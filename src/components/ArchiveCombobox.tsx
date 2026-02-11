"use client";

import { useState, useRef, useEffect } from "react";
import { filterArchives, type Archive } from "@/lib/archives";

interface Props {
  value: Archive | null;
  onChange: (archive: Archive | null) => void;
  disabled?: boolean;
}

export default function ArchiveCombobox({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = filterArchives(query);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open && listRef.current) {
      const activeItem = listRef.current.children[activeIndex] as HTMLElement;
      activeItem?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) handleSelect(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
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
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Оберіть архів..."
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900"
      />
      {open && (
        <ul ref={listRef} className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">Нічого не знайдено</li>
          ) : (
            results.map((archive, index) => (
              <li
                key={archive.abbr}
                onMouseDown={() => handleSelect(archive)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2 text-sm ${index === activeIndex ? "bg-zinc-100 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
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
