import {
  parseWikiTable,
  buildRow,
  insertRow,
  naturalCompare,
  type ParsedWikiTable,
} from "./wikitable";

export interface ArchivePageParams {
  archiveAbbr: string;
  archiveName: string;
  fond: string;
  fondName: string;
}

export function extractFondPrefix(fond: string): string {
  // Matches Cyrillic/Latin prefix before dash: "Р-34" → "Р", "Н-3777" → "Н"
  const match = fond.match(/^([А-ЯҐЄІЇA-Z]+)-/);
  return match ? match[1] : "Д";
}

export function getArchivePageTitle(archiveAbbr: string, fond: string): string {
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

export function parseArchivePage(content: string): ParsedWikiTable {
  // Matches [[../Р-34/]] → "Р-34", [[../1/]] → "1"
  return parseWikiTable(content, { idRegex: /\[\[\.\.\/([^/]+)\/\]\]/ });
}

export function fondCompare(a: string, b: string): number {
  // Strip prefix+dash for numeric comparison: "Р-34" → "34", "5" → "5"
  const stripPrefix = (s: string) => s.replace(/^[А-ЯҐЄІЇA-Z]+-/, "");
  return naturalCompare(stripPrefix(a), stripPrefix(b));
}

export function insertFondRow(
  parsed: ParsedWikiTable,
  fond: string,
  name: string
): string {
  const newRow = buildFondRow(fond, name, parsed.columnCount);
  return insertRow(parsed, fond, newRow, fondCompare);
}

export function buildOrUpdateArchiveContent(
  existingContent: string | null,
  params: ArchivePageParams
): string {
  if (existingContent === null) {
    return buildNewArchivePage(params);
  }
  const parsed = parseArchivePage(existingContent);
  return insertFondRow(parsed, params.fond, params.fondName);
}
