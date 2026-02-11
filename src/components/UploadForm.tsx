"use client";

import { useState } from "react";
import ArchiveCombobox from "./ArchiveCombobox";
import DateFields, { getDateError, type DateState } from "./DateFields";
import type { Archive } from "@/lib/archives";

const CHUNK_SIZE = 20 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

interface FormState {
  file: File | null;
  archive: Archive | null;
  fond: string;
  opis: string;
  sprava: string;
  dateFrom: string;
  dateTo: string;
  isArbitraryDate: boolean;
  isOver75Years: boolean;
  isRussianEmpire: boolean;
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

interface NameFieldState {
  value: string;           // Editable value when page doesn't exist
  fetched: string;         // Fetched from Wikisource
  exists: boolean;         // Whether Wikisource page exists
  loading: boolean;
  lastFetchedTitle: string; // Title used in the last completed fetch
}

const emptyNameState: NameFieldState = {
  value: "",
  fetched: "",
  exists: false,
  loading: false,
  lastFetchedTitle: "",
};

async function fetchWikisourceName(
  pageTitle: string
): Promise<{ name: string | null; exists: boolean }> {
  const res = await fetch(`/api/wikisource-name?title=${encodeURIComponent(pageTitle)}`);
  return res.json();
}

const initialState: FormState = {
  file: null,
  archive: null,
  fond: "",
  opis: "",
  sprava: "",
  dateFrom: "",
  dateTo: "",
  isArbitraryDate: false,
  isOver75Years: false,
  isRussianEmpire: false,
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

function FieldError({ show, message = "Поле обов'язкове" }: { show: boolean; message?: string }) {
  if (!show) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

export default function UploadForm() {
  const [state, setState] = useState<FormState>(initialState);
  const [fondName, setFondName] = useState<NameFieldState>(emptyNameState);
  const [opisName, setOpisName] = useState<NameFieldState>(emptyNameState);
  const [spravaName, setSpravaName] = useState<NameFieldState>(emptyNameState);

  function update(patch: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  async function handleFondBlur(value: string) {
    if (!state.archive || !value.trim()) return;
    const title = `Архів:${state.archive.abbr}/${value.trim()}`;
    if (fondName.lastFetchedTitle === title) return;
    setFondName((p) => ({ ...p, loading: true }));
    try {
      const result = await fetchWikisourceName(title);
      setFondName({ value: "", fetched: result.name ?? "", exists: result.exists, loading: false, lastFetchedTitle: title });
    } catch {
      setFondName((p) => ({ ...p, loading: false }));
    }
  }

  async function handleOpisBlur(value: string) {
    if (!state.archive || !state.fond.trim() || !value.trim()) return;
    const title = `Архів:${state.archive.abbr}/${state.fond.trim()}/${value.trim()}`;
    if (opisName.lastFetchedTitle === title) return;
    setOpisName((p) => ({ ...p, loading: true }));
    try {
      const result = await fetchWikisourceName(title);
      setOpisName({ value: "", fetched: result.name ?? "", exists: result.exists, loading: false, lastFetchedTitle: title });
    } catch {
      setOpisName((p) => ({ ...p, loading: false }));
    }
  }

  async function handleSpravaBlur(value: string) {
    if (!state.archive || !state.fond.trim() || !state.opis.trim() || !value.trim()) return;
    const title = `Архів:${state.archive.abbr}/${state.fond.trim()}/${state.opis.trim()}/${value.trim()}`;
    if (spravaName.lastFetchedTitle === title) return;
    setSpravaName((p) => ({ ...p, loading: true }));
    try {
      const result = await fetchWikisourceName(title);
      setSpravaName({ value: result.name ?? "", fetched: result.name ?? "", exists: result.exists, loading: false, lastFetchedTitle: title });
    } catch {
      setSpravaName((p) => ({ ...p, loading: false }));
    }
  }

  const archiveEnabled = state.file !== null;
  const fondEnabled = state.archive !== null;
  const opisEnabled = state.fond.trim() !== "";
  const spravaEnabled = state.opis.trim() !== "";
  const dateEnabled = state.sprava.trim() !== "";

  const dateState: DateState = {
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    isArbitraryDate: state.isArbitraryDate,
    isOver75Years: state.isOver75Years,
    isRussianEmpire: state.isRussianEmpire,
  };

  const dateError = getDateError(dateState);
  const arbitraryOk = !state.isArbitraryDate || state.isOver75Years;
  const datesValid =
    dateEnabled &&
    !dateError &&
    arbitraryOk &&
    (state.dateFrom.trim() !== "" || state.dateTo.trim() !== "");

  // Name field writable/empty checks
  const fondNameShown = fondName.loading || fondName.lastFetchedTitle !== "";
  const fondNameWritable = fondNameShown && !fondName.loading && !fondName.exists;
  const fondNameEmpty = fondNameWritable && fondName.value.trim() === "";

  const opisNameShown = opisName.loading || opisName.lastFetchedTitle !== "";
  const opisNameWritable = opisNameShown && !opisName.loading && !opisName.exists;
  const opisNameEmpty = opisNameWritable && opisName.value.trim() === "";

  const spravaNameWritable = dateEnabled && !spravaName.loading;
  const spravaNameEmpty = spravaNameWritable && spravaName.value.trim() === "";

  const formValid = datesValid && !fondNameEmpty && !opisNameEmpty && !spravaNameEmpty;

  async function handleDirectUpload(currentState: FormState) {
    const fd = new FormData();
    fd.append("file", currentState.file!);
    fd.append("archiveAbbr", currentState.archive!.abbr);
    fd.append("fond", currentState.fond);
    fd.append("opis", currentState.opis);
    fd.append("sprava", currentState.sprava);
    fd.append("dateFrom", currentState.dateFrom);
    fd.append("dateTo", currentState.dateTo);
    fd.append("isArbitraryDate", String(currentState.isArbitraryDate));
    fd.append("isOver75Years", String(currentState.isOver75Years));
    fd.append("isRussianEmpire", String(currentState.isRussianEmpire));

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.duplicateUrl) {
      update({ status: "duplicate", duplicateUrl: data.duplicateUrl });
    } else if (data.error) {
      update({ status: "error", errorMessage: data.error });
    } else {
      update({ status: "success", resultUrl: data.url });
    }
  }

  async function uploadChunkWithRetry(
    chunkFd: FormData,
    retries: number
  ): Promise<{ filekey: string; offset: number }> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch("/api/upload/chunk", { method: "POST", body: chunkFd });
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        return { filekey: data.filekey, offset: data.offset };
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
      }
    }
    throw new Error("Unreachable");
  }

  async function handleCommit(
    filekey: string,
    currentState: FormState
  ): Promise<string> {
    const file = currentState.file!;
    const ext = file.name.split(".").pop() ?? "jpg";

    const fd = new FormData();
    fd.append("commitOnly", "true");
    fd.append("filekey", filekey);
    fd.append("ext", ext);
    fd.append("archiveAbbr", currentState.archive!.abbr);
    fd.append("fond", currentState.fond);
    fd.append("opis", currentState.opis);
    fd.append("sprava", currentState.sprava);
    fd.append("dateFrom", currentState.dateFrom);
    fd.append("dateTo", currentState.dateTo);
    fd.append("isArbitraryDate", String(currentState.isArbitraryDate));
    fd.append("isOver75Years", String(currentState.isOver75Years));
    fd.append("isRussianEmpire", String(currentState.isRussianEmpire));

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.duplicateUrl) {
      update({ status: "duplicate", duplicateUrl: data.duplicateUrl });
      return "";
    }
    if (data.error) {
      throw new Error(data.error);
    }
    return data.url as string;
  }

  async function handleChunkedUpload(currentState: FormState) {
    const file = currentState.file!;
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    update({
      totalBytes: fileSize,
      totalChunks,
      uploadedBytes: 0,
      uploadProgress: 0,
      currentChunk: 0,
    });

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
      if (filekey) {
        chunkFd.append("filekey", filekey);
      }

      const result = await uploadChunkWithRetry(chunkFd, MAX_CHUNK_RETRIES);
      filekey = result.filekey;
      confirmedOffset = result.offset;

      const progress = Math.round((confirmedOffset / fileSize) * 100);
      update({
        currentChunk: i + 1,
        uploadedBytes: confirmedOffset,
        uploadProgress: progress,
      });
    }

    const url = await handleCommit(filekey, currentState);
    if (url) {
      update({ status: "success", resultUrl: url });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.status === "uploading") return;

    if (!formValid) {
      update({ submitted: true });
      return;
    }

    update({ submitted: false, status: "uploading", errorMessage: "", resultUrl: "", duplicateUrl: "" });

    const currentState = { ...state, submitted: false, status: "uploading" as const };

    try {
      if (state.file!.size > LARGE_FILE_THRESHOLD) {
        await handleChunkedUpload(currentState);
      } else {
        await handleDirectUpload(currentState);
      }
    } catch {
      update({ status: "error", errorMessage: "Помилка мережі" });
    }
  }

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900";

  const uploadedMB = (state.uploadedBytes / (1024 * 1024)).toFixed(1);
  const totalMB = (state.totalBytes / (1024 * 1024)).toFixed(1);

  function renderNameField(
    nameState: NameFieldState,
    setNameState: React.Dispatch<React.SetStateAction<NameFieldState>>,
    label: string,
    show: boolean,
    alwaysWritable = false
  ) {
    if (!show) return null;
    const isDisabled = alwaysWritable ? nameState.loading : nameState.loading || nameState.exists;
    const value = nameState.loading ? "" : alwaysWritable ? nameState.value : nameState.exists ? nameState.fetched : nameState.value;
    const isWritable = !isDisabled;
    const nameError = state.submitted && isWritable && !nameState.loading && !nameState.exists && value.trim() === "";
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
        <input
          type="text"
          disabled={isDisabled}
          value={value}
          onChange={isDisabled ? undefined : (e) => setNameState((p) => ({ ...p, value: e.target.value }))}
          placeholder={nameState.loading ? "Завантаження…" : `Введіть ${label.toLowerCase()}`}
          className={inputClass}
        />
        <FieldError show={nameError} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* File */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Файл
        </label>
        <input
          type="file"
          accept="image/*,.pdf,.tif,.tiff"
          onChange={(e) => update({ file: e.target.files?.[0] ?? null, archive: null, fond: "", opis: "", sprava: "", dateFrom: "", dateTo: "", submitted: false })}
          className="w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-700 dark:file:text-zinc-300"
        />
      </div>

      {/* Archive */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Архів
        </label>
        <ArchiveCombobox
          value={state.archive}
          onChange={(a) => {
            update({ archive: a, fond: "", opis: "", sprava: "", dateFrom: "", dateTo: "" });
            setFondName(emptyNameState);
            setOpisName(emptyNameState);
            setSpravaName(emptyNameState);
          }}
          disabled={!archiveEnabled}
        />
        <FieldError show={state.submitted && archiveEnabled && state.archive === null} />
      </div>

      {/* Fond / Opis / Sprava */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Фонд
          </label>
          <input
            type="text"
            value={state.fond}
            onChange={(e) => {
              update({ fond: e.target.value, opis: "", sprava: "", dateFrom: "", dateTo: "" });
              setFondName(emptyNameState);
              setOpisName(emptyNameState);
              setSpravaName(emptyNameState);
            }}
            onBlur={(e) => handleFondBlur(e.target.value)}
            disabled={!fondEnabled}
            placeholder="напр. 201"
            className={inputClass}
          />
          <FieldError show={state.submitted && fondEnabled && state.fond.trim() === ""} />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Опис
          </label>
          <input
            type="text"
            value={state.opis}
            onChange={(e) => {
              update({ opis: e.target.value, sprava: "", dateFrom: "", dateTo: "" });
              setOpisName(emptyNameState);
              setSpravaName(emptyNameState);
            }}
            onBlur={(e) => handleOpisBlur(e.target.value)}
            disabled={!opisEnabled}
            placeholder="напр. 1"
            className={inputClass}
          />
          <FieldError show={state.submitted && opisEnabled && state.opis.trim() === ""} />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Справа
          </label>
          <input
            type="text"
            value={state.sprava}
            onChange={(e) => {
              update({ sprava: e.target.value, dateFrom: "", dateTo: "" });
              setSpravaName(emptyNameState);
            }}
            onBlur={(e) => handleSpravaBlur(e.target.value)}
            disabled={!spravaEnabled}
            placeholder="напр. 3350"
            className={inputClass}
          />
          <FieldError show={state.submitted && spravaEnabled && state.sprava.trim() === ""} />
        </div>
      </div>

      {/* Names — full-width rows below fond/opis/sprava */}
      <div className="flex flex-col gap-2">
        {fondNameShown && renderNameField(fondName, setFondName, "Назва фонду", true)}
        {opisNameShown && renderNameField(opisName, setOpisName, "Назва опису", true)}
        {renderNameField(spravaName, setSpravaName, "Назва справи", true, true)}
      </div>

      {/* Dates */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Дати
        </label>
        <DateFields
          state={dateState}
          onChange={(patch) => update(patch)}
          disabled={!dateEnabled}
        />
        <FieldError
          show={state.submitted && dateEnabled && state.dateFrom.trim() === "" && state.dateTo.trim() === ""}
          message="Вкажіть хоча б одну дату"
        />
        <FieldError
          show={state.submitted && dateEnabled && state.isArbitraryDate && !state.isOver75Years}
          message="Підтвердіть, що справі більше 75 років"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={(state.submitted && !formValid) || state.status === "uploading" || state.status === "success"}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
      >
        {state.status === "uploading" ? "Завантаження…" : "Завантажити на Commons"}
      </button>

      {state.submitted && !formValid && (
        <p className="text-sm text-red-600 dark:text-red-400">
          У формі наявні помилки. Виправте їх і спробуйте знову.
        </p>
      )}

      {state.status === "uploading" && state.totalChunks > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Чанк {state.currentChunk} з {state.totalChunks} — {state.uploadProgress}%
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              style={{ width: `${state.uploadProgress}%` }}
              className="h-2 bg-blue-600 rounded-full transition-all duration-300"
            />
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {uploadedMB} МБ з {totalMB} МБ
          </div>
        </div>
      )}

      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Успішно!{" "}
          <a href={state.resultUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Переглянути файл
          </a>
        </p>
      )}

      {state.status === "duplicate" && (
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          Файл з таким вмістом вже існує у Вікісховищі.{" "}
          <a href={state.duplicateUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Переглянути існуючий файл
          </a>
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.errorMessage}</p>
      )}
    </form>
  );
}
