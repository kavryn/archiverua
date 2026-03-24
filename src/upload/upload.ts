import { type FileEntry } from "./types";
import { getEffectiveFileName } from "./hooks/usePublicFileName";
import { apiFetch } from "@/lib/api-fetch";
import { buildCommonsDescription, COMMONS_UPLOAD_COMMENT } from "@/lib/wikicommons-upload";
import { DuplicateFileError, wikicommons } from "@/lib/wikimedia";

export const CHUNK_SIZE = 8 * 1024 * 1024;
export const LARGE_FILE_THRESHOLD = 8 * 1024 * 1024;
export const MAX_CHUNK_RETRIES = 3;

export type UploadResult =
  | { status: "success"; url: string }
  | { status: "duplicate"; duplicateUrl: string }
  | { status: "error"; errorMessage: string };

export type ProgressCallback = (progress: {
  totalBytes: number;
  totalChunks: number;
  currentChunk: number;
  uploadedBytes: number;
  uploadProgress: number;
}) => void;

type UploadApiResponse = { url?: string; duplicateUrl?: string; error?: string };
type UploadMetadata = { filename: string; description: string; comment: string };
type ProxyUploadPayload = Pick<UploadMetadata, "filename" | "description">;

function buildWikiSourceDateStr(dateFrom: string, dateTo: string, isArbitraryDate: boolean): string {
  if (isArbitraryDate || !dateTo || dateFrom === dateTo) {
    return dateFrom;
  }
  return `${dateFrom}-${dateTo}`;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
    }
  }
  throw new Error("Unreachable");
}

async function proxyUploadChunk(chunkFd: FormData): Promise<{ filekey: string; offset: number }> {
  const res = await apiFetch("/api/wikicommons/upload/chunk", { method: "POST", body: chunkFd });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { filekey: data.filekey, offset: data.offset };
}

function parseUploadResponse(data: UploadApiResponse): UploadResult {
  if (data.duplicateUrl) {
    return { status: "duplicate", duplicateUrl: data.duplicateUrl };
  }
  if (data.error) {
    return { status: "error", errorMessage: data.error };
  }
  return { status: "success", url: data.url! };
}

function getUploadMetadata(entry: FileEntry): UploadMetadata {
  if (!entry.archive) {
    throw new Error("Не обрано архів");
  }

  const filename = getEffectiveFileName(entry).trim();
  if (!filename) {
    throw new Error("Відсутня назва файлу");
  }

  return {
    filename,
    description: buildCommonsDescription({
      archiveName: entry.archive.name,
      category: entry.archive.category,
      fond: entry.fond,
      opys: entry.opys,
      sprava: entry.sprava,
      spravaName: entry.spravaName,
      dateFrom: entry.dateFrom,
      dateTo: entry.dateTo,
      isArbitraryDate: entry.dateMode === "other",
      license: entry.license.join("\n"),
      author: entry.author,
    }),
    comment: COMMONS_UPLOAD_COMMENT,
  };
}

function buildProxyUploadFormData(
  payload: ProxyUploadPayload,
  options: { file?: File; filekey?: string; commitOnly?: boolean }
): FormData {
  const fd = new FormData();
  if (options.commitOnly) {
    fd.append("commitOnly", "true");
  }
  if (options.file) {
    fd.append("file", options.file);
  }
  if (options.filekey) {
    fd.append("filekey", options.filekey);
  }
  fd.append("fileName", payload.filename);
  fd.append("description", payload.description);
  return fd;
}

async function commitDirectUpload(
  filekey: string,
  metadata: UploadMetadata,
  accessToken: string,
  csrfToken: string
): Promise<UploadResult> {
  const { filename, description, comment } = metadata;
  let currentCsrfToken = csrfToken;

  const doDirectCommitUpload = () =>
    wikicommons.commitChunkedUpload({
      accessToken,
      csrfToken: currentCsrfToken,
      filekey,
      filename,
      description,
      comment,
      useCrossOrigin: true,
    });

  try {
    const url = await retryWithBackoff(async () => {
      try {
        return await doDirectCommitUpload();
      } catch (err) {
        if (err instanceof Error && err.message.includes("badtoken")) {
          currentCsrfToken = await wikicommons.getCsrfToken(accessToken, true);
          return await doDirectCommitUpload();
        }
        throw err;
      }
    }, MAX_CHUNK_RETRIES);
    return { status: "success", url };
  } catch (err) {
    if (err instanceof DuplicateFileError) {
      return { status: "duplicate", duplicateUrl: err.duplicateUrl };
    }
    throw err;
  }
}

async function commitProxyUpload(filekey: string, metadata: UploadMetadata): Promise<UploadResult> {
  const { filename, description } = metadata;
  const fd = buildProxyUploadFormData({ filename, description }, { commitOnly: true, filekey });
  const res = await apiFetch("/api/wikicommons/upload", { method: "POST", body: fd });
  return parseUploadResponse(await res.json());
}

async function uploadSmallFile(file: File, metadata: UploadMetadata): Promise<UploadResult> {
  const fd = buildProxyUploadFormData(metadata, { file });
  const res = await apiFetch("/api/wikicommons/upload", { method: "POST", body: fd });
  return parseUploadResponse(await res.json());
}

function reportUploadProgress(
  onProgress: ProgressCallback | undefined,
  progress: {
    totalBytes: number;
    totalChunks: number;
    currentChunk: number;
    uploadedBytes: number;
  }
): void {
  const uploadProgress = Math.round((progress.uploadedBytes / progress.totalBytes) * 100);
  onProgress?.({ ...progress, uploadProgress });
}

async function uploadDirectChunk(params: {
  accessToken: string;
  csrfToken: string;
  filekey: string;
  chunkStart: number;
  chunkBlob: Blob;
  fileSize: number;
  filename: string;
}): Promise<{ filekey: string; offset: number; csrfToken: string }> {
  let currentCsrfToken = params.csrfToken;

  const doDirectChunkUpload = () => {
    const base = {
      accessToken: params.accessToken,
      csrfToken: currentCsrfToken,
      filename: params.filename,
      chunk: params.chunkBlob,
      fileSize: params.fileSize,
      useCrossOrigin: true,
    };
    return params.filekey
      ? wikicommons.uploadNextChunk({ ...base, filekey: params.filekey, offset: params.chunkStart })
      : wikicommons.uploadFirstChunk(base);
  };

  const result = await retryWithBackoff(async () => {
    try {
      return await doDirectChunkUpload();
    } catch (err) {
      if (err instanceof Error && err.message.includes("badtoken")) {
        currentCsrfToken = await wikicommons.getCsrfToken(params.accessToken, true);
        return await doDirectChunkUpload();
      }
      throw err;
    }
  }, MAX_CHUNK_RETRIES);

  return { filekey: result.filekey, offset: result.offset, csrfToken: currentCsrfToken };
}

async function uploadProxyChunk(params: {
  chunkBlob: Blob;
  filename: string;
  fileSize: number;
  chunkStart: number;
  filekey: string;
}): Promise<{ filekey: string; offset: number }> {
  const chunkFd = new FormData();
  chunkFd.append("chunk", params.chunkBlob, "chunk");
  chunkFd.append("filename", params.filename);
  chunkFd.append("fileSize", String(params.fileSize));
  chunkFd.append("offset", String(params.chunkStart));
  if (params.filekey) {
    chunkFd.append("filekey", params.filekey);
  }
  return await retryWithBackoff(() => proxyUploadChunk(chunkFd), MAX_CHUNK_RETRIES);
}

async function uploadChunkedFile(
  file: File,
  metadata: UploadMetadata,
  useDirectUpload: boolean,
  onProgress?: ProgressCallback,
  accessToken?: string
): Promise<UploadResult> {
  const fileSize = file.size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  reportUploadProgress(onProgress, {
    totalBytes: fileSize,
    totalChunks,
    currentChunk: 0,
    uploadedBytes: 0,
  });

  let filekey = "";
  let confirmedOffset = 0;
  let csrfToken = useDirectUpload ? await wikicommons.getCsrfToken(accessToken!, true) : undefined;

  for (let i = 0; i < totalChunks; i++) {
    const chunkStart = i * CHUNK_SIZE;
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, fileSize);
    const chunkBlob = file.slice(chunkStart, chunkEnd);

    if (useDirectUpload) {
      const result = await uploadDirectChunk({
        accessToken: accessToken!,
        csrfToken: csrfToken!,
        filekey,
        chunkStart,
        chunkBlob,
        fileSize,
        filename: file.name,
      });
      filekey = result.filekey;
      confirmedOffset = result.offset ?? chunkEnd;
      csrfToken = result.csrfToken;
    } else {
      const result = await uploadProxyChunk({
        chunkBlob,
        filename: file.name,
        fileSize,
        chunkStart,
        filekey,
      });
      filekey = result.filekey;
      confirmedOffset = result.offset ?? chunkEnd;
    }

    reportUploadProgress(onProgress, {
      totalBytes: fileSize,
      totalChunks,
      currentChunk: i + 1,
      uploadedBytes: confirmedOffset,
    });
  }

  if (useDirectUpload) {
    return await commitDirectUpload(filekey, metadata, accessToken!, csrfToken!);
  }

  return await commitProxyUpload(filekey, metadata);
}

export async function uploadFile(
  entry: FileEntry,
  onProgress?: ProgressCallback,
  accessToken?: string,
  useDirectUpload = true
): Promise<UploadResult> {
  const file = entry.file;
  const metadata = getUploadMetadata(entry);
  const useChunkedUpload = useDirectUpload || file.size > LARGE_FILE_THRESHOLD;

  if (useDirectUpload && !accessToken) {
    throw new Error("Немає access token для direct upload");
  }

  if (!useChunkedUpload) {
    return await uploadSmallFile(file, metadata);
  }

  return await uploadChunkedFile(file, metadata, useDirectUpload, onProgress, accessToken);
}

export type WikisourcePageResult = { url: string; created?: boolean; error?: string };
export type WikisourceAllResult = {
  sprava: WikisourcePageResult;
  opys?: WikisourcePageResult;
  fond?: WikisourcePageResult;
  archive?: WikisourcePageResult;
};

export async function callWikisourcePublish(entry: FileEntry): Promise<WikisourceAllResult> {
  if (!entry.archive) throw new Error("No archive selected");

  const dates = buildWikiSourceDateStr(
    entry.dateFrom,
    entry.dateTo,
    entry.dateMode === "other"
  );

  const body = {
    archiveAbbr: entry.archive.abbr,
    fond: entry.fond,
    opys: entry.opys,
    sprava: entry.sprava,
    spravaName: entry.spravaName,
    opysName: entry.opysName.fetched || entry.opysName.value,
    fondName: entry.fondName.fetched || entry.fondName.value,
    archiveName: entry.archive.name,
    dates,
    publicFileName: getEffectiveFileName(entry),
    updateOpys: !entry.spravaWikisource.exists || !entry.opysName.exists,
    updateFond: !entry.opysName.exists || !entry.fondName.exists,
    updateArchive: !entry.fondName.exists,
  };

  const res = await apiFetch("/api/wikisource/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `wikisource/publish failed: ${res.status}`);
  }

  const data = await res.json();
  return data as WikisourceAllResult;
}
