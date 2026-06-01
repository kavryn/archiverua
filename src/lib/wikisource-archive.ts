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
import { wikisource } from "./wikimedia";

export interface ArchivePageParams {
  archiveAbbr: string;
  archiveName: string;
  fond: string;
  fondName: string;
}

const ARCHIVE_FIELD_ALIASES: RowFieldAliases = {
  id: ["№", "Фонд"],
  title: ["Назва фонду", "Назва"],
  dates: ["Крайні дати", "Рік", "Роки", "Дата"],
  pages: ["Справ"],
};

function logMissingArchiveField(title: string, info: MissingFieldInfo): void {
  logWarning(
    "wikisource-archive",
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

export function extractFondPrefix(fond: string): string {
  // Matches Cyrillic/Latin prefix before dash: "Р-34" → "Р", "Н-3777" → "Н"
  const match = fond.match(/^([А-ЯҐЄІЇA-Z]+)-/);
  return match ? match[1] : "Д";
}

export function getArchivePageTitle(archiveAbbr: string, fond: string): string {
  if (archiveAbbr === "ЦДІАЛ" || archiveAbbr === "ЦДІАК" || archiveAbbr === "ЦДАВО") {
    return `Архів:${archiveAbbr}`;
  }
  return `Архів:${archiveAbbr}/${extractFondPrefix(fond)}`;
}

export function buildFondRow(
  fond: string,
  name: string,
  columnCount: number
): string {
  return buildRow(fond, [name, "", ""], columnCount, "../");
}

export function buildNewArchivePage(params: ArchivePageParams): string {
  const template = `{{заголовок
 | назва = [[../]]
 | автор =
 | секція = ${params.archiveName}
 | попередня =
 | наступна =
 | примітки =
}}`;

  const tableHeader = `{| class="wikitable sortable"
!№||Назва фонду||Крайні дати||Справ`;

  const columnCount = 4;

  const prefix = extractFondPrefix(params.fond);
  // Strip prefix+dash to get numeric part: "Р-34" → "34", "1" → "1"
  const numericPart = prefix === "Д" ? params.fond : params.fond.replace(/^[А-ЯҐЄІЇA-Z]+-/, "");
  const isFirst = numericPart === "1";

  if (isFirst) {
    const row = buildFondRow(params.fond, params.fondName, columnCount);
    return `${template}\n\n== Фонди ==\n${tableHeader}\n${row}\n|}`;
  }

  const placeholderId = prefix === "Д" ? "1" : `${prefix}-1`;
  const placeholderRow = buildFondRow(placeholderId, "", columnCount);
  const actualRow = buildFondRow(params.fond, params.fondName, columnCount);
  return `${template}\n\n== Фонди ==\n${tableHeader}\n${placeholderRow}\n${actualRow}\n|}`;
}

export function parseArchivePage(content: string, params: ArchivePageParams): ParsedWikiTable {
  // Matches [[../Р-34/]] → "Р-34", [[../1/]] → "1"
  const parseOptions = { idRegex: /\[\[\.\.\/([^/]+)\/\]\]/ };
  return parseOrEmptyTable(content, ARCHIVE_SCHEMA, parseOptions, (err) => {
    const title = getArchivePageTitle(params.archiveAbbr, params.fond);
    logWarning("wikisource-archive", `No wikitable on page ${title}: ${err instanceof Error ? err.message : err}`, { title });
  });
}

export function fondCompare(a: string, b: string): number {
  // Strip prefix+dash for numeric comparison: "Р-34" → "34", "5" → "5"
  const stripPrefix = (s: string) => s.replace(/^[А-ЯҐЄІЇA-Z]+-/, "");
  return naturalCompare(stripPrefix(a), stripPrefix(b));
}

export function insertFondRow(
  parsed: ParsedWikiTable,
  fond: string,
  name: string,
  title?: string
): string {
  const newRow = buildMappedRow(
    fond,
    { title: name, dates: "", pages: "" },
    parsed.headers,
    ARCHIVE_FIELD_ALIASES,
    "../",
    title ? (info) => logMissingArchiveField(title, info) : undefined
  );
  return insertRow(parsed, fond, newRow, fondCompare);
}

const ARCHIVE_SCHEMA: FallbackSchema = {
  tableStart: '{| class="wikitable sortable"',
  headerLine: "!№||Назва фонду||Крайні дати||Справ",
  columnCount: 4,
};

export function buildOrUpdateArchiveContent(
  existingContent: string | null,
  params: ArchivePageParams
): string {
  if (existingContent === null) {
    return buildNewArchivePage(params);
  }
  const parsed = parseArchivePage(existingContent, params);
  const title = getArchivePageTitle(params.archiveAbbr, params.fond);
  return insertFondRow(parsed, params.fond, params.fondName, title);
}

export interface UpdateArchivePageParams extends ArchivePageParams {
  accessToken: string;
  csrfToken: string;
}

export async function updateArchivePage(
  params: UpdateArchivePageParams
): Promise<{ url: string; created: boolean }> {
  const title = getArchivePageTitle(params.archiveAbbr, params.fond);
  const existingContent = await wikisource.getPageContent(params.accessToken, title);
  const content = buildOrUpdateArchiveContent(existingContent, params);
  const url = await wikisource.editPage({
    accessToken: params.accessToken,
    csrfToken: params.csrfToken,
    title,
    content,
    summary: `Додано фонд ${params.fond}`,
  });
  return { url, created: existingContent === null };
}
