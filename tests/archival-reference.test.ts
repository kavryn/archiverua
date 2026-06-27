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

  it("strips leading zeros from a numeric fond", () => {
    expect(normalizeFond("0203")).toBe("203");
  });

  it("strips leading zeros from a prefixed fond", () => {
    expect(normalizeFond("р0203")).toBe("Р-203");
  });

  it("keeps a single zero", () => {
    expect(normalizeFond("0")).toBe("0");
  });
});

describe("normalizeOpysSprava", () => {
  it('changes "4-А" to "4а"', () => {
    expect(normalizeOpysSprava("4-А")).toBe("4а");
  });

  it("removes spaces and hyphens before lowercasing", () => {
    expect(normalizeOpysSprava(" 4 - А ")).toBe("4а");
  });

  it("strips leading zeros", () => {
    expect(normalizeOpysSprava("04а")).toBe("4а");
    expect(normalizeOpysSprava("007")).toBe("7");
  });

  it("keeps a single zero", () => {
    expect(normalizeOpysSprava("0")).toBe("0");
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
    expect(parseArchivalReferenceFromFileName("ЦДІАЛ-А-Б-123-4-5.pdf")).toMatchObject({
      archive: { abbr: "ЦДІАЛ" },
      fond: "",
      opys: "",
      sprava: "",
    });
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

  it("takes the code from a self-contained first token and ignores trailing junk tokens", () => {
    expect(parseArchivalReferenceFromFileName("ДАЛО 123-4-56_scan001.pdf")).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "123",
      opys: "4",
      sprava: "56",
    });
  });

  it("keeps the code but drops the tail when junk sits between the code and the years", () => {
    // Everything after the code ("_scan001. 1910. Назва документа") is junk because the
    // tail does not directly follow the code, so the years and title stay empty.
    expect(
      parseArchivalReferenceFromFileName("ДАЛО 123-4-56_scan001. 1910. Назва документа.pdf"),
    ).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "123",
      opys: "4",
      sprava: "56",
      dateFrom: "",
      dateTo: "",
      title: "",
    });
  });

  it("takes the code from a complete first token and ignores space-separated trailing junk", () => {
    expect(parseArchivalReferenceFromFileName("ДАЛО 123-4-56 scan001.pdf")).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "123",
      opys: "4",
      sprava: "56",
    });
  });

  it("drops the tail when space-separated junk sits between the code and the years", () => {
    expect(
      parseArchivalReferenceFromFileName("ДАЛО 123-4-56 scan001. 1910. Назва документа.pdf"),
    ).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "123",
      opys: "4",
      sprava: "56",
      dateFrom: "",
      dateTo: "",
      title: "",
    });
  });

  it("leaves the date and title empty when the file name carries only a code", () => {
    expect(parseArchivalReferenceFromFileName("ЦДІАЛ 201-4а-348.pdf")).toMatchObject({
      dateFrom: "",
      dateTo: "",
      title: "",
    });
  });
});

describe("parseArchivalReferenceFromFileName code separator variants", () => {
  it("parses an underscore-delimited code followed by a tail", () => {
    expect(
      parseArchivalReferenceFromFileName("ЦДІАК Р203_2_45. 1910. Опис справ.pdf"),
    ).toMatchObject({
      archive: { abbr: "ЦДІАК" },
      fond: "Р-203",
      opys: "2",
      sprava: "45",
      dateFrom: "1910",
      dateTo: "1910",
      title: "Опис справ",
    });
  });

  it("falls through to the token split when the three-dash reading is invalid", () => {
    // Split on "-" gives ["Р", "203_4", "а_5"], whose first part "Р" is not a valid fond;
    // the parser must keep trying and split on "_" instead -> Р-203 / 4а / 5.
    expect(parseArchivalReferenceFromFileName("ДАЛО Р-203_4-а_5.pdf")).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "Р-203",
      opys: "4а",
      sprava: "5",
    });
  });

  it("falls through to the token split when the four-dash reading is invalid", () => {
    // Split on "-" yields a four-part reading with an invalid fond "Р-203_4"; the parser
    // must fall back to the "_" split -> Р-203 / 4а / 5б.
    expect(parseArchivalReferenceFromFileName("ДАЛО Р-203_4-а_5-б.pdf")).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "Р-203",
      opys: "4а",
      sprava: "5б",
    });
  });
});

describe("parseArchivalReferenceFromFileName with years and title", () => {
  it("parses a year range and title in the canonical format", () => {
    expect(
      parseArchivalReferenceFromFileName("ДАЛО 123-4-56. 1925-1930. Листування.pdf"),
    ).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "123",
      opys: "4",
      sprava: "56",
      dateFrom: "1925",
      dateTo: "1930",
      title: "Листування",
    });
  });

  it("parses a single year with dateTo equal to dateFrom", () => {
    expect(
      parseArchivalReferenceFromFileName("ЦДАВО Р1-2-3. 1920. Протокол засідання.pdf"),
    ).toMatchObject({
      archive: { abbr: "ЦДАВО" },
      fond: "Р-1",
      opys: "2",
      sprava: "3",
      dateFrom: "1920",
      dateTo: "1920",
      title: "Протокол засідання",
    });
  });

  it("keeps dots and digits that belong to the title", () => {
    expect(
      parseArchivalReferenceFromFileName("ЦДІАК П789-10-11. 1918. Акт передачі. Том 1.pdf"),
    ).toMatchObject({
      fond: "П-789",
      opys: "10",
      sprava: "11",
      dateFrom: "1918",
      title: "Акт передачі. Том 1",
    });
  });

  it("does not mistake a year inside the title for the document date", () => {
    expect(
      parseArchivalReferenceFromFileName("ДАЛО 1-2-3. 1900. Метрика 1925 року.pdf"),
    ).toMatchObject({
      dateFrom: "1900",
      title: "Метрика 1925 року",
    });
  });

  it("extracts the tail when the archive separator is an underscore", () => {
    expect(
      parseArchivalReferenceFromFileName("ДАЛО_123-4-56. 1925-1930. Листування.pdf"),
    ).toMatchObject({
      fond: "123",
      opys: "4",
      sprava: "56",
      dateFrom: "1925",
      dateTo: "1930",
      title: "Листування",
    });
  });

  it("does not treat spaces between code parts as separators", () => {
    expect(parseArchivalReferenceFromFileName("ДАЛО 5 1 3.pdf")).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "",
      opys: "",
      sprava: "",
    });
  });

  it("does not treat dots between code parts as separators", () => {
    expect(parseArchivalReferenceFromFileName("ДАЛО 5.1.3.pdf")).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "",
      opys: "",
      sprava: "",
    });
  });

  it("returns the archive alone when only the prefix is recognizable", () => {
    expect(parseArchivalReferenceFromFileName("ДАЛО документ.pdf")).toMatchObject({
      archive: { abbr: "ДАЛО" },
      fond: "",
      opys: "",
      sprava: "",
      dateFrom: "",
      dateTo: "",
      title: "",
    });
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
    expect(entry.dateFrom).toBe("");
    expect(entry.dateTo).toBe("");
    expect(entry.dateMode).toBe("range");
    expect(entry.spravaName).toBe("");
  });

  it("pre-fills the archive even when the rest of the code is missing", () => {
    const entry = makeEntry(new File(["test"], "ДАЛО документ.pdf"));

    expect(entry.archive?.abbr).toBe("ДАЛО");
    expect(entry.fond).toBe("");
    expect(entry.opys).toBe("");
    expect(entry.sprava).toBe("");
  });

  it("pre-fills a year range as range mode with both dates and the title", () => {
    const entry = makeEntry(new File(["test"], "ДАЛО 123-4-56. 1925-1930. Листування.pdf"));

    expect(entry.dateMode).toBe("range");
    expect(entry.dateFrom).toBe("1925");
    expect(entry.dateTo).toBe("1930");
    expect(entry.spravaName).toBe("Листування");
  });

  it("pre-fills a single year as single mode with equal dates", () => {
    const entry = makeEntry(new File(["test"], "ЦДАВО Р1-2-3. 1920. Протокол засідання.pdf"));

    expect(entry.dateMode).toBe("single");
    expect(entry.dateFrom).toBe("1920");
    expect(entry.dateTo).toBe("1920");
    expect(entry.spravaName).toBe("Протокол засідання");
  });
});
