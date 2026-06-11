"use client";

import { useRef, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import ZipPreviewStrip from "./ZipPreviewStrip";
import ZipPreviewLightbox from "./ZipPreviewLightbox";
import type { ZipPreview } from "../hooks/useUploadWizard";

interface Props {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  previews?: Map<string, ZipPreview>;
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

export default function FileDropZone({ files, onAdd, onRemove, previews }: Props) {
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
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-zinc-300 hover:border-zinc-800"
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
        <p className="font-medium text-zinc-700">
          Перетягніть PDF / DJVU / ZIP файли сюди
        </p>
        <p className="font-medium text-zinc-700">
          або натисніть для вибору
        </p>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file, index) => {
            const preview = previews?.get(file.name);
            return (
              <li
                key={index}
                className="flex flex-col gap-2 rounded-md bg-zinc-50 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="mr-4 truncate text-base text-zinc-700">
                    {file.name}
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
