import type { FileEntry } from "./types";
import { isFondNameEnabled } from "./types";
import { isFileNameEnabled, getEffectiveFileName } from "./hooks/usePublicFileName";

const INTEGER_RE = /^\d+$/;

function getDateError(
  entry: Pick<FileEntry, "dateMode" | "dateFrom" | "dateTo">
): string | null {
  const currentYear = new Date().getFullYear();
  const from = entry.dateFrom.trim();
  const to = entry.dateTo.trim();

  if (entry.dateMode === "other") {
    return from !== "" ? null : "Поле обов'язкове";
  }

  if (entry.dateMode === "single") {
    if (from === "") return "Поле обов'язкове";
    if (!INTEGER_RE.test(from)) return "Дата має бути числом";
    if (parseInt(from, 10) > currentYear)
      return `Дата не може перевищувати ${currentYear}`;
    return null;
  }

  // range
  const fromEmpty = from === "";
  const toEmpty = to === "";
  if (fromEmpty && toEmpty) return "Поля обов'язкові";
  if (fromEmpty) return "Поле 'Початкова' обов'язкове";
  if (toEmpty) return "Поле 'Кінцева' обов'язкове";
  if (!INTEGER_RE.test(from) || !INTEGER_RE.test(to))
    return "Дати мають бути числами";
  const fromYear = parseInt(from, 10);
  const toYear = parseInt(to, 10);
  if (toYear > currentYear)
    return `Кінцева дата не може перевищувати ${currentYear}`;
  if (toYear < fromYear)
    return "Кінцева дата має бути не меншою за початкову";
  return null;
}

function getFileNameError(entry: FileEntry): string | null {
  if (!isFileNameEnabled(entry)) return null;
  if (entry.submitted && getEffectiveFileName(entry).trim() === "")
    return "Поле обов'язкове";
  if (entry.fileNameCheck.status === 'invalid_chars')
    return 'Назва файлу не може містити символи: ":", "/" або "\\"';
  if (entry.fileNameCheck.status === 'too_short')
    return "Назва файлу надто коротка (мінімум 5 символів)";
  if (entry.fileNameCheck.status === 'too_long')
    return "Назва файлу надто довга. Розмір не повинен перевищувати 235 байтів";
  if (entry.fileNameCheck.status === 'done' && entry.fileNameCheck.blacklisted)
    return "Назва файлу не дозволена на Вікісховищі";
  if (entry.fileNameCheck.status === 'done' && entry.fileNameCheck.exists)
    return "Файл з такою назвою вже існує на Вікісховищі";
  return null;
}

export interface EntryErrors {
  archive: string | null;
  fond: string | null;
  opys: string | null;
  sprava: string | null;
  fondName: string | null;
  spravaName: string | null;
  dates: string | null;
  license: string | null;
  fileName: string | null;
}

export function getEntryErrors(entry: FileEntry): EntryErrors {
  const req = (condition: boolean) => (condition ? "Поле обов'язкове" : null);

  const datesHaveValue =
    entry.dateFrom.trim() !== "" || entry.dateTo.trim() !== "";

  return {
    archive:    req(entry.submitted && entry.archive === null),
    fond:       req(entry.submitted && entry.fond.trim() === ""),
    opys:       req(entry.submitted && entry.opys.trim() === ""),
    sprava:     req(entry.submitted && entry.sprava.trim() === ""),
    fondName:   req(entry.submitted && isFondNameEnabled(entry) && entry.fondName.value.trim() === ""),
    spravaName: req(entry.submitted && entry.spravaName.trim() === ""),
    dates:      entry.submitted ? getDateError(entry) : null,
    license:    req(entry.submitted && datesHaveValue && entry.license.length === 0),
    fileName:   getFileNameError(entry),
  };
}

export function isEntryValid(entry: FileEntry): boolean {
  const errors = getEntryErrors({ ...entry, submitted: true });
  return Object.values(errors).every((e) => e === null);
}
