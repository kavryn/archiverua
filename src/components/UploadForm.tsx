"use client";

import { useState } from "react";
import ArchiveCombobox from "./ArchiveCombobox";
import DateFields, { getDateError, type DateState } from "./DateFields";
import FileDropZone from "./FileDropZone";
import type { Archive } from "@/lib/archives";

const CHUNK_SIZE = 20 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

interface NameFieldState {
  value: string;
  fetched: string;
  exists: boolean;
  loading: boolean;
  lastFetchedTitle: string;
}

const emptyNameState: NameFieldState = {
  value: "",
  fetched: "",
  exists: false,
  loading: false,
  lastFetchedTitle: "",
};

interface FileEntry {
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

function makeEntry(file: File): FileEntry {
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

async function fetchWikisourceName(
  pageTitle: string
): Promise<{ name: string | null; exists: boolean }> {
  const res = await fetch(`/api/wikisource-name?title=${encodeURIComponent(pageTitle)}`);
  return res.json();
}

function isEntryValid(entry: FileEntry): boolean {
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

  const opisNameShown = entry.opisName.loading || entry.opisName.lastFetchedTitle !== "";
  const opisNameWritable = opisNameShown && !entry.opisName.loading && !entry.opisName.exists;
  const opisNameEmpty = opisNameWritable && entry.opisName.value.trim() === "";

  const spravaNameWritable = dateEnabled && !entry.spravaName.loading;
  const spravaNameEmpty = spravaNameWritable && entry.spravaName.value.trim() === "";

  return (
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opis.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    datesValid &&
    !fondNameEmpty &&
    !opisNameEmpty &&
    !spravaNameEmpty
  );
}

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

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900";

export default function UploadForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [fileStates, setFileStates] = useState<FileEntry[]>([]);

  function updateEntry(index: number, patch: Partial<FileEntry>) {
    setFileStates((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  // Step 1 handlers
  function handleAddFiles(newFiles: File[]) {
    setFiles((prev) => {
      const filtered = newFiles.filter(
        (nf) => !prev.some((ef) => ef.name === nf.name && ef.size === nf.size)
      );
      return [...prev, ...filtered];
    });
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleContinue() {
    setFileStates(files.map(makeEntry));
    setStep(2);
  }

  function handleBack() {
    setStep(1);
    setFileStates([]);
  }

  // Per-entry blur handlers
  async function handleFondBlur(index: number, value: string) {
    const entry = fileStates[index];
    if (!entry.archive || !value.trim()) return;
    const title = `Архів:${entry.archive.abbr}/${value.trim()}`;
    if (entry.fondName.lastFetchedTitle === title) return;
    updateEntry(index, { fondName: { ...entry.fondName, loading: true } });
    try {
      const result = await fetchWikisourceName(title);
      updateEntry(index, {
        fondName: { value: "", fetched: result.name ?? "", exists: result.exists, loading: false, lastFetchedTitle: title },
      });
    } catch {
      setFileStates((prev) =>
        prev.map((e, i) => i === index ? { ...e, fondName: { ...e.fondName, loading: false } } : e)
      );
    }
  }

  async function handleOpisBlur(index: number, value: string) {
    const entry = fileStates[index];
    if (!entry.archive || !entry.fond.trim() || !value.trim()) return;
    const title = `Архів:${entry.archive.abbr}/${entry.fond.trim()}/${value.trim()}`;
    if (entry.opisName.lastFetchedTitle === title) return;
    updateEntry(index, { opisName: { ...entry.opisName, loading: true } });
    try {
      const result = await fetchWikisourceName(title);
      updateEntry(index, {
        opisName: { value: "", fetched: result.name ?? "", exists: result.exists, loading: false, lastFetchedTitle: title },
      });
    } catch {
      setFileStates((prev) =>
        prev.map((e, i) => i === index ? { ...e, opisName: { ...e.opisName, loading: false } } : e)
      );
    }
  }

  async function handleSpravaBlur(index: number, value: string) {
    const entry = fileStates[index];
    if (!entry.archive || !entry.fond.trim() || !entry.opis.trim() || !value.trim()) return;
    const title = `Архів:${entry.archive.abbr}/${entry.fond.trim()}/${entry.opis.trim()}/${value.trim()}`;
    if (entry.spravaName.lastFetchedTitle === title) return;
    updateEntry(index, { spravaName: { ...entry.spravaName, loading: true } });
    try {
      const result = await fetchWikisourceName(title);
      updateEntry(index, {
        spravaName: { value: result.name ?? "", fetched: result.name ?? "", exists: result.exists, loading: false, lastFetchedTitle: title },
      });
    } catch {
      setFileStates((prev) =>
        prev.map((e, i) => i === index ? { ...e, spravaName: { ...e.spravaName, loading: false } } : e)
      );
    }
  }

  // Upload helpers
  async function uploadChunkWithRetry(
    chunkFd: FormData,
    retries: number
  ): Promise<{ filekey: string; offset: number }> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch("/api/upload/chunk", { method: "POST", body: chunkFd });
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
    const ext = entry.file.name.split(".").pop() ?? "pdf";
    const fd = new FormData();
    fd.append("commitOnly", "true");
    fd.append("filekey", filekey);
    fd.append("ext", ext);
    fd.append("archiveAbbr", entry.archive!.abbr);
    fd.append("fond", entry.fond);
    fd.append("opis", entry.opis);
    fd.append("sprava", entry.sprava);
    fd.append("dateFrom", entry.dateFrom);
    fd.append("dateTo", entry.dateTo);
    fd.append("isArbitraryDate", String(entry.isArbitraryDate));
    fd.append("isOver75Years", String(entry.isOver75Years));
    fd.append("isRussianEmpire", String(entry.isRussianEmpire));
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.duplicateUrl) return `__duplicate__${data.duplicateUrl}`;
    if (data.error) throw new Error(data.error);
    return data.url as string;
  }

  async function uploadEntry(index: number, entry: FileEntry) {
    const file = entry.file;
    if (file.size > LARGE_FILE_THRESHOLD) {
      const fileSize = file.size;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      updateEntry(index, {
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
        if (filekey) chunkFd.append("filekey", filekey);

        const result = await uploadChunkWithRetry(chunkFd, MAX_CHUNK_RETRIES);
        filekey = result.filekey;
        confirmedOffset = result.offset;

        const progress = Math.round((confirmedOffset / fileSize) * 100);
        updateEntry(index, {
          currentChunk: i + 1,
          uploadedBytes: confirmedOffset,
          uploadProgress: progress,
        });
      }

      const url = await commitUpload(filekey, entry);
      if (url.startsWith("__duplicate__")) {
        updateEntry(index, { status: "duplicate", duplicateUrl: url.slice("__duplicate__".length) });
      } else {
        updateEntry(index, { status: "success", resultUrl: url });
      }
    } else {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("archiveAbbr", entry.archive!.abbr);
      fd.append("fond", entry.fond);
      fd.append("opis", entry.opis);
      fd.append("sprava", entry.sprava);
      fd.append("dateFrom", entry.dateFrom);
      fd.append("dateTo", entry.dateTo);
      fd.append("isArbitraryDate", String(entry.isArbitraryDate));
      fd.append("isOver75Years", String(entry.isOver75Years));
      fd.append("isRussianEmpire", String(entry.isRussianEmpire));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.duplicateUrl) {
        updateEntry(index, { status: "duplicate", duplicateUrl: data.duplicateUrl });
      } else if (data.error) {
        updateEntry(index, { status: "error", errorMessage: data.error });
      } else {
        updateEntry(index, { status: "success", resultUrl: data.url });
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Snapshot current state and validate
    const current = fileStates;
    setFileStates((prev) => prev.map((e) => ({ ...e, submitted: true })));

    const allValid = current.every(isEntryValid);
    if (!allValid) return;

    for (let i = 0; i < current.length; i++) {
      const entry = current[i];
      if (entry.status === "success") continue;
      updateEntry(i, { status: "uploading", errorMessage: "", resultUrl: "", duplicateUrl: "" });
      try {
        await uploadEntry(i, entry);
      } catch {
        updateEntry(i, { status: "error", errorMessage: "Помилка мережі" });
      }
    }
  }

  function renderEntryCard(entry: FileEntry, index: number) {
    const fondEnabled = entry.archive !== null;
    const opisEnabled = entry.fond.trim() !== "";
    const spravaEnabled = entry.opis.trim() !== "";
    const dateEnabled = entry.sprava.trim() !== "";

    const dateState: DateState = {
      dateFrom: entry.dateFrom,
      dateTo: entry.dateTo,
      isArbitraryDate: entry.isArbitraryDate,
      isOver75Years: entry.isOver75Years,
      isRussianEmpire: entry.isRussianEmpire,
    };

    const fondNameShown = entry.fondName.loading || entry.fondName.lastFetchedTitle !== "";
    const fondNameWritable = fondNameShown && !entry.fondName.loading && !entry.fondName.exists;
    const opisNameShown = entry.opisName.loading || entry.opisName.lastFetchedTitle !== "";
    const opisNameWritable = opisNameShown && !entry.opisName.loading && !entry.opisName.exists;
    const spravaNameWritable = dateEnabled && !entry.spravaName.loading;

    const uploadedMB = (entry.uploadedBytes / (1024 * 1024)).toFixed(1);
    const totalMB = (entry.totalBytes / (1024 * 1024)).toFixed(1);

    return (
      <div key={index} className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {entry.file.name}
        </h3>

        {/* Archive */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Архів
          </label>
          <ArchiveCombobox
            value={entry.archive}
            onChange={(a) =>
              updateEntry(index, {
                archive: a,
                fond: "",
                opis: "",
                sprava: "",
                dateFrom: "",
                dateTo: "",
                fondName: emptyNameState,
                opisName: emptyNameState,
                spravaName: emptyNameState,
              })
            }
            disabled={false}
          />
          <FieldError show={entry.submitted && entry.archive === null} />
        </div>

        {/* Fond / Opis / Sprava */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Фонд
            </label>
            <input
              type="text"
              value={entry.fond}
              onChange={(e) =>
                updateEntry(index, {
                  fond: e.target.value,
                  opis: "",
                  sprava: "",
                  dateFrom: "",
                  dateTo: "",
                  fondName: emptyNameState,
                  opisName: emptyNameState,
                  spravaName: emptyNameState,
                })
              }
              onBlur={(e) => handleFondBlur(index, e.target.value)}
              disabled={!fondEnabled}
              placeholder="напр. 201"
              className={inputClass}
            />
            <FieldError show={entry.submitted && fondEnabled && entry.fond.trim() === ""} />
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Опис
            </label>
            <input
              type="text"
              value={entry.opis}
              onChange={(e) =>
                updateEntry(index, {
                  opis: e.target.value,
                  sprava: "",
                  dateFrom: "",
                  dateTo: "",
                  opisName: emptyNameState,
                  spravaName: emptyNameState,
                })
              }
              onBlur={(e) => handleOpisBlur(index, e.target.value)}
              disabled={!opisEnabled}
              placeholder="напр. 1"
              className={inputClass}
            />
            <FieldError show={entry.submitted && opisEnabled && entry.opis.trim() === ""} />
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Справа
            </label>
            <input
              type="text"
              value={entry.sprava}
              onChange={(e) =>
                updateEntry(index, {
                  sprava: e.target.value,
                  dateFrom: "",
                  dateTo: "",
                  spravaName: emptyNameState,
                })
              }
              onBlur={(e) => handleSpravaBlur(index, e.target.value)}
              disabled={!spravaEnabled}
              placeholder="напр. 3350"
              className={inputClass}
            />
            <FieldError show={entry.submitted && spravaEnabled && entry.sprava.trim() === ""} />
          </div>
        </div>

        {/* Name fields */}
        <div className="flex flex-col gap-2">
          {fondNameShown && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Назва фонду
              </label>
              <input
                type="text"
                disabled={entry.fondName.loading || entry.fondName.exists}
                value={
                  entry.fondName.loading
                    ? ""
                    : entry.fondName.exists
                    ? entry.fondName.fetched
                    : entry.fondName.value
                }
                onChange={(e) =>
                  !entry.fondName.loading &&
                  !entry.fondName.exists &&
                  updateEntry(index, { fondName: { ...entry.fondName, value: e.target.value } })
                }
                placeholder={entry.fondName.loading ? "Завантаження…" : "Введіть назву фонду"}
                className={inputClass}
              />
              <FieldError
                show={
                  entry.submitted &&
                  fondNameWritable &&
                  !entry.fondName.loading &&
                  entry.fondName.value.trim() === ""
                }
              />
            </div>
          )}

          {opisNameShown && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Назва опису
              </label>
              <input
                type="text"
                disabled={entry.opisName.loading || entry.opisName.exists}
                value={
                  entry.opisName.loading
                    ? ""
                    : entry.opisName.exists
                    ? entry.opisName.fetched
                    : entry.opisName.value
                }
                onChange={(e) =>
                  !entry.opisName.loading &&
                  !entry.opisName.exists &&
                  updateEntry(index, { opisName: { ...entry.opisName, value: e.target.value } })
                }
                placeholder={entry.opisName.loading ? "Завантаження…" : "Введіть назву опису"}
                className={inputClass}
              />
              <FieldError
                show={
                  entry.submitted &&
                  opisNameWritable &&
                  !entry.opisName.loading &&
                  entry.opisName.value.trim() === ""
                }
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Назва справи
            </label>
            <input
              type="text"
              disabled={!dateEnabled || entry.spravaName.loading}
              value={entry.spravaName.loading ? "" : entry.spravaName.value}
              onChange={(e) =>
                dateEnabled &&
                !entry.spravaName.loading &&
                updateEntry(index, { spravaName: { ...entry.spravaName, value: e.target.value } })
              }
              placeholder={entry.spravaName.loading ? "Завантаження…" : "Введіть назву справи"}
              className={inputClass}
            />
            <FieldError
              show={entry.submitted && spravaNameWritable && entry.spravaName.value.trim() === ""}
            />
          </div>
        </div>

        {/* Dates */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Дати
          </label>
          <DateFields
            state={dateState}
            onChange={(patch) => updateEntry(index, patch)}
            disabled={!dateEnabled}
          />
          <FieldError
            show={
              entry.submitted &&
              dateEnabled &&
              entry.dateFrom.trim() === "" &&
              entry.dateTo.trim() === ""
            }
            message="Вкажіть хоча б одну дату"
          />
          <FieldError
            show={entry.submitted && dateEnabled && entry.isArbitraryDate && !entry.isOver75Years}
            message="Підтвердіть, що справі більше 75 років"
          />
        </div>

        {/* Upload status */}
        {entry.status === "uploading" && entry.totalChunks > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Чанк {entry.currentChunk} з {entry.totalChunks} — {entry.uploadProgress}%
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                style={{ width: `${entry.uploadProgress}%` }}
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              />
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {uploadedMB} МБ з {totalMB} МБ
            </div>
          </div>
        )}

        {entry.status === "uploading" && entry.totalChunks === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Завантаження…</p>
        )}

        {entry.status === "success" && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Успішно!{" "}
            <a href={entry.resultUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Переглянути файл
            </a>
          </p>
        )}

        {entry.status === "duplicate" && (
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Файл з таким вмістом вже існує у Вікісховищі.{" "}
            <a
              href={entry.duplicateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Переглянути існуючий файл
            </a>
          </p>
        )}

        {entry.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{entry.errorMessage}</p>
        )}
      </div>
    );
  }

  // Step 1
  if (step === 1) {
    return (
      <div className="flex flex-col gap-4">
        <FileDropZone files={files} onAdd={handleAddFiles} onRemove={handleRemoveFile} />
        <button
          type="button"
          onClick={handleContinue}
          disabled={files.length === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
        >
          Продовжити
        </button>
      </div>
    );
  }

  // Step 2
  const isAnyUploading = fileStates.some((e) => e.status === "uploading");
  const allSucceeded = fileStates.length > 0 && fileStates.every((e) => e.status === "success");
  const hasErrors = fileStates.some((e) => e.submitted && !isEntryValid(e));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleBack}
        className="self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Назад
      </button>

      {fileStates.map((entry, index) => renderEntryCard(entry, index))}

      <button
        type="submit"
        disabled={isAnyUploading || allSucceeded}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
      >
        {isAnyUploading ? "Завантаження…" : "Завантажити на Commons"}
      </button>

      {hasErrors && (
        <p className="text-sm text-red-600 dark:text-red-400">
          У формі наявні помилки. Виправте їх і спробуйте знову.
        </p>
      )}
    </form>
  );
}
