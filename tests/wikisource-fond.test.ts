import { describe, it, expect, vi } from "vitest";
import {
  buildOpysRow,
  buildNewFondPage,
  parseFondPage,
  insertOpysRow,
  buildOrUpdateFondContent,
} from "@/lib/wikisource-fond";

vi.mock("@/lib/logger", () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

describe("buildOpysRow", () => {
  it("builds a row with correct cells", () => {
    const row = buildOpysRow("3", "Анотація опису", 4);
    expect(row).toBe("|-\n|[[/3/]]||Анотація опису||||");
  });
});

describe("buildNewFondPage", () => {
  const baseParams = {
    archiveAbbr: "ЦДІАК",
    fond: "Р-203",
    opysName: "Назва опису",
    fondName: "Назва фонду",
  };

  it("creates page with a single data row when opys=1", () => {
    const result = buildNewFondPage({ ...baseParams, opys: "1" });
    expect(result).toContain("{{Архіви/фонд");
    expect(result).toContain("| назва = Назва фонду");
    expect(result).toContain("== Описи ==");
    expect(result).toContain('{| class="wikitable sortable"');
    expect(result).toContain("[[/1/]]||Назва опису");
    expect(result).not.toContain("[[/2/]]");
    const idx1 = result.indexOf("[[/1/]]");
  });

  it("creates page with placeholder + data row when opys!=1", () => {
    const result = buildNewFondPage({ ...baseParams, opys: "5" });
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

  it("detects column count with !! separators", () => {
    const content = `{| class="wikitable sortable"
!A!!B!!C!!D
|-
|1||2||3||4
|}`;
    const parsed = parseFondPage(content);
    expect(parsed.columnCount).toBe(4);
  });

  it("detects column count with || separators in header", () => {
    const content = `{| class="wikitable sortable"
!A||B||C||D
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

  it('parses page with class="wikitable" (without sortable)', () => {
    const content = `{{Архіви/фонд
 | назва = Колекція документів Скарбу коронного
 | рік = 1546–1792
 | примітки = https://cdiak.archives.gov.ua/spysok_fondiv/0001/
}}
[[Файл:Žygimont Aŭgust, Pahonia. Жыгімонт Аўгуст, Пагоня crop.png|300px|center|альт=Герб Речі Посполитої|Герб Речі Посполитої]]
== Описи ==
{| class="wikitable"
!Опис||Назва||Роки||Справ
|-
|[[/1/]]||Люстрація Богуславського...||1546–1792||15
|}

[[Категорія:Річ Посполита]]`;

    const parsed = parseFondPage(content);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("1");
    expect(parsed.columnCount).toBe(4);
  });
});

describe("insertOpysRow", () => {
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
    const result = insertOpysRow(parsed, "3", "New");
    const idx1 = result.indexOf("[[/1/]]");
    const idx3 = result.indexOf("[[/3/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx3).toBeGreaterThan(idx1);
    expect(idx3).toBeLessThan(idx5);
  });

  it("inserts at beginning", () => {
    const parsed = makeParsed([makeRow("5"), makeRow("10")]);
    const result = insertOpysRow(parsed, "2", "New");
    const idx2 = result.indexOf("[[/2/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx2).toBeLessThan(idx5);
  });

  it("inserts at end", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("3")]);
    const result = insertOpysRow(parsed, "10", "New");
    const idx3 = result.indexOf("[[/3/]]");
    const idx10 = result.indexOf("[[/10/]]");
    expect(idx10).toBeGreaterThan(idx3);
  });

  it("returns unchanged when opys already exists", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("5")]);
    const result = insertOpysRow(parsed, "5", "Different");
    expect(result).not.toContain("Different");
    expect(result).toContain("Name5");
  });

  it("inserts into empty table", () => {
    const parsed = makeParsed([]);
    const result = insertOpysRow(parsed, "1", "First");
    expect(result).toContain("[[/1/]]||First");
  });

  it("preserves content before and after table", () => {
    const parsed = makeParsed([makeRow("1")]);
    const result = insertOpysRow(parsed, "5", "New");
    expect(result).toMatch(/^before\n/);
    expect(result).toMatch(/\nafter$/);
  });

  it("inserts alphanumeric opys correctly", () => {
    const parsed = makeParsed([makeRow("4"), makeRow("5"), makeRow("10")]);
    const result = insertOpysRow(parsed, "4а", "Special");
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
    opys: "1",
    opysName: "Назва опису",
    fondName: "Назва фонду",
  };

  it("creates new page when content is null", () => {
    const result = buildOrUpdateFondContent(null, params);
    expect(result).toContain("{{Архіви/фонд");
    expect(result).toContain("== Описи ==");
    expect(result).toContain("[[/1/]]");
  });

  it('inserts opys into page with class="wikitable" (without sortable)', () => {
    const existing = `{{Архіви/фонд
 | назва = Колекція документів Скарбу коронного
 | рік = 1546–1792
 | примітки = https://cdiak.archives.gov.ua/spysok_fondiv/0001/
}}
[[Файл:Žygimont Aŭgust, Pahonia. Жыгімонт Аўгуст, Пагоня crop.png|300px|center|альт=Герб Речі Посполитої|Герб Речі Посполитої]]
== Описи ==
{| class="wikitable"
!Опис||Назва||Роки||Справ
|-
|[[/1/]]||Люстрація Богуславського...||1546–1792||15
|}

[[Категорія:Річ Посполита]]`;

    const insertParams = {
      archiveAbbr: "ЦДІАК",
      fond: "1",
      opys: "2",
      opysName: "Другий опис",
      fondName: "Колекція документів Скарбу коронного",
    };
    const result = buildOrUpdateFondContent(existing, insertParams);
    expect(result).toContain("[[/1/]]");
    expect(result).toContain("[[/2/]]||Другий опис");
    const idx1 = result.indexOf("[[/1/]]");
    const idx2 = result.indexOf("[[/2/]]");
    expect(idx2).toBeGreaterThan(idx1);
    expect(result).toContain("[[Категорія:Річ Посполита]]");
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
      opys: "5",
      opysName: "Новий опис",
    });
    expect(result).toContain("[[/1/]]||Existing||2000||10");
    expect(result).toContain("[[/5/]]||Новий опис");
  });

  it("falls back gracefully when existing page has no wikitable", async () => {
    const { logWarning } = await import("@/lib/logger");
    const existing = "{{Архіви/фонд\n  | назва = Test\n}}\n\nJust some text, no table here.";
    const result = buildOrUpdateFondContent(existing, { ...params, opys: "3", opysName: "Новий опис" });

    expect(logWarning).toHaveBeenCalledWith(
      "wikisource-fond",
      expect.stringContaining("Архів:ЦДІАК/Р-203"),
      expect.objectContaining({ title: "Архів:ЦДІАК/Р-203" })
    );
    expect(result).toContain(existing);
    expect(result).toContain("!№!!Анотація!!Крайні дати!!Справ");
    expect(result).toContain("[[/3/]]||Новий опис");
  });
});
