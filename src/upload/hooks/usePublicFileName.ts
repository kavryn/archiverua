import { useEffect, useRef } from "react";
import { type FileEntry, type FileNameCheckState } from "../types";
import { apiFetch } from "@/lib/api-fetch";

export const FILE_NAME_MIN_CHARS = 5;
export const FILE_NAME_MAX_BYTES = 235;

export function getFileNameByteLength(name: string): number {
  return new TextEncoder().encode(name).length;
}

export function getFileNameStem(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function buildAutoFileName(entry: FileEntry): string {
  if (!entry.archive || !entry.fond || !entry.opys || !entry.sprava) return "";
  const ext = entry.file.name.split(".").pop() ?? "pdf";
  const spravaName = entry.spravaName.trim();
  const fondNoHyphen = entry.fond.replace(/-/g, "");
  const prefix = `${entry.archive.abbr} ${fondNoHyphen}-${entry.opys}-${entry.sprava}. `;
  const suffix = `.${ext}`;
  const maxNameLen = 75 - prefix.length - suffix.length;
  const truncated = spravaName.slice(0, Math.max(0, maxNameLen));
  const raw = `${prefix}${truncated}${suffix}`;
  return raw.replace(/[:/\\]/g, "");
}

export function getEffectiveFileName(entry: FileEntry): string {
  if (entry.fileNameEdited && entry.fileName.trim() !== "") {
    const name = entry.fileName.trim();
    const ext = entry.file.name.split(".").pop() ?? "";
    if (ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
      return `${name}.${ext}`;
    }
    return name;
  }
  return buildAutoFileName(entry);
}

export function isFileNameEnabled(entry: FileEntry): boolean {
  return (
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opys.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    entry.spravaName.trim() !== ""
  );
}

export function hasInvalidFileNameChars(entry: FileEntry): boolean {
  return isFileNameEnabled(entry) && /[:/\\]/.test(getEffectiveFileName(entry));
}

export function usePublicFileName(
  entry: FileEntry,
  onUpdate: (patch: Partial<FileEntry>) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const fileNameEnabled = isFileNameEnabled(entry);
  const effectiveFileName = fileNameEnabled ? getEffectiveFileName(entry) : "";

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!fileNameEnabled || !effectiveFileName.trim()) {
      onUpdateRef.current({ fileNameCheck: { status: 'idle' } });
      return;
    }

    if (hasInvalidFileNameChars(entry)) {
      onUpdateRef.current({ fileNameCheck: { status: 'invalid_chars' } });
      return;
    }

    const stem = getFileNameStem(effectiveFileName);
    if (stem.length < FILE_NAME_MIN_CHARS) {
      onUpdateRef.current({ fileNameCheck: { status: 'too_short' } });
      return;
    }

    const byteLen = getFileNameByteLength(effectiveFileName);
    if (byteLen > FILE_NAME_MAX_BYTES) {
      onUpdateRef.current({ fileNameCheck: { status: 'too_long' } });
      return;
    }

    const name = effectiveFileName;
    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current;
      onUpdateRef.current({ fileNameCheck: { status: 'loading' } });
      try {
        const res = await apiFetch(`/api/wikicommons/verify-file-name?filename=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (requestIdRef.current !== reqId) return;
        onUpdateRef.current({ fileNameCheck: { status: 'done', exists: data.exists, blacklisted: data.blacklisted } });
      } catch {
        if (requestIdRef.current !== reqId) return;
        onUpdateRef.current({ fileNameCheck: { status: 'done', exists: null, blacklisted: null } });
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [effectiveFileName, fileNameEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
