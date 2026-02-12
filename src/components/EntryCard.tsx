import ArchiveCombobox from "./ArchiveCombobox";
import DateFields, { type DateState } from "./DateFields";
import FieldError from "./FieldError";
import { emptyNameState, type FileEntry, buildAutoFileName, getEffectiveFileName } from "@/types/upload-form";

interface EntryCardProps {
  entry: FileEntry;
  inputClass: string;
  onUpdate: (patch: Partial<FileEntry>) => void;
  onFondBlur: (value: string) => void;
  onOpisBlur: (value: string) => void;
  onSpravaBlur: (value: string) => void;
}

export default function EntryCard({ entry, inputClass, onUpdate, onFondBlur, onOpisBlur, onSpravaBlur }: EntryCardProps) {
  const fondEnabled = entry.archive !== null;
  const opisEnabled = entry.fond.trim() !== "";
  const spravaEnabled = entry.opis.trim() !== "";
  const spravaNameEnabled = entry.sprava.trim() !== "";

  const dateState: DateState = {
    dateMode: entry.dateMode,
    dateFrom: entry.dateFrom,
    dateTo: entry.dateTo,
    isOver75Years: entry.isOver75Years,
    isRussianEmpire: entry.isRussianEmpire,
  };

  const fondNameShown = entry.fondName.loading || entry.fondName.lastFetchedTitle !== "";
  const fondNameWritable = fondNameShown && !entry.fondName.loading && !entry.fondName.exists;
  const opisNameShown = entry.opisName.loading || entry.opisName.lastFetchedTitle !== "";
  const opisNameWritable = opisNameShown && !entry.opisName.loading && !entry.opisName.exists;
  const spravaNameWritable = spravaNameEnabled && !entry.spravaName.loading;

  const spravaNameValue = (entry.spravaName.value || entry.spravaName.fetched).trim();
  const fileNameEnabled =
    entry.archive !== null &&
    entry.fond.trim() !== "" &&
    entry.opis.trim() !== "" &&
    entry.sprava.trim() !== "" &&
    spravaNameValue !== "";
  const autoFileName = buildAutoFileName(entry);
  const effectiveFileName = getEffectiveFileName(entry);

  const uploadedMB = (entry.uploadedBytes / (1024 * 1024)).toFixed(1);
  const totalMB = (entry.totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {entry.file.name}
      </h2>

      {/* Archive */}
      <div>
        <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
          Архів
        </label>
        <ArchiveCombobox
          value={entry.archive}
          onChange={(a) =>
            onUpdate({
              archive: a,
              fond: "",
              opis: "",
              sprava: "",
              dateFrom: "",
              dateTo: "",
              fondName: emptyNameState,
              opisName: emptyNameState,
              spravaName: emptyNameState,
            })
          }
          disabled={false}
        />
        <FieldError show={entry.submitted && entry.archive === null} />
      </div>

      {/* Fond / Opis / Sprava */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
            Фонд
          </label>
          <input
            type="text"
            value={entry.fond}
            onChange={(e) =>
              onUpdate({
                fond: e.target.value,
                opis: "",
                sprava: "",
                dateFrom: "",
                dateTo: "",
                fondName: emptyNameState,
                opisName: emptyNameState,
                spravaName: emptyNameState,
              })
            }
            onBlur={(e) => onFondBlur(e.target.value)}
            disabled={!fondEnabled}
            placeholder="напр. 201"
            className={inputClass}
          />
          <FieldError show={entry.submitted && fondEnabled && entry.fond.trim() === ""} />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
            Опис
          </label>
          <input
            type="text"
            value={entry.opis}
            onChange={(e) =>
              onUpdate({
                opis: e.target.value,
                sprava: "",
                dateFrom: "",
                dateTo: "",
                opisName: emptyNameState,
                spravaName: emptyNameState,
              })
            }
            onBlur={(e) => onOpisBlur(e.target.value)}
            disabled={!opisEnabled}
            placeholder="напр. 1"
            className={inputClass}
          />
          <FieldError show={entry.submitted && opisEnabled && entry.opis.trim() === ""} />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
            Справа
          </label>
          <input
            type="text"
            value={entry.sprava}
            onChange={(e) =>
              onUpdate({
                sprava: e.target.value,
                dateFrom: "",
                dateTo: "",
                spravaName: emptyNameState,
              })
            }
            onBlur={(e) => onSpravaBlur(e.target.value)}
            disabled={!spravaEnabled}
            placeholder="напр. 3350"
            className={inputClass}
          />
          <FieldError show={entry.submitted && spravaEnabled && entry.sprava.trim() === ""} />
        </div>
      </div>

      {/* Name fields */}
      <div className="flex flex-col gap-2">
        {fondNameShown && (
          <div>
            <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
              Назва фонду
            </label>
            <input
              type="text"
              disabled={entry.fondName.loading || entry.fondName.exists}
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
              placeholder={entry.fondName.loading ? "Завантаження…" : "Введіть назву фонду"}
              className={inputClass}
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
        )}

        {opisNameShown && (
          <div>
            <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
              Назва опису <span className="text-zinc-400 dark:text-zinc-500">(необовʼязково)</span>
            </label>
            <input
              type="text"
              disabled={entry.opisName.loading || entry.opisName.exists}
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
              placeholder={entry.opisName.loading ? "Завантаження…" : "Введіть назву опису"}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
            Назва справи
          </label>
          <input
            type="text"
            disabled={!spravaNameEnabled || entry.spravaName.loading}
            value={entry.spravaName.loading ? "" : entry.spravaName.value}
            onChange={(e) =>
              spravaNameEnabled &&
              !entry.spravaName.loading &&
              onUpdate({ spravaName: { ...entry.spravaName, value: e.target.value } })
            }
            placeholder={entry.spravaName.loading ? "Завантаження…" : spravaNameEnabled ? "Введіть назву справи" :
                "Спершу введіть архів, фонд, опис, справу"}
            className={inputClass}
          />
          <FieldError
            show={entry.submitted && spravaNameWritable && entry.spravaName.value.trim() === ""}
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
        <FieldError
          show={entry.submitted && entry.dateMode === "other" && !entry.isOver75Years}
          message="Підтвердіть, що справі більше 75 років"
        />
      </div>

      {/* Upload status */}
      {entry.status === "uploading" && entry.totalChunks > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-base text-zinc-600 dark:text-zinc-400">
            Чанк {entry.currentChunk} з {entry.totalChunks} — {entry.uploadProgress}%
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              style={{ width: `${entry.uploadProgress}%` }}
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            />
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {uploadedMB} МБ з {totalMB} МБ
          </div>
        </div>
      )}

      {entry.status === "uploading" && entry.totalChunks === 0 && (
        <p className="text-base text-zinc-600 dark:text-zinc-400">Завантаження…</p>
      )}

      {entry.status === "success" && (
        <p className="text-base text-green-700 dark:text-green-400">
          Успішно!{" "}
          <a href={entry.resultUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Переглянути файл
          </a>
        </p>
      )}

      {entry.status === "duplicate" && (
        <p className="text-base text-yellow-700 dark:text-yellow-400">
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
        <p className="text-base text-red-600 dark:text-red-400">{entry.errorMessage}</p>
      )}

      {/* Назва файлу */}
      <div>
        <label className="mb-1 block text-base font-medium text-zinc-700 dark:text-zinc-300">
          Назва файлу
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
          className={inputClass}
        />
        <FieldError
          show={entry.submitted && fileNameEnabled && effectiveFileName.trim() === ""}
        />
      </div>
    </div>
  );
}
