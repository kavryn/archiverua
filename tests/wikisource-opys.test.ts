import { describe, it, expect, vi } from "vitest";
import {
  buildSpravaRow,
  buildNewOpysPage,
  parseOpysPage,
  insertSpravaRow,
  buildOrUpdateOpysContent,
} from "@/lib/wikisource-opys";

vi.mock("@/lib/logger", () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

describe("buildSpravaRow", () => {
  it("builds a row with correct cells", () => {
    const row = buildSpravaRow("127", "Назва справи", "1920-1930", 5);
    expect(row).toBe("|-\n|[[/127/]]||Назва справи||1920-1930||||");
  });
});

describe("buildNewOpysPage", () => {
  const baseParams = {
    archiveAbbr: "ЦДІАК",
    fond: "Р-203",
    opys: "4а",
    spravaName: "Назва справи",
    opysName: "Назва опису",
    dates: "1920-1930",
  };

  it("creates page with single data row when sprava=1", () => {
    const result = buildNewOpysPage({ ...baseParams, sprava: "1" });
    expect(result).toContain("{{Архіви/опис");
    expect(result).toContain("| назва = Назва опису");
    expect(result).toContain("== Справи ==");
    expect(result).toContain('{| class="wikitable sortable"');
    expect(result).toContain('!№!!Назва!!Роки!!Сторінки!!Примітки');
    expect(result).toContain("[[/1/]]||Назва справи||1920-1930||||");
    const matches = result.match(/\[\[\/1\/\]\]/g);
    expect(matches).toHaveLength(1);
  });

  it("creates page with placeholder row + actual row when sprava!=1", () => {
    const result = buildNewOpysPage({ ...baseParams, sprava: "5" });
    expect(result).toContain("[[/1/]]||||||||");
    expect(result).toContain("[[/5/]]||Назва справи||1920-1930||||");
    const idx1 = result.indexOf("[[/1/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx1).toBeLessThan(idx5);
  });
});

describe("parseOpysPage", () => {
  const makeTable = (rows: string) => {
    return `{{Архіви/опис
  | назва = Test
}}

== Справи ==
{| class="wikitable sortable"
!№!!Назва!!Дати!!Примітки!!
${rows}
|}

[[Категорія:Тест]]`;
  };

  const params = {
    archiveAbbr: "ЦДІАК",
    fond: "Р-203",
    opys: "4а",
    sprava: "1",
    spravaName: "Назва справи",
    opysName: "Назва опису",
    dates: "1920-1930",
  } as const;

  it("parses page with one row", () => {
    const content = makeTable("|-\n|[[/1/]]||Name||2000|| ||");
    const parsed = parseOpysPage(content, params);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("1");
    expect(parsed.columnCount).toBe(5);
  });

  it("parses page with multiple rows", () => {
    const content = makeTable(
      "|-\n|[[/1/]]||A||2000|| ||\n|-\n|[[/3/]]||B||2001|| ||\n|-\n|[[/5/]]||C||2002|| ||"
    );
    const parsed = parseOpysPage(content, params);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((r) => r.id)).toEqual(["1", "3", "5"]);
  });

  it("parses empty table (header only)", () => {
    const content = makeTable("");
    const parsed = parseOpysPage(content, params);
    expect(parsed.rows).toHaveLength(0);
  });

  it("detects column count", () => {
    const content = `{| class="wikitable sortable"
!A!!B!!C
|-
|1||2||3
|}`;
    const parsed = parseOpysPage(content, params);
    expect(parsed.columnCount).toBe(3);
  });

  it("creates an empty table when no wikitable found", () => {
    const parsed = parseOpysPage("just some text", params);
    expect(parsed.rows).toHaveLength(0);
  });
});

describe("insertSpravaRow", () => {
  const makeParsed = (rows: { raw: string; id: string | null }[]) => ({
    before: "before\n",
    tableStart: '{| class="wikitable sortable"',
    headerLine: "!№!!Назва!!Дати!!Примітки!!",
    rows,
    after: "\nafter",
    columnCount: 5,
  });

  const makeRow = (n: string) => ({
    raw: `|-\n|[[/${n}/]]||Name${n}||2000|| ||`,
    id: n,
  });

  it("inserts in correct numerical position (middle)", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("5"), makeRow("10")]);
    const result = insertSpravaRow(parsed, "3", "New", "2020");
    const idx1 = result.indexOf("[[/1/]]");
    const idx3 = result.indexOf("[[/3/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx3).toBeGreaterThan(idx1);
    expect(idx3).toBeLessThan(idx5);
  });

  it("inserts at beginning", () => {
    const parsed = makeParsed([makeRow("5"), makeRow("10")]);
    const result = insertSpravaRow(parsed, "2", "New", "2020");
    const idx2 = result.indexOf("[[/2/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx2).toBeLessThan(idx5);
  });

  it("inserts at end", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("3")]);
    const result = insertSpravaRow(parsed, "10", "New", "2020");
    const idx3 = result.indexOf("[[/3/]]");
    const idx10 = result.indexOf("[[/10/]]");
    expect(idx10).toBeGreaterThan(idx3);
  });

  it("returns unchanged when sprava already exists", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("5")]);
    const result = insertSpravaRow(parsed, "5", "Different", "Different");
    expect(result).not.toContain("Different");
    expect(result).toContain("Name5");
  });

  it("inserts into empty table", () => {
    const parsed = makeParsed([]);
    const result = insertSpravaRow(parsed, "1", "First", "2020");
    expect(result).toContain("[[/1/]]||First||2020");
  });

  it("preserves content before and after table", () => {
    const parsed = makeParsed([makeRow("1")]);
    const result = insertSpravaRow(parsed, "5", "New", "2020");
    expect(result).toMatch(/^before\n/);
    expect(result).toMatch(/\nafter$/);
  });

  it("inserts alphanumeric sprava correctly", () => {
    const parsed = makeParsed([makeRow("4"), makeRow("5"), makeRow("10")]);
    const result = insertSpravaRow(parsed, "4а", "Special", "2020");
    const idx4 = result.indexOf("[[/4/]]");
    const idx4a = result.indexOf("[[/4а/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx4a).toBeGreaterThan(idx4);
    expect(idx4a).toBeLessThan(idx5);
  });
});

describe("buildOrUpdateOpysContent", () => {
  const params = {
    archiveAbbr: "ЦДІАК",
    fond: "Р-203",
    opys: "4а",
    sprava: "1",
    spravaName: "Назва справи",
    opysName: "Назва опису",
    dates: "1920-1930",
  };

  it("creates new page when content is null", () => {
    const result = buildOrUpdateOpysContent(null, params);
    expect(result).toContain("{{Архіви/опис");
    expect(result).toContain("== Справи ==");
    expect(result).toContain("[[/1/]]");
  });

  it("updates existing page", () => {
    const existing = `{{Архіви/опис
  | назва = Test
}}

== Справи ==
{| class="wikitable sortable"
!№!!Назва!!Дати!!Примітки!!
|-
|[[/1/]]||Existing||2000|| ||
|}`;

    const result = buildOrUpdateOpysContent(existing, {
      ...params,
      sprava: "5",
    });
    expect(result).toContain("[[/1/]]||Existing||2000");
    expect(result).toContain("[[/5/]]||Назва справи||1920-1930");
  });

  it("falls back gracefully when existing page has no wikitable", async () => {
    const { logWarning } = await import("@/lib/logger");
    const existing = "{{Архіви/опис\n  | назва = Test\n}}\n\nJust some text, no table here.";
    const result = buildOrUpdateOpysContent(existing, { ...params, sprava: "3" });

    expect(logWarning).toHaveBeenCalledWith(
      "wikisource-opys",
      expect.stringContaining("Архів:ЦДІАК/Р-203/4а"),
      expect.objectContaining({ title: "Архів:ЦДІАК/Р-203/4а" })
    );
    expect(result).toContain(existing);
    expect(result).toContain('!№!!Назва!!Роки!!Сторінки!!Примітки');
    expect(result).toContain("[[/3/]]||Назва справи||1920-1930");
  });
});
