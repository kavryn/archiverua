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
    template: "PD-old-assumed-expired",
    label: `Документ створений до ${THRESHOLD_120} року (автор невідомий або дата смерті невідома)`,
    helpText: `Дата створення твору була понад 120 років тому, і тому є розумним припущення, що термін дії
    авторського права закінчився. Не використовуйте цей шаблон, якщо дата смерті автора відома.`
  },
  {
    value: "{{PD-scan|PD-UA-exempt}}",
    template: "PD-UA-exempt",
    label: "Офіційний документ органів влади або самоврядування",
    helpText: `Ця робота перебуває в суспільному надбанні, оскільки відповідно до статті 8, пункту 3 Закону України
    про авторське право і суміжні права не охороняються авторським правом: акти органів державної влади, органів місцевого самоврядування, офіційні документи політичного, законодавчого, адміністративного і судового характеру (закони, укази, постанови, рішення, державні стандарти тощо), також їх проекти та офіційні переклади;`
  },
  {
    value: "{{PD-scan|PD-RusEmpire}}",
    template: "PD-RusEmpire",
    label: "Робота опублікована в Російській імперії до 7 листопада 1917 року",
    helpText: "Ця робота перебуває в суспільному надбанні в Росії відповідно до статті 1256 Цивільного Кодексу Російської Федерації."
  },
  {
    value: "{{PD-scan|PD-Ukraine}}",
    template: "PD-Ukraine",
    label: `Робота опублікована в Україні чи УРСР до ${THRESHOLD_70} року (автор невідомий або помер до цієї дати)`,
    helpText: `Цей файл є твором, створеним в Україні чи Українській РСР, і перебуває в суспільному надбанні в
    Україні, оскільки він був опублікований до 1 січня ${THRESHOLD_70} року і його творець (якщо відомий) помер до цієї дати.`
  },
  {
    value: "{{PD-scan|PD-anon-70-EU}}",
    template: "PD-anon-70-EU",
    label: `Анонімна робота, опублікована у ЄС до ${THRESHOLD_70} року`,
    helpText: `This image (or other media file) is in the public domain because its copyright has expired and its
    author is anonymous. This applies to the European Union and those countries with a copyright term of 70 years after the work was made available to the public and the author never disclosed their identity.`
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
    if (opt.value === "{{PD-scan|PD-anon-70-EU}}") return endYear < THRESHOLD_70 && anonymousAuthor;
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
