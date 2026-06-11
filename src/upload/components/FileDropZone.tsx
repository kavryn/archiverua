"use client";

import { useRef, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";

interface Props {
  files: File[];
  onAdd: (files: File[]) => void;
  onAddZips: (files: File[]) => void;
  onRemove: (index: number) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function partitionFiles(fileList: FileList | File[]): { ready: File[]; zips: File[] } {
  const ready: File[] = [];
  const zips: File[] = [];
  for (const f of Array.from(fileList)) {
    const name = f.name.toLowerCase();
    if (name.endsWith(".pdf") || name.endsWith(".djvu")) ready.push(f);
    else if (name.endsWith(".zip")) zips.push(f);
  }
  return { ready, zips };
}

export default function FileDropZone({ files, onAdd, onAddZips, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleClick() {
    inputRef.current?.click();
  }

  function dispatch(list: FileList | File[]) {
    const { ready, zips } = partitionFiles(list);
    if (ready.length > 0) onAdd(ready);
    if (zips.length > 0) onAddZips(zips);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      dispatch(e.target.files);
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
    dispatch(Array.from(e.dataTransfer.files));
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
          {files.map((file, index) => (
            <li
              key={index}
              className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
