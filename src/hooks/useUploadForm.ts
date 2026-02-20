import { useState } from "react";
import { makeEntry, isEntryValid, fetchWikisourceName, emptyNameState, emptySpravaWikisource, type FileEntry } from "@/types/upload-form";
import { uploadFile, callWikisourceAll } from "@/lib/upload";
import type { Archive } from "@/lib/archives";

/**
 * Changes from "р203" to "Р-203"
 */
function normalizeFond(v: string): string {
  let r = v.replace(/[\s\/]/g, "").toUpperCase();
  if (r.length >= 2 && /[A-ZА-ЯІЇЄҐ]/.test(r[0]) && /\d/.test(r[1])) {
    r = r[0] + "-" + r.slice(1);
  }
  return r;
}

/**
 * Changes from "4-А" to "4а"
 */
function normalizeOpisSprava(v: string): string {
  return v.replace(/[\s\-\/]/g, "").toLowerCase();
}

export function useUploadForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [fileStates, setFileStates] = useState<FileEntry[]>([]);
  const [uploadStarted, setUploadStarted] = useState(false);

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
    value = normalizeFond(value);
    updateEntry(index, { fond: value });
    const entry = fileStates[index];
    if (!entry.archive) return;
    if (!value) {
      updateEntry(index, { fondName: emptyNameState, opisName: emptyNameState, spravaWikisource: emptySpravaWikisource });
      return;
    }
    const title = `Архів:${entry.archive.abbr}/${value}`;
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
    value = normalizeOpisSprava(value);
    updateEntry(index, { opis: value });
    const entry = fileStates[index];
    if (!entry.archive || !entry.fond) return;
    if (!value) {
      updateEntry(index, { opisName: emptyNameState, spravaWikisource: emptySpravaWikisource });
      return;
    }
    const title = `Архів:${entry.archive.abbr}/${entry.fond}/${value}`;
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
    value = normalizeOpisSprava(value);
    updateEntry(index, { sprava: value });
    const entry = fileStates[index];
    if (!entry.archive || !entry.fond || !entry.opis) return;
    if (!value) {
      updateEntry(index, { spravaWikisource: emptySpravaWikisource });
      return;
    }
    const title = `Архів:${entry.archive.abbr}/${entry.fond}/${entry.opis}/${value}`;
    if (entry.spravaWikisource.lastFetchedTitle === title) return;
    updateEntry(index, { spravaWikisource: { ...entry.spravaWikisource, loading: true } });
    try {
      const result = await fetchWikisourceName(title);
      updateEntry(index, {
        spravaWikisource: { name: result.name, exists: result.exists, loading: false, lastFetchedTitle: title },
      });
    } catch {
      setFileStates((prev) =>
        prev.map((e, i) => i === index ? { ...e, spravaWikisource: { ...e.spravaWikisource, loading: false } } : e)
      );
    }
  }

  async function handleArchiveChange(index: number, newArchive: Archive | null) {
    const entry = fileStates[index];
    updateEntry(index, { archive: newArchive });

    if (!newArchive) {
      updateEntry(index, { fondName: emptyNameState, opisName: emptyNameState, spravaWikisource: emptySpravaWikisource });
      return;
    }

    const fond = entry.fond.trim();
    const opis = entry.opis.trim();
    const sprava = entry.sprava.trim();

    if (fond) {
      const title = `Архів:${newArchive.abbr}/${fond}`;
      if (entry.fondName.lastFetchedTitle !== title) {
        updateEntry(index, { fondName: { ...emptyNameState, loading: true } });
        try {
          const r = await fetchWikisourceName(title);
          updateEntry(index, { fondName: { value: "", fetched: r.name ?? "", exists: r.exists, loading: false, lastFetchedTitle: title } });
        } catch { updateEntry(index, { fondName: emptyNameState }); }
      }
    }

    if (fond && opis) {
      const title = `Архів:${newArchive.abbr}/${fond}/${opis}`;
      if (entry.opisName.lastFetchedTitle !== title) {
        updateEntry(index, { opisName: { ...emptyNameState, loading: true } });
        try {
          const r = await fetchWikisourceName(title);
          updateEntry(index, { opisName: { value: "", fetched: r.name ?? "", exists: r.exists, loading: false, lastFetchedTitle: title } });
        } catch { updateEntry(index, { opisName: emptyNameState }); }
      }
    }

    if (fond && opis && sprava) {
      const title = `Архів:${newArchive.abbr}/${fond}/${opis}/${sprava}`;
      if (entry.spravaWikisource.lastFetchedTitle !== title) {
        updateEntry(index, { spravaWikisource: { ...emptySpravaWikisource, loading: true } });
        try {
          const r = await fetchWikisourceName(title);
          updateEntry(index, { spravaWikisource: { name: r.name, exists: r.exists, loading: false, lastFetchedTitle: title } });
        } catch { updateEntry(index, { spravaWikisource: emptySpravaWikisource }); }
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const current = fileStates;
    setFileStates((prev) => prev.map((entry) => ({ ...entry, submitted: true })));

    const allValid = current.every(isEntryValid);
    if (!allValid) return;

    setUploadStarted(true);

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
            const wikisourceResult = await callWikisourceAll(entry);
            updateEntry(i, { wikisourceStatus: "success", wikisourceResult });
          } catch {
            updateEntry(i, { wikisourceStatus: "error" });
          }
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
  const hasFileNameConflict = fileStates.some((e) => e.fileNameCheck.exists === true);

  return {
    step,
    files,
    fileStates,
    uploadStarted,
    isAnyUploading,
    allSucceeded,
    hasErrors,
    hasFileNameConflict,
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
  };
}
