import { getTemplateParam, setTemplateParam } from "./wikitemplate";
import { wikisource } from "./wikimedia";

export interface SpravaPageParams {
  archiveAbbr: string;
  fond: string;
  opys: string;
  sprava: string;
  spravaName: string;
  dates: string;
  publicFileName: string;
}

export interface UpdateSpravaPageParams extends SpravaPageParams {
  accessToken: string;
  csrfToken: string;
}

export function buildNewSpravaPage(params: SpravaPageParams): string {
  return `{{Архіви/справа
 | назва = ${params.spravaName}
 | рік = ${params.dates}
 | link_commons = File:${params.publicFileName}
 | примітки =
}}`;
}

const LINK_COMMONS_FIELDS = [
  "link_commons",
  "link_commons2",
  "link_commons3",
  "link_commons4",
  "link_commons5",
];

export function addLinkCommonsToContent(
  content: string,
  publicFileName: string
): string {
  const fileValue = `File:${publicFileName}`;
  for (const field of LINK_COMMONS_FIELDS) {
    const existing = getTemplateParam(content, field);
    if (existing === null || existing === "") {
      return setTemplateParam(content, field, fileValue);
    }
    if (existing === fileValue) {
      return content;
    }
    // non-empty and different — try next field
  }
  return content;
}

export function buildOrUpdateSpravaContent(
  existingContent: string | null,
  params: SpravaPageParams
): string {
  if (existingContent === null) {
    return buildNewSpravaPage(params);
  }
  return addLinkCommonsToContent(existingContent, params.publicFileName);
}

export async function updateSpravaPage(
  params: UpdateSpravaPageParams
): Promise<{ url: string; created: boolean }> {
  const title = `Архів:${params.archiveAbbr}/${params.fond}/${params.opys}/${params.sprava}`;
  const existingContent = await wikisource.getPageContent(params.accessToken, title);
  const content = buildOrUpdateSpravaContent(existingContent, params);
  const url = await wikisource.editPage({
    accessToken: params.accessToken,
    csrfToken: params.csrfToken,
    title,
    content,
    summary: "Додано посилання на Commons",
  });
  return { url, created: existingContent === null };
}
