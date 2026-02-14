"use client";

import { useUploadForm } from "@/hooks/useUploadForm";
import EntryCard from "./EntryCard";
import FileDropZone from "./FileDropZone";

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
    handleArchiveChange,
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
          className="btn-primary"
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
        className="self-start text-base text-blue-600 hover:underline"
      >
        ← Назад
      </button>

      {fileStates.map((entry, index) => (
        <EntryCard
          key={index}
          entry={entry}
          onUpdate={(patch) => updateEntry(index, patch)}
          onArchiveChange={(a) => handleArchiveChange(index, a)}
          onFondBlur={(value) => handleFondBlur(index, value)}
          onOpisBlur={(value) => handleOpisBlur(index, value)}
          onSpravaBlur={(value) => handleSpravaBlur(index, value)}
        />
      ))}

      <button
        type="submit"
        disabled={isAnyUploading || allSucceeded}
        className="btn-primary"
      >
        {isAnyUploading ? "Завантаження…" : "Завантажити"}
      </button>

      {hasErrors && (
        <p className="text-base text-red-600">
          У формі наявні помилки. Виправте їх і спробуйте знову.
        </p>
      )}
    </form>
  );
}
