import ArchiveCombobox from "./ArchiveCombobox";
import DateFields, { type DateState } from "./DateFields";
import FieldError from "./FieldError";
import LicenseField from "./LicenseField";
import LicenseHelpPopup from "./LicenseHelpPopup";
import { type FileEntry, isFondNameEnabled, isOpysNameEnabled } from "../types";
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

      {/* Archive */}
      <div>
        <ArchiveCombobox
          value={entry.archive}
          onChange={(a) => handleArchiveChange(a)}
          disabled={false}
        />
        <FieldError error={errors.archive} />
      </div>

      {/* Fond / Opys / Sprava */}
      <div className="flex gap-3">
        <div className="flex-1">
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

      {entry.spravaWikisource.exists && spravaWikisourceUrl && (
        <p className="text-base text-blue-700">
          Така справа вже існує у Вікіджерелах, але ви можете завантажити свою версію.{" "}
          <a href={spravaWikisourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Переглянути справу
          </a>
        </p>
      )}

      {/* Name fields */}
      <div className="flex flex-col gap-2">
        <div>
          <label className="label">
            Назва фонду
          </label>
          <input
            type="text"
            disabled={!isFondNameEnabled(entry)}
            value={
              entry.fondName.loading
                ? ""
                : entry.fondName.exists
                ? entry.fondName.fetched
                : entry.fondName.value
            }
            onChange={(e) =>
              !entry.fondName.loading &&
              !entry.fondName.exists &&
              onUpdate({ fondName: { ...entry.fondName, value: e.target.value } })
            }
            placeholder={entry.fondName.loading ? "Завантаження…" :
                entry.fondName.lastFetchedTitle === "" ? "Автоматично. Спершу введіть архів та фонд." :
                "Офіційна назва фонду"}
            className="input"
          />
          <FieldError error={errors.fondName} />
        </div>

        <div>
          <label className="label">
            Назва опису <span className="text-zinc-400">(необовʼязково)</span>
          </label>
          <input
            type="text"
            disabled={!isOpysNameEnabled(entry)}
            value={
              entry.opysName.loading
                ? ""
                : entry.opysName.exists
                ? entry.opysName.fetched
                : entry.opysName.value
            }
            onChange={(e) =>
              !entry.opysName.loading &&
              !entry.opysName.exists &&
              onUpdate({ opysName: { ...entry.opysName, value: e.target.value } })
            }
            placeholder={entry.opysName.loading ? "Завантаження…" :
                 entry.opysName.lastFetchedTitle === "" ? "Автоматично. Спершу введіть архів, фонд та опис." :
                 "Офіційна назва опису"}
            className="input"
          />
        </div>

        <div>
          <label className="label">
            Назва справи
          </label>
          <input
            type="text"
            disabled={false}
            value={entry.spravaName}
            onChange={(e) => onUpdate({ spravaName: e.target.value })}
            placeholder={"Офіційна назва справи"}
            className="input"
          />
          <FieldError error={errors.spravaName} />
        </div>
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

      <div>
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

      {/* Ліцензування */}
      <div>
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
          disabled={false}
        />
        <FieldError error={errors.license} />
      </div>

      {/* Назва файлу */}
      <div>
        <label className="label">
          Публічна назва файлу
        </label>
        <input
          type="text"
          disabled={!fileNameEnabled}
          value={fileNameEnabled ? (entry.fileNameEdited ? entry.fileName : autoFileName) : ""}
          onChange={(e) => {
            const val = e.target.value;
            onUpdate({ fileName: val, fileNameEdited: val !== "" });
          }}
          placeholder={
            fileNameEnabled
              ? "Назва файлу для завантаження"
              : "Спершу введіть архів, фонд, опис, справу та назву справи"
          }
          className="input"
        />
        {entry.fileNameCheck.status === 'loading' && (
          <p className="mt-1 text-sm text-zinc-400">Перевірка…</p>
        )}
        <FieldError error={errors.fileName} />
      </div>
    </div>
  );
}
