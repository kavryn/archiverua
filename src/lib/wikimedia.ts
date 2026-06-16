import { wikiFetch } from "@/lib/wiki-fetch";

const WIKICOMMONS_API_URL =
  process.env.NEXT_PUBLIC_WIKICOMMONS_API_URL ?? "https://commons.wikimedia.org/w/api.php";
const WIKICOMMONS_BASE = WIKICOMMONS_API_URL.replace(/\/w\/api\.php$/, "");

const WIKISOURCE_API_URL =
  process.env.NEXT_PUBLIC_WIKISOURCE_API_URL ?? "https://uk.wikisource.org/w/api.php";
const WIKISOURCE_BASE = WIKISOURCE_API_URL.replace(/\/w\/api\.php$/, "");

// Async chunk assembly / publish polling, matching UploadWizard's checkStatus loop.
export const UPLOAD_POLL_INTERVAL_MS = 3000;
export const UPLOAD_POLL_TIMEOUT_MS = 20 * 60 * 1000;
// UploadWizard fails immediately on any checkstatus 5xx. We're more lenient
// (a single transient 504 from the edge shouldn't kill the upload), but we
// won't let a real outage quietly burn the entire 10-min budget either —
// after this many ms of *consecutive* 5xx with no successful response in
// between, the latest error is rethrown.
const UPLOAD_TRANSIENT_5XX_BUDGET_MS = 60 * 1000;

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
  useCrossOrigin?: boolean;
  useAsync?: boolean;
}

export interface ChunkUploadNextParams {
  accessToken: string;
  csrfToken: string;
  filekey: string;
  filename: string;
  chunk: Blob;
  offset: number;
  fileSize: number;
  useCrossOrigin?: boolean;
  useAsync?: boolean;
}

export interface ChunkUploadResult {
  filekey: string;
  offset: number;
  // "Continue" | "Success" — chunk stashed; "Poll" — server is processing
  // the chunk/assembly asynchronously and the client must call checkUploadStatus.
  result?: string;
  stage?: string;
  warnings?: Record<string, unknown>;
}

export interface CheckUploadStatusParams {
  accessToken: string;
  csrfToken: string;
  filekey: string;
  useCrossOrigin?: boolean;
}

export interface CommitUploadParams {
  accessToken: string;
  csrfToken: string;
  filekey: string;
  filename: string;
  description: string;
  comment: string;
  useCrossOrigin?: boolean;
  useAsync?: boolean;
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
  // Optimistic concurrency: timestamp of the revision the edit is based on
  // (from getPageContent). Omit when creating a brand-new page.
  basetimestamp?: string;
  // Timestamp at which the read happened (curtimestamp). Used by the server
  // to detect creation conflicts and as a fallback edit-conflict signal.
  starttimestamp?: string;
}

export interface WikisourcePageRevision {
  content: string | null;
  basetimestamp?: string;
  starttimestamp: string;
}

export class EditConflictError extends Error {
  constructor(message = "editconflict") {
    super(message);
    this.name = "EditConflictError";
  }
}

// Both Commons and uk.wikisource grant the `autoconfirmed` right purely by
// account age (wgAutoConfirmAge = 4 days, wgAutoConfirmCount = 0 — no edits).
export const AUTOCONFIRM_AGE_DAYS = 4;

// Wikimedia blocks publishing by accounts that are not yet autoconfirmed in two
// ways we can't satisfy client-side: an hCaptcha from ConfirmEdit, and Commons
// abuse filter 281 which disallows PDF uploads from such accounts. Both lift at
// the autoconfirmed threshold and surface as hard, non-retryable API errors.
export class UploadNotAllowedError extends Error {
  constructor(
    message = "Завантаження недоступне для нових облікових записів"
  ) {
    super(message);
    this.name = "UploadNotAllowedError";
  }
}

export interface AccountUploadAccess {
  // Whether the account is autoconfirmed on this wiki — the threshold at which
  // both the captcha and abuse filter 281 stop blocking uploads.
  isAutoconfirmed: boolean;
  // Local account registration timestamp (ISO 8601), or null if unavailable.
  // Used to estimate when the account becomes autoconfirmed.
  registrationDate: string | null;
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

export function throwOnUploadWarnings(warnings: Record<string, unknown> | undefined): void {
  const filteredWarnings = getUploadWarnings(warnings);
  if (!filteredWarnings) return;
  const entries = Object.entries(filteredWarnings);

  const duplicateWarning = entries.find(([key]) => key === "duplicate")?.[1];
  if (Array.isArray(duplicateWarning) && typeof duplicateWarning[0] === "string") {
    throw new DuplicateFileError(duplicateWarning[0]);
  }

  for (const [key] of entries) {
    throw new Error(WARNING_MESSAGES[key] ?? `Помилка при завантаженні: ${key}`);
  }
}

function getUploadWarnings(warnings: unknown): Record<string, unknown> | undefined {
  if (!warnings || typeof warnings !== "object") return undefined;

  const entries = Object.entries(warnings).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== false;
  });

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

class WikiClient {
  constructor(protected apiUrl: string, protected baseUrl: string) {}

  protected apiUrlWithCrossOrigin(useCrossOrigin = false): string {
    if (!useCrossOrigin) return this.apiUrl;
    return `${this.apiUrl}?crossorigin=1`;
  }

  pageUrl(title: string): string {
    return `${this.baseUrl}/wiki/${encodeURIComponent(title)}`;
  }

  async getCsrfToken(accessToken: string, useCrossOrigin = false): Promise<string> {
    const base = useCrossOrigin
      ? `${this.apiUrl}?action=query&meta=tokens&type=csrf&format=json&crossorigin=1`
      : `${this.apiUrl}?action=query&meta=tokens&type=csrf&format=json`;
    const res = await wikiFetch(base, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to get CSRF token: ${res.status}`);
    }
    const data = await res.json();
    return data.query.tokens.csrftoken as string;
  }

  async getAccountUploadAccess(accessToken: string): Promise<AccountUploadAccess> {
    const params = new URLSearchParams({
      action: "query",
      meta: "userinfo",
      uiprop: "rights|registrationdate",
      format: "json",
    });
    const res = await wikiFetch(`${this.apiUrl}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Failed to get account upload access: ${res.status}`);
    }
    const data = await res.json();
    const userinfo = data?.query?.userinfo ?? {};
    const rights: string[] = Array.isArray(userinfo.rights) ? userinfo.rights : [];
    const isAutoconfirmed = rights.includes("autoconfirmed");
    const registrationDate: string | null = userinfo.registrationdate ?? null;

    // A non-autoconfirmed account is necessarily recent, so it must have a local
    // registration timestamp — either real, or set to "now" when this very
    // authenticated request auto-created the local account (CentralAuth/SUL
    // auto-attach). A missing date here shouldn't be possible; it would silently
    // fail open (treated as eligible), so flag it loudly. (Old accounts with no
    // registration timestamp are fine: they're always autoconfirmed, where we
    // don't use the date at all.)
    if (!isAutoconfirmed && registrationDate === null) {
      console.error(
        `[getAccountUploadAccess] non-autoconfirmed account with no registrationdate on ${this.apiUrl}`
      );
    }

    return { isAutoconfirmed, registrationDate };
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
      console.error("[uploadFile] API error", data.error);
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
    // Ignore warnings until the final commit, when Commons validates the complete file.
    fd.append("ignorewarnings", "1");
    if (params.useAsync) {
      fd.append("async", "1");
    }
    fd.append("chunk", params.chunk, params.filename);

    const res = await wikiFetch(this.apiUrlWithCrossOrigin(params.useCrossOrigin), {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: fd,
    });

    if (!res.ok) {
      throw new Error(`Chunk upload failed: ${res.status}`);
    }

    const data = await res.json();
//     const warnings = getUploadWarnings(data.upload?.warnings);
//     const context = {
//       filename: params.filename,
//       fileSize: params.fileSize,
//       requestedOffset: 0,
//       returnedOffset: data.upload?.offset,
//       filekey: data.upload?.filekey,
//       warnings,
//     };
//     if (warnings) {
//       logWarning("wikicommons/upload-first-chunk", "Upload warnings received", context);
//     } else {
//       logInfo("wikicommons/upload-first-chunk", context);
//     }
    if (data.error) {
      console.error("[uploadFirstChunk] API error", data.error);
      throw new Error(data.error.info ?? "Chunk upload error");
    }

    return {
      filekey: data.upload.filekey as string,
      offset: data.upload.offset as number,
      result: data.upload.result as string | undefined,
      stage: data.upload.stage as string | undefined,
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
    // Ignore warnings until the final commit, when Commons validates the complete file.
    fd.append("ignorewarnings", "1");
    if (params.useAsync) {
      fd.append("async", "1");
    }
    fd.append("chunk", params.chunk, "chunk");

    const res = await wikiFetch(this.apiUrlWithCrossOrigin(params.useCrossOrigin), {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: fd,
    });

    if (!res.ok) {
      throw new Error(`Chunk upload failed: ${res.status}`);
    }

    const data = await res.json();
//     const warnings = getUploadWarnings(data.upload?.warnings);
//     const context = {
//       filename: params.filename,
//       fileSize: params.fileSize,
//       requestedOffset: params.offset,
//       returnedOffset: data.upload?.offset,
//       filekey: data.upload?.filekey,
//       warnings,
//     };
//     if (warnings) {
//       logWarning("wikicommons/upload-next-chunk", "Upload warnings received", context);
//     } else {
//       logInfo("wikicommons/upload-next-chunk", context);
//     }
    if (data.error) {
      console.error("[uploadNextChunk] API error", data.error);
      throw new Error(data.error.info ?? "Chunk upload error");
    }

    return {
      filekey: data.upload.filekey as string,
      offset: data.upload.offset as number,
      result: data.upload.result as string | undefined,
      stage: data.upload.stage as string | undefined,
    };
  }

  // Poll an async chunked upload. While the server reports result "Poll" the
  // chunk/assembly job is still running; this returns the latest status so the
  // caller can wait until result becomes "Continue"/"Success".
  async checkUploadStatus(params: CheckUploadStatusParams): Promise<ChunkUploadResult> {
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("format", "json");
    fd.append("checkstatus", "1");
    fd.append("filekey", params.filekey);
    fd.append("token", params.csrfToken);

    const res = await wikiFetch(this.apiUrlWithCrossOrigin(params.useCrossOrigin), {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: fd,
    });

    if (!res.ok) {
      const err: Error & { httpStatus?: number } = new Error(
        `Check upload status failed: ${res.status}`
      );
      err.httpStatus = res.status;
      throw err;
    }

    const data = await res.json();
    if (data.error) {
      console.error("[checkUploadStatus] API error", data.error);
      throw new Error(data.error.info ?? "Check upload status error");
    }

    return {
      filekey: (data.upload?.filekey as string) ?? params.filekey,
      offset: (data.upload?.offset as number) ?? 0,
      result: data.upload?.result as string | undefined,
      stage: data.upload?.stage as string | undefined,
      warnings: data.upload?.warnings as Record<string, unknown> | undefined,
    };
  }

  // Poll an async upload (chunk assembly or publish) until the server stops
  // returning result "Poll". Returns the final status.
  // Transient 5xx errors on checkstatus (Wikimedia edge times out while the
  // server-side job keeps running) are treated as "couldn't check this round,
  // retry next tick" — the 10-min overall timeout is the real safety net.
  async waitForUploadCompletion(
    params: CheckUploadStatusParams,
    onPollTick?: (status: ChunkUploadResult) => void
  ): Promise<ChunkUploadResult> {
    const startedAt = Date.now();
    // Window of consecutive 5xx with no successful checkstatus in between.
    // Reset to null any time the server actually responds (Poll or final).
    let firstTransient5xxAt: number | null = null;
    for (;;) {
      try {
        const status = await this.checkUploadStatus(params);
        firstTransient5xxAt = null;
        console.info("[checkUploadStatus]", {
          result: status.result ?? null,
          stage: status.stage ?? null,
        });
        onPollTick?.(status);
        if (status.result !== "Poll") {
          return status;
        }
      } catch (err) {
        const httpStatus = (err as Error & { httpStatus?: number }).httpStatus;
        // Only swallow transient infrastructure 5xx — deterministic errors
        // (API error codes, 4xx) must surface immediately.
        if (httpStatus === undefined || httpStatus < 500) {
          throw err;
        }
        if (firstTransient5xxAt === null) {
          firstTransient5xxAt = Date.now();
        }
        const transient5xxElapsed = Date.now() - firstTransient5xxAt;
        if (transient5xxElapsed > UPLOAD_TRANSIENT_5XX_BUDGET_MS) {
          console.error(
            `[waitForUploadCompletion] HTTP ${httpStatus} persisted for ${Math.round(transient5xxElapsed / 1000)}s; giving up`
          );
          throw err;
        }
        console.warn(
          `[waitForUploadCompletion] transient HTTP ${httpStatus} on checkstatus; will retry`
        );
      }
      if (Date.now() - startedAt > UPLOAD_POLL_TIMEOUT_MS) {
        throw new Error("Перевищено час очікування обробки файлу на сервері Вікісховища");
      }
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_POLL_INTERVAL_MS));
    }
  }

  async commitChunkedUpload(
    params: CommitUploadParams,
    onPollTick?: (status: ChunkUploadResult) => void
  ): Promise<string> {
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("format", "json");
    fd.append("filename", params.filename);
    fd.append("filekey", params.filekey);
    fd.append("text", params.description);
    fd.append("comment", params.comment);
    fd.append("token", params.csrfToken);
    if (params.useAsync) {
      fd.append("async", "1");
    }

    const res = await wikiFetch(this.apiUrlWithCrossOrigin(params.useCrossOrigin), {
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
      console.error("[commitChunkedUpload] API error", data.error);
      const code: string = data.error.code ?? "";
      // captcha (ConfirmEdit) and abuse filter 281 both gate not-yet-autoconfirmed
      // accounts and can't be satisfied from here — surface a clean,
      // non-retryable error instead of retrying.
      if (code === "captcha" || code.startsWith("abusefilter")) {
        throw new UploadNotAllowedError();
      }
      throw new Error(data.error.info ?? "Commit upload error");
    }

    // Async publish: the file is being published by a job. Poll until it lands,
    // then re-check warnings on the final response (e.g. duplicate).
    if (data.upload?.result === "Poll") {
      const status = await this.waitForUploadCompletion(
        {
          accessToken: params.accessToken,
          csrfToken: params.csrfToken,
          filekey: params.filekey,
          useCrossOrigin: params.useCrossOrigin,
        },
        onPollTick
      );
      throwOnUploadWarnings(status.warnings);
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

  async getPageContent(
    accessToken: string,
    title: string
  ): Promise<WikisourcePageRevision | null> {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content|timestamp",
      rvslots: "main",
      titles: title,
      curtimestamp: "1",
      format: "json",
    });

    const res = await wikiFetch(`${this.apiUrl}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Wikisource page: ${res.status}`);
    }

    const data = await res.json();
    const starttimestamp = (data?.curtimestamp as string) ?? new Date().toISOString();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as Record<string, unknown>;
    if ("missing" in page) {
      return { content: null, starttimestamp };
    }

    const revisions = page?.revisions as Array<Record<string, unknown>> | undefined;
    const firstRev = revisions?.[0];
    if (!firstRev) return { content: null, starttimestamp };
    const slots = firstRev?.slots as Record<string, Record<string, string>> | undefined;
    const content = slots?.main?.["*"] ?? (firstRev?.["*"] as string) ?? null;
    if (content === null) return { content: null, starttimestamp };
    const basetimestamp = firstRev.timestamp as string;
    return { content, basetimestamp, starttimestamp };
  }

  async editPage(params: EditWikisourcePageParams): Promise<string> {
    const fd = new FormData();
    fd.append("action", "edit");
    fd.append("format", "json");
    fd.append("title", params.title);
    fd.append("text", params.content);
    fd.append("summary", params.summary);
    fd.append("token", params.csrfToken);
    if (params.basetimestamp) {
      fd.append("basetimestamp", params.basetimestamp);
    }
    if (params.starttimestamp) {
      fd.append("starttimestamp", params.starttimestamp);
    }

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
      if (data.error.code === "editconflict") {
        throw new EditConflictError(data.error.info ?? "editconflict");
      }
      console.error("[editPage] API error", data.error);
      throw new Error(data.error.info ?? "Wikisource edit error");
    }

    return `${this.baseUrl}/wiki/${encodeURIComponent(params.title)}`;
  }
}

export const WIKISOURCE_EDIT_MAX_ATTEMPTS = 4;

export interface UpdateWikisourcePageArgs {
  accessToken: string;
  csrfToken: string;
  title: string;
  summary: string;
  build: (existingContent: string | null) => string;
}

// Read-modify-write with optimistic-concurrency retry. On EditConflictError we
// re-read the page, rebuild content from the fresh revision, and try again,
// up to WIKISOURCE_EDIT_MAX_ATTEMPTS times before surfacing the conflict.
export async function updateWikisourcePage(
  args: UpdateWikisourcePageArgs
): Promise<{ url: string; created: boolean }> {
  let lastConflict: EditConflictError | null = null;
  for (let attempt = 1; attempt <= WIKISOURCE_EDIT_MAX_ATTEMPTS; attempt++) {
    const existing = await wikisource.getPageContent(args.accessToken, args.title);
    const content = args.build(existing?.content ?? null);
    try {
      const url = await wikisource.editPage({
        accessToken: args.accessToken,
        csrfToken: args.csrfToken,
        title: args.title,
        content,
        summary: args.summary,
        basetimestamp: existing?.basetimestamp,
        starttimestamp: existing?.starttimestamp,
      });
      return { url, created: existing === null || existing.content === null };
    } catch (err) {
      if (!(err instanceof EditConflictError)) throw err;
      lastConflict = err;
      console.warn(
        `[updateWikisourcePage] editconflict on "${args.title}" (attempt ${attempt}/${WIKISOURCE_EDIT_MAX_ATTEMPTS})`
      );
    }
  }
  throw lastConflict ?? new EditConflictError();
}

export const wikicommons = new WikicommonsClient();
export const wikisource = new WikisourceClient();

function autoconfirmDate(registrationDate: string | null): string | null {
  if (!registrationDate) return null;
  const registered = new Date(registrationDate);
  if (Number.isNaN(registered.getTime())) return null;
  return new Date(
    registered.getTime() + AUTOCONFIRM_AGE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

// Computes the date (ISO 8601) the account becomes eligible to upload, by checking
// autoconfirmed status + registration on both wikis — the threshold that lifts the
// captcha and abuse filter 281. null = already eligible or indeterminate. Both
// wikis use the same 4-day threshold but track local registration independently,
// so we return the later date among those still blocking. Network call — see the
// cached wrapper below.
export async function resolveUploadAvailableFrom(accessToken: string): Promise<string | null> {
  const [commons, source] = await Promise.all([
    wikicommons.getAccountUploadAccess(accessToken),
    wikisource.getAccountUploadAccess(accessToken),
  ]);
  const dates = [
    commons.isAutoconfirmed ? null : autoconfirmDate(commons.registrationDate),
    source.isAutoconfirmed ? null : autoconfirmDate(source.registrationDate),
  ].filter((d): d is string => d !== null);
  return dates.length > 0 ? dates.reduce((latest, d) => (d > latest ? d : latest)) : null;
}

// The eligibility date is derived from the account's immutable registration date,
// so it never changes for a given user — cache it per user for the lifetime of the
// server process to avoid hitting the wiki API on every page render. Only
// successful lookups are cached; failures fall through so the next render retries.
const uploadAvailableFromCache = new Map<string, string | null>();

export async function getUploadAvailableFrom(
  userId: string,
  accessToken: string
): Promise<string | null> {
  const cached = uploadAvailableFromCache.get(userId);
  if (cached !== undefined) return cached;
  const availableFrom = await resolveUploadAvailableFrom(accessToken);
  uploadAvailableFromCache.set(userId, availableFrom);
  return availableFrom;
}

// Pure, network-free check for rendering: an account may upload once its
// eligibility date has passed. A null or unparseable date fails open (allowed).
export function isUploadAllowed(availableFrom: string | null): boolean {
  if (!availableFrom) return true;
  const ts = new Date(availableFrom).getTime();
  return Number.isNaN(ts) || ts <= Date.now();
}
