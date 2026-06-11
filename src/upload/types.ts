import type { Archive } from "@/lib/archives";
import { type DateMode } from "./components/DateFields";
import { parseArchivalReferenceFromFileName } from "./archivalReference";

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

export type FileNameCheckState =
  | { status: 'idle' }
  | { status: 'invalid_chars' }
  | { status: 'too_short' }
  | { status: 'too_long' }
  | { status: 'loading' }
  | { status: 'done'; exists: boolean | null; blacklisted: boolean | null };

export interface FileEntry {
  file: File;
  archive: Archive | null;
  fond: string;
  opys: string;
  sprava: string;
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
  license: string[];
  licenseManuallySet: boolean;
  fondName: NameFieldState;
  opysName: NameFieldState;
  spravaName: string;
  author: string;
  spravaWikisource: SpravaWikisourceState;
  fileName: string;
  fileNameEdited: boolean;
  fileNameCheck: FileNameCheckState;
  status: "idle" | "uploading" | "success" | "error" | "duplicate";
  wikisourceStatus: "idle" | "pending" | "success" | "error" | "cancelled";
  wikisourceResult: {
    sprava?: { url: string; created?: boolean; error?: string };
    opys?: { url: string; created?: boolean; error?: string };
    fond?: { url: string; created?: boolean; error?: string };
    archive?: { url: string; created?: boolean; error?: string };
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
  const parsedReference = parseArchivalReferenceFromFileName(file.name);

  return {
    file,
    archive: parsedReference?.archive ?? null,
    fond: parsedReference?.fond ?? "",
    opys: parsedReference?.opys ?? "",
    sprava: parsedReference?.sprava ?? "",
    dateMode: "range",
    dateFrom: "",
    dateTo: "",
    license: [],
    licenseManuallySet: false,
    fondName: emptyNameState,
    opysName: emptyNameState,
    spravaName: "",
    spravaWikisource: emptySpravaWikisource,
    author: "",
    fileName: "",
    fileNameEdited: false,
    fileNameCheck: { status: 'idle' },
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

