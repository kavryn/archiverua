export interface ParsedRow {
  raw: string;
  id: string | null;
}

export interface ParsedWikiTable {
  before: string;
  tableStart: string;
  headerLine: string;
  rows: ParsedRow[];
  after: string;
  columnCount: number;
}

export function parseWikiTable(content: string): ParsedWikiTable {
  const tableStartIdx = content.indexOf('{| class="wikitable sortable"');
  if (tableStartIdx === -1) {
    throw new Error("No wikitable found in page content");
  }

  const tableEndIdx = content.indexOf("\n|}", tableStartIdx);
  if (tableEndIdx === -1) {
    throw new Error("No wikitable closing found in page content");
  }

  const before = content.slice(0, tableStartIdx);
  const tableContent = content.slice(tableStartIdx, tableEndIdx + 3);
  const after = content.slice(tableEndIdx + 3);

  const lines = tableContent.split("\n");
  const tableStart = lines[0];

  let headerLineIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith("!")) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx === -1) {
    throw new Error("No header line found in wikitable");
  }

  const headerLine = lines[headerLineIdx];
  const columnCount = (headerLine.match(/!!/g) || []).length + 1;

  const rows: ParsedRow[] = [];
  let i = headerLineIdx + 1;
  while (i < lines.length) {
    if (lines[i] === "|-") {
      const rowLines = [lines[i]];
      i++;
      while (i < lines.length && !lines[i].startsWith("|-") && lines[i] !== "|}") {
        rowLines.push(lines[i]);
        i++;
      }
      const raw = rowLines.join("\n");
      const idMatch = raw.match(/\[\[\/([^/]+)\/\]\]/);
      const id = idMatch ? idMatch[1] : null;
      rows.push({ raw, id });
    } else {
      i++;
    }
  }

  return { before, tableStart, headerLine, rows, after, columnCount };
}

export function rebuildPage(parsed: ParsedWikiTable): string {
  const rowLines = parsed.rows.map((r) => r.raw).join("\n");
  const table = rowLines
    ? `${parsed.tableStart}\n${parsed.headerLine}\n${rowLines}\n|}`
    : `${parsed.tableStart}\n${parsed.headerLine}\n|}`;
  return `${parsed.before}${table}${parsed.after}`;
}

export function buildRow(id: string, cells: string[], columnCount: number): string {
  const allCells = [`[[/${id}/]]`, ...cells];
  while (allCells.length < columnCount) allCells.push("");
  if (allCells.length > columnCount) allCells.length = columnCount;
  return `|-\n|${allCells.join("||")}`;
}

export function insertRow(
  parsed: ParsedWikiTable,
  id: string,
  row: string,
  compareFn: (a: string, b: string) => number
): string {
  if (parsed.rows.some((r) => r.id === id)) {
    return rebuildPage(parsed);
  }

  let insertIdx = parsed.rows.length;
  for (let i = 0; i < parsed.rows.length; i++) {
    if (parsed.rows[i].id !== null && compareFn(parsed.rows[i].id!, id) > 0) {
      insertIdx = i;
      break;
    }
  }

  const newRows = [...parsed.rows];
  newRows.splice(insertIdx, 0, { raw: row, id });

  return rebuildPage({ ...parsed, rows: newRows });
}

export function naturalCompare(a: string, b: string): number {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);

  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }

  // Same numeric prefix (or both non-numeric) — compare full string
  if (!isNaN(numA) && !isNaN(numB) && numA === numB) {
    const suffixA = a.slice(String(numA).length);
    const suffixB = b.slice(String(numB).length);
    return suffixA.localeCompare(suffixB);
  }

  return a.localeCompare(b);
}
