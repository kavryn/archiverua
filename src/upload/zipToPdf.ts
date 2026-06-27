import {
  BlobReader,
  Uint8ArrayWriter,
  ZipReader,
  type Entry,
  configure,
} from "@zip.js/zip.js";

configure({ useWebWorkers: false });

const TMP_PREFIX = "ziptmp-";

export const PREVIEW_LIMIT = 10;

export type ZipConversionProgress = {
  phase: "validating" | "converting";
  currentEntry: number;
  totalEntries: number;
  currentName: string;
};

// How many example names to show before collapsing the rest into "та ще N".
const INVALID_EXAMPLE_LIMIT = 4;

function basenameOf(name: string): string {
  return name.split(/[\\/]/).pop() || name;
}

// Ukrainian plural for "файл": 1 → файл, 2–4 → файли, 5+/11–14 → файлів.
function fileWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "файл";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "файли";
  return "файлів";
}

// ZIP entries whose filenames lack the UTF-8 flag get decoded with a legacy
// codepage, so non-Latin names (e.g. Cyrillic folders) come through as garbled
// runs like "╤ä╨▓╤û╨░". We can't reliably recover the original, so collapse any
// run of characters that aren't plausible filename glyphs into a single "?".
function sanitizeForDisplay(name: string): string {
  return name.replace(/[^\p{L}\p{N}\s._()[\]{}'`!&+,/\\-]+/gu, "?");
}

function listExamples(names: string[], fullPath = false): string {
  const shown = names
    .slice(0, INVALID_EXAMPLE_LIMIT)
    .map((n) => sanitizeForDisplay(fullPath ? n : basenameOf(n)));
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} та ще ${rest}` : shown.join(", ");
}

function buildValidationMessage(
  emptyArchive: boolean,
  nested: string[],
  badFormat: string[],
): string {
  if (emptyArchive) {
    return "ZIP-архів порожній або не містить зображень.";
  }

  const parts: string[] = [];

  if (badFormat.length > 0) {
    parts.push(
      `Не вдалося додати ${badFormat.length} ${fileWord(badFormat.length)} із ZIP-архіву — підтримуються лише формати JPEG та PNG. ` +
        `Відхилено: ${listExamples(badFormat)}.`,
    );
  }

  if (nested.length > 0) {
    parts.push(
      `Не вдалося додати ${nested.length} ${fileWord(nested.length)} із ZIP-архіву — усі зображення мають лежати ` +
        `в одній папці (або в корені архіву), без вкладених підпапок. ` +
        `Відхилено: ${listExamples(nested, true)}.`,
    );
  }

  return parts.join("\n\n");
}

export class ZipValidationError extends Error {
  constructor(
    public readonly invalidEntries: string[],
    public readonly emptyArchive: boolean,
    nested: string[] = [],
    badFormat: string[] = invalidEntries,
  ) {
    super(buildValidationMessage(emptyArchive, nested, badFormat));
    this.name = "ZipValidationError";
  }
}

function hasNestedPath(name: string): boolean {
  return name.includes("/") || name.includes("\\");
}

function isAcceptableImageName(name: string): boolean {
  if (hasNestedPath(name)) return false;
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

// OPFS is shared across all tabs of the same origin, so cleanupStaleTmpFiles
// (run when any wizard mounts) must not delete a tmp file another tab is still
// uploading. We coordinate via the Web Locks API — also origin-scoped: each
// tab holds an exclusive lock for the lifetime of each tmp file it owns, and
// cleanup probes with { ifAvailable: true } to skip files still locked
// elsewhere. Locks auto-release when a tab is closed, so files left by a
// crashed session are correctly seen as orphaned and removed.
// A lock grant is asynchronous, but releaseTmpFileLock may run before the grant
// callback fires. So the entry is registered synchronously at acquire time and
// carries a `released` flag: if release wins the race, the grant callback sees
// it and lets go immediately instead of leaking the lock until tab close.
type LockEntry = { resolve?: () => void; released: boolean };
const lockReleasers = new Map<string, LockEntry>();

function lockNameFor(opfsName: string): string {
  return `ziptmp-lock:${opfsName}`;
}

// Exported for tests — the cross-tab primitives behind cleanupStaleTmpFiles.
export function acquireTmpFileLock(opfsName: string): void {
  if (!navigator.locks?.request) return;
  const name = lockNameFor(opfsName);
  const entry: LockEntry = { released: false };
  lockReleasers.set(name, entry);
  navigator.locks
    .request(
      name,
      () =>
        new Promise<void>((resolve) => {
          // Release may have already happened before the lock was granted.
          if (entry.released) resolve();
          else entry.resolve = resolve;
        }),
    )
    .catch(() => undefined)
    .finally(() => {
      // Forget the entry once the lock is gone, unless a later re-acquire of
      // the same name has already replaced it.
      if (lockReleasers.get(name) === entry) lockReleasers.delete(name);
    });
}

export function releaseTmpFileLock(opfsName: string): void {
  const entry = lockReleasers.get(lockNameFor(opfsName));
  if (!entry) return;
  entry.released = true;
  entry.resolve?.();
}

// True only if no context currently holds this file's lock (safe to delete).
// When Web Locks is unavailable we stay conservative and report "locked" so
// cleanup never deletes a file that might be in use by another tab.
async function isTmpFileUnlocked(opfsName: string): Promise<boolean> {
  if (!navigator.locks?.request) return false;
  return await navigator.locks.request(
    lockNameFor(opfsName),
    { ifAvailable: true },
    (lock) => lock !== null,
  );
}

export async function cleanupStaleTmpFiles(): Promise<void> {
  try {
    const root = await getOpfsRoot();
    // @ts-expect-error — iterator API not yet in TS lib
    for await (const [name] of root.entries() as AsyncIterable<[string, FileSystemHandle]>) {
      if (name.startsWith(TMP_PREFIX) && (await isTmpFileUnlocked(name))) {
        await root.removeEntry(name).catch(() => undefined);
      }
    }
  } catch {
    // ignore — best-effort
  }
}

export async function removeOpfsFile(name: string): Promise<void> {
  releaseTmpFileLock(name);
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
  const nested: string[] = [];
  const badFormat: string[] = [];

  for (const entry of nonJunk) {
    const effectiveName = prefix && entry.filename.startsWith(prefix)
      ? entry.filename.slice(prefix.length)
      : entry.filename;
    if (effectiveName === "") continue; // the folder entry itself
    if (hasNestedPath(effectiveName)) {
      nested.push(entry.filename);
      continue;
    }
    if (!isAcceptableImageName(effectiveName)) {
      badFormat.push(entry.filename);
      continue;
    }
    entries.push({ entry, effectiveName });
  }

  const invalid = [...badFormat, ...nested];
  if (invalid.length > 0 || entries.length === 0) {
    await reader.close().catch(() => undefined);
    throw new ZipValidationError(
      invalid,
      entries.length === 0 && invalid.length === 0,
      nested,
      badFormat,
    );
  }

  entries.sort((a, b) => compareEntriesNaturally(a.effectiveName, b.effectiveName));
  return { entries, reader };
}

export type ZipConversionResult = {
  file: File;
  opfsName: string;
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

// The output PDF is always at least the sum of the embedded images: PDFKit
// stores JPEGs verbatim and re-zlib-compresses PNGs, on top of the PDF
// structure. So the sum of decompressed image sizes is a safe lower bound to
// check the browser storage bucket against — we don't try to guess the exact
// final size, just refuse when even this lower bound won't fit.
export function estimatePdfSize(
  entries: { entry: Pick<Entry, "uncompressedSize" | "compressedSize"> }[],
): number {
  return entries.reduce(
    (sum, { entry }) => sum + (entry.uncompressedSize || entry.compressedSize || 0),
    0,
  );
}

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} ГБ`;
  return `${Math.round(n / 1024 ** 2)} МБ`;
}

export class StorageQuotaError extends Error {
  constructor(
    public readonly requiredBytes: number,
    public readonly availableBytes: number,
  ) {
    super(
      `Цей архів завеликий, щоб перетворити його на PDF у браузері — потрібно щонайменше ` +
        `~${formatBytes(requiredBytes)}, а у сховищі браузера доступно лише ~${formatBytes(availableBytes)}. ` +
        `Перетворіть ZIP на PDF самостійно за допомогою іншої програми та завантажте готовий PDF.`,
    );
    this.name = "StorageQuotaError";
  }
}

// Pre-flight: refuse early with a clear message if the origin's storage bucket
// can't hold the resulting PDF, instead of writing partway and surfacing an
// opaque QuotaExceededError mid-conversion. Best-effort: when the Storage API
// or quota figure is unavailable we stay out of the way and let the real write
// surface any genuine failure.
export async function ensureStorageForPdf(estimatedBytes: number): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
  let estimate: StorageEstimate;
  try {
    estimate = await navigator.storage.estimate();
  } catch {
    return;
  }
  const quota = estimate.quota ?? 0;
  if (quota === 0) return;
  const available = quota - (estimate.usage ?? 0);
  if (estimatedBytes > available) {
    throw new StorageQuotaError(estimatedBytes, available);
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

  // Bail out before touching OPFS if the PDF clearly won't fit.
  try {
    await ensureStorageForPdf(estimatePdfSize(entries));
  } catch (err) {
    await reader.close().catch(() => undefined);
    throw err;
  }

  const root = await getOpfsRoot();
  const opfsName = `${TMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  // Lock the tmp file before any other tab can reach it via cleanup. Held
  // until removeOpfsFile (success path) or the catch below (failure path).
  acquireTmpFileLock(opfsName);
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

    // Preview rendering is deferred to the caller so a slow pdf.js pass on
    // a large PDF doesn't gate the "Continue" button. See useUploadWizard.
    return {
      file: pdfFile,
      opfsName,
      totalPages: total,
    };
  } catch (err) {
    await reader.close().catch(() => undefined);
    releaseTmpFileLock(opfsName);
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

