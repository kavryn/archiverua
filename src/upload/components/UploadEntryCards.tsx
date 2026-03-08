"use client";

import type { FileEntry } from "../types";
import { isEntryValid } from "../validation";
import EntryCard from "./EntryCard";

type Props = {
  fileStates: FileEntry[];
  updateEntry: (index: number, patch: Partial<FileEntry> | ((e: FileEntry) => Partial<FileEntry>)) => void;
  handleBack: () => void;
  handleSubmit: (e: React.FormEvent) => void;
};

export default function UploadEntryCards({
  fileStates,
  updateEntry,
  handleBack,
  handleSubmit,
}: Props) {
  const hasErrors = fileStates.some((e) => e.submitted && !isEntryValid(e));
  const hasFileNameConflict = fileStates.some((e) => {
    const c = e.fileNameCheck;
    return c.status === 'too_short' || c.status === 'too_long' ||
      (c.status === 'done' && (c.exists === true || c.blacklisted === true));
  });
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
        />
      ))}

      {hasErrors && (
        <p className="text-base text-red-600">
          У формі наявні помилки. Виправте їх і спробуйте знову.
        </p>
      )}

      <button
        type="submit"
        disabled={hasFileNameConflict}
        className="btn-primary"
      >
        Завантажити
      </button>
    </form>
  );
}
