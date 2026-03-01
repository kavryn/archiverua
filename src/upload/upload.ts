import { type FileEntry } from "./types";
import { getEffectiveFileName } from "./hooks/usePublicFileName";
import { apiFetch } from "@/lib/api-fetch";

export const CHUNK_SIZE = 20 * 1024 * 1024;
export const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
export const MAX_CHUNK_RETRIES = 3;

function buildWikiSourceDateStr(dateFrom: string, dateTo: string, isArbitraryDate: boolean): string {
  if (isArbitraryDate || !dateTo || dateFrom === dateTo) {
    return dateFrom;
  }
  return `${dateFrom}-${dateTo}`;
}

async function uploadChunkWithRetry(
  chunkFd: FormData,
  retries: number
): Promise<{ filekey: string; offset: number }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await apiFetch("/api/wikicommons/upload/chunk", { method: "POST", body: chunkFd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return { filekey: data.filekey, offset: data.offset };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
    }
  }
  throw new Error("Unreachable");
}

async function commitUpload(filekey: string, entry: FileEntry): Promise<string> {
  const fd = new FormData();
  fd.append("commitOnly", "true");
  fd.append("filekey", filekey);
  fd.append("archiveAbbr", entry.archive!.abbr);
  fd.append("fond", entry.fond);
  fd.append("opys", entry.opys);
  fd.append("sprava", entry.sprava);
  fd.append("dateFrom", entry.dateFrom);
  fd.append("dateTo", entry.dateTo);
  fd.append("isArbitraryDate", String(entry.dateMode === "other"));
  fd.append("license", entry.license.join("\n"));
  fd.append("spravaName", entry.spravaName);
  fd.append("author", entry.author);
  fd.append("fileName", getEffectiveFileName(entry));
  const res = await apiFetch("/api/wikicommons/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (data.duplicateUrl) return `__duplicate__${data.duplicateUrl}`;
  if (data.error) throw new Error(data.error);
  return data.url as string;
}

async function uploadSmallFile(entry: FileEntry): Promise<{ url?: string; duplicateUrl?: string; error?: string }> {
  const fd = new FormData();
  fd.append("file", entry.file);
  fd.append("archiveAbbr", entry.archive!.abbr);
  fd.append("fond", entry.fond);
  fd.append("opys", entry.opys);
  fd.append("sprava", entry.sprava);
  fd.append("dateFrom", entry.dateFrom);
  fd.append("dateTo", entry.dateTo);
  fd.append("isArbitraryDate", String(entry.dateMode === "other"));
  fd.append("license", entry.license.join("\n"));
  fd.append("spravaName", entry.spravaName);
  fd.append("author", entry.author);
  fd.append("fileName", getEffectiveFileName(entry));
  const res = await apiFetch("/api/wikicommons/upload", { method: "POST", body: fd });
  const data = await res.json();
  return data;
}

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

export async function uploadFile(
  entry: FileEntry,
  onProgress?: ProgressCallback
): Promise<UploadResult> {
  const file = entry.file;

  if (file.size > LARGE_FILE_THRESHOLD) {
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    onProgress?.({ totalBytes: fileSize, totalChunks, uploadedBytes: 0, uploadProgress: 0, currentChunk: 0 });

    let filekey = "";
    let confirmedOffset = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * CHUNK_SIZE;
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, fileSize);
      const chunkBlob = file.slice(chunkStart, chunkEnd);

      const chunkFd = new FormData();
      chunkFd.append("chunk", chunkBlob, "chunk");
      chunkFd.append("filename", file.name);
      chunkFd.append("fileSize", String(fileSize));
      chunkFd.append("offset", String(chunkStart));
      if (filekey) chunkFd.append("filekey", filekey);

      const result = await uploadChunkWithRetry(chunkFd, MAX_CHUNK_RETRIES);
      filekey = result.filekey;
      confirmedOffset = result.offset ?? chunkEnd;

      const progress = Math.round((confirmedOffset / fileSize) * 100);
      onProgress?.({ totalBytes: fileSize, totalChunks, currentChunk: i + 1, uploadedBytes: confirmedOffset, uploadProgress: progress });
    }

    const url = await commitUpload(filekey, entry);
    if (url.startsWith("__duplicate__")) {
      return { status: "duplicate", duplicateUrl: url.slice("__duplicate__".length) };
    }
    return { status: "success", url };
  } else {
    const data = await uploadSmallFile(entry);
    if (data.duplicateUrl) {
      return { status: "duplicate", duplicateUrl: data.duplicateUrl };
    }
    if (data.error) {
      return { status: "error", errorMessage: data.error };
    }
    return { status: "success", url: data.url! };
  }
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
