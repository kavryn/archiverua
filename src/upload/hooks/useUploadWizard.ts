import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import pLimit from "p-limit";
import { makeEntry, type FileEntry } from "../types";
import { isEntryValid } from "../validation";
import { uploadFile, callWikisourcePublish } from "../upload";
import {
  cleanupStaleTmpFiles,
  convertZipToPdf,
  pdfNameForZip,
  removeOpfsFile,
  ZipValidationError,
} from "../zipToPdf";
import {
  renderPdfPageBlob,
  revokeThumbUrls,
  type PdfThumb,
} from "../pdfPreview";
import { useNavigationGuard } from "@/context/NavigationGuardContext";

const MAX_CONCURRENT_UPLOADS = 3;

// ZIP→PDF conversion is CPU-heavy: zip.js inflate, image parsing, and PDFKit
// embedding all run on the main thread (web workers off for OPFS visibility).
// Run conversions serially so dropping many archives doesn't freeze the UI.
const zipConversionLimit = pLimit(1);

export type ZipPreview = {
  thumbs: PdfThumb[];
  totalPages: number;
  loadFull: (index: number) => Promise<Blob>;
};

export type ZipConversionState = {
  id: string;
  zipName: string;
  status: "validating" | "converting" | "error";
  currentEntry: number;
  totalEntries: number;
  currentName: string;
  errorMessage?: string;
};

export function useUploadWizard(directUploadEnabled: boolean) {
  const { data: session } = useSession();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [fileStates, setFileStates] = useState<FileEntry[]>([]);
  const [zipConversions, setZipConversions] = useState<ZipConversionState[]>([]);
  const [zipPreviews, setZipPreviews] = useState<Map<string, ZipPreview>>(new Map());
  const zipControllersRef = useRef<Map<string, AbortController>>(new Map());
  // We forbid two files with the same name in `files` (see handleAddFiles /
  // handleAddZips), so name → opfsName is a safe lookup.
  const opfsNamesRef = useRef<Map<string, string>>(new Map());
  const zipPreviewsRef = useRef<Map<string, ZipPreview>>(zipPreviews);

  useEffect(() => {
    zipPreviewsRef.current = zipPreviews;
  }, [zipPreviews]);

  useEffect(() => {
    cleanupStaleTmpFiles();
  }, []);

  // Revoke any leftover blob URLs when the wizard unmounts.
  useEffect(() => {
    return () => {
      for (const p of zipPreviewsRef.current.values()) revokeThumbUrls(p.thumbs);
    };
  }, []);

  function updateEntry(index: number, patch: Partial<FileEntry> | ((e: FileEntry) => Partial<FileEntry>)) {
    setFileStates((prev) => prev.map((e, i) => {
      if (i !== index) return e;
      const p = typeof patch === "function" ? patch(e) : patch;
      return { ...e, ...p };
    }));
  }

  // Identity for collision detection: a ZIP and the PDF it would produce share
  // the same identity ("scan.zip" and "scan.pdf" → "scan.pdf"). DJVU is
  // independent. This is what prevents two indistinguishable entries in step 2.
  function identityOf(file: File): string {
    return file.name.toLowerCase().endsWith(".zip") ? pdfNameForZip(file.name) : file.name;
  }

  // Step 1 handler. Single entry point so direct PDFs and ZIPs dropped in the
  // same event are deduped against each other atomically — no stale-closure
  // race between separate handlers.
  function handleAdd(newFiles: File[]) {
    const taken = new Set<string>([
      ...files.map((f) => f.name),
      ...zipConversions
        .filter((c) => c.status !== "error")
        .map((c) => pdfNameForZip(c.zipName)),
    ]);

    const acceptedReady: File[] = [];
    const acceptedZips: File[] = [];
    const rejectedZips: { file: File; conflictName: string }[] = [];

    for (const f of newFiles) {
      const id = identityOf(f);
      const isZip = f.name.toLowerCase().endsWith(".zip");
      if (taken.has(id)) {
        if (isZip) rejectedZips.push({ file: f, conflictName: id });
        // Direct duplicates (PDF/DJVU) are silently dropped, matching the
        // pre-existing UX for re-dropping the same file.
        continue;
      }
      taken.add(id);
      if (isZip) acceptedZips.push(f);
      else acceptedReady.push(f);
    }

    if (acceptedReady.length > 0) {
      setFiles((prev) => [...prev, ...acceptedReady]);
    }
    for (const zip of acceptedZips) {
      startZipConversion(zip);
    }
    for (const { file, conflictName } of rejectedZips) {
      pushZipErrorChip(file, `Файл ${conflictName} вже додано`);
    }
  }

  function pushZipErrorChip(zip: File, message: string) {
    const id = `${zip.name}-${zip.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setZipConversions((prev) => [
      ...prev,
      {
        id,
        zipName: zip.name,
        status: "error",
        currentEntry: 0,
        totalEntries: 0,
        currentName: "",
        errorMessage: message,
      },
    ]);
  }

  function handleRemoveFile(index: number) {
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileStates((prev) => prev.filter((e) => e.file !== fileToRemove));
    const opfsName = opfsNamesRef.current.get(fileToRemove.name);
    if (opfsName) {
      opfsNamesRef.current.delete(fileToRemove.name);
      removeOpfsFile(opfsName);
    }
    setZipPreviews((prev) => {
      const existing = prev.get(fileToRemove.name);
      if (!existing) return prev;
      revokeThumbUrls(existing.thumbs);
      const next = new Map(prev);
      next.delete(fileToRemove.name);
      return next;
    });
  }

  function startZipConversion(zip: File) {
    const id = `${zip.name}-${zip.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const controller = new AbortController();
    zipControllersRef.current.set(id, controller);

    setZipConversions((prev) => [
      ...prev,
      {
        id,
        zipName: zip.name,
        status: "validating",
        currentEntry: 0,
        totalEntries: 0,
        currentName: "",
      },
    ]);

    zipConversionLimit(async () => {
      // If user aborted before this slot opened, surface as AbortError so the
      // error branch below handles cleanup uniformly.
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return convertZipToPdf(
        zip,
        (p) =>
          setZipConversions((prev) =>
            prev.map((c) =>
              c.id === id
                ? {
                    ...c,
                    status: p.phase,
                    currentEntry: p.currentEntry,
                    totalEntries: p.totalEntries,
                    currentName: p.currentName,
                  }
                : c,
            ),
          ),
        controller.signal,
      );
    }).then(
      (result) => {
        zipControllersRef.current.delete(id);
        // convertZipToPdf only checks the abort signal at the start of each
        // image iteration, so a trash click between the last check and this
        // resolver still produces a finished PDF. Honor the cancellation
        // by discarding the artifact instead of resurrecting it in the list.
        if (controller.signal.aborted) {
          removeOpfsFile(result.opfsName);
          revokeThumbUrls(result.previews);
          return;
        }
        opfsNamesRef.current.set(result.file.name, result.opfsName);
        const pdfFile = result.file;
        const loadFull = (i: number) => renderPdfPageBlob(pdfFile, i);
        setZipPreviews((prev) => {
          const next = new Map(prev);
          next.set(result.file.name, {
            thumbs: result.previews,
            totalPages: result.totalPages,
            loadFull,
          });
          return next;
        });
        setZipConversions((prev) => prev.filter((c) => c.id !== id));
        setFiles((prev) => [...prev, result.file]);
      },
      (err) => {
        zipControllersRef.current.delete(id);
        if (err?.name === "AbortError") {
          setZipConversions((prev) => prev.filter((c) => c.id !== id));
          return;
        }
        const message =
          err instanceof ZipValidationError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Не вдалося обробити ZIP";
        setZipConversions((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: "error", errorMessage: message } : c,
          ),
        );
      },
    );
  }

  // Single trash-button handler. Aborting a finished or never-started
  // controller is a no-op, so this works for active and error chips alike.
  // Dropping the chip immediately also unblocks Continue if the chip was
  // stuck queued behind a long-running conversion in pLimit.
  function handleRemoveZipChip(id: string) {
    zipControllersRef.current.get(id)?.abort();
    setZipConversions((prev) => prev.filter((c) => c.id !== id));
  }

  function handleContinue() {
    setFileStates(files.map((f) => fileStates.find((e) => e.file === f) ?? makeEntry(f)));
    setStep(2);
  }

  // Step 2 handlers
  function handleBack() {
    setStep(1);
  }

  async function processEntry(index: number, entry: FileEntry) {
    if (entry.status === "success" || entry.status === "duplicate") return;

    updateEntry(index, { status: "uploading", errorMessage: "", resultUrl: "", duplicateUrl: "" });

    try {
      const result = await uploadFile(
        entry,
        (progress) => updateEntry(index, progress),
        session?.accessToken,
        directUploadEnabled
      );

      if (result.status === "success") {
        updateEntry(index, { status: "success", resultUrl: result.url });
        const opfsName = opfsNamesRef.current.get(entry.file.name);
        if (opfsName) {
          opfsNamesRef.current.delete(entry.file.name);
          removeOpfsFile(opfsName);
        }
        try {
          updateEntry(index, { wikisourceStatus: "pending" });
          const wikisourceResult = await callWikisourcePublish(entry);
          updateEntry(index, { wikisourceStatus: "success", wikisourceResult });
        } catch {
          updateEntry(index, { wikisourceStatus: "error" });
        }
      } else if (result.status === "duplicate") {
        updateEntry(index, { status: "duplicate", duplicateUrl: result.duplicateUrl, wikisourceStatus: "cancelled" });
      } else {
        updateEntry(index, { status: "error", errorMessage: result.errorMessage, wikisourceStatus: "cancelled" });
      }
    } catch (err) {
      updateEntry(index, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Помилка мережі",
        wikisourceStatus: "cancelled",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const current = fileStates;
    setFileStates((prev) => prev.map((entry) => ({ ...entry, submitted: true })));

    const allValid = current.every(isEntryValid);
    if (!allValid) return;

    setStep(3);

    const limit = pLimit(MAX_CONCURRENT_UPLOADS);
    await Promise.all(current.map((entry, index) => limit(() => processEntry(index, entry))));
  }

  const isAnyUploading = fileStates.some((e) => e.status === "uploading" || e.wikisourceStatus === "pending");
  const isAnyConverting = zipConversions.some(
    (c) => c.status === "validating" || c.status === "converting",
  );

  const { setShouldGuard } = useNavigationGuard();

  useEffect(() => {
    const guard =
      (step === 1 && isAnyConverting) || step === 2 || (step === 3 && isAnyUploading);
    setShouldGuard(guard);
    return () => setShouldGuard(false);
  }, [step, isAnyUploading, isAnyConverting, setShouldGuard]);

  return {
    step,
    files,
    fileStates,
    zipConversions,
    isAnyConverting,
    updateEntry,
    handleAdd,
    handleRemoveZipChip,
    handleRemoveFile,
    handleContinue,
    handleBack,
    handleSubmit,
    zipPreviews,
  };
}
