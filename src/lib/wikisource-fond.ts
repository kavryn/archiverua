import {
  parseWikiTable,
  buildRow,
  insertRow,
  naturalCompare,
  type ParsedWikiTable,
} from "./wikitable";

export interface FondPageParams {
  archiveAbbr: string;
  fond: string;
  opis: string;
  opisName: string;
  fondName: string;
}

export function buildOpisRow(
  opis: string,
  name: string,
  columnCount: number
): string {
  return buildRow(opis, [name, "", ""], columnCount);
}

export function buildNewFondPage(params: FondPageParams): string {
  const template = `{{Архіви/фонд
  | назва = ${params.fondName}
  | примітки =
}}`;

  const tableHeader = `{| class="wikitable sortable"
!№!!Анотація!!Крайні дати!!Справ`;

  const columnCount = 4;

  if (params.opis === "1") {
    const row1 = buildOpisRow(params.opis, params.opisName, columnCount);
    return `${template}\n\n== Описи ==\n${tableHeader}\n${row1}\n|}`;
  }

  const placeholderRow = buildOpisRow("1", "", columnCount);
  const actualRow = buildOpisRow(params.opis, params.opisName, columnCount);
  return `${template}\n\n== Описи ==\n${tableHeader}\n${placeholderRow}\n${actualRow}\n|}`;
}

export function parseFondPage(content: string): ParsedWikiTable {
  return parseWikiTable(content);
}

export function insertOpisRow(
  parsed: ParsedWikiTable,
  opis: string,
  name: string
): string {
  const newRow = buildOpisRow(opis, name, parsed.columnCount);
  return insertRow(parsed, opis, newRow, naturalCompare);
}

export function buildOrUpdateFondContent(
  existingContent: string | null,
  params: FondPageParams
): string {
  if (existingContent === null) {
    return buildNewFondPage(params);
  }
  const parsed = parseFondPage(existingContent);
  return insertOpisRow(parsed, params.opis, params.opisName);
}
