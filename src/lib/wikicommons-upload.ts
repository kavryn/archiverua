export interface CommonsDescriptionParams {
  archiveName: string;
  category: string;
  fond: string;
  opys: string;
  sprava: string;
  spravaName?: string;
  dateFrom: string;
  dateTo: string;
  isArbitraryDate: boolean;
  license: string;
  author?: string;
}

export const COMMONS_UPLOAD_COMMENT = "Завантаження через Вікіархіватор";

function buildDateStr(isArbitraryDate: boolean, dateFrom: string, dateTo: string): string {
  if (isArbitraryDate || !dateTo || dateFrom === dateTo) return dateFrom;
  return `${dateFrom}–${dateTo}`;
}

export function buildCommonsDescription(params: CommonsDescriptionParams): string {
  const dateStr = buildDateStr(params.isArbitraryDate, params.dateFrom, params.dateTo);

  return `=={{int:filedesc}}==
{{Information
|description={{uk|1=Фонд ${params.fond}, опис ${params.opys}, справа ${params.sprava}${params.spravaName ? `. ${params.spravaName}` : ""}}}
|date=${dateStr}
|source=${params.archiveName}
|author=${params.author ? params.author : "{{author|unknown}}"}
}}

=={{int:license-header}}==
${params.license}

[[Category:${params.category}]]
`;
}
