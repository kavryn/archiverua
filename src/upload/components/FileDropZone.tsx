"use client";

import { useRef, useState } from "react";
import { TrashIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import ZipPreviewStrip from "./ZipPreviewStrip";
import ZipPreviewLightbox from "./ZipPreviewLightbox";
import type { ZipPreview } from "../hooks/useUploadWizard";

interface Props {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  previews?: Map<string, ZipPreview>;
  pendingPreviews?: Set<string>;
  zipSourced?: Set<string>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function filterAcceptedFiles(fileList: FileList | File[]): File[] {
  return Array.from(fileList).filter((f) => {
    const name = f.name.toLowerCase();
    return name.endsWith(".pdf") || name.endsWith(".djvu") || name.endsWith(".zip");
  });
}

export default function FileDropZone({ files, onAdd, onRemove, previews, pendingPreviews, zipSourced }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState<{ fileName: string; index: number } | null>(null);
  const activePreview = lightbox ? previews?.get(lightbox.fileName) : undefined;

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      onAdd(filterAcceptedFiles(e.target.files));
      e.target.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    onAdd(filterAcceptedFiles(Array.from(e.dataTransfer.files)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-blue-400 hover:border-blue-600 hover:bg-blue-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.djvu,.zip"
          multiple
          onChange={handleChange}
          className="hidden"
        />
        <ArrowUpTrayIcon className="size-8 text-blue-500" />
        <p className="font-medium text-zinc-700">
          Перетягніть PDF, DJVU чи ZIP із зображеннями
        </p>
        <p className="font-medium text-zinc-700">
          або <span className="text-blue-600 underline">натисніть для вибору</span>
        </p>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file, index) => {
            const preview = previews?.get(file.name);
            const isPreviewPending = pendingPreviews?.has(file.name) ?? false;
            const isZipSourced = zipSourced?.has(file.name) ?? false;
            return (
              <li
                key={index}
                className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="mr-4 flex min-w-0 items-center gap-2 text-base text-zinc-700">
                    <span className="truncate font-bold">{file.name}</span>
                    {isZipSourced && (
                      <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                        ZIP → PDF
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm text-zinc-500">
                      {formatSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="text-zinc-400 transition-colors hover:text-red-500"
                      aria-label={`Видалити ${file.name}`}
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                </div>
                {preview && (
                  <ZipPreviewStrip
                    thumbs={preview.thumbs}
                    totalPages={preview.totalPages}
                    onOpen={(i) => setLightbox({ fileName: file.name, index: i })}
                  />
                )}
                {!preview && isPreviewPending && (
                  <p className="text-sm text-zinc-500">Генерація прев&apos;ю…</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {lightbox && activePreview && (
        <ZipPreviewLightbox
          thumbs={activePreview.thumbs}
          totalPages={activePreview.totalPages}
          startIndex={lightbox.index}
          loadFull={activePreview.loadFull}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
