"use client";

import { useEffect } from "react";
import { getEndYear, type DateState } from "./DateFields";

const CURRENT_YEAR = new Date().getFullYear();
const THRESHOLD_120 = CURRENT_YEAR - 120;
const THRESHOLD_70 = CURRENT_YEAR - 70;

const baseInputClass =
  "w-full rounded-md border px-3 py-2 text-base placeholder-zinc-400 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900";
const normalInputClass = `${baseInputClass} border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100`;

interface Option {
  value: string;
  label: string;
}

const ALL_OPTIONS: Option[] = [
  {
    value: "{{PD-scan|PD-old-assumed-expired}}",
    label: `Документ створений до ${THRESHOLD_120} року (автор невідомий або дата смерті невідома)`,
  },
  {
    value: "{{PD-scan|PD-UA-exempt}}",
    label: "Офіційний документ органів влади або самоврядування",
  },
  {
    value: "{{PD-scan|PD-RusEmpire}}",
    label: "Робота опублікована в Російській імперії до 7 листопада 1917 року",
  },
  {
    value: "{{PD-scan|PD-Ukraine}}",
    label: `Робота опублікована до ${THRESHOLD_70} року (автор невідомий або помер до цієї дати)`,
  },
  {
    value: "{{PD-scan|PD-anon-70-EU}}",
    label: `Анонімна робота, опублікована у Західній Україні чи Буковині до 1939 року`,
  }
];

function getAvailableOptions(endYear: number | null, mode: string, author: string): Option[] {
  const anonymousAuthor = author.trim() === "";
  if (mode === "other") return ALL_OPTIONS.filter((opt) => opt.value !== "{{PD-scan|PD-anon-70-EU}}" || anonymousAuthor);
  if (endYear === null) return [];
  return ALL_OPTIONS.filter((opt) => {
    if (opt.value === "{{PD-scan|PD-old-assumed-expired}}") return endYear < THRESHOLD_120;
    if (opt.value === "{{PD-scan|PD-RusEmpire}}") return endYear <= 1917;
    if (opt.value === "{{PD-scan|PD-Ukraine}}") return endYear < THRESHOLD_70;
    if (opt.value === "{{PD-scan|PD-anon-70-EU}}") return endYear <= 1939 && anonymousAuthor;
    return true;
  });
}

interface Props {
  dateState: DateState;
  author: string;
  value: string;
  onChange: (license: string) => void;
  disabled?: boolean;
}

export default function LicenseField({ dateState, author, value, onChange, disabled }: Props) {
  const endYear = getEndYear(dateState);

  useEffect(() => {
    if (endYear !== null && endYear < THRESHOLD_120) {
      onChange("{{PD-scan|PD-old-assumed-expired}}");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endYear]);

  const hasDate =
    dateState.dateMode === "other"
      ? dateState.dateFrom.trim() !== ""
      : endYear !== null;

  if (!hasDate) {
    return (
      <input
        type="text"
        disabled
        value=""
        placeholder="Спершу введіть дати"
        className={normalInputClass}
      />
    );
  }

  const options = getAvailableOptions(endYear, dateState.dateMode, author);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={normalInputClass}
    >
      <option value="">— Оберіть ліцензію —</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
