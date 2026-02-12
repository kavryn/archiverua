import type { Archive } from "@/lib/archives";
import { getDateError, type DateState } from "@/components/DateFields";

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

export interface FileEntry {
  file: File;
  archive: Archive | null;
  fond: string;
  opis: string;
  sprava: string;
  dateFrom: string;
  dateTo: string;
  isArbitraryDate: boolean;
  isOver75Years: boolean;
  isRussianEmpire: boolean;
  fondName: NameFieldState;
  opisName: NameFieldState;
  spravaName: NameFieldState;
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
    dateFrom: "",
    dateTo: "",
    isArbitraryDate: false,
    isOver75Years: false,
    isRussianEmpire: false,
    fondName: emptyNameState,
    opisName: emptyNameState,
    spravaName: emptyNameState,
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
  const spravaName = (entry.spravaName.value || entry.spravaName.fetched).trim();
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
    dateFrom: entry.dateFrom,
    dateTo: entry.dateTo,
    isArbitraryDate: entry.isArbitraryDate,
    isOver75Years: entry.isOver75Years,
    isRussianEmpire: entry.isRussianEmpire,
  };
  const dateError = getDateError(dateState);
  const dateEnabled = entry.sprava.trim() !== "";
  const datesValid =
    dateEnabled &&
    !dateError &&
    (!entry.isArbitraryDate || entry.isOver75Years) &&
    (entry.dateFrom.trim() !== "" || entry.dateTo.trim() !== "");

  const fondNameShown = entry.fondName.loading || entry.fondName.lastFetchedTitle !== "";
  const fondNameWritable = fondNameShown && !entry.fondName.loading && !entry.fondName.exists;
  const fondNameEmpty = fondNameWritable && entry.fondName.value.trim() === "";

  const spravaNameWritable = dateEnabled && !entry.spravaName.loading;
  const spravaNameEmpty = spravaNameWritable && entry.spravaName.value.trim() === "";

  const fileNameEnabled =
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opis.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    (entry.spravaName.value || entry.spravaName.fetched).trim() !== "";
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

export async function fetchWikisourceName(
  pageTitle: string
): Promise<{ name: string | null; exists: boolean }> {
  const res = await fetch(`/api/wikisource-name?title=${encodeURIComponent(pageTitle)}`);
  return res.json();
}
