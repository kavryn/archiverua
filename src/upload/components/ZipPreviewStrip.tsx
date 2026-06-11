"use client";

import type { PdfThumb } from "../pdfPreview";

interface Props {
  thumbs: PdfThumb[];
  totalPages: number;
  onOpen: (index: number) => void;
}

export default function ZipPreviewStrip({ thumbs, totalPages, onOpen }: Props) {
  if (thumbs.length === 0) return null;
  const truncated = totalPages > thumbs.length;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-zinc-500">
        {truncated
          ? `${totalPages} сторінок · перші ${thumbs.length} у попередньому перегляді`
          : `${totalPages} ${pluralPages(totalPages)}`}
      </p>
      <ul className="flex flex-wrap gap-2">
        {thumbs.map((thumb, i) => (
          <li key={thumb.url}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              className="group flex flex-col items-center gap-0.5 rounded border border-zinc-200 bg-white p-1 transition-colors hover:border-blue-400"
              aria-label={`Сторінка ${i + 1}: ${thumb.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb.url}
                alt=""
                className="h-20 w-auto max-w-[80px] object-contain"
              />
              <span className="text-[10px] text-zinc-500 group-hover:text-blue-600">
                {i + 1}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function pluralPages(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "сторінка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сторінки";
  return "сторінок";
}
