import { wikiFetch } from "@/lib/wiki-fetch";

const WIKICOMMONS_API_URL =
  process.env.NEXT_PUBLIC_WIKICOMMONS_API_URL ?? "https://commons.wikimedia.org/w/api.php";
const WIKICOMMONS_BASE = WIKICOMMONS_API_URL.replace(/\/w\/api\.php$/, "");

const WIKISOURCE_API_URL =
  process.env.NEXT_PUBLIC_WIKISOURCE_API_URL ?? "https://uk.wikisource.org/w/api.php";
const WIKISOURCE_BASE = WIKISOURCE_API_URL.replace(/\/w\/api\.php$/, "");

export interface UploadParams {
  accessToken: string;
  csrfToken: string;
  filename: string;
  file: Blob;
  description: string;
  comment: string;
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
  filename: string;
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

export interface UserContrib {
  title: string;
  timestamp: string;
}

export interface EditWikisourcePageParams {
  accessToken: string;
  csrfToken: string;
  title: string;
  content: string;
  summary: string;
}

export interface BlacklistResult {
  blacklisted: boolean;
  reason?: string;
  line?: string;
}

export class DuplicateFileError extends Error {
  duplicateUrl: string;
  constructor(filename: string) {
    super("Файл з таким вмістом вже існує у Вікісховищі");
    this.duplicateUrl = `${WIKICOMMONS_BASE}/wiki/File:${encodeURIComponent(filename)}`;
  }
}

const WARNING_MESSAGES: Record<string, string> = {
  "duplicate-archive": "Файл з таким вмістом вже існував у Вікісховищі, але був видалений",
  "exists": "Файл з такою назвою вже існує",
  "was-deleted": "Файл з такою назвою вже існував, але був видалений",
  "badfilename": "Некоректна назва файлу",
};

function throwOnUploadWarnings(warnings: Record<string, unknown> | undefined): void {
  if (!warnings) return;
  console.error("[throwOnUploadWarnings] Upload warnings received:", JSON.stringify(warnings));
  if (warnings.duplicate) {
    throw new DuplicateFileError((warnings.duplicate as string[])[0]);
  }
  for (const key of Object.keys(warnings)) {
    throw new Error(WARNING_MESSAGES[key] ?? `Помилка при завантаженні: ${key}`);
  }
}

class WikiClient {
  constructor(protected apiUrl: string, protected baseUrl: string) {}

  pageUrl(title: string): string {
    return `${this.baseUrl}/wiki/${encodeURIComponent(title)}`;
  }

  async getCsrfToken(accessToken: string): Promise<string> {
    const url = `${this.apiUrl}?action=query&meta=tokens&type=csrf&format=json`;
    const res = await wikiFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to get CSRF token: ${res.status}`);
    }
    const data = await res.json();
    return data.query.tokens.csrftoken as string;
  }
}

class WikicommonsClient extends WikiClient {
  constructor() {
    super(WIKICOMMONS_API_URL, WIKICOMMONS_BASE);
  }

  async fileExists(filename: string): Promise<boolean> {
    const params = new URLSearchParams({
      action: "query",
      titles: `File:${filename}`,
      prop: "info",
      format: "json",
    });
    const res = await wikiFetch(`${this.apiUrl}?${params}`);
    if (!res.ok) {
      throw new Error(`Wikimedia API error: ${res.status}`);
    }
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return false;
    const page = Object.values(pages)[0] as Record<string, unknown>;
    return !("missing" in page);
  }

  async checkTitleBlacklist(filename: string): Promise<BlacklistResult> {
    const params = new URLSearchParams({
      action: "titleblacklist",
      format: "json",
      tbaction: "create",
      tbtitle: `File:${filename}`,
      formatversion: "2",
    });
    const res = await wikiFetch(`${this.apiUrl}?${params}`);
    const data = await res.json();
    const tbResult = data?.titleblacklist;
    return {
      blacklisted: tbResult?.result === "blacklisted",
      reason: tbResult?.reason,
      line: tbResult?.line,
    };
  }

  async uploadFile(params: UploadParams): Promise<string> {
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("format", "json");
    fd.append("filename", params.filename);
    fd.append("text", params.description);
    fd.append("comment", params.comment);
    fd.append("token", params.csrfToken);
    fd.append("file", params.file, params.filename);

    const res = await wikiFetch(this.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: fd,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }

    const data = await res.json();

    throwOnUploadWarnings(data.upload?.warnings);

    if (data.error) {
      console.error("[uploadFile] API error:", JSON.stringify(data.error));
      throw new Error(data.error.info ?? "Upload error");
    }

    return `${this.baseUrl}/wiki/File:${encodeURIComponent(params.filename)}`;
  }

  async uploadFirstChunk(params: ChunkUploadFirstParams): Promise<ChunkUploadResult> {
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("format", "json");
    fd.append("filename", params.filename);
    fd.append("stash", "1");
    fd.append("offset", "0");
    fd.append("filesize", String(params.fileSize));
    fd.append("token", params.csrfToken);
    fd.append("ignorewarnings", "1");
    fd.append("chunk", params.chunk, params.filename);

    const res = await wikiFetch(this.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: fd,
    });

    if (!res.ok) {
      throw new Error(`Chunk upload failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      console.error("[uploadFirstChunk] API error:", JSON.stringify(data.error));
      throw new Error(data.error.info ?? "Chunk upload error");
    }

    return {
      filekey: data.upload.filekey as string,
      offset: data.upload.offset as number,
    };
  }

  async uploadNextChunk(params: ChunkUploadNextParams): Promise<ChunkUploadResult> {
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("format", "json");
    fd.append("stash", "1");
    fd.append("filekey", params.filekey);
    fd.append("filename", params.filename);
    fd.append("offset", String(params.offset));
    fd.append("filesize", String(params.fileSize));
    fd.append("token", params.csrfToken);
    fd.append("ignorewarnings", "1");
    fd.append("chunk", params.chunk, "chunk");

    const res = await wikiFetch(this.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: fd,
    });

    if (!res.ok) {
      throw new Error(`Chunk upload failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      console.error("[uploadNextChunk] API error:", JSON.stringify(data.error));
      throw new Error(data.error.info ?? "Chunk upload error");
    }

    return {
      filekey: data.upload.filekey as string,
      offset: data.upload.offset as number,
    };
  }

  async commitChunkedUpload(params: CommitUploadParams): Promise<string> {
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("format", "json");
    fd.append("filename", params.filename);
    fd.append("filekey", params.filekey);
    fd.append("text", params.description);
    fd.append("comment", params.comment);
    fd.append("token", params.csrfToken);

    const res = await wikiFetch(this.apiUrl, {
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
      console.error("[commitChunkedUpload] API error:", JSON.stringify(data.error));
      throw new Error(data.error.info ?? "Commit upload error");
    }

    return `${this.baseUrl}/wiki/File:${encodeURIComponent(params.filename)}`;
  }

  async getUserContribs(username: string, oauthCid: string): Promise<UserContrib[]> {
    const params = new URLSearchParams({
      action: "query",
      list: "usercontribs",
      ucuser: username,
      uctag: `OAuth CID: ${oauthCid}`,
      uclimit: "500",
      ucnamespace: "6",
      ucprop: "title|timestamp",
      format: "json",
    });

    const res = await wikiFetch(`${this.apiUrl}?${params}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Wikimedia API error: ${res.status}`);
    }
    const data = await res.json();
    return (data.query?.usercontribs ?? []) as UserContrib[];
  }
}

class WikisourceClient extends WikiClient {
  constructor() {
    super(WIKISOURCE_API_URL, WIKISOURCE_BASE);
  }

  async getPageContent(accessToken: string, title: string): Promise<string | null> {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: title,
      format: "json",
    });

    const res = await wikiFetch(`${this.apiUrl}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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

  async editPage(params: EditWikisourcePageParams): Promise<string> {
    const fd = new FormData();
    fd.append("action", "edit");
    fd.append("format", "json");
    fd.append("title", params.title);
    fd.append("text", params.content);
    fd.append("summary", params.summary);
    fd.append("token", params.csrfToken);

    const res = await wikiFetch(this.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: fd,
    });

    if (!res.ok) {
      throw new Error(`Wikisource edit failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      console.error("[editPage] API error:", JSON.stringify(data.error));
      throw new Error(data.error.info ?? "Wikisource edit error");
    }

    return `${this.baseUrl}/wiki/${encodeURIComponent(params.title)}`;
  }
}

export const wikicommons = new WikicommonsClient();
export const wikisource = new WikisourceClient();
