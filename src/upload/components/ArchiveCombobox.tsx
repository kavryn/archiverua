"use client";

import { useState } from "react";
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
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
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </Combobox.Button>
      </div>

      <ComboboxOptions
        anchor="bottom"
        className="dropdown w-[var(--input-width)] !max-h-64 overflow-auto py-1"
      >
        {results.length === 0 ? (
          <div className="px-3 py-2 text-base text-zinc-500">Нічого не знайдено</div>
        ) : (
          results.map((archive) => (
            <ComboboxOption
              key={archive.abbr}
              value={archive}
              className="cursor-pointer px-3 py-2 text-base data-[focus]:bg-blue-50">
              <span className="text-zinc-900">{archive.name}</span>
              <span className="ml-2 text-sm text-zinc-400">{archive.abbr}</span>
            </ComboboxOption>
          ))
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
