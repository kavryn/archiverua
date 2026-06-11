// Lazy PDF page rendering for the upload-wizard preview UI. Both thumbnails
// and full-resolution lightbox views are produced from the generated PDF
// (the artifact actually uploaded to Commons), not from the source ZIP.

import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

export const PREVIEW_THUMB_MAX_DIM = 240;
export const PREVIEW_FULL_MAX_DIM = 1600;

export type PdfThumb = {
  url: string;
  name: string;
  width: number;
  height: number;
};

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

async function loadPdfJs(): Promise<PdfJs> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    const pdfjs = await import(/* webpackChunkName: "pdfjs" */ "pdfjs-dist");
    // Worker URL resolved at build time so the bundler emits the worker chunk
    // alongside the main pdf.js chunk.
    const workerUrl = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })();
  return pdfjsPromise;
}

type OpenedPdf = {
  doc: PDFDocumentProxy;
  dispose: () => Promise<void>;
};

async function openPdf(file: File): Promise<OpenedPdf> {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  return {
    doc,
    dispose: () => loadingTask.destroy(),
  };
}

async function renderPageToBlob(
  page: PDFPageProxy,
  maxDim: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const baseViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(baseViewport.width, baseViewport.height);
  const scale = longestSide > 0 ? maxDim / longestSide : 1;
  const viewport = page.getViewport({ scale });
  const width = Math.max(1, Math.floor(viewport.width));
  const height = Math.max(1, Math.floor(viewport.height));

  let blob: Blob;
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не вдалося отримати 2D-контекст");
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas: canvas as unknown as HTMLCanvasElement }).promise;
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не вдалося отримати 2D-контекст");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.8,
      );
    });
  }
  return { blob, width, height };
}

// Extracted so the URL-creation invariant ("every minted URL must be
// revoked if the loop fails") is testable without spinning up pdf.js
// and a real canvas. `renderPage` is the only side-effectful seam.
export async function renderThumbsLoop(
  count: number,
  renderPage: (i: number) => Promise<{ blob: Blob; width: number; height: number }>,
  signal?: AbortSignal,
): Promise<PdfThumb[]> {
  const thumbs: PdfThumb[] = [];
  try {
    for (let i = 1; i <= count; i++) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const { blob, width, height } = await renderPage(i);
      thumbs.push({
        url: URL.createObjectURL(blob),
        name: `Сторінка ${i}`,
        width,
        height,
      });
    }
    return thumbs;
  } catch (err) {
    revokeThumbUrls(thumbs);
    throw err;
  }
}

export async function renderPdfThumbnails(
  pdfFile: File,
  limit: number,
  signal?: AbortSignal,
): Promise<{ thumbs: PdfThumb[]; totalPages: number }> {
  const { doc, dispose } = await openPdf(pdfFile);
  try {
    const totalPages = doc.numPages;
    const count = Math.min(limit, totalPages);
    const thumbs = await renderThumbsLoop(
      count,
      async (i) => {
        const page = await doc.getPage(i);
        try {
          return await renderPageToBlob(page, PREVIEW_THUMB_MAX_DIM);
        } finally {
          await page.cleanup();
        }
      },
      signal,
    );
    return { thumbs, totalPages };
  } finally {
    await dispose();
  }
}

export async function renderPdfPageBlob(
  pdfFile: File,
  pageIndex: number,
): Promise<Blob> {
  const { doc, dispose } = await openPdf(pdfFile);
  try {
    const page = await doc.getPage(pageIndex + 1);
    try {
      const { blob } = await renderPageToBlob(page, PREVIEW_FULL_MAX_DIM);
      return blob;
    } finally {
      await page.cleanup();
    }
  } finally {
    await dispose();
  }
}

export function revokeThumbUrls(thumbs: readonly PdfThumb[]): void {
  for (const t of thumbs) URL.revokeObjectURL(t.url);
}
