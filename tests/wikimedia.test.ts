import { describe, expect, it } from "vitest";
import { DuplicateFileError, throwOnUploadWarnings } from "@/lib/wikimedia";

describe("throwOnUploadWarnings", () => {
  it("ignores an empty warnings object", () => {
    expect(() => throwOnUploadWarnings({})).not.toThrow();
  });

  it("ignores empty warning arrays", () => {
    expect(() => throwOnUploadWarnings({ duplicate: [] })).not.toThrow();
  });

  it("throws DuplicateFileError for duplicate warnings", () => {
    expect(() => throwOnUploadWarnings({ duplicate: ["Existing.pdf"] })).toThrow(DuplicateFileError);
  });

  it("throws a mapped message for named upload warnings", () => {
    expect(() => throwOnUploadWarnings({ badfilename: "Bad filename" })).toThrow(
      "Некоректна назва файлу"
    );
  });

  it("falls back to the warning key for unknown warnings", () => {
    expect(() => throwOnUploadWarnings({ weirdwarning: true })).toThrow(
      "Помилка при завантаженні: weirdwarning"
    );
  });
});
