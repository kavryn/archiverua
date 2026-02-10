import "server-only";

const API_URL = "https://commons.wikimedia.org/w/api.php";

export async function getCsrfToken(accessToken: string): Promise<string> {
  const url = `${API_URL}?action=query&meta=tokens&type=csrf&format=json`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to get CSRF token: ${res.status}`);
  }
  const data = await res.json();
  return data.query.tokens.csrftoken as string;
}

export interface UploadParams {
  accessToken: string;
  csrfToken: string;
  filename: string;
  file: Blob;
  description: string;
  comment: string;
}

export async function uploadFile(params: UploadParams): Promise<string> {
  const fd = new FormData();
  fd.append("action", "upload");
  fd.append("format", "json");
  fd.append("filename", params.filename);
  fd.append("text", params.description);
  fd.append("comment", params.comment);
  fd.append("token", params.csrfToken);
  fd.append("ignorewarnings", "1");
  fd.append("file", params.file, params.filename);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: fd,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.info ?? "Upload error");
  }

  const fileUrl: string =
    data.upload?.imageinfo?.url ??
    `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(params.filename)}`;

  return fileUrl;
}

export function buildFilename(
  abbr: string,
  fond: string,
  opis: string,
  sprava: string,
  ext: string
): string {
  return `${abbr} Ф. ${fond} Оп. ${opis} Спр. ${sprava}.${ext}`;
}

export interface DescriptionParams {
  archiveName: string;
  abbr: string;
  fond: string;
  opis: string;
  sprava: string;
  dateFrom: string;
  dateTo: string;
  isArbitraryDate: boolean;
  isRussianEmpire: boolean;
}

export function buildDescription(params: DescriptionParams): string {
  const dateStr = params.isArbitraryDate
    ? `${params.dateFrom}–${params.dateTo}`
    : `${params.dateFrom}–${params.dateTo}`;

  const source = `[[${params.archiveName}]] (${params.abbr}), Ф. ${params.fond}, Оп. ${params.opis}, Спр. ${params.sprava}`;

  const licenseTemplate = params.isRussianEmpire
    ? "{{PD-Russia-2}}"
    : "{{PD-old-auto}}";

  return `=={{int:filedesc}}==
{{Information
|description={{uk|1=Документ з ${source}}}
|date=${dateStr}
|source=${source}
|author=Невідомо
|permission=
|other versions=
}}

=={{int:license-header}}==
${licenseTemplate}

[[Category:Documents from Ukrainian archives]]
`;
}
