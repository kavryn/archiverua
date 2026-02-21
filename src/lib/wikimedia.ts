import "server-only";

const API_URL = process.env.NEXT_PUBLIC_WIKI_API_URL ?? "https://commons.wikimedia.org/w/api.php";
const WIKI_BASE = API_URL.replace(/\/w\/api\.php$/, "");

const WIKISOURCE_API_URL = process.env.NEXT_PUBLIC_WIKI_API_URL ?? "https://uk.wikisource.org/w/api.php";
const WIKISOURCE_BASE = WIKISOURCE_API_URL.replace(/\/w\/api\.php$/, "");

export class DuplicateFileError extends Error {
  duplicateUrl: string;
  constructor(filename: string) {
    super("Файл з таким вмістом вже існує у Вікісховищі");
    this.duplicateUrl = `${WIKI_BASE}/wiki/File:${encodeURIComponent(filename)}`;
  }
}

const WARNING_MESSAGES: Record<string, string> = {
  "duplicate-archive": "Файл з таким вмістом вже існував у Вікісховищі, але був видалений",
  "was-deleted": "Файл з такою назвою вже існував, але був видалений",
  "badfilename": "Некоректна назва файлу",
};

function throwOnUploadWarnings(warnings: Record<string, unknown> | undefined): void {
  if (!warnings) return;
  if (warnings.duplicate) {
    throw new DuplicateFileError((warnings.duplicate as string[])[0]);
  }
  for (const key of Object.keys(warnings)) {
    throw new Error(WARNING_MESSAGES[key] ?? `Помилка при завантаженні: ${key}`);
  }
}

export async function getCsrfToken(accessToken: string): Promise<string> {
  const url = `${API_URL}?action=query&meta=tokens&type=csrf&format=json`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    let body: string | undefined;
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    console.error("[getCsrfToken] Request failed", {
      status: res.status,
      statusText: res.statusText,
      url,
      tokenPreview: accessToken ? `${accessToken.slice(0, 8)}...` : "missing",
      body,
    });
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

  throwOnUploadWarnings(data.upload?.warnings);

  if (data.error) {
    throw new Error(data.error.info ?? "Upload error");
  }

  return `${WIKI_BASE}/wiki/File:${encodeURIComponent(params.filename)}`;
}

export interface ChunkUploadFirstParams {
  accessToken: string;
  csrfToken: string;
  filename: string;
  chunk: Blob;
  fileSize: number;
}

export interface ChunkUploadNextParams {
  accessToken: string;
  csrfToken: string;
  filekey: string;
  chunk: Blob;
  offset: number;
  fileSize: number;
}

export interface ChunkUploadResult {
  filekey: string;
  offset: number;
}

export interface CommitUploadParams {
  accessToken: string;
  csrfToken: string;
  filekey: string;
  filename: string;
  description: string;
  comment: string;
}

export async function uploadFirstChunk(params: ChunkUploadFirstParams): Promise<ChunkUploadResult> {
  const fd = new FormData();
  fd.append("action", "upload");
  fd.append("format", "json");
  fd.append("filename", params.filename);
  fd.append("stash", "1");
  fd.append("offset", "0");
  fd.append("filesize", String(params.fileSize));
  fd.append("token", params.csrfToken);
  fd.append("ignorewarnings", "1");
  fd.append("file", params.chunk, params.filename);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}` },
    body: fd,
  });

  if (!res.ok) {
    throw new Error(`Chunk upload failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.info ?? "Chunk upload error");
  }

  return {
    filekey: data.upload.filekey as string,
    offset: data.upload.offset as number,
  };
}

export async function uploadNextChunk(params: ChunkUploadNextParams): Promise<ChunkUploadResult> {
  const fd = new FormData();
  fd.append("action", "upload");
  fd.append("format", "json");
  fd.append("stash", "1");
  fd.append("filekey", params.filekey);
  fd.append("offset", String(params.offset));
  fd.append("filesize", String(params.fileSize));
  fd.append("token", params.csrfToken);
  fd.append("ignorewarnings", "1");
  fd.append("chunk", params.chunk, "chunk");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}` },
    body: fd,
  });

  if (!res.ok) {
    throw new Error(`Chunk upload failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.info ?? "Chunk upload error");
  }

  return {
    filekey: data.upload.filekey as string,
    offset: data.upload.offset as number,
  };
}

export async function commitChunkedUpload(params: CommitUploadParams): Promise<string> {
  const fd = new FormData();
  fd.append("action", "upload");
  fd.append("format", "json");
  fd.append("filename", params.filename);
  fd.append("filekey", params.filekey);
  fd.append("text", params.description);
  fd.append("comment", params.comment);
  fd.append("token", params.csrfToken);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}` },
    body: fd,
  });

  if (!res.ok) {
    throw new Error(`Commit upload failed: ${res.status}`);
  }

  const data = await res.json();

  throwOnUploadWarnings(data.upload?.warnings);

  if (data.error) {
    throw new Error(data.error.info ?? "Commit upload error");
  }

  return `${WIKI_BASE}/wiki/File:${encodeURIComponent(params.filename)}`;
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
  category: string;
  fond: string;
  opis: string;
  sprava: string;
  spravaName?: string;
  dateFrom: string;
  dateTo: string;
  isArbitraryDate: boolean;
  license: string;
  author?: string;
}

export async function getWikisourceCsrfToken(accessToken: string): Promise<string> {
  const url = `${WIKISOURCE_API_URL}?action=query&meta=tokens&type=csrf&format=json`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    let body: string | undefined;
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    console.error("[getWikisourceCsrfToken] Request failed", {
      status: res.status,
      statusText: res.statusText,
      url,
      tokenPreview: accessToken ? `${accessToken.slice(0, 8)}...` : "missing",
      body,
    });
    throw new Error(`Failed to get Wikisource CSRF token: ${res.status}`);
  }
  const data = await res.json();
  return data.query.tokens.csrftoken as string;
}

export function buildWikisourceDateStr(
  dateFrom: string,
  dateTo: string,
  isArbitraryDate: boolean
): string {
  if (isArbitraryDate || !dateTo || dateFrom === dateTo) {
    return dateFrom;
  }
  return `${dateFrom}-${dateTo}`;
}

export async function getWikisourcePageContent(
  accessToken: string,
  title: string
): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: title,
    format: "json",
  });

  const res = await fetch(`${WIKISOURCE_API_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "archiverua/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Wikisource page: ${res.status}`);
  }

  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0] as Record<string, unknown>;
  if ("missing" in page) return null;

  const revisions = page?.revisions as Array<Record<string, unknown>> | undefined;
  const firstRev = revisions?.[0];
  const slots = firstRev?.slots as Record<string, Record<string, string>> | undefined;
  return slots?.main?.["*"] ?? (firstRev?.["*"] as string) ?? null;
}

export interface EditWikisourcePageParams {
  accessToken: string;
  csrfToken: string;
  title: string;
  content: string;
  summary: string;
}

export async function editWikisourcePage(params: EditWikisourcePageParams): Promise<string> {
  const fd = new FormData();
  fd.append("action", "edit");
  fd.append("format", "json");
  fd.append("title", params.title);
  fd.append("text", params.content);
  fd.append("summary", params.summary);
  fd.append("token", params.csrfToken);

  const res = await fetch(WIKISOURCE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: fd,
  });

  if (!res.ok) {
    throw new Error(`Wikisource edit failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.info ?? "Wikisource edit error");
  }

  return `${WIKISOURCE_BASE}/wiki/${encodeURIComponent(params.title)}`;
}

export function buildDescription(params: DescriptionParams): string {
  const dateStr = params.isArbitraryDate
    ? `${params.dateFrom}–${params.dateTo}`
    : `${params.dateFrom}–${params.dateTo}`;

  return `=={{int:filedesc}}==
{{Information
|description={{uk|1=Фонд ${params.fond}, опис ${params.opis}, справа ${params.sprava}${params.spravaName ? ` – ${params.spravaName}` : ""}}}
|date=${dateStr}
|source=${params.archiveName}
|author=${params.author ? params.author : "{{author|unknown}}"}
}}

=={{int:license-header}}==
${params.license}

[[Category:${params.category}]]
`;
}
