import {
  parseWikiTable,
  buildRow,
  insertRow,
  naturalCompare,
  type ParsedWikiTable,
} from "./wikitable";

export type { ParsedWikiTable };

export interface OpysPageParams {
  archiveAbbr: string;
  fond: string;
  opis: string;
  sprava: string;
  spravaName: string;
  opisName: string;
  dates: string;
}

export function buildSpravaRow(
  sprava: string,
  name: string,
  dates: string,
  columnCount: number
): string {
  return buildRow(sprava, [name, dates, "", ""], columnCount);
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

  if (params.sprava === "1") {
    const row1 = buildSpravaRow(params.sprava, params.spravaName, params.dates, columnCount);
    return `${template}\n\n== Справи ==\n${tableHeader}\n${row1}\n|}`;
  }

  const placeholderRow = buildSpravaRow("1", "", "", columnCount);
  const actualRow = buildSpravaRow(params.sprava, params.spravaName, params.dates, columnCount);
  return `${template}\n\n== Справи ==\n${tableHeader}\n${placeholderRow}\n${actualRow}\n|}`;
}

export function parseOpysPage(content: string): ParsedWikiTable {
  return parseWikiTable(content);
}

export function insertSpravaRow(
  parsed: ParsedWikiTable,
  sprava: string,
  name: string,
  dates: string
): string {
  const newRow = buildSpravaRow(sprava, name, dates, parsed.columnCount);
  return insertRow(parsed, sprava, newRow, naturalCompare);
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