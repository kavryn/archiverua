import { describe, it, expect, vi } from "vitest";
import {
  extractFondPrefix,
  getArchivePageTitle,
  fondCompare,
  buildFondRow,
  buildNewArchivePage,
  parseArchivePage,
  insertFondRow,
  buildOrUpdateArchiveContent,
} from "@/lib/wikisource-archive";

vi.mock("@/lib/logger", () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

describe("extractFondPrefix", () => {
  it("extracts Cyrillic prefix from prefixed fonds", () => {
    expect(extractFondPrefix("Р-34")).toBe("Р");
    expect(extractFondPrefix("Н-3777")).toBe("Н");
    expect(extractFondPrefix("П-1234")).toBe("П");
  });

  it("returns Д for non-prefixed fonds", () => {
    expect(extractFondPrefix("34")).toBe("Д");
    expect(extractFondPrefix("1")).toBe("Д");
  });
});

describe("getArchivePageTitle", () => {
  it("builds title with extracted prefix", () => {
    expect(getArchivePageTitle("ЦДІАК", "Р-34")).toBe("Архів:ЦДІАК/Р");
  });

  it("builds title with Д for non-prefixed fond", () => {
    expect(getArchivePageTitle("ЦДІАК", "34")).toBe("Архів:ЦДІАК/Д");
  });
});

describe("fondCompare", () => {
  it("compares prefixed fonds by numeric part", () => {
    expect(fondCompare("Р-1", "Р-2")).toBeLessThan(0);
    expect(fondCompare("Р-10", "Р-2")).toBeGreaterThan(0);
  });

  it("compares non-prefixed fonds numerically", () => {
    expect(fondCompare("1", "2")).toBeLessThan(0);
    expect(fondCompare("10", "2")).toBeGreaterThan(0);
  });

  it("compares mixed prefix fonds by numeric part", () => {
    expect(fondCompare("Р-1", "Н-2")).toBeLessThan(0);
    expect(fondCompare("Р-10", "Н-2")).toBeGreaterThan(0);
  });

  it("sorts full sequence correctly", () => {
    const input = ["Р-10", "Р-1", "Р-5", "Р-2"];
    const sorted = [...input].sort(fondCompare);
    expect(sorted).toEqual(["Р-1", "Р-2", "Р-5", "Р-10"]);
  });
});

describe("buildFondRow", () => {
  it("builds a row with ../  links", () => {
    const row = buildFondRow("Р-34", "Назва фонду", 4);
    expect(row).toBe("|-\n|[[../Р-34/]]||Назва фонду||||");
  });
});

describe("buildNewArchivePage", () => {
  const baseParams = {
    archiveAbbr: "ЦДІАК",
    archiveName: "Центральний архів",
    fond: "Р-1",
    fondName: "Назва фонду",
  };

  it("creates page with single row when fond numeric part is 1", () => {
    const result = buildNewArchivePage(baseParams);
    expect(result).toContain("{{заголовок");
    expect(result).toContain("| секція = Центральний архів");
    expect(result).toContain("== Фонди ==");
    expect(result).toContain("[[../Р-1/]]||Назва фонду");
    // Should not have a second row
    const rowCount = (result.match(/\|-/g) || []).length;
    expect(rowCount).toBe(1);
  });

  it("creates page with placeholder + data row when fond is not 1", () => {
    const result = buildNewArchivePage({ ...baseParams, fond: "Р-5", fondName: "Інший фонд" });
    expect(result).toContain("[[../Р-1/]]||||||");
    expect(result).toContain("[[../Р-5/]]||Інший фонд");
    const idxPlaceholder = result.indexOf("[[../Р-1/]]");
    const idxActual = result.indexOf("[[../Р-5/]]");
    expect(idxPlaceholder).toBeLessThan(idxActual);
  });

  it("creates page with non-prefixed fond", () => {
    const result = buildNewArchivePage({ ...baseParams, fond: "1" });
    expect(result).toContain("[[../1/]]");
    const rowCount = (result.match(/\|-/g) || []).length;
    expect(rowCount).toBe(1);
  });

  it("creates placeholder with 1 for non-prefixed fond", () => {
    const result = buildNewArchivePage({ ...baseParams, fond: "5" });
    expect(result).toContain("[[../1/]]||||||");
    expect(result).toContain("[[../5/]]");
  });
});

describe("parseArchivePage", () => {
  const makePage = (rows: string) => {
    return `{{заголовок
 | назва = [[../]]
}}

== Фонди ==
{| class="wikitable sortable"
!№||Назва фонду||Крайні дати||Справ
${rows}
|}`;
  };

  const params = {
    archiveAbbr: "ЦДІАК",
    archiveName: "Центральний архів",
    fond: "Р-1",
    fondName: "Назва фонду",
  } as const;

  it("parses page with one row", () => {
    const content = makePage("|-\n|[[../Р-1/]]||Назва||2000||50");
    const parsed = parseArchivePage(content, params);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("Р-1");
    expect(parsed.columnCount).toBe(4);
  });

  it("parses page with multiple rows", () => {
    const content = makePage(
      "|-\n|[[../Р-1/]]||A||2000||10\n|-\n|[[../Р-3/]]||B||2001||20\n|-\n|[[../Р-5/]]||C||2002||30"
    );
    const parsed = parseArchivePage(content, params);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((r) => r.id)).toEqual(["Р-1", "Р-3", "Р-5"]);
  });

  it("parses empty table", () => {
    const content = makePage("");
    const parsed = parseArchivePage(content, params);
    expect(parsed.rows).toHaveLength(0);
  });

  it("creates an empty table when no wikitable found", () => {
    const parsed = parseArchivePage("just some text", params);
    expect(parsed.rows).toHaveLength(0);
  });
});

describe("insertFondRow", () => {
  const makeParsed = (rows: { raw: string; id: string | null }[]) => ({
    before: "before\n",
    tableStart: '{| class="wikitable sortable"',
    headerLine: "!№||Назва фонду||Крайні дати||Справ",
    rows,
    after: "\nafter",
    columnCount: 4,
  });

  const makeRow = (id: string) => ({
    raw: `|-\n|[[../${id}/]]||Name${id}||||`,
    id,
  });

  it("inserts in correct position (middle)", () => {
    const parsed = makeParsed([makeRow("Р-1"), makeRow("Р-5"), makeRow("Р-10")]);
    const result = insertFondRow(parsed, "Р-3", "New");
    const idx1 = result.indexOf("[[../Р-1/]]");
    const idx3 = result.indexOf("[[../Р-3/]]");
    const idx5 = result.indexOf("[[../Р-5/]]");
    expect(idx3).toBeGreaterThan(idx1);
    expect(idx3).toBeLessThan(idx5);
  });

  it("inserts at beginning", () => {
    const parsed = makeParsed([makeRow("Р-5"), makeRow("Р-10")]);
    const result = insertFondRow(parsed, "Р-2", "New");
    const idx2 = result.indexOf("[[../Р-2/]]");
    const idx5 = result.indexOf("[[../Р-5/]]");
    expect(idx2).toBeLessThan(idx5);
  });

  it("inserts at end", () => {
    const parsed = makeParsed([makeRow("Р-1"), makeRow("Р-3")]);
    const result = insertFondRow(parsed, "Р-10", "New");
    const idx3 = result.indexOf("[[../Р-3/]]");
    const idx10 = result.indexOf("[[../Р-10/]]");
    expect(idx10).toBeGreaterThan(idx3);
  });

  it("returns unchanged when fond already exists", () => {
    const parsed = makeParsed([makeRow("Р-1"), makeRow("Р-5")]);
    const result = insertFondRow(parsed, "Р-5", "Different");
    expect(result).not.toContain("Different");
    expect(result).toContain("NameР-5");
  });

  it("inserts into empty table", () => {
    const parsed = makeParsed([]);
    const result = insertFondRow(parsed, "Р-1", "First");
    expect(result).toContain("[[../Р-1/]]||First");
  });
});

describe("buildOrUpdateArchiveContent", () => {
  const params = {
    archiveAbbr: "ЦДІАК",
    archiveName: "Центральний архів",
    fond: "Р-1",
    fondName: "Назва фонду",
  };

  it("creates new page when content is null", () => {
    const result = buildOrUpdateArchiveContent(null, params);
    expect(result).toContain("{{заголовок");
    expect(result).toContain("== Фонди ==");
    expect(result).toContain("[[../Р-1/]]");
  });

  it("updates existing page", () => {
    const existing = `{{заголовок
 | назва = [[../]]
}}

== Фонди ==
{| class="wikitable sortable"
!№||Назва фонду||Крайні дати||Справ
|-
|[[../Р-1/]]||Existing||2000||10
|}`;

    const result = buildOrUpdateArchiveContent(existing, {
      ...params,
      fond: "Р-5",
      fondName: "Новий фонд",
    });
    expect(result).toContain("[[../Р-1/]]||Existing||2000||10");
    expect(result).toContain("[[../Р-5/]]||Новий фонд");
  });

  it("falls back gracefully when existing page has no wikitable", async () => {
    const { logWarning } = await import("@/lib/logger");
    const existing = "{{заголовок\n | назва = [[../]]\n}}\n\nJust some text, no table here.";
    const result = buildOrUpdateArchiveContent(existing, { ...params, fond: "Р-5", fondName: "Новий фонд" });

    expect(logWarning).toHaveBeenCalledWith(
      "wikisource-archive",
      expect.stringContaining("Архів:ЦДІАК/Р"),
      expect.objectContaining({ title: "Архів:ЦДІАК/Р" })
    );
    expect(result).toContain(existing);
    expect(result).toContain("!№||Назва фонду||Крайні дати||Справ");
    expect(result).toContain("[[../Р-5/]]||Новий фонд");
  });
});
