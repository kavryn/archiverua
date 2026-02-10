"use client";

import { useState, useRef } from "react";
import { filterArchives, type Archive } from "@/lib/archives";

interface Props {
  value: Archive | null;
  onChange: (archive: Archive | null) => void;
  disabled?: boolean;
}

export default function ArchiveCombobox({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = filterArchives(query);

  function handleFocus() {
    setQuery("");
    setOpen(true);
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false);
      setQuery("");
    }, 150);
  }

  function handleSelect(archive: Archive) {
    onChange(archive);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (!open) setOpen(true);
    if (value) onChange(null);
  }

  const displayValue = open ? query : (value?.name ?? "");

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="Оберіть архів..."
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">Нічого не знайдено</li>
          ) : (
            results.map((archive) => (
              <li
                key={archive.abbr}
                onMouseDown={() => handleSelect(archive)}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="text-zinc-900 dark:text-zinc-100">{archive.name}</span>
                <span className="ml-2 text-xs text-zinc-400">{archive.abbr}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
