"use client";

import { useUploadForm } from "@/hooks/useUploadForm";
import EntryCard from "./EntryCard";
import FileDropZone from "./FileDropZone";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900";

export default function UploadForm() {
  const {
    step,
    files,
    fileStates,
    isAnyUploading,
    allSucceeded,
    hasErrors,
    updateEntry,
    handleAddFiles,
    handleRemoveFile,
    handleContinue,
    handleBack,
    handleFondBlur,
    handleOpisBlur,
    handleSpravaBlur,
    handleSubmit,
  } = useUploadForm();

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleBack}
        className="self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Назад
      </button>

      {fileStates.map((entry, index) => (
        <EntryCard
          key={index}
          entry={entry}
          inputClass={inputClass}
          onUpdate={(patch) => updateEntry(index, patch)}
          onFondBlur={(value) => handleFondBlur(index, value)}
          onOpisBlur={(value) => handleOpisBlur(index, value)}
          onSpravaBlur={(value) => handleSpravaBlur(index, value)}
        />
      ))}

      <button
        type="submit"
        disabled={isAnyUploading || allSucceeded}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
      >
        {isAnyUploading ? "Завантаження…" : "Завантажити"}
      </button>

      {hasErrors && (
        <p className="text-sm text-red-600 dark:text-red-400">
          У формі наявні помилки. Виправте їх і спробуйте знову.
        </p>
      )}
    </form>
  );
}
