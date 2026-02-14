"use client";

import { useState } from "react";
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from "@headlessui/react";
import { filterArchives, type Archive } from "@/lib/archives";

interface Props {
  value: Archive | null;
  onChange: (archive: Archive | null) => void;
  disabled?: boolean;
}

export default function ArchiveCombobox({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");

  const results = filterArchives(query);

  return (
    <Combobox value={value} onChange={onChange} disabled={disabled} immediate onClose={() => setQuery("")}>
      <div className="relative">
        <ComboboxInput
          displayValue={(archive: Archive | null) => archive?.name ?? ""}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Оберіть архів..."
          className="input pr-8"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className="h-4 w-4 shrink-0 text-zinc-400 transition-transform ui-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </ComboboxButton>
      </div>

      <ComboboxOptions
        anchor="bottom"
        className="z-10 w-[var(--input-width)] !max-h-64 overflow-auto rounded-md border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-800 focus:outline-none"
      >
        {results.length === 0 ? (
          <div className="px-3 py-2 text-base text-zinc-500">Нічого не знайдено</div>
        ) : (
          results.map((archive) => (
            <ComboboxOption
              key={archive.abbr}
              value={archive}
              className="cursor-pointer px-3 py-2 text-base data-[focus]:bg-zinc-50 dark:data-[focus]:bg-zinc-700"
            >
              <span className="text-zinc-900 dark:text-zinc-100">{archive.name}</span>
              <span className="ml-2 text-sm text-zinc-400">{archive.abbr}</span>
            </ComboboxOption>
          ))
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
