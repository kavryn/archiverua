import { describe, it, expect } from "vitest";
import {
  buildOpisRow,
  buildNewFondPage,
  parseFondPage,
  insertOpisRow,
  buildOrUpdateFondContent,
} from "@/lib/wikisource-fond";

describe("buildOpisRow", () => {
  it("builds a row with correct cells", () => {
    const row = buildOpisRow("3", "Анотація опису", 4);
    expect(row).toBe("|-\n|[[/3/]]||Анотація опису||||");
  });
});

describe("buildNewFondPage", () => {
  const baseParams = {
    archiveAbbr: "ЦДІАК",
    fond: "Р-203",
    opisName: "Назва опису",
    fondName: "Назва фонду",
  };

  it("creates page with a single data row when opis=1", () => {
    const result = buildNewFondPage({ ...baseParams, opis: "1" });
    expect(result).toContain("{{Архіви/фонд");
    expect(result).toContain("| назва = Назва фонду");
    expect(result).toContain("== Описи ==");
    expect(result).toContain('{| class="wikitable sortable"');
    expect(result).toContain("[[/1/]]||Назва опису");
    expect(result).not.toContain("[[/2/]]");
    const idx1 = result.indexOf("[[/1/]]");
  });

  it("creates page with placeholder + data row when opis!=1", () => {
    const result = buildNewFondPage({ ...baseParams, opis: "5" });
    expect(result).toContain("[[/1/]]||||||");
    expect(result).toContain("[[/5/]]||Назва опису");
    const idx1 = result.indexOf("[[/1/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx1).toBeLessThan(idx5);
  });
});

describe("parseFondPage", () => {
  const makeTable = (rows: string) => {
    return `{{Архіви/фонд
  | назва = Test
}}

== Описи ==
{| class="wikitable sortable"
!№!!Анотація!!Крайні дати!!Справ
${rows}
|}

[[Категорія:Тест]]`;
  };

  it("parses page with one row", () => {
    const content = makeTable("|-\n|[[/1/]]||Анотація||2000||50");
    const parsed = parseFondPage(content);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("1");
    expect(parsed.columnCount).toBe(4);
  });

  it("parses page with multiple rows", () => {
    const content = makeTable(
      "|-\n|[[/1/]]||A||2000||10\n|-\n|[[/3/]]||B||2001||20\n|-\n|[[/5/]]||C||2002||30"
    );
    const parsed = parseFondPage(content);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((r) => r.id)).toEqual(["1", "3", "5"]);
  });

  it("parses empty table (header only)", () => {
    const content = makeTable("");
    const parsed = parseFondPage(content);
    expect(parsed.rows).toHaveLength(0);
  });

  it("detects column count", () => {
    const content = `{| class="wikitable sortable"
!A!!B!!C!!D
|-
|1||2||3||4
|}`;
    const parsed = parseFondPage(content);
    expect(parsed.columnCount).toBe(4);
  });

  it("throws when no wikitable found", () => {
    expect(() => parseFondPage("just some text")).toThrow(
      "No wikitable found"
    );
  });
});

describe("insertOpisRow", () => {
  const makeParsed = (rows: { raw: string; id: string | null }[]) => ({
    before: "before\n",
    tableStart: '{| class="wikitable sortable"',
    headerLine: "!№!!Анотація!!Крайні дати!!Справ",
    rows,
    after: "\nafter",
    columnCount: 4,
  });

  const makeRow = (id: string) => ({
    raw: `|-\n|[[/${id}/]]||Name${id}||2000||10`,
    id,
  });

  it("inserts in correct position (middle)", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("5"), makeRow("10")]);
    const result = insertOpisRow(parsed, "3", "New");
    const idx1 = result.indexOf("[[/1/]]");
    const idx3 = result.indexOf("[[/3/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx3).toBeGreaterThan(idx1);
    expect(idx3).toBeLessThan(idx5);
  });

  it("inserts at beginning", () => {
    const parsed = makeParsed([makeRow("5"), makeRow("10")]);
    const result = insertOpisRow(parsed, "2", "New");
    const idx2 = result.indexOf("[[/2/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx2).toBeLessThan(idx5);
  });

  it("inserts at end", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("3")]);
    const result = insertOpisRow(parsed, "10", "New");
    const idx3 = result.indexOf("[[/3/]]");
    const idx10 = result.indexOf("[[/10/]]");
    expect(idx10).toBeGreaterThan(idx3);
  });

  it("returns unchanged when opis already exists", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("5")]);
    const result = insertOpisRow(parsed, "5", "Different");
    expect(result).not.toContain("Different");
    expect(result).toContain("Name5");
  });

  it("inserts into empty table", () => {
    const parsed = makeParsed([]);
    const result = insertOpisRow(parsed, "1", "First");
    expect(result).toContain("[[/1/]]||First");
  });

  it("preserves content before and after table", () => {
    const parsed = makeParsed([makeRow("1")]);
    const result = insertOpisRow(parsed, "5", "New");
    expect(result).toMatch(/^before\n/);
    expect(result).toMatch(/\nafter$/);
  });

  it("inserts alphanumeric opis correctly", () => {
    const parsed = makeParsed([makeRow("4"), makeRow("5"), makeRow("10")]);
    const result = insertOpisRow(parsed, "4а", "Special");
    const idx4 = result.indexOf("[[/4/]]");
    const idx4a = result.indexOf("[[/4а/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx4a).toBeGreaterThan(idx4);
    expect(idx4a).toBeLessThan(idx5);
  });
});

describe("buildOrUpdateFondContent", () => {
  const params: Parameters<typeof buildOrUpdateFondContent>[1] = {
    archiveAbbr: "ЦДІАК",
    fond: "Р-203",
    opis: "1",
    opisName: "Назва опису",
    fondName: "Назва фонду",
  };

  it("creates new page when content is null", () => {
    const result = buildOrUpdateFondContent(null, params);
    expect(result).toContain("{{Архіви/фонд");
    expect(result).toContain("== Описи ==");
    expect(result).toContain("[[/1/]]");
  });

  it("updates existing page", () => {
    const existing = `{{Архіви/фонд
  | назва = Test
}}

== Описи ==
{| class="wikitable sortable"
!№!!Анотація!!Крайні дати!!Справ
|-
|[[/1/]]||Existing||2000||10
|}`;

    const result = buildOrUpdateFondContent(existing, {
      ...params,
      opis: "5",
      opisName: "Новий опис",
    });
    expect(result).toContain("[[/1/]]||Existing||2000||10");
    expect(result).toContain("[[/5/]]||Новий опис");
  });
});
