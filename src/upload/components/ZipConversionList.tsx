"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import type { ZipConversionState } from "../hooks/useUploadWizard";

interface Props {
  conversions: ZipConversionState[];
  onRemove: (id: string) => void;
}

export default function ZipConversionList({ conversions, onRemove }: Props) {
  if (conversions.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {conversions.map((c) => {
        const percent =
          c.totalEntries > 0 ? Math.round((c.currentEntry / c.totalEntries) * 100) : 0;
        const isActive = c.status === "validating" || c.status === "converting";
        const isError = c.status === "error";

        return (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="mr-2 truncate text-base text-zinc-700">{c.zipName}</span>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="shrink-0 text-zinc-400 transition-colors hover:text-red-500"
                aria-label={`Видалити ${c.zipName}`}
              >
                <TrashIcon className="size-4" />
              </button>
            </div>

            {isActive && (
              <>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-500">
                  {c.status === "validating"
                    ? "Перевірка архіву…"
                    : `Конвертація ${c.currentEntry} / ${c.totalEntries}: ${c.currentName}`}
                </p>
              </>
            )}

            {isError && (
              <p className="text-sm text-red-600">{c.errorMessage}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
