import { describe, expect, it } from "vitest";
import {
  normalizeFond,
  normalizeOpysSprava,
  parseArchivalReferenceFromFileName,
} from "@/upload/archivalReference";
import { makeEntry } from "@/upload/types";

describe("normalizeFond", () => {
  it('changes "р203" to "Р-203"', () => {
    expect(normalizeFond("р203")).toBe("Р-203");
  });

  it("removes spaces before normalizing", () => {
    expect(normalizeFond(" р 203 ")).toBe("Р-203");
  });
});

describe("normalizeOpysSprava", () => {
  it('changes "4-А" to "4а"', () => {
    expect(normalizeOpysSprava("4-А")).toBe("4а");
  });

  it("removes spaces and hyphens before lowercasing", () => {
    expect(normalizeOpysSprava(" 4 - А ")).toBe("4а");
  });
});

describe("parseArchivalReferenceFromFileName", () => {
  it("parses archival references with a numeric fond", () => {
    expect(parseArchivalReferenceFromFileName("ЦДІАЛ 201-4а-348.pdf")).toMatchObject({
      archive: { abbr: "ЦДІАЛ" },
      fond: "201",
      opys: "4а",
      sprava: "348",
    });
  });

  it("parses archival references with a prefixed fond", () => {
    expect(parseArchivalReferenceFromFileName("ДАТО Р-234-4-38а.djvu")).toMatchObject({
      archive: { abbr: "ДАТО" },
      fond: "Р-234",
      opys: "4",
      sprava: "38а",
    });
  });

  it("parses archival references when the archive abbreviation is followed by a hyphen", () => {
    expect(parseArchivalReferenceFromFileName("ЦДІАЛ-201-4а-348.pdf")).toMatchObject({
      archive: { abbr: "ЦДІАЛ" },
      fond: "201",
      opys: "4а",
      sprava: "348",
    });
  });

  it("parses prefixed fonds when the archive abbreviation is followed by a hyphen", () => {
    expect(parseArchivalReferenceFromFileName("ДАТО-Р-234-4-38а.djvu")).toMatchObject({
      archive: { abbr: "ДАТО" },
      fond: "Р-234",
      opys: "4",
      sprava: "38а",
    });
  });

  it("does not accept single-token references with arbitrary extra hyphens", () => {
    expect(parseArchivalReferenceFromFileName("ЦДІАЛ-А-Б-123-4-5.pdf")).toBeNull();
  });

  it("parses underscores and mixed case", () => {
    expect(parseArchivalReferenceFromFileName("цдіак_р203_2_45.PDF")).toMatchObject({
      archive: { abbr: "ЦДІАК" },
      fond: "Р-203",
      opys: "2",
      sprava: "45",
    });
  });

  it("parses archive abbreviations with spaces when file names use underscores", () => {
    expect(parseArchivalReferenceFromFileName("ІР_НБУВ_123-4-5.pdf")).toMatchObject({
      archive: { abbr: "ІР НБУВ" },
      fond: "123",
      opys: "4",
      sprava: "5",
    });
  });

  it("parses archive abbreviations with spaces when file names use hyphens", () => {
    expect(parseArchivalReferenceFromFileName("ГДА-СБУ_123-4-5.pdf")).toMatchObject({
      archive: { abbr: "ГДА СБУ" },
      fond: "123",
      opys: "4",
      sprava: "5",
    });
  });

  it("prefers a longer archive abbreviation over a shorter matching prefix", () => {
    expect(parseArchivalReferenceFromFileName("ДАКО_123-4-5.pdf")).toMatchObject({
      archive: { abbr: "ДАКО" },
      fond: "123",
      opys: "4",
      sprava: "5",
    });
    expect(parseArchivalReferenceFromFileName("ДАК_123-4-5.pdf")).toMatchObject({
      archive: { abbr: "ДАК" },
      fond: "123",
      opys: "4",
      sprava: "5",
    });
  });

  it("returns null when the file name does not start with a known archive reference", () => {
    expect(parseArchivalReferenceFromFileName("scan_001.pdf")).toBeNull();
  });
});

describe("makeEntry", () => {
  it("pre-fills archive, fond, opys, and sprava from the file name", () => {
    const entry = makeEntry(new File(["test"], "ДАТО Р-234-4-38а.pdf"));

    expect(entry.archive?.abbr).toBe("ДАТО");
    expect(entry.fond).toBe("Р-234");
    expect(entry.opys).toBe("4");
    expect(entry.sprava).toBe("38а");
  });

  it("leaves manual fields empty when the file name does not match the archive pattern", () => {
    const entry = makeEntry(new File(["test"], "notes.pdf"));

    expect(entry.archive).toBeNull();
    expect(entry.fond).toBe("");
    expect(entry.opys).toBe("");
    expect(entry.sprava).toBe("");
  });
});
