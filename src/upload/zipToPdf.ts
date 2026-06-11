import {
  BlobReader,
  Uint8ArrayWriter,
  ZipReader,
  type Entry,
  configure,
} from "@zip.js/zip.js";

import { renderPdfThumbnails, type PdfThumb } from "./pdfPreview";

configure({ useWebWorkers: false });

const TMP_PREFIX = "ziptmp-";

export const PREVIEW_LIMIT = 10;

export type ZipConversionProgress = {
  phase: "validating" | "converting";
  currentEntry: number;
  totalEntries: number;
  currentName: string;
};

export class ZipValidationError extends Error {
  constructor(
    public readonly invalidEntries: string[],
    public readonly emptyArchive: boolean,
  ) {
    super(
      emptyArchive
        ? "ZIP-архів порожній"
        : `ZIP містить файли, що не є JPEG/PNG, або вкладені папки: ${invalidEntries.join(", ")}`,
    );
    this.name = "ZipValidationError";
  }
}

function isAcceptableImageName(name: string): boolean {
  if (name.includes("/") || name.includes("\\")) return false;
  const lower = name.toLowerCase();
  return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
}

function shouldIgnoreEntry(entry: Entry): boolean {
  if (entry.directory) return true;
  const name = entry.filename;
  if (name.startsWith("__MACOSX/") || name.startsWith("__MACOSX\\")) return true;
  const base = name.split(/[\\/]/).pop() ?? name;
  if (base === ".DS_Store" || base === "Thumbs.db" || base.startsWith("._")) return true;
  return false;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareEntriesNaturally(a: string, b: string): number {
  return collator.compare(a, b);
}

// Minimal sink interface — lets the PDF builder write to OPFS in production
// and to an in-memory buffer in tests, without depending on FileSystem APIs.
export interface PdfWriter {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

async function pumpDocumentToWriter(
  doc: PdfKitDoc,
  writer: PdfWriter,
  signal: AbortSignal | undefined,
): Promise<void> {
  let pending: Promise<void> = Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });

    doc.on("data", (chunk: Uint8Array) => {
      // Copy into a fresh ArrayBuffer-backed Uint8Array so the writer accepts it.
      const copy = new Uint8Array(chunk);
      pending = pending.then(() => writer.write(copy));
      pending.catch(reject);
    });
    doc.on("error", reject);
    doc.on("end", () => {
      pending.then(resolve, reject);
    });
  });
}

async function loadPdfKit(): Promise<new (opts?: object) => PdfKitDoc> {
  const mod = await import(
    /* webpackChunkName: "pdfkit" */ "pdfkit/js/pdfkit.standalone.js"
  );
  const PDFDocument = (mod as { default?: unknown }).default ?? mod;
  return PDFDocument as new (opts?: object) => PdfKitDoc;
}

type PdfKitDocEvent = "data" | "end" | "error";
type PdfKitImage = { width: number; height: number; orientation: number };
type PdfKitDoc = {
  on(ev: PdfKitDocEvent, cb: (arg: never) => void): void;
  addPage(opts: { size: [number, number]; margin: number }): PdfKitDoc;
  openImage(src: ArrayBuffer): PdfKitImage;
  image(src: PdfKitImage, x: number, y: number): PdfKitDoc;
  end(): void;
};

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    throw new Error("OPFS недоступний у цьому браузері. Спробуйте Chrome, Firefox або Safari новішої версії.");
  }
  return await navigator.storage.getDirectory();
}

export async function cleanupStaleTmpFiles(): Promise<void> {
  try {
    const root = await getOpfsRoot();
    // @ts-expect-error — iterator API not yet in TS lib
    for await (const [name] of root.entries() as AsyncIterable<[string, FileSystemHandle]>) {
      if (name.startsWith(TMP_PREFIX)) {
        await root.removeEntry(name).catch(() => undefined);
      }
    }
  } catch {
    // ignore — best-effort
  }
}

export async function removeOpfsFile(name: string): Promise<void> {
  try {
    const root = await getOpfsRoot();
    await root.removeEntry(name);
  } catch {
    // ignore — best-effort
  }
}

function findSingleFolderPrefix(names: string[]): string | null {
  if (names.length === 0) return null;
  const first = names[0];
  const slashIdx = first.indexOf("/");
  if (slashIdx === -1) return null;
  const candidate = first.slice(0, slashIdx + 1);
  for (const name of names) {
    if (!name.startsWith(candidate)) return null;
  }
  return candidate;
}

export async function validateZip(
  zipFile: File,
): Promise<{ entries: { entry: Entry; effectiveName: string }[]; reader: ZipReader<unknown> }> {
  const reader = new ZipReader(new BlobReader(zipFile));
  const allEntries = await reader.getEntries();
  const nonJunk = allEntries.filter((e) => !shouldIgnoreEntry(e));

  // If every non-junk file lives under one top-level folder, transparently strip it.
  const prefix = findSingleFolderPrefix(nonJunk.map((e) => e.filename));

  const entries: { entry: Entry; effectiveName: string }[] = [];
  const invalid: string[] = [];

  for (const entry of nonJunk) {
    const effectiveName = prefix && entry.filename.startsWith(prefix)
      ? entry.filename.slice(prefix.length)
      : entry.filename;
    if (effectiveName === "") continue; // the folder entry itself
    if (!isAcceptableImageName(effectiveName)) {
      invalid.push(entry.filename);
      continue;
    }
    entries.push({ entry, effectiveName });
  }

  if (invalid.length > 0 || entries.length === 0) {
    await reader.close().catch(() => undefined);
    throw new ZipValidationError(invalid, entries.length === 0 && invalid.length === 0);
  }

  entries.sort((a, b) => compareEntriesNaturally(a.effectiveName, b.effectiveName));
  return { entries, reader };
}

export type ZipConversionResult = {
  file: File;
  opfsName: string;
  previews: PdfThumb[];
  totalPages: number;
};

export function pdfNameForZip(zipName: string): string {
  return zipName.replace(/\.zip$/i, "") + ".pdf";
}

export type ImageSource = {
  name: string;
  getBytes: (signal?: AbortSignal) => Promise<Uint8Array>;
};

// Pure PDF-building core: takes a sequence of image sources and pumps the
// resulting PDF bytes to a writer. No ZIP, no OPFS — tests can drive this
// directly with an in-memory writer.
export async function buildPdfFromImages(
  images: ImageSource[],
  writer: PdfWriter,
  options: {
    signal?: AbortSignal;
    onPageDone?: (index: number, total: number, name: string) => void;
  } = {},
): Promise<void> {
  const { signal, onPageDone } = options;
  const PDFDocument = await loadPdfKit();
  const doc = new PDFDocument({ autoFirstPage: false });
  const streamPromise = pumpDocumentToWriter(doc, writer, signal);
  // Pre-attach a no-op handler so an early abort doesn't surface as an
  // unhandled rejection while we're still in the main loop.
  streamPromise.catch(() => undefined);

  try {
    for (let i = 0; i < images.length; i++) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");

      const src = images[i];
      const bytes = await src.getBytes(signal);
      // PDFKit's image()/openImage() check Buffer.isBuffer first, then
      // ArrayBuffer; a plain Uint8Array falls through to fs.readFileSync. Pass
      // the underlying buffer.
      const ab = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const img = doc.openImage(ab);
      // PDFKit honors JPEG EXIF Orientation internally when drawing: it
      // swaps the image's internal dimensions and rotates the placement.
      // We only need the page to match the *displayed* dimensions, which
      // are the swapped ones for orientations 5–8.
      const sideways = img.orientation > 4;
      const pageW = sideways ? img.height : img.width;
      const pageH = sideways ? img.width : img.height;
      doc.addPage({ size: [pageW, pageH], margin: 0 });
      doc.image(img, 0, 0);
      onPageDone?.(i + 1, images.length, src.name);
    }

    doc.end();
    await streamPromise;
  } finally {
    await writer.close().catch(() => undefined);
  }
}

export async function convertZipToPdf(
  zipFile: File,
  onProgress: (p: ZipConversionProgress) => void,
  signal?: AbortSignal,
): Promise<ZipConversionResult> {
  onProgress({ phase: "validating", currentEntry: 0, totalEntries: 0, currentName: "" });

  const { entries, reader } = await validateZip(zipFile);
  const total = entries.length;
  onProgress({ phase: "validating", currentEntry: 0, totalEntries: total, currentName: "" });

  const root = await getOpfsRoot();
  const opfsName = `${TMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const handle = await root.getFileHandle(opfsName, { create: true });
  const writer = createOpfsWriter(await handle.createWritable());

  const images: ImageSource[] = entries.map(({ entry, effectiveName }) => ({
    name: effectiveName,
    getBytes: async (sig) => {
      if (!("getData" in entry) || !entry.getData) {
        throw new Error(`ZIP entry missing data: ${entry.filename}`);
      }
      return await entry.getData(new Uint8ArrayWriter(), { signal: sig });
    },
  }));

  try {
    await buildPdfFromImages(images, writer, {
      signal,
      onPageDone: (currentEntry, totalEntries, currentName) =>
        onProgress({ phase: "converting", currentEntry, totalEntries, currentName }),
    });
    await reader.close().catch(() => undefined);

    const file = await handle.getFile();
    const pdfName = pdfNameForZip(zipFile.name);
    const pdfFile = new File([file], pdfName, { type: "application/pdf" });

    // Previews come from the generated PDF — the artifact actually uploaded
    // to Commons — so what the user sees IS what gets uploaded. A preview
    // failure must not poison the otherwise-valid conversion result.
    let previews: PdfThumb[] = [];
    let pdfPages = total;
    try {
      const rendered = await renderPdfThumbnails(pdfFile, PREVIEW_LIMIT, signal);
      previews = rendered.thumbs;
      pdfPages = rendered.totalPages;
    } catch (previewErr) {
      if (signal?.aborted) throw previewErr;
      // Swallow: user still gets a valid PDF without thumbnails.
    }

    return {
      file: pdfFile,
      opfsName,
      previews,
      totalPages: pdfPages,
    };
  } catch (err) {
    await reader.close().catch(() => undefined);
    await root.removeEntry(opfsName).catch(() => undefined);
    throw err;
  }
}

function createOpfsWriter(stream: FileSystemWritableFileStream): PdfWriter {
  let closed = false;
  return {
    write: (chunk) => stream.write(chunk as Uint8Array<ArrayBuffer>),
    close: async () => {
      if (closed) return;
      closed = true;
      await stream.close();
    },
  };
}

