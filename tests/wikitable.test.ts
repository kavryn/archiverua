import { describe, it, expect, vi } from "vitest";
import {
  buildRow,
  parseWikiTable,
  parseOrEmptyTable,
  rebuildPage,
  insertRow,
  naturalCompare,
  type FallbackSchema,
} from "@/lib/wikitable";

describe("buildRow", () => {
  it("builds a row with all columns filled", () => {
    const row = buildRow("127", ["Назва", "1920-1930", "", ""], 5);
    expect(row).toBe("|-\n|[[/127/]]||Назва||1920-1930||||");
  });

  it("pads missing columns with empty strings", () => {
    const row = buildRow("5", ["Назва"], 4);
    expect(row).toBe("|-\n|[[/5/]]||Назва||||");
  });

  it("trims extra columns", () => {
    const row = buildRow("1", ["a", "b", "c", "d"], 3);
    expect(row).toBe("|-\n|[[/1/]]||a||b");
  });

  it("handles empty cells", () => {
    const row = buildRow("1", ["", "", "", ""], 5);
    expect(row).toBe("|-\n|[[/1/]]||||||||");
  });

  it("handles alphanumeric id", () => {
    const row = buildRow("4а", ["Name"], 2);
    expect(row).toBe("|-\n|[[/4а/]]||Name");
  });

  it("uses custom link prefix", () => {
    const row = buildRow("Р-34", ["Назва"], 2, "../");
    expect(row).toBe("|-\n|[[../Р-34/]]||Назва");
  });
});

describe("parseWikiTable", () => {
  const makeTable = (header: string, rows: string) => {
    return `before\n{| class="wikitable sortable"\n${header}\n${rows}\n|}\nafter`;
  };

  it("parses page with one row", () => {
    const content = makeTable("!A!!B!!C", "|-\n|[[/1/]]||val1||val2");
    const parsed = parseWikiTable(content);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("1");
    expect(parsed.columnCount).toBe(3);
  });

  it("parses page with multiple rows", () => {
    const content = makeTable(
      "!A!!B",
      "|-\n|[[/1/]]||A\n|-\n|[[/3/]]||B\n|-\n|[[/5/]]||C"
    );
    const parsed = parseWikiTable(content);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((r) => r.id)).toEqual(["1", "3", "5"]);
  });

  it("parses empty table (header only)", () => {
    const content = makeTable("!A!!B", "");
    const parsed = parseWikiTable(content);
    expect(parsed.rows).toHaveLength(0);
  });

  it("detects column count", () => {
    const content = `{| class="wikitable sortable"\n!A!!B!!C!!D!!E\n|}`;
    const parsed = parseWikiTable(content);
    expect(parsed.columnCount).toBe(5);
  });

  it("detects column count with || separators", () => {
    const content = `{| class="wikitable sortable"\n!A||B||C||D\n|}`;
    const parsed = parseWikiTable(content);
    expect(parsed.columnCount).toBe(4);
  });

  it('parses table with class="wikitable" and || header separators', () => {
    const content = `{| class="wikitable"\n!Опис||Назва||Роки||Справ\n|-\n|[[/1/]]||val||val||val\n|}`;
    const parsed = parseWikiTable(content);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("1");
    expect(parsed.columnCount).toBe(4);
  });

  it("parses table with no class attribute (bare {|)", () => {
    const content = `{|\n!A!!B\n|-\n|[[/1/]]||val\n|}`;
    const parsed = parseWikiTable(content);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("1");
    expect(parsed.columnCount).toBe(2);
  });

  it("parses table with style= attribute instead of class", () => {
    const content = `{| style="border:1px solid"\n!A!!B\n|-\n|[[/2/]]||val\n|}`;
    const parsed = parseWikiTable(content);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("2");
    expect(parsed.tableStart).toBe('{| style="border:1px solid"');
  });

  it("uses custom idRegex", () => {
    const content = makeTable("!A!!B", "|-\n|[[../Р-1/]]||val");
    const parsed = parseWikiTable(content, { idRegex: /\[\[\.\.\/([^/]+)\/\]\]/ });
    expect(parsed.rows[0].id).toBe("Р-1");
  });

  it("returns null id when custom idRegex does not match", () => {
    const content = makeTable("!A!!B", "|-\n|[[/1/]]||val");
    const parsed = parseWikiTable(content, { idRegex: /\[\[\.\.\/([^/]+)\/\]\]/ });
    expect(parsed.rows[0].id).toBeNull();
  });

  it("extracts alphanumeric ids", () => {
    const content = makeTable("!A!!B", "|-\n|[[/4а/]]||val");
    const parsed = parseWikiTable(content);
    expect(parsed.rows[0].id).toBe("4а");
  });

  it("preserves before and after content", () => {
    const content = makeTable("!A!!B", "|-\n|[[/1/]]||val");
    const parsed = parseWikiTable(content);
    expect(parsed.before).toBe("before\n");
    expect(parsed.after).toBe("\nafter");
  });

  it("throws when no wikitable found", () => {
    expect(() => parseWikiTable("just some text")).toThrow(
      "No wikitable found"
    );
  });

  it("throws when no closing found", () => {
    expect(() =>
      parseWikiTable('{| class="wikitable sortable"\n!A!!B\n|-\n|1||2')
    ).toThrow("No wikitable closing found");
  });
});

describe("rebuildPage", () => {
  it("rebuilds page with rows", () => {
    const parsed = {
      before: "before\n",
      tableStart: '{| class="wikitable sortable"',
      headerLine: "!A!!B",
      rows: [{ raw: "|-\n|[[/1/]]||val", id: "1" }],
      after: "\nafter",
      columnCount: 2,
    };
    const result = rebuildPage(parsed);
    expect(result).toBe(
      'before\n{| class="wikitable sortable"\n!A!!B\n|-\n|[[/1/]]||val\n|}\nafter'
    );
  });

  it("rebuilds page with empty table", () => {
    const parsed = {
      before: "",
      tableStart: '{| class="wikitable sortable"',
      headerLine: "!A!!B",
      rows: [],
      after: "",
      columnCount: 2,
    };
    const result = rebuildPage(parsed);
    expect(result).toBe('{| class="wikitable sortable"\n!A!!B\n|}');
  });
});

describe("insertRow", () => {
  const makeParsed = (rows: { raw: string; id: string | null }[]) => ({
    before: "before\n",
    tableStart: '{| class="wikitable sortable"',
    headerLine: "!A!!B",
    rows,
    after: "\nafter",
    columnCount: 2,
  });

  const makeRow = (id: string) => ({
    raw: `|-\n|[[/${id}/]]||Name${id}`,
    id,
  });

  const numericCompare = (a: string, b: string) =>
    parseInt(a, 10) - parseInt(b, 10);

  it("inserts in correct position (middle)", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("5"), makeRow("10")]);
    const result = insertRow(parsed, "3", "|-\n|[[/3/]]||New", numericCompare);
    const idx1 = result.indexOf("[[/1/]]");
    const idx3 = result.indexOf("[[/3/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx3).toBeGreaterThan(idx1);
    expect(idx3).toBeLessThan(idx5);
  });

  it("inserts at beginning", () => {
    const parsed = makeParsed([makeRow("5"), makeRow("10")]);
    const result = insertRow(parsed, "2", "|-\n|[[/2/]]||New", numericCompare);
    const idx2 = result.indexOf("[[/2/]]");
    const idx5 = result.indexOf("[[/5/]]");
    expect(idx2).toBeLessThan(idx5);
  });

  it("inserts at end", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("3")]);
    const result = insertRow(
      parsed,
      "10",
      "|-\n|[[/10/]]||New",
      numericCompare
    );
    const idx3 = result.indexOf("[[/3/]]");
    const idx10 = result.indexOf("[[/10/]]");
    expect(idx10).toBeGreaterThan(idx3);
  });

  it("skips duplicate id", () => {
    const parsed = makeParsed([makeRow("1"), makeRow("5")]);
    const result = insertRow(
      parsed,
      "5",
      "|-\n|[[/5/]]||Different",
      numericCompare
    );
    expect(result).not.toContain("Different");
    expect(result).toContain("Name5");
  });

  it("inserts into empty table", () => {
    const parsed = makeParsed([]);
    const result = insertRow(
      parsed,
      "1",
      "|-\n|[[/1/]]||First",
      numericCompare
    );
    expect(result).toContain("[[/1/]]||First");
  });

  it("preserves content before and after table", () => {
    const parsed = makeParsed([makeRow("1")]);
    const result = insertRow(parsed, "5", "|-\n|[[/5/]]||New", numericCompare);
    expect(result).toMatch(/^before\n/);
    expect(result).toMatch(/\nafter$/);
  });
});

describe("parseOrEmptyTable", () => {
  const schema: FallbackSchema = {
    tableStart: '{| class="wikitable sortable"',
    headerLine: "!№!!Назва!!Роки",
    columnCount: 3,
  };

  it("returns parsed table when content has a valid wikitable", () => {
    const content = `before\n{| class="wikitable sortable"\n!A!!B!!C\n|-\n|[[/1/]]||val1||val2\n|}\nafter`;
    const parsed = parseOrEmptyTable(content, schema);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].id).toBe("1");
  });

  it("calls onFallback and returns empty table when content has no wikitable", () => {
    const onFallback = vi.fn();
    const content = "just some text without a table";
    const parsed = parseOrEmptyTable(content, schema, undefined, onFallback);
    expect(onFallback).toHaveBeenCalledOnce();
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.tableStart).toBe(schema.tableStart);
    expect(parsed.headerLine).toBe(schema.headerLine);
    expect(parsed.columnCount).toBe(schema.columnCount);
  });

  it("sets before to content + two newlines on fallback", () => {
    const content = "some text";
    const parsed = parseOrEmptyTable(content, schema, undefined, () => {});
    expect(parsed.before).toBe("some text\n\n");
    expect(parsed.after).toBe("");
  });

  it("does not call onFallback on success", () => {
    const onFallback = vi.fn();
    const content = `{| class="wikitable sortable"\n!A!!B!!C\n|}`;
    parseOrEmptyTable(content, schema, undefined, onFallback);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("passes options to parseWikiTable (custom idRegex)", () => {
    const content = `{| class="wikitable sortable"\n!A!!B\n|-\n|[[../Р-34/]]||val\n|}`;
    const parsed = parseOrEmptyTable(content, schema, { idRegex: /\[\[\.\.\/([^/]+)\/\]\]/ });
    expect(parsed.rows[0].id).toBe("Р-34");
  });
});

describe("naturalCompare", () => {
  it("compares numbers correctly", () => {
    expect(naturalCompare("1", "2")).toBeLessThan(0);
    expect(naturalCompare("2", "10")).toBeLessThan(0);
    expect(naturalCompare("10", "2")).toBeGreaterThan(0);
  });

  it("handles alphanumeric suffixes", () => {
    expect(naturalCompare("4", "4а")).toBeLessThan(0);
    expect(naturalCompare("4а", "4")).toBeGreaterThan(0);
    expect(naturalCompare("4а", "5")).toBeLessThan(0);
  });

  it("handles equal values", () => {
    expect(naturalCompare("1", "1")).toBe(0);
    expect(naturalCompare("4а", "4а")).toBe(0);
  });

  it("sorts full sequence correctly", () => {
    const input = ["10", "4а", "1", "5", "4", "2"];
    const sorted = [...input].sort(naturalCompare);
    expect(sorted).toEqual(["1", "2", "4", "4а", "5", "10"]);
  });
});