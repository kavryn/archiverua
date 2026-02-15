export interface OpysPageParams {
  archiveAbbr: string;
  fond: string;
  opis: string;
  sprava: number;
  spravaName: string;
  opisName: string;
  dates: string;
}

export interface ParsedOpysPage {
  before: string;
  tableStart: string;
  headerLine: string;
  rows: { raw: string; spravaNum: number | null }[];
  after: string;
  columnCount: number;
}

export function buildSpravaRow(
  sprava: number,
  name: string,
  dates: string,
  columnCount: number
): string {
  const cells = [`[[/${sprava}/]]`, name, dates, "", ""];
  while (cells.length < columnCount) cells.push("");
  if (cells.length > columnCount) cells.length = columnCount;
  return `|-\n|${cells.join("||")}`;
}

export function buildNewOpysPage(params: OpysPageParams): string {
  const template = `{{Архіви/опис
  | назва = ${params.opisName}
  | рік =
  | примітки =
}}`;

  const tableHeader = `{| class="wikitable sortable"
!№!!Назва!!Дати!!Примітки!!`;

  const columnCount = 5;

  if (params.sprava === 1) {
    const row1 = buildSpravaRow(params.sprava, params.spravaName, params.dates, columnCount);
    const row2 = buildSpravaRow(2, "", "", columnCount);
    return `${template}\n\n== Справи ==\n${tableHeader}\n${row1}\n${row2}\n|}`;
  }

  const placeholderRow = buildSpravaRow(1, "", "", columnCount);
  const actualRow = buildSpravaRow(params.sprava, params.spravaName, params.dates, columnCount);
  return `${template}\n\n== Справи ==\n${tableHeader}\n${placeholderRow}\n${actualRow}\n|}`;
}

export function parseOpysPage(content: string): ParsedOpysPage {
  const tableStartIdx = content.indexOf('{| class="wikitable sortable"');
  if (tableStartIdx === -1) {
    throw new Error("No wikitable found in page content");
  }

  const tableEndIdx = content.indexOf("\n|}", tableStartIdx);
  if (tableEndIdx === -1) {
    throw new Error("No wikitable closing found in page content");
  }

  const before = content.slice(0, tableStartIdx);
  const tableContent = content.slice(tableStartIdx, tableEndIdx + 3); // includes \n|}
  const after = content.slice(tableEndIdx + 3);

  const lines = tableContent.split("\n");
  const tableStart = lines[0];

  // Find header line (starts with !)
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

  // Parse rows: each row starts with |- and the next line has cells
  const rows: { raw: string; spravaNum: number | null }[] = [];
  let i = headerLineIdx + 1;
  while (i < lines.length) {
    if (lines[i] === "|-") {
      // Collect all lines for this row until next |- or |}
      const rowLines = [lines[i]];
      i++;
      while (i < lines.length && !lines[i].startsWith("|-") && lines[i] !== "|}") {
        rowLines.push(lines[i]);
        i++;
      }
      const raw = rowLines.join("\n");
      const spravaMatch = raw.match(/\[\[\/(\d+)\/\]\]/);
      const spravaNum = spravaMatch ? parseInt(spravaMatch[1], 10) : null;
      rows.push({ raw, spravaNum });
    } else {
      i++;
    }
  }

  return { before, tableStart, headerLine, rows, after, columnCount };
}

export function insertSpravaRow(
  parsed: ParsedOpysPage,
  sprava: number,
  name: string,
  dates: string
): string {
  // Check if sprava already exists
  if (parsed.rows.some((r) => r.spravaNum === sprava)) {
    return rebuildPage(parsed);
  }

  const newRow = buildSpravaRow(sprava, name, dates, parsed.columnCount);

  // Find insertion point
  let insertIdx = parsed.rows.length;
  for (let i = 0; i < parsed.rows.length; i++) {
    if (parsed.rows[i].spravaNum !== null && parsed.rows[i].spravaNum! > sprava) {
      insertIdx = i;
      break;
    }
  }

  const newRows = [...parsed.rows];
  newRows.splice(insertIdx, 0, { raw: newRow, spravaNum: sprava });

  return rebuildPage({ ...parsed, rows: newRows });
}

function rebuildPage(parsed: ParsedOpysPage): string {
  const rowLines = parsed.rows.map((r) => r.raw).join("\n");
  const table = rowLines
    ? `${parsed.tableStart}\n${parsed.headerLine}\n${rowLines}\n|}`
    : `${parsed.tableStart}\n${parsed.headerLine}\n|}`;
  return `${parsed.before}${table}${parsed.after}`;
}

export function buildOrUpdateOpysContent(
  existingContent: string | null,
  params: OpysPageParams
): string {
  if (existingContent === null) {
    return buildNewOpysPage(params);
  }
  const parsed = parseOpysPage(existingContent);
  return insertSpravaRow(parsed, params.sprava, params.spravaName, params.dates);
}
