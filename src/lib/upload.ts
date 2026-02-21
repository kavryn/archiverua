import { CHUNK_SIZE, LARGE_FILE_THRESHOLD, MAX_CHUNK_RETRIES, type FileEntry, getEffectiveFileName } from "@/types/upload-form";
import { apiFetch } from "@/lib/apiFetch";

function buildWikisourceDateStr(dateFrom: string, dateTo: string, isArbitraryDate: boolean): string {
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
      const res = await apiFetch("/api/upload/chunk", { method: "POST", body: chunkFd });
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
  fd.append("opis", entry.opis);
  fd.append("sprava", entry.sprava);
  fd.append("dateFrom", entry.dateFrom);
  fd.append("dateTo", entry.dateTo);
  fd.append("isArbitraryDate", String(entry.dateMode === "other"));
  fd.append("license", entry.license.join("\n"));
  fd.append("spravaName", entry.spravaName);
  fd.append("author", entry.author);
  fd.append("fileName", getEffectiveFileName(entry));
  const res = await apiFetch("/api/upload", { method: "POST", body: fd });
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
  fd.append("opis", entry.opis);
  fd.append("sprava", entry.sprava);
  fd.append("dateFrom", entry.dateFrom);
  fd.append("dateTo", entry.dateTo);
  fd.append("isArbitraryDate", String(entry.dateMode === "other"));
  fd.append("license", entry.license.join("\n"));
  fd.append("spravaName", entry.spravaName);
  fd.append("author", entry.author);
  fd.append("fileName", getEffectiveFileName(entry));
  const res = await apiFetch("/api/upload", { method: "POST", body: fd });
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
      confirmedOffset = result.offset;

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

export type WikisourcePageResult = { url: string; created: boolean };
export type WikisourceAllResult = {
  sprava: WikisourcePageResult;
  opys?: WikisourcePageResult;
  fond?: WikisourcePageResult;
  archive?: WikisourcePageResult;
};

export async function callWikisourceAll(entry: FileEntry): Promise<WikisourceAllResult> {
  if (!entry.archive) throw new Error("No archive selected");

  const dates = buildWikisourceDateStr(
    entry.dateFrom,
    entry.dateTo,
    entry.dateMode === "other"
  );

  const body = {
    archiveAbbr: entry.archive.abbr,
    fond: entry.fond,
    opis: entry.opis,
    sprava: entry.sprava,
    spravaName: entry.spravaName,
    opisName: entry.opisName.fetched || entry.opisName.value,
    fondName: entry.fondName.fetched || entry.fondName.value,
    archiveName: entry.archive.name,
    dates,
    publicFileName: getEffectiveFileName(entry),
    updateOpys: !entry.spravaWikisource.exists || !entry.opisName.exists,
    updateFond: !entry.opisName.exists || !entry.fondName.exists,
    updateArchive: !entry.fondName.exists,
  };

  const res = await apiFetch("/api/wikisource-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `wikisource-all failed: ${res.status}`);
  }

  const data = await res.json();
  return data as WikisourceAllResult;
}
