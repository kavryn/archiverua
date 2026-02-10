"use client";

import { useState } from "react";
import ArchiveCombobox from "./ArchiveCombobox";
import DateFields, { getDateError, type DateState } from "./DateFields";
import type { Archive } from "@/lib/archives";

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
  status: "idle" | "uploading" | "success" | "error";
  errorMessage: string;
  resultUrl: string;
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
};

export default function UploadForm() {
  const [state, setState] = useState<FormState>(initialState);

  function update(patch: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...patch }));
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
  const submitEnabled =
    dateEnabled &&
    !dateError &&
    arbitraryOk &&
    (state.dateFrom.trim() !== "" || state.dateTo.trim() !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submitEnabled || state.status === "uploading") return;

    update({ status: "uploading", errorMessage: "", resultUrl: "" });

    const fd = new FormData();
    fd.append("file", state.file!);
    fd.append("archiveAbbr", state.archive!.abbr);
    fd.append("fond", state.fond);
    fd.append("opis", state.opis);
    fd.append("sprava", state.sprava);
    fd.append("dateFrom", state.dateFrom);
    fd.append("dateTo", state.dateTo);
    fd.append("isArbitraryDate", String(state.isArbitraryDate));
    fd.append("isOver75Years", String(state.isOver75Years));
    fd.append("isRussianEmpire", String(state.isRussianEmpire));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) {
        update({ status: "error", errorMessage: data.error });
      } else {
        update({ status: "success", resultUrl: data.url });
      }
    } catch {
      update({ status: "error", errorMessage: "Помилка мережі" });
    }
  }

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* File */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Файл
        </label>
        <input
          type="file"
          accept="image/*,.pdf,.tif,.tiff"
          onChange={(e) => update({ file: e.target.files?.[0] ?? null, archive: null, fond: "", opis: "", sprava: "", dateFrom: "", dateTo: "" })}
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
          onChange={(a) => update({ archive: a, fond: "", opis: "", sprava: "", dateFrom: "", dateTo: "" })}
          disabled={!archiveEnabled}
        />
      </div>

      {/* Fond */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Фонд
        </label>
        <input
          type="text"
          value={state.fond}
          onChange={(e) => update({ fond: e.target.value, opis: "", sprava: "", dateFrom: "", dateTo: "" })}
          disabled={!fondEnabled}
          placeholder="напр. 201"
          className={inputClass}
        />
      </div>

      {/* Opis */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Опис
        </label>
        <input
          type="text"
          value={state.opis}
          onChange={(e) => update({ opis: e.target.value, sprava: "", dateFrom: "", dateTo: "" })}
          disabled={!opisEnabled}
          placeholder="напр. 1"
          className={inputClass}
        />
      </div>

      {/* Sprava */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Справа
        </label>
        <input
          type="text"
          value={state.sprava}
          onChange={(e) => update({ sprava: e.target.value, dateFrom: "", dateTo: "" })}
          disabled={!spravaEnabled}
          placeholder="напр. 3350"
          className={inputClass}
        />
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
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!submitEnabled || state.status === "uploading"}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
      >
        {state.status === "uploading" ? "Завантаження…" : "Завантажити на Commons"}
      </button>

      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Успішно!{" "}
          <a href={state.resultUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Переглянути файл
          </a>
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.errorMessage}</p>
      )}
    </form>
  );
}
