import {
  parseOrEmptyTable,
  buildRow,
  buildMappedRow,
  insertRow,
  naturalCompare,
  type ParsedWikiTable,
  type FallbackSchema,
  type MissingFieldInfo,
  type RowFieldAliases,
} from "./wikitable";
import { logWarning } from "./logger";
import { updateWikisourcePage } from "./wikimedia";

export type { ParsedWikiTable };

export interface OpysPageParams {
  archiveAbbr: string;
  fond: string;
  opys: string;
  sprava: string;
  spravaName: string;
  opysName: string;
  dates: string;
}

const OPYS_FIELD_ALIASES: RowFieldAliases = {
  id: ["№"],
  title: ["Назва", "Анотація"],
  dates: ["Крайні дати", "Крайні роки", "Рік", "Роки", "Дата", "Дати"],
  pages: ["Сторінки"],
  notes: ["Примітки"],
};

function logMissingOpysField(title: string, info: MissingFieldInfo): void {
  logWarning(
    "wikisource-opys",
    `Could not map field "${info.fieldKey}" while updating ${title}`,
    {
      title,
      field: info.fieldKey,
      value: info.value,
      expectedHeaders: info.aliases,
      tableHeaders: info.headers,
    }
  );
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
  | назва = ${params.opysName}
  | рік =
  | примітки =
}}`;

  const tableHeader = `{| class="wikitable sortable"
!№!!Назва!!Роки!!Сторінки!!Примітки`;

  const columnCount = 5;

  if (params.sprava === "1") {
    const row1 = buildSpravaRow(params.sprava, params.spravaName, params.dates, columnCount);
    return `${template}\n\n== Справи ==\n${tableHeader}\n${row1}\n|}`;
  }

  const placeholderRow = buildSpravaRow("1", "", "", columnCount);
  const actualRow = buildSpravaRow(params.sprava, params.spravaName, params.dates, columnCount);
  return `${template}\n\n== Справи ==\n${tableHeader}\n${placeholderRow}\n${actualRow}\n|}`;
}

export function parseOpysPage(content: string, params: OpysPageParams): ParsedWikiTable {
  return parseOrEmptyTable(content, OPYS_SCHEMA, undefined, (err) => {
    const title = `Архів:${params.archiveAbbr}/${params.fond}/${params.opys}`;
    logWarning("wikisource-opys", `No wikitable on page ${title}: ${err instanceof Error ? err.message : err}`, { title });
  });
}

export function insertSpravaRow(
  parsed: ParsedWikiTable,
  sprava: string,
  name: string,
  dates: string,
  title?: string
): string {
  const newRow = buildMappedRow(
    sprava,
    { title: name, dates, pages: "", notes: "" },
    parsed.headers,
    OPYS_FIELD_ALIASES,
    "/",
    title ? (info) => logMissingOpysField(title, info) : undefined
  );
  return insertRow(parsed, sprava, newRow, naturalCompare);
}

const OPYS_SCHEMA: FallbackSchema = {
  tableStart: '{| class="wikitable sortable"',
  headerLine: "!№!!Назва!!Роки!!Сторінки!!Примітки",
  columnCount: 5,
};

export function buildOrUpdateOpysContent(
  existingContent: string | null,
  params: OpysPageParams
): string {
  if (existingContent === null) {
    return buildNewOpysPage(params);
  }
  const parsed = parseOpysPage(existingContent, params);
  const title = `Архів:${params.archiveAbbr}/${params.fond}/${params.opys}`;
  return insertSpravaRow(parsed, params.sprava, params.spravaName, params.dates, title);
}

export interface UpdateOpysPageParams extends OpysPageParams {
  accessToken: string;
  csrfToken: string;
}

export async function updateOpysPage(
  params: UpdateOpysPageParams
): Promise<{ url: string; created: boolean }> {
  const title = `Архів:${params.archiveAbbr}/${params.fond}/${params.opys}`;
  return updateWikisourcePage({
    accessToken: params.accessToken,
    csrfToken: params.csrfToken,
    title,
    summary: `Додано справу ${params.sprava}`,
    build: (existingContent) => buildOrUpdateOpysContent(existingContent, params),
  });
}
