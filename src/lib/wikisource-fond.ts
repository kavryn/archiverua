import {
  parseWikiTable,
  parseOrEmptyTable,
  buildRow,
  insertRow,
  naturalCompare,
  type ParsedWikiTable,
  type FallbackSchema,
} from "./wikitable";
import { logWarning } from "./logger";
import { wikisource } from "./wikimedia";

export interface FondPageParams {
  archiveAbbr: string;
  fond: string;
  opys: string;
  opysName: string;
  fondName: string;
}

export function buildOpysRow(
  opys: string,
  name: string,
  columnCount: number
): string {
  return buildRow(opys, [name, "", ""], columnCount);
}

export function buildNewFondPage(params: FondPageParams): string {
  const template = `{{Архіви/фонд
  | назва = ${params.fondName}
  | примітки =
}}`;

  const tableHeader = `{| class="wikitable sortable"
!№!!Анотація!!Крайні дати!!Справ`;

  const columnCount = 4;

  if (params.opys === "1") {
    const row1 = buildOpysRow(params.opys, params.opysName, columnCount);
    return `${template}\n\n== Описи ==\n${tableHeader}\n${row1}\n|}`;
  }

  const placeholderRow = buildOpysRow("1", "", columnCount);
  const actualRow = buildOpysRow(params.opys, params.opysName, columnCount);
  return `${template}\n\n== Описи ==\n${tableHeader}\n${placeholderRow}\n${actualRow}\n|}`;
}

export function parseFondPage(content: string): ParsedWikiTable {
  return parseWikiTable(content);
}

export function insertOpysRow(
  parsed: ParsedWikiTable,
  opys: string,
  name: string
): string {
  const newRow = buildOpysRow(opys, name, parsed.columnCount);
  return insertRow(parsed, opys, newRow, naturalCompare);
}

const FOND_SCHEMA: FallbackSchema = {
  tableStart: '{| class="wikitable sortable"',
  headerLine: "!№!!Анотація!!Крайні дати!!Справ",
  columnCount: 4,
};

export function buildOrUpdateFondContent(
  existingContent: string | null,
  params: FondPageParams
): string {
  if (existingContent === null) {
    return buildNewFondPage(params);
  }
  const title = `Архів:${params.archiveAbbr}/${params.fond}`;
  const parsed = parseOrEmptyTable(existingContent, FOND_SCHEMA, undefined, (err) => {
    logWarning("wikisource-fond", `No wikitable on page ${title}: ${err instanceof Error ? err.message : err}`, { title });
  });
  return insertOpysRow(parsed, params.opys, params.opysName);
}

export interface UpdateFondPageParams extends FondPageParams {
  accessToken: string;
  csrfToken: string;
}

export async function updateFondPage(
  params: UpdateFondPageParams
): Promise<{ url: string; created: boolean }> {
  const title = `Архів:${params.archiveAbbr}/${params.fond}`;
  const existingContent = await wikisource.getPageContent(params.accessToken, title);
  const content = buildOrUpdateFondContent(existingContent, params);
  const url = await wikisource.editPage({
    accessToken: params.accessToken,
    csrfToken: params.csrfToken,
    title,
    content,
    summary: `Додано опис ${params.opys}`,
  });
  return { url, created: existingContent === null };
}
