"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { PdfThumb } from "../pdfPreview";

interface Props {
  thumbs: PdfThumb[];
  totalPages: number;
  startIndex: number;
  loadFull: (index: number) => Promise<Blob>;
  onClose: () => void;
}

export default function ZipPreviewLightbox({
  thumbs,
  totalPages,
  startIndex,
  loadFull,
  onClose,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  // Cache of resolved full-resolution blob URLs by thumb index, plus
  // in-flight promises so concurrent ensureFull calls coalesce.
  const fullUrlsRef = useRef<Map<number, string>>(new Map());
  const inFlightRef = useRef<Map<number, Promise<string | null>>>(new Map());
  // Set on unmount. Once true, any newly-resolved blob must be revoked
  // immediately because nothing will ever read it.
  const unmountedRef = useRef(false);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [fullLoaded, setFullLoaded] = useState(false);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, thumbs.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [thumbs.length, onClose]);

  // Revoke all cached full-res URLs on unmount. In-flight promises that
  // resolve after unmount get their URLs revoked inline by ensureFull via
  // the unmountedRef check. Reset the flag on every (re)mount so React's
  // StrictMode dev unmount/remount cycle doesn't leave the second mount
  // permanently believing it's unmounted.
  useEffect(() => {
    unmountedRef.current = false;
    const cache = fullUrlsRef.current;
    const inFlight = inFlightRef.current;
    return () => {
      unmountedRef.current = true;
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
      inFlight.clear();
    };
  }, []);

  // Shared, cache-and-coalesce loader. Used both for the current page and
  // for neighbor prefetch — both feed the same cache.
  const ensureFull = useCallback(
    (i: number): Promise<string | null> => {
      const cached = fullUrlsRef.current.get(i);
      if (cached) return Promise.resolve(cached);
      const inFlight = inFlightRef.current.get(i);
      if (inFlight) return inFlight;
      const p = loadFull(i)
        .then((blob) => {
          // Component unmounted while we were decoding — nothing will ever
          // revoke a URL we put in the cache now, so just drop the blob.
          if (unmountedRef.current) return null;
          const existing = fullUrlsRef.current.get(i);
          if (existing) return existing;
          const url = URL.createObjectURL(blob);
          fullUrlsRef.current.set(i, url);
          return url;
        })
        .finally(() => {
          inFlightRef.current.delete(i);
        });
      inFlightRef.current.set(i, p);
      return p;
    },
    [loadFull],
  );

  // Resolve the full-res URL for the current index. Reset loaded flag so
  // the fade-in transition replays on every navigation.
  useEffect(() => {
    let cancelled = false;
    setFullLoaded(false);
    const cached = fullUrlsRef.current.get(index);
    setFullUrl(cached ?? null);
    if (!cached) {
      ensureFull(index).then(
        (url) => {
          if (cancelled || !url) return;
          setFullUrl(url);
        },
        () => {
          // Swallow; the blurred thumb stays as fallback.
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [index, ensureFull]);

  // Preload neighbors into the same cache so left/right navigation is
  // instant. Fire-and-forget; errors are ignored.
  useEffect(() => {
    if (index + 1 < thumbs.length) ensureFull(index + 1).catch(() => undefined);
    if (index - 1 >= 0) ensureFull(index - 1).catch(() => undefined);
  }, [index, thumbs.length, ensureFull]);

  if (thumbs.length === 0) return null;
  const current = thumbs[index];
  const hasPrev = index > 0;
  const hasNext = index < thumbs.length - 1;
  const truncated = totalPages > thumbs.length;

  // Reserve the display box at the page's exact aspect ratio so the blurred
  // thumb and the full image occupy identical pixels — eliminating the size
  // jump and letting the full fade in cleanly over the placeholder.
  const containerStyle: React.CSSProperties = {
    aspectRatio: `${current.width} / ${current.height}`,
    height: `min(80vh, calc(80vw * ${current.height} / ${current.width}))`,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Закрити"
      >
        <XMarkIcon className="size-6" />
      </button>

      <div
        className="flex max-h-full max-w-full items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => hasPrev && setIndex(index - 1)}
          disabled={!hasPrev}
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Попередня"
        >
          <ChevronLeftIcon className="size-6" />
        </button>

        <div className="flex flex-col items-center gap-2">
          <div className="relative overflow-hidden" style={containerStyle}>
            {/* Blurred LQIP — always rendered, sits behind the full image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-contain blur-lg"
            />
            {fullUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={fullUrl}
                alt={current.name}
                onLoad={() => setFullLoaded(true)}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
                  fullLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            )}
          </div>
          <div className="flex flex-col items-center text-sm text-white">
            <span className="font-mono">{current.name}</span>
            <span className="text-white/70">
              {index + 1} / {thumbs.length}
              {truncated && ` · всього сторінок: ${totalPages}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => hasNext && setIndex(index + 1)}
          disabled={!hasNext}
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Наступна"
        >
          <ChevronRightIcon className="size-6" />
        </button>
      </div>
    </div>
  );
}
