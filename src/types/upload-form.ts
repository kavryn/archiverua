import type { Archive } from "@/lib/archives";
import { getDateError, type DateMode, type DateState } from "@/components/DateFields";

export const CHUNK_SIZE = 20 * 1024 * 1024;
export const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
export const MAX_CHUNK_RETRIES = 3;

export interface NameFieldState {
  value: string;
  fetched: string;
  exists: boolean;
  loading: boolean;
  lastFetchedTitle: string;
}

export const emptyNameState: NameFieldState = {
  value: "",
  fetched: "",
  exists: false,
  loading: false,
  lastFetchedTitle: "",
};

export interface SpravaWikisourceState {
  name: string | null;
  exists: boolean;
  loading: boolean;
  lastFetchedTitle: string;
}

export const emptySpravaWikisource: SpravaWikisourceState = {
  name: null,
  exists: false,
  loading: false,
  lastFetchedTitle: "",
};

export interface FileEntry {
  file: File;
  archive: Archive | null;
  fond: string;
  opis: string;
  sprava: string;
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
  isOver75Years: boolean;
  isRussianEmpire: boolean;
  fondName: NameFieldState;
  opisName: NameFieldState;
  spravaName: string;
  spravaWikisource: SpravaWikisourceState;
  fileName: string;
  fileNameEdited: boolean;
  status: "idle" | "uploading" | "success" | "error" | "duplicate";
  errorMessage: string;
  resultUrl: string;
  duplicateUrl: string;
  uploadProgress: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  submitted: boolean;
}

export function makeEntry(file: File): FileEntry {
  return {
    file,
    archive: null,
    fond: "",
    opis: "",
    sprava: "",
    dateMode: "range",
    dateFrom: "",
    dateTo: "",
    isOver75Years: false,
    isRussianEmpire: false,
    fondName: emptyNameState,
    opisName: emptyNameState,
    spravaName: "",
    spravaWikisource: emptySpravaWikisource,
    fileName: "",
    fileNameEdited: false,
    status: "idle",
    errorMessage: "",
    resultUrl: "",
    duplicateUrl: "",
    uploadProgress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    currentChunk: 0,
    totalChunks: 0,
    submitted: false,
  };
}

export function buildAutoFileName(entry: FileEntry): string {
  if (!entry.archive || !entry.fond || !entry.opis || !entry.sprava) return "";
  const ext = entry.file.name.split(".").pop() ?? "pdf";
  const spravaName = entry.spravaName.trim();
  const prefix = `${entry.archive.abbr} ${entry.fond}-${entry.opis}-${entry.sprava}. `;
  const suffix = `.${ext}`;
  const maxNameLen = 75 - prefix.length - suffix.length;
  const truncated = spravaName.slice(0, Math.max(0, maxNameLen));
  return `${prefix}${truncated}${suffix}`;
}

export function getEffectiveFileName(entry: FileEntry): string {
  if (entry.fileNameEdited && entry.fileName.trim() !== "") return entry.fileName;
  return buildAutoFileName(entry);
}

export function isEntryValid(entry: FileEntry): boolean {
  const dateState: DateState = {
    dateMode: entry.dateMode,
    dateFrom: entry.dateFrom,
    dateTo: entry.dateTo,
    isOver75Years: entry.isOver75Years,
    isRussianEmpire: entry.isRussianEmpire,
  };
  const dateError = getDateError(dateState);
  const dateEnabled = entry.sprava.trim() !== "";
  const datesValid =
    dateEnabled &&
    !dateError &&
    (entry.dateMode !== "other" || entry.isOver75Years) &&
    (entry.dateMode === "single"
      ? entry.dateFrom.trim() !== ""
      : entry.dateFrom.trim() !== "" || entry.dateTo.trim() !== "");

  const fondNameShown = entry.fondName.loading || entry.fondName.lastFetchedTitle !== "";
  const fondNameWritable = fondNameShown && !entry.fondName.loading && !entry.fondName.exists;
  const fondNameEmpty = fondNameWritable && entry.fondName.value.trim() === "";

  const spravaNameEmpty = dateEnabled && entry.spravaName.trim() === "";

  const fileNameEnabled =
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opis.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    entry.spravaName.trim() !== "";
  const fileNameEmpty = fileNameEnabled && getEffectiveFileName(entry).trim() === "";

  return (
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opis.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    datesValid &&
    !fondNameEmpty &&
    !spravaNameEmpty &&
    !fileNameEmpty
  );
}

const wikisourceNameCache = new Map<string, { name: string | null; exists: boolean }>();

export async function fetchWikisourceName(
  pageTitle: string
): Promise<{ name: string | null; exists: boolean }> {
  const cached = wikisourceNameCache.get(pageTitle);
  if (cached) return cached;
  const res = await fetch(`/api/wikisource-name?title=${encodeURIComponent(pageTitle)}`);
  const result = await res.json();
  wikisourceNameCache.set(pageTitle, result);
  return result;
}
