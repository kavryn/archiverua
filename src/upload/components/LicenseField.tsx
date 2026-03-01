"use client";

import { useRef, useEffect } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { getEndYear, type DateState } from "./DateFields";

const CURRENT_YEAR = new Date().getFullYear();
const THRESHOLD_120 = CURRENT_YEAR - 120;
const THRESHOLD_70 = CURRENT_YEAR - 70;

export interface Option {
  value: string;
  label: string;
  template: string;
  helpText: string;
  note?: string;
  sort: number;
}

export const ALL_OPTIONS: Option[] = [
  {
    value: "{{PD-scan|PD-old-assumed-expired}}",
    template: "PD-old-assumed-expired",
    label: `Документ створений до 1 січня ${THRESHOLD_120} року (автор невідомий або дата смерті невідома)`,
    helpText: `Ситуація з авторським правом на цей твір теоретично невизначена, оскільки в країні походження
    авторське право триває 70 років після смерті автора, а дата смерті автора невідома. Однак дата створення твору була понад 120 років тому, і тому є розумним припущення, що термін дії авторського права закінчився. Не використовуйте цей шаблон, якщо дата смерті автора відома.`,
    sort: 1
  },
  {
    value: "{{PD-scan|PD-UA-exempt}}",
    template: "PD-UA-exempt",
    label: "Офіційний документ державних органів",
    helpText: `Ця робота перебуває в суспільному надбанні, оскільки відповідно до статті 8, пункту 3 Закону України
    про авторське право і суміжні права не охороняються авторським правом: акти органів державної влади, органів
    місцевого самоврядування, офіційні документи політичного, законодавчого, адміністративного і судового характеру (закони, укази, постанови, рішення, державні стандарти тощо), також їх проекти та офіційні переклади;`,
    sort: 2
  },
  {
    value: "{{PD-scan|PD-RusEmpire}}",
    template: "PD-RusEmpire",
    label: "Робота опублікована в Російській імперії до 7 листопада 1917 року",
    helpText: `Ця робота перебуває в суспільному надбанні в Росії відповідно до статті 1256 Цивільного Кодексу
    Російської Федерації. Ця робота була опублікована на території Російської імперії (Російської республіки), за
    винятком територій Великого князівства Фінляндського (Великое княжество Финляндское) та Царства Польського
    (Царство Польское) до 7 листопада 1917 і не була опублікована на території Радянської Росії чи інших держав протягом 30 днів після першої публікації.`,
    sort: 5
  },
  {
    value: "{{PD-scan|PD-Ukraine}}",
    template: "PD-Ukraine",
    label: `Робота опублікована в Україні чи УРСР до 1 січня ${THRESHOLD_70} року (автор невідомий або помер до цієї дати)`,
    helpText: `Цей файл є твором, створеним в Україні чи Українській РСР, і перебуває в суспільному надбанні в
    Україні, оскільки він був опублікований до 1 січня ${THRESHOLD_70} року і його творець (якщо відомий) помер до
    цієї дати.`,
    sort: 3
  },
  {
    value: "{{PD-scan|PD-anon-70-EU}}",
    template: "PD-anon-70-EU",
    label: `Анонімна робота, опублікована у країні ЄС до 1 січня ${THRESHOLD_70} року`,
    helpText: `This image (or other media file) is in the public domain because its copyright has expired and its
    author is anonymous. This applies to the European Union and those countries with a copyright term of 70 years
    after the work was made available to the public and the author never disclosed their identity.`,
    note: "Може використовуватись також для Західної України до 1939 року",
    sort: 4
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

function licenseCountLabel(count: number): string {
  if (count === 1) return "ліцензію";
  if (count >= 2 && count <= 4) return "ліцензії";
  return "ліцензій";
}

interface Props {
  dateState: DateState;
  author: string;
  value: string[];
  onChange: (license: string[]) => void;
  disabled?: boolean;
}

export default function LicenseField({ dateState, author, value: rawValue, onChange, disabled }: Props) {
  const value = Array.isArray(rawValue) ? rawValue : [];
  const endYear = getEndYear(dateState);
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (endYear !== null && endYear < THRESHOLD_120) {
      onChange(["{{PD-scan|PD-old-assumed-expired}}"]);
    } else {
      onChange([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateState.dateFrom, dateState.dateTo, dateState.dateMode]);

  useEffect(() => {
    if (!isMounted.current) return;
    const available = new Set(getAvailableOptions(endYear, dateState.dateMode, author).map((o) => o.value));
    const filtered = value.filter((v) => available.has(v));
    if (filtered.length !== value.length) {
      onChange(filtered);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

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
        className="input"
      />
    );
  }

  const options = getAvailableOptions(endYear, dateState.dateMode, author);

  const sortByOptionOrder = (vals: string[]) => {
    const sortMap = new Map(ALL_OPTIONS.map((o) => [o.value, o.sort]));
    return [...vals].sort((a, b) => (sortMap.get(a) ?? 0) - (sortMap.get(b) ?? 0));
  };

  function getTriggerLabel(): string {
    if (value.length === 0) return "— Оберіть ліцензію —";
    if (value.length === 1) {
      const opt = options.find((o) => o.value === value[0]);
      return opt ? opt.label : value[0];
    }
    return `Обрано ${value.length} ${licenseCountLabel(value.length)}`;
  }

  return (
    <Listbox value={value} onChange={(v: string[]) => onChange(sortByOptionOrder(v))} multiple disabled={disabled}>
      <Listbox.Button
        className={`input flex items-center justify-between text-left ${
          value.length === 0 ? "text-zinc-400" : ""
        }`}
      >
        <span className="truncate">{getTriggerLabel()}</span>
        <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 transition-transform ui-open:rotate-180" />
      </Listbox.Button>

      <Listbox.Options
        anchor="bottom"
        className="dropdown w-[var(--button-width)]"
      >
        {options.map((opt) => (
          <Listbox.Option
            key={opt.value}
            value={opt.value}
            as="div"
            className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-blue-50">
            {({ selected }) => (
              <>
                <input
                  type="checkbox"
                  readOnly
                  checked={selected}
                  className="mt-0.5 shrink-0 accent-blue-600"
                />
                <span className="text-base text-zinc-900">{opt.label}</span>
              </>
            )}
          </Listbox.Option>
        ))}
      </Listbox.Options>
    </Listbox>
  );
}
