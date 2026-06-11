import { describe, it, expect } from "vitest";
import {
  BlobWriter,
  Uint8ArrayReader,
  ZipWriter,
} from "@zip.js/zip.js";
import {
  compareEntriesNaturally,
  validateZip,
  ZipValidationError,
} from "@/upload/zipToPdf";
import sharp from "sharp";

async function encodePng(width: number, height: number): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

const PNG_1x1 = await encodePng(1, 1);

async function makeZip(files: Record<string, Uint8Array>): Promise<File> {
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
  for (const [name, bytes] of Object.entries(files)) {
    await zipWriter.add(name, new Uint8ArrayReader(bytes));
  }
  const blob = await zipWriter.close();
  return new File([blob], "test.zip", { type: "application/zip" });
}

describe("compareEntriesNaturally", () => {
  it("sorts page1, page2, page10 in numeric order", () => {
    const sorted = ["page10.jpg", "page1.jpg", "page2.jpg"].sort(compareEntriesNaturally);
    expect(sorted).toEqual(["page1.jpg", "page2.jpg", "page10.jpg"]);
  });

  it("is case-insensitive", () => {
    expect(compareEntriesNaturally("A.jpg", "b.jpg")).toBeLessThan(0);
  });
});

describe("validateZip", () => {
  it("accepts a zip of only jpg/png files", async () => {
    const zip = await makeZip({
      "page1.png": PNG_1x1,
      "page2.png": PNG_1x1,
    });
    const { entries, reader } = await validateZip(zip);
    expect(entries.map((e) => e.effectiveName)).toEqual(["page1.png", "page2.png"]);
    await reader.close();
  });

  it("sorts entries naturally", async () => {
    const zip = await makeZip({
      "page10.png": PNG_1x1,
      "page1.png": PNG_1x1,
      "page2.png": PNG_1x1,
    });
    const { entries, reader } = await validateZip(zip);
    expect(entries.map((e) => e.effectiveName)).toEqual([
      "page1.png",
      "page2.png",
      "page10.png",
    ]);
    await reader.close();
  });

  it("rejects entries with nested folders", async () => {
    const zip = await makeZip({
      "page1.png": PNG_1x1,
      "sub/page2.png": PNG_1x1,
    });
    await expect(validateZip(zip)).rejects.toBeInstanceOf(ZipValidationError);
  });

  it("rejects entries with non-image extensions", async () => {
    const zip = await makeZip({
      "page1.png": PNG_1x1,
      "notes.txt": new TextEncoder().encode("hello"),
    });
    await expect(validateZip(zip)).rejects.toBeInstanceOf(ZipValidationError);
  });

  it("ignores __MACOSX and dotfiles", async () => {
    const zip = await makeZip({
      "__MACOSX/page1.png": new TextEncoder().encode("garbage"),
      ".DS_Store": new TextEncoder().encode("garbage"),
      "page1.png": PNG_1x1,
    });
    const { entries, reader } = await validateZip(zip);
    expect(entries.map((e) => e.effectiveName)).toEqual(["page1.png"]);
    await reader.close();
  });

  it("transparently strips a single top-level folder", async () => {
    const zip = await makeZip({
      "scans/page1.png": PNG_1x1,
      "scans/page2.png": PNG_1x1,
      "scans/page10.png": PNG_1x1,
    });
    const { entries, reader } = await validateZip(zip);
    expect(entries.map((e) => e.effectiveName)).toEqual([
      "page1.png",
      "page2.png",
      "page10.png",
    ]);
    // Original entry path is preserved for getData
    expect(entries[0].entry.filename).toBe("scans/page1.png");
    await reader.close();
  });

  it("rejects when files are spread across multiple top-level folders", async () => {
    const zip = await makeZip({
      "a/page1.png": PNG_1x1,
      "b/page2.png": PNG_1x1,
    });
    await expect(validateZip(zip)).rejects.toBeInstanceOf(ZipValidationError);
  });

  it("rejects an empty zip", async () => {
    const zip = await makeZip({});
    await expect(validateZip(zip)).rejects.toBeInstanceOf(ZipValidationError);
  });
});
