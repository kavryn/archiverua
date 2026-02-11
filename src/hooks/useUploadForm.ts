import { useState } from "react";
import { makeEntry, isEntryValid, fetchWikisourceName, type FileEntry } from "@/types/upload-form";
import { uploadFile } from "@/lib/upload";

export function useUploadForm() {
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
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileStates((prev) => prev.filter((e) => e.file !== fileToRemove));
  }

  function handleContinue() {
    setFileStates(files.map((f) => fileStates.find((e) => e.file === f) ?? makeEntry(f)));
    setStep(2);
  }

  function handleBack() {
    setStep(1);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const current = fileStates;
    setFileStates((prev) => prev.map((entry) => ({ ...entry, submitted: true })));

    const allValid = current.every(isEntryValid);
    if (!allValid) return;

    for (let i = 0; i < current.length; i++) {
      const entry = current[i];
      if (entry.status === "success") continue;
      updateEntry(i, { status: "uploading", errorMessage: "", resultUrl: "", duplicateUrl: "" });
      try {
        const result = await uploadFile(entry, (progress) => updateEntry(i, progress));
        if (result.status === "success") {
          updateEntry(i, { status: "success", resultUrl: result.url });
        } else if (result.status === "duplicate") {
          updateEntry(i, { status: "duplicate", duplicateUrl: result.duplicateUrl });
        } else {
          updateEntry(i, { status: "error", errorMessage: result.errorMessage });
        }
      } catch {
        updateEntry(i, { status: "error", errorMessage: "Помилка мережі" });
      }
    }
  }

  const isAnyUploading = fileStates.some((e) => e.status === "uploading");
  const allSucceeded = fileStates.length > 0 && fileStates.every((e) => e.status === "success");
  const hasErrors = fileStates.some((e) => e.submitted && !isEntryValid(e));

  return {
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
  };
}
