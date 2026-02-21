import type { Archive } from "@/lib/archives";
import { type DateMode } from "@/components/DateFields";
import { apiFetch } from "@/lib/apiFetch";


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

export interface FileNameCheckState {
  loading: boolean;
  exists: boolean | null;
  lastCheckedName: string;
}

export interface FileEntry {
  file: File;
  archive: Archive | null;
  fond: string;
  opis: string;
  sprava: string;
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
  license: string[];
  fondName: NameFieldState;
  opisName: NameFieldState;
  spravaName: string;
  author: string;
  spravaWikisource: SpravaWikisourceState;
  fileName: string;
  fileNameEdited: boolean;
  fileNameCheck: FileNameCheckState;
  status: "idle" | "uploading" | "success" | "error" | "duplicate";
  wikisourceStatus: "idle" | "pending" | "success" | "error";
  wikisourceResult: {
    sprava?: { url: string; created: boolean };
    opys?: { url: string; created: boolean };
    fond?: { url: string; created: boolean };
    archive?: { url: string; created: boolean };
  } | null;
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
    license: [],
    fondName: emptyNameState,
    opisName: emptyNameState,
    spravaName: "",
    author: "",
    spravaWikisource: emptySpravaWikisource,
    fileName: "",
    fileNameEdited: false,
    fileNameCheck: { loading: false, exists: null, lastCheckedName: "" },
    status: "idle",
    wikisourceStatus: "idle",
    wikisourceResult: null,
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
  const fondNoHyphen = entry.fond.replace(/-/g, "");
  const prefix = `${entry.archive.abbr} ${fondNoHyphen}-${entry.opis}-${entry.sprava}. `;
  const suffix = `.${ext}`;
  const maxNameLen = 75 - prefix.length - suffix.length;
  const truncated = spravaName.slice(0, Math.max(0, maxNameLen));
  const raw = `${prefix}${truncated}${suffix}`;
  return raw.replace(/[:/\\]/g, "");
}

export function getEffectiveFileName(entry: FileEntry): string {
  if (entry.fileNameEdited && entry.fileName.trim() !== "") {
    const name = entry.fileName.trim();
    const ext = entry.file.name.split(".").pop() ?? "";
    if (ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
      return `${name}.${ext}`;
    }
    return name;
  }
  return buildAutoFileName(entry);
}

export function isFileNameEnabled(entry: FileEntry): boolean {
  return (
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opis.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    entry.spravaName.trim() !== ""
  );
}

export function hasInvalidFileNameChars(entry: FileEntry): boolean {
  return isFileNameEnabled(entry) && /[:/\\]/.test(getEffectiveFileName(entry));
}

const INTEGER_RE = /^\d+$/;

export function getDateError(
  entry: Pick<FileEntry, "dateMode" | "dateFrom" | "dateTo">
): string | null {
  const currentYear = new Date().getFullYear();
  const from = entry.dateFrom.trim();
  const to = entry.dateTo.trim();

  if (entry.dateMode === "other") {
    return from !== "" ? null : "Поле обов'язкове";
  }

  if (entry.dateMode === "single") {
    if (from === "") return "Поле обов'язкове";
    if (!INTEGER_RE.test(from)) return "Дата має бути числом";
    if (parseInt(from, 10) > currentYear)
      return `Дата не може перевищувати ${currentYear}`;
    return null;
  }

  // range
  const fromEmpty = from === "";
  const toEmpty = to === "";
  if (fromEmpty && toEmpty) return "Поля обов'язкові";
  if (fromEmpty) return "Поле 'Початкова' обов'язкове";
  if (toEmpty) return "Поле 'Кінцева' обов'язкове";
  if (!INTEGER_RE.test(from) || !INTEGER_RE.test(to))
    return "Дати мають бути числами";
  const fromYear = parseInt(from, 10);
  const toYear = parseInt(to, 10);
  if (toYear > currentYear)
    return `Кінцева дата не може перевищувати ${currentYear}`;
  if (toYear < fromYear)
    return "Кінцева дата має бути не меншою за початкову";
  return null;
}

export function areDatesValid(
  entry: Pick<FileEntry, "dateMode" | "dateFrom" | "dateTo">
): boolean {
  return getDateError(entry) === null;
}

export function isEntryValid(entry: FileEntry): boolean {
  const dateEnabled = entry.sprava.trim() !== "";
  const datesValid =
    dateEnabled &&
    areDatesValid(entry) &&
    entry.license.length > 0;

  const fondNameShown = entry.fondName.loading || entry.fondName.lastFetchedTitle !== "";
  const fondNameWritable = fondNameShown && !entry.fondName.loading && !entry.fondName.exists;
  const fondNameEmpty = fondNameWritable && entry.fondName.value.trim() === "";

  const spravaNameEmpty = dateEnabled && entry.spravaName.trim() === "";

  const fileNameEnabled = isFileNameEnabled(entry);
  const fileNameEmpty = fileNameEnabled && getEffectiveFileName(entry).trim() === "";
  const fileNameConflict = fileNameEnabled && entry.fileNameCheck.exists === true;
  const fileNameHasInvalidChars = hasInvalidFileNameChars(entry);

  return (
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opis.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    datesValid &&
    !fondNameEmpty &&
    !spravaNameEmpty &&
    !fileNameEmpty &&
    !fileNameConflict &&
    !fileNameHasInvalidChars
  );
}

const wikisourceNameCache = new Map<string, { name: string | null; exists: boolean }>();

export async function fetchWikisourceName(
  pageTitle: string
): Promise<{ name: string | null; exists: boolean }> {
  const cached = wikisourceNameCache.get(pageTitle);
  if (cached) return cached;
  const res = await apiFetch(`/api/wikisource-name?title=${encodeURIComponent(pageTitle)}`);
  const result = await res.json();
  wikisourceNameCache.set(pageTitle, result);
  return result;
}
