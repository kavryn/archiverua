import ArchiveCombobox from "./ArchiveCombobox";
import DateFields, { type DateState } from "./DateFields";
import FieldError from "./FieldError";
import LicenseField from "./LicenseField";
import LicenseHelpPopup from "./LicenseHelpPopup";
import { type FileEntry, buildAutoFileName, getEffectiveFileName, hasInvalidFileNameChars, isFileNameEnabled } from "@/types/upload-form";
import { useFileNameCheck } from "@/hooks/useFileNameCheck";
import type { Archive } from "@/lib/archives";

interface EntryCardProps {
  entry: FileEntry;
  onUpdate: (patch: Partial<FileEntry>) => void;
  onArchiveChange: (a: Archive | null) => void;
  onFondBlur: (value: string) => void;
  onOpisBlur: (value: string) => void;
  onSpravaBlur: (value: string) => void;
}

export default function EntryCard({ entry, onUpdate, onArchiveChange, onFondBlur, onOpisBlur, onSpravaBlur }: EntryCardProps) {

  const dateState: DateState = {
    dateMode: entry.dateMode,
    dateFrom: entry.dateFrom,
    dateTo: entry.dateTo,
  };

  const fondNameWritable = !entry.fondName.loading && !entry.fondName.exists;
  const opisNameShown = entry.opisName.loading || entry.opisName.lastFetchedTitle !== "";
  const opisNameWritable = opisNameShown && !entry.opisName.loading && !entry.opisName.exists;

  const spravaWikisourceUrl = entry.spravaWikisource.lastFetchedTitle
    ? `https://uk.wikisource.org/wiki/${encodeURIComponent(entry.spravaWikisource.lastFetchedTitle)}`
    : "";

  const fileNameEnabled = isFileNameEnabled(entry);
  const autoFileName = buildAutoFileName(entry);
  const effectiveFileName = getEffectiveFileName(entry);
  const fileNameHasInvalidChars = hasInvalidFileNameChars(entry);

  const uploadedMB = (entry.uploadedBytes / (1024 * 1024)).toFixed(1);
  const totalMB = (entry.totalBytes / (1024 * 1024)).toFixed(1);

  useFileNameCheck(entry, onUpdate);

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
          onChange={(a) => onArchiveChange(a)}
          disabled={false}
        />
        <FieldError show={entry.submitted && entry.archive === null} />
      </div>

      {/* Fond / Opis / Sprava */}
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={entry.fond}
            onChange={(e) => onUpdate({ fond: e.target.value })}
            onBlur={(e) => onFondBlur(e.target.value)}
            disabled={false}
            placeholder="Фонд"
            className="input"
          />
          <FieldError show={entry.submitted && entry.fond.trim() === ""} />
        </div>

        <div className="flex-1">
          <input
            type="text"
            value={entry.opis}
            onChange={(e) => onUpdate({opis: e.target.value})}
            onBlur={(e) => onOpisBlur(e.target.value)}
            disabled={false}
            placeholder="Опис"
            className="input"
          />
          <FieldError show={entry.submitted && entry.opis.trim() === ""} />
        </div>

        <div className="flex-1">
          <input
            type="text"
            value={entry.sprava}
            onChange={(e) => onUpdate({ sprava: e.target.value })}
            onBlur={(e) => onSpravaBlur(e.target.value)}
            disabled={false}
            placeholder="Справа"
            className="input"
          />
          <FieldError show={entry.submitted && entry.sprava.trim() === ""} />
        </div>
      </div>

      {/* Name fields */}
      <div className="flex flex-col gap-2">
        {entry.spravaWikisource.exists && spravaWikisourceUrl && (
          <p className="text-base text-blue-700">
            Така справа вже існує у Вікіджерелах, але ви можете завантажити свою версію.{" "}
            <a href={spravaWikisourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Переглянути справу
            </a>
          </p>
        )}
        <div>
          <label className="label">
            Назва фонду
          </label>
          <input
            type="text"
            disabled={ entry.fondName.lastFetchedTitle === "" || entry.fondName.loading || entry.fondName.exists}
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
                "Введіть назву фонду"}
            className="input"
          />
          <FieldError
            show={
              entry.submitted &&
              fondNameWritable &&
              !entry.fondName.loading &&
              entry.fondName.value.trim() === ""
            }
          />
        </div>

        <div>
          <label className="label">
            Назва опису <span className="text-zinc-400">(необовʼязково)</span>
          </label>
          <input
            type="text"
            disabled={entry.opisName.lastFetchedTitle === "" || entry.opisName.loading || entry.opisName.exists}
            value={
              entry.opisName.loading
                ? ""
                : entry.opisName.exists
                ? entry.opisName.fetched
                : entry.opisName.value
            }
            onChange={(e) =>
              !entry.opisName.loading &&
              !entry.opisName.exists &&
              onUpdate({ opisName: { ...entry.opisName, value: e.target.value } })
            }
            placeholder={entry.opisName.loading ? "Завантаження…" :
                 entry.opisName.lastFetchedTitle === "" ? "Автоматично. Спершу введіть архів, фонд та опис." :
                 "Введіть назву опису"}
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
          <FieldError
            show={entry.submitted && entry.spravaName.trim() === ""}
          />
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
        <FieldError
          show={
            entry.submitted &&
            entry.dateFrom.trim() === "" &&
            entry.dateTo.trim() === ""
          }
          message="Вкажіть хоча б одну дату"
        />
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
        <FieldError
          show={
            entry.submitted &&
            (entry.dateFrom.trim() !== "" || entry.dateTo.trim() !== "") &&
            entry.license.length === 0
          }
        />
      </div>

      {/* Upload status */}
      {entry.status === "uploading" && entry.totalChunks > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-base text-zinc-600">
            Чанк {entry.currentChunk} з {entry.totalChunks} — {entry.uploadProgress}%
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              style={{ width: `${entry.uploadProgress}%` }}
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            />
          </div>
          <div className="text-sm text-zinc-500">
            {uploadedMB} МБ з {totalMB} МБ
          </div>
        </div>
      )}

      {entry.status === "uploading" && entry.totalChunks === 0 && (
        <p className="text-base text-zinc-600">Завантаження…</p>
      )}

      {entry.status === "success" && (
        <p className="text-base text-green-700">
          Успішно!{" "}
          <a href={entry.resultUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Переглянути файл
          </a>
        </p>
      )}

      {entry.status === "duplicate" && (
        <p className="text-base text-yellow-700">
          Файл з таким вмістом вже існує у Вікісховищі.{" "}
          <a
            href={entry.duplicateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Переглянути існуючий файл
          </a>
        </p>
      )}

      {entry.status === "error" && (
        <p className="text-base text-red-600">{entry.errorMessage}</p>
      )}

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
        {entry.fileNameCheck.loading && (
          <p className="mt-1 text-sm text-zinc-400">Перевірка…</p>
        )}
        <FieldError
          show={entry.submitted && fileNameEnabled && effectiveFileName.trim() === ""}
        />
        <FieldError
          show={fileNameEnabled && entry.fileNameCheck.exists === true}
          message="Файл з такою назвою вже існує на Вікісховищі"
        />
        <FieldError
          show={fileNameHasInvalidChars}
          message='Назва файлу не може містити символи: ":", "/" або "\"'
        />
      </div>
    </div>
  );
}
