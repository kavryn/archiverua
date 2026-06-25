import ArchiveCombobox from "./ArchiveCombobox";
import AutoGrowTextarea from "./AutoGrowTextarea";
import DateFields, { type DateState } from "./DateFields";
import FieldError from "./FieldError";
import LicenseField from "./LicenseField";
import LicenseHelpPopup from "./LicenseHelpPopup";
import WikisourceNameField from "./WikisourceNameField";
import { type FileEntry } from "../types";
import { buildAutoFileName, isFileNameEnabled, usePublicFileName } from "../hooks/usePublicFileName";
import { getEntryErrors } from "../validation";
import { useArchivalReferenceCode } from "../hooks/useArchivalReferenceCode";
import { wikisource } from "@/lib/wikimedia";

interface EntryCardProps {
  entry: FileEntry;
  onUpdate: (patch: Partial<FileEntry> | ((e: FileEntry) => Partial<FileEntry>)) => void;
}

export default function EntryCard({ entry, onUpdate }: EntryCardProps) {
  const { handleFondBlur, handleOpysBlur, handleSpravaBlur, handleArchiveChange } = useArchivalReferenceCode(entry, onUpdate);

  const dateState: DateState = {
    dateMode: entry.dateMode,
    dateFrom: entry.dateFrom,
    dateTo: entry.dateTo,
  };

  const spravaWikisourceUrl = entry.spravaWikisource.lastFetchedTitle
    ? wikisource.pageUrl(entry.spravaWikisource.lastFetchedTitle)
    : "";

  const fileNameEnabled = isFileNameEnabled(entry);
  const autoFileName = buildAutoFileName(entry);

  usePublicFileName(entry, onUpdate);

  const errors = getEntryErrors(entry);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4">
      <div className="-mx-4 -mt-4 rounded-t-lg bg-zinc-600 px-4 py-3">
         <div className="truncate font-mono text-base font-semibold text-white">
           {entry.file.name}
         </div>
       </div>

      {/* Archive / Fond / Opys / Sprava + name fields */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          {/* Archive */}
          <div className="lg:flex-[5]">
            <label className="label">Архів</label>
            <ArchiveCombobox
              value={entry.archive}
              onChange={(a) => handleArchiveChange(a)}
              disabled={false}
            />
            <FieldError error={errors.archive} />
          </div>

          {/* Fond / Opys / Sprava */}
          <div className="flex gap-3 lg:flex-[4]">
            <div className="flex-1">
              <label className="label">Фонд</label>
              <input
                type="text"
                value={entry.fond}
                onChange={(e) => onUpdate({ fond: e.target.value })}
                onBlur={(e) => handleFondBlur(e.target.value)}
                disabled={false}
                placeholder="Фонд"
                className="input"
              />
              <FieldError error={errors.fond} />
            </div>

            <div className="flex-1">
              <label className="label">Опис</label>
              <input
                type="text"
                value={entry.opys}
                onChange={(e) => onUpdate({opys: e.target.value})}
                onBlur={(e) => handleOpysBlur(e.target.value)}
                disabled={false}
                placeholder="Опис"
                className="input"
              />
              <FieldError error={errors.opys} />
            </div>

            <div className="flex-1">
              <label className="label">Справа</label>
              <input
                type="text"
                value={entry.sprava}
                onChange={(e) => onUpdate({ sprava: e.target.value })}
                onBlur={(e) => handleSpravaBlur(e.target.value)}
                disabled={false}
                placeholder="Справа"
                className="input"
              />
              <FieldError error={errors.sprava} />
            </div>
          </div>
        </div>

        {entry.spravaWikisource.exists && spravaWikisourceUrl && (
          <p className="text-base text-blue-700">
            Така справа вже існує у Вікіджерелах, але ви можете завантажити свою версію.{" "}
            <a href={spravaWikisourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Переглянути справу
            </a>
          </p>
        )}

        {/* Wikisource name lookups */}
        <div className="flex flex-col gap-2">
          <WikisourceNameField label="Фонд" state={entry.fondName} />
          <WikisourceNameField label="Опис" state={entry.opysName} />
        </div>
      </div>

      {/* Назва справи */}
      <div>
        <label className="label">
          Назва справи
        </label>
        <AutoGrowTextarea
          value={entry.spravaName}
          onChange={(spravaName) => onUpdate({ spravaName })}
          placeholder={"Офіційна назва справи"}
          className="input resize-none overflow-hidden"
        />
        <FieldError error={errors.spravaName} />
      </div>

      {/* Dates */}
      <div>
        <DateFields
          label="Дати"
          state={dateState}
          onChange={(patch) => onUpdate(patch)}
          disabled={false}
        />
        <FieldError error={errors.dates} />
      </div>

      {/* Автор / Ліцензування */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 lg:flex-[2]">
          <label className="label">
            Автор <span className="text-zinc-400">(необовʼязково)</span>
          </label>
          <input
            type="text"
            value={entry.author}
            onChange={(e) => onUpdate({ author: e.target.value })}
            placeholder="Хто створив справу, якщо це відомо"
            className="input"
          />
        </div>

        <div className="min-w-0 lg:flex-[3]">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-base font-medium text-zinc-700">
              Ліцензування
            </label>
            <LicenseHelpPopup />
          </div>
          <LicenseField
            dateState={dateState}
            author={entry.author}
            value={entry.license}
            onChange={(license) => onUpdate({ license })}
            manuallySet={entry.licenseManuallySet}
            onSetManual={(v) => onUpdate({ licenseManuallySet: v })}
            disabled={false}
          />
          <FieldError error={errors.license} />
        </div>
      </div>

      {/* Назва файлу */}
      <div>
        <label className="label">
          Публічна назва файлу
        </label>
        <div className="relative">
          <AutoGrowTextarea
            disabled={!fileNameEnabled}
            value={fileNameEnabled ? (entry.fileNameEdited ? entry.fileName : autoFileName) : ""}
            onChange={(val) => {
              onUpdate({ fileName: val, fileNameEdited: val !== "" });
            }}
            placeholder={
              fileNameEnabled
                ? "Назва файлу для завантаження"
                : "Спершу введіть архів, фонд, опис, справу та назву справи"
            }
            className="input resize-none overflow-hidden pr-9"
          />
          {entry.fileNameCheck.status === 'loading' && (
            <span
              aria-label="Перевірка"
              className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500"
            />
          )}
        </div>
        <FieldError error={errors.fileName} />
      </div>
    </div>
  );
}
