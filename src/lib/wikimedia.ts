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

  if (data.upload?.warnings?.duplicate) {
    throw new DuplicateFileError(data.upload.warnings.duplicate[0]);
  }

  if (data.error) {
    throw new Error(data.error.info ?? "Upload error");
  }

  const fileUrl: string =
    data.upload?.imageinfo?.url ??
    `${WIKI_BASE}/wiki/File:${encodeURIComponent(params.filename)}`;

  return fileUrl;
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

  if (data.upload?.warnings?.duplicate) {
    throw new DuplicateFileError(data.upload.warnings.duplicate[0]);
  }

  if (data.error) {
    throw new Error(data.error.info ?? "Commit upload error");
  }

  const fileUrl: string =
    data.upload?.imageinfo?.url ??
    `${WIKI_BASE}/wiki/File:${encodeURIComponent(params.filename)}`;

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

export function buildWikisourcePageContent(
  spravaName: string,
  dateStr: string,
  filename: string
): string {
  return `{{Архіви/справа
 | назва = ${spravaName}
 | рік = ${dateStr}
 | link_commons = File:${filename}
 | примітки =
}}`;
}

export interface CreateWikisourcePageParams {
  accessToken: string;
  csrfToken: string;
  title: string;
  content: string;
  summary: string;
}

export async function createWikisourcePage(params: CreateWikisourcePageParams): Promise<string | null> {
  const fd = new FormData();
  fd.append("action", "edit");
  fd.append("format", "json");
  fd.append("title", params.title);
  fd.append("createonly", "1");
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
    if (data.error.code === "articleexists") {
      return null;
    }
    throw new Error(data.error.info ?? "Wikisource edit error");
  }

  return `${WIKISOURCE_BASE}/wiki/${encodeURIComponent(params.title)}`;
}

export function buildDescription(params: DescriptionParams): string {
  const dateStr = params.isArbitraryDate
    ? `${params.dateFrom}–${params.dateTo}`
    : `${params.dateFrom}–${params.dateTo}`;

  const source = `[[${params.archiveName}]] (${params.abbr}), Ф. ${params.fond}, Оп. ${params.opis}, Спр. ${params.sprava}`;

  return `=={{int:filedesc}}==
{{Information
|description={{uk|1=Документ з ${source}}}
|date=${dateStr}
|source=${source}
|author=${params.author ? params.author : "{{author|unknown}}"}
}}

=={{int:license-header}}==
${params.license}

[[Category:Documents from Ukrainian archives]]
`;
}
