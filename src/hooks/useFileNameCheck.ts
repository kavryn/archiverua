import { useEffect, useRef } from "react";
import { type FileEntry, isFileNameEnabled, getEffectiveFileName, hasInvalidFileNameChars } from "@/types/upload-form";

export function useFileNameCheck(
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

    if (!fileNameEnabled || !effectiveFileName.trim() || hasInvalidFileNameChars(entry)) {
      onUpdateRef.current({ fileNameCheck: { loading: false, exists: null, lastCheckedName: "" } });
      return;
    }

    const name = effectiveFileName;
    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current;
      onUpdateRef.current({ fileNameCheck: { loading: true, exists: null, lastCheckedName: name } });
      try {
        const res = await fetch(`/api/commons-file-exists?filename=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (requestIdRef.current !== reqId) return;
        onUpdateRef.current({ fileNameCheck: { loading: false, exists: data.exists, lastCheckedName: name } });
      } catch {
        if (requestIdRef.current !== reqId) return;
        onUpdateRef.current({ fileNameCheck: { loading: false, exists: null, lastCheckedName: name } });
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
