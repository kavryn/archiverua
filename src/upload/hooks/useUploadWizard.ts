import { useState, useEffect } from "react";
import { makeEntry, type FileEntry } from "../types";
import { isEntryValid } from "../validation";
import { uploadFile, callWikisourcePublish } from "../upload";
import { useNavigationGuard } from "@/context/NavigationGuardContext";

export function useUploadWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [fileStates, setFileStates] = useState<FileEntry[]>([]);

  function updateEntry(index: number, patch: Partial<FileEntry> | ((e: FileEntry) => Partial<FileEntry>)) {
    setFileStates((prev) => prev.map((e, i) => {
      if (i !== index) return e;
      const p = typeof patch === "function" ? patch(e) : patch;
      return { ...e, ...p };
    }));
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

  // Step 2 handlers
  function handleBack() {
    setStep(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const current = fileStates;
    setFileStates((prev) => prev.map((entry) => ({ ...entry, submitted: true })));

    const allValid = current.every(isEntryValid);
    if (!allValid) return;

    setStep(3);

    for (let i = 0; i < current.length; i++) {
      const entry = current[i];
      if (entry.status === "success" || entry.status === "duplicate") continue;
      updateEntry(i, { status: "uploading", errorMessage: "", resultUrl: "", duplicateUrl: "" });
      try {
        const result = await uploadFile(entry, (progress) => updateEntry(i, progress));
        if (result.status === "success") {
          updateEntry(i, { status: "success", resultUrl: result.url });
          try {
            updateEntry(i, { wikisourceStatus: "pending" });
            const wikisourceResult = await callWikisourcePublish(entry);
            updateEntry(i, { wikisourceStatus: "success", wikisourceResult });
          } catch {
            updateEntry(i, { wikisourceStatus: "error" });
          }
        } else if (result.status === "duplicate") {
          updateEntry(i, { status: "duplicate", duplicateUrl: result.duplicateUrl, wikisourceStatus: "cancelled" });
        } else {
          updateEntry(i, { status: "error", errorMessage: result.errorMessage, wikisourceStatus: "cancelled" });
        }
      } catch {
        updateEntry(i, { status: "error", errorMessage: "Помилка мережі", wikisourceStatus: "cancelled" });
      }
    }
  }

  const isAnyUploading = fileStates.some((e) => e.status === "uploading" || e.wikisourceStatus === "pending");

  const { setShouldGuard } = useNavigationGuard();

  useEffect(() => {
    const guard = step === 2 || (step === 3 && isAnyUploading);
    setShouldGuard(guard);
    return () => setShouldGuard(false);
  }, [step, isAnyUploading, setShouldGuard]);

  return {
    step,
    files,
    fileStates,
    updateEntry,
    handleAddFiles,
    handleRemoveFile,
    handleContinue,
    handleBack,
    handleSubmit,
  };
}
