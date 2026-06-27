import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BlobWriter,
  Uint8ArrayReader,
  ZipWriter,
} from "@zip.js/zip.js";
import {
  compareEntriesNaturally,
  ensureStorageForPdf,
  estimatePdfSize,
  StorageQuotaError,
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

  it("reports an unsupported-format rejection with examples", async () => {
    const zip = await makeZip({
      "page1.png": PNG_1x1,
      "IMG_1.HEIC": new TextEncoder().encode("x"),
    });
    const err = await validateZip(zip).catch((e) => e);
    expect(err).toBeInstanceOf(ZipValidationError);
    expect(err.message).toContain("Не вдалося додати 1 файл із ZIP-архіву");
    expect(err.message).toContain("лише формати JPEG та PNG");
    expect(err.message).toContain("Відхилено: IMG_1.HEIC");
  });

  it("reports a nested-folder rejection with full paths", async () => {
    const zip = await makeZip({
      "page1.png": PNG_1x1,
      "a/page2.png": PNG_1x1,
      "b/page3.png": PNG_1x1,
    });
    const err = await validateZip(zip).catch((e) => e);
    expect(err).toBeInstanceOf(ZipValidationError);
    expect(err.message).toContain("Не вдалося додати 2 файли із ZIP-архіву");
    expect(err.message).toContain("вкладених підпапок");
    // Nested examples keep the full path, not just the basename.
    expect(err.message).toContain("a/page2.png");
    expect(err.message).toContain("b/page3.png");
  });
});

describe("ZipValidationError message", () => {
  const badFor = (names: string[]) => new ZipValidationError(names, false, [], names);

  it("uses Ukrainian plural agreement for файл", () => {
    expect(badFor(["a.x"]).message).toContain("1 файл із");
    expect(badFor(["a.x", "b.x", "c.x"]).message).toContain("3 файли із");
    expect(badFor(Array.from({ length: 5 }, (_, i) => `f${i}.x`)).message).toContain(
      "5 файлів із",
    );
    expect(badFor(Array.from({ length: 11 }, (_, i) => `f${i}.x`)).message).toContain(
      "11 файлів із",
    );
    expect(badFor(Array.from({ length: 21 }, (_, i) => `f${i}.x`)).message).toContain(
      "21 файл із",
    );
  });

  it("collapses long lists to a few examples plus a count", () => {
    const names = Array.from({ length: 596 }, (_, i) => `IMG_${i}.HEIC`);
    const msg = badFor(names).message;
    expect(msg).toContain("Відхилено: IMG_0.HEIC, IMG_1.HEIC, IMG_2.HEIC, IMG_3.HEIC та ще 592.");
  });

  it("replaces garbled non-UTF-8 filename runs with ?", () => {
    const msg = new ZipValidationError(
      ["╤ä╨▓╤û╨░/IMG_1.HEIC"],
      false,
      ["╤ä╨▓╤û╨░/IMG_1.HEIC"],
      [],
    ).message;
    // Nested examples show the full path; box-drawing runs collapse to "?".
    expect(msg).not.toContain("╤");
    expect(msg).not.toContain("╨");
    expect(msg).toContain("?");
    expect(msg).toContain("/IMG_1.HEIC");
  });

  it("reports an empty archive", () => {
    expect(new ZipValidationError([], true).message).toContain("порожній");
  });
});

describe("estimatePdfSize", () => {
  it("sums the decompressed image sizes", () => {
    expect(
      estimatePdfSize([
        { entry: { uncompressedSize: 1000, compressedSize: 400 } },
        { entry: { uncompressedSize: 2000, compressedSize: 800 } },
      ]),
    ).toBe(3000);
  });

  it("falls back to compressedSize when the uncompressed size is unknown", () => {
    expect(
      estimatePdfSize([{ entry: { uncompressedSize: 0, compressedSize: 500 } }]),
    ).toBe(500);
  });
});

describe("ensureStorageForPdf", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage(estimate: { quota?: number; usage?: number } | null) {
    vi.stubGlobal("navigator", {
      storage: estimate === null ? undefined : { estimate: async () => estimate },
    });
  }

  it("throws StorageQuotaError when the estimate exceeds available space", async () => {
    stubStorage({ quota: 1000, usage: 900 }); // 100 free, need 101
    await expect(ensureStorageForPdf(101)).rejects.toBeInstanceOf(StorageQuotaError);
  });

  it("passes when the estimate fits in the available space", async () => {
    stubStorage({ quota: 1000, usage: 900 }); // 100 free, need exactly 100
    await expect(ensureStorageForPdf(100)).resolves.toBeUndefined();
  });

  it("is a no-op when the Storage API is unavailable", async () => {
    stubStorage(null);
    await expect(ensureStorageForPdf(10 ** 12)).resolves.toBeUndefined();
  });

  it("is a no-op when the quota figure is unknown", async () => {
    stubStorage({ usage: 0 });
    await expect(ensureStorageForPdf(10 ** 12)).resolves.toBeUndefined();
  });

  it("ignores a failing estimate() rather than blocking conversion", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => {
          throw new Error("boom");
        },
      },
    });
    await expect(ensureStorageForPdf(10 ** 12)).resolves.toBeUndefined();
  });
});

describe("StorageQuotaError message", () => {
  it("names the required and available space and suggests converting elsewhere", () => {
    const msg = new StorageQuotaError(2 * 1024 ** 3, 500 * 1024 ** 2).message;
    expect(msg).toBe(
      "Цей архів завеликий, щоб перетворити його на PDF у браузері — потрібно щонайменше " +
        "~2.0 ГБ, а у сховищі браузера доступно лише ~500 МБ. " +
        "Перетворіть ZIP на PDF самостійно за допомогою іншої програми та завантажте готовий PDF.",
    );
  });
});
