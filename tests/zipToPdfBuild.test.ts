import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { buildPdfFromImages, type ImageSource, type PdfWriter } from "@/upload/zipToPdf";

async function encodePng(width: number, height: number): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

async function encodeJpeg(
  width: number,
  height: number,
  orientation: number = 1,
): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .withMetadata({ orientation })
    .jpeg()
    .toBuffer();
  return new Uint8Array(buf);
}

function makeMemoryWriter(): { writer: PdfWriter; getBytes: () => Uint8Array } {
  const chunks: Uint8Array[] = [];
  return {
    writer: {
      write: async (chunk) => {
        chunks.push(new Uint8Array(chunk));
      },
      close: async () => undefined,
    },
    getBytes: () => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      return out;
    },
  };
}

function source(name: string, bytes: Uint8Array): ImageSource {
  return { name, getBytes: async () => bytes };
}

describe("buildPdfFromImages", () => {
  it("produces a valid PDF with one page per image (orientation 1)", async () => {
    const png = await encodePng(1, 1);
    const { writer, getBytes } = makeMemoryWriter();
    await buildPdfFromImages(
      [source("a.png", png), source("b.png", png), source("c.png", png)],
      writer,
    );

    const pdfBytes = getBytes();
    expect(new TextDecoder().decode(pdfBytes.slice(0, 5))).toBe("%PDF-");

    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(3);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      expect(width).toBe(1);
      expect(height).toBe(1);
    }
  });

  it("preserves PNG page dimensions", async () => {
    const { writer, getBytes } = makeMemoryWriter();
    await buildPdfFromImages([source("a.png", await encodePng(40, 25))], writer);
    const pdf = await PDFDocument.load(getBytes());
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBe(40);
    expect(height).toBe(25);
  });

  it("preserves JPEG page dimensions when orientation is normal", async () => {
    const { writer, getBytes } = makeMemoryWriter();
    await buildPdfFromImages([source("a.jpg", await encodeJpeg(40, 25))], writer);
    const pdf = await PDFDocument.load(getBytes());
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBe(40);
    expect(height).toBe(25);
  });

  it("swaps page dimensions for JPEG with EXIF orientation 6 (90° CW)", async () => {
    const jpeg = await encodeJpeg(40, 25, 6);
    const { writer, getBytes } = makeMemoryWriter();
    await buildPdfFromImages([source("rot6.jpg", jpeg)], writer);
    const pdf = await PDFDocument.load(getBytes());
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBe(25);
    expect(height).toBe(40);
  });

  it("swaps page dimensions for JPEG with EXIF orientation 8 (90° CCW)", async () => {
    const jpeg = await encodeJpeg(40, 25, 8);
    const { writer, getBytes } = makeMemoryWriter();
    await buildPdfFromImages([source("rot8.jpg", jpeg)], writer);
    const pdf = await PDFDocument.load(getBytes());
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBe(25);
    expect(height).toBe(40);
  });

  it("keeps page dimensions for JPEG with EXIF orientation 3 (180°)", async () => {
    const jpeg = await encodeJpeg(40, 25, 3);
    const { writer, getBytes } = makeMemoryWriter();
    await buildPdfFromImages([source("rot3.jpg", jpeg)], writer);
    const pdf = await PDFDocument.load(getBytes());
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBe(40);
    expect(height).toBe(25);
  });

  it("calls onPageDone for each image", async () => {
    const png = await encodePng(1, 1);
    const { writer } = makeMemoryWriter();
    const calls: Array<[number, number, string]> = [];
    await buildPdfFromImages([source("x.png", png), source("y.png", png)], writer, {
      onPageDone: (i, total, name) => calls.push([i, total, name]),
    });
    expect(calls).toEqual([
      [1, 2, "x.png"],
      [2, 2, "y.png"],
    ]);
  });

  it("aborts mid-pipeline when signal is triggered", async () => {
    const controller = new AbortController();
    const { writer } = makeMemoryWriter();
    let calls = 0;
    const png = await encodePng(1, 1);
    const slow = (name: string): ImageSource => ({
      name,
      getBytes: async () => {
        calls++;
        if (calls === 2) controller.abort();
        return png;
      },
    });
    await expect(
      buildPdfFromImages([slow("a.png"), slow("b.png"), slow("c.png")], writer, {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(calls).toBeLessThan(3);
  });
});
