import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, ArrowPathIcon, EllipsisHorizontalCircleIcon } from "@heroicons/react/20/solid";
import type { FileEntry } from "@/types/upload-form";

function IconIdle() {
  return <EllipsisHorizontalCircleIcon className="w-5 h-5 text-gray-400 shrink-0" />;
}

function IconSpinner() {
  return <ArrowPathIcon className="w-5 h-5 text-blue-500 shrink-0 animate-spin" />;
}

function IconSuccess() {
  return <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0" />;
}

function IconError() {
  return <XCircleIcon className="w-5 h-5 text-red-600 shrink-0" />;
}

function IconWarning() {
  return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 shrink-0" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function FileStatusCard({ entry }: { entry: FileEntry }) {
  const uploadEnded = entry.status !== "idle" && entry.status !== "uploading";

  let commonsIcon;
  if (entry.status === "idle") commonsIcon = <IconIdle />;
  else if (entry.status === "uploading") commonsIcon = <IconSpinner />;
  else if (entry.status === "success") commonsIcon = <IconSuccess />;
  else if (entry.status === "duplicate") commonsIcon = <IconWarning />;
  else commonsIcon = <IconError />;

  let wikisourceIcon;
  if (entry.wikisourceStatus === "pending") wikisourceIcon = <IconSpinner />;
  else if (entry.wikisourceStatus === "success") wikisourceIcon = <IconSuccess />;
  else if (entry.wikisourceStatus === "error") wikisourceIcon = <IconError />;
  else wikisourceIcon = <IconIdle />;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3 shadow-sm">
      <p className="font-medium text-gray-900 truncate">{entry.file.name}</p>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {commonsIcon}
          <span className="text-sm text-gray-700">Завантаження файла на Вікісховище</span>
        </div>
        <div className="ml-7 text-sm">
          {entry.status === "uploading" && entry.totalChunks > 0 && (
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${entry.uploadProgress}%` }}
                />
              </div>
              <span className="text-gray-500">
                {`Частина ${entry.currentChunk} з ${entry.totalChunks} — ${Math.round(entry.uploadProgress)}% (${formatBytes(entry.uploadedBytes)} / ${formatBytes(entry.totalBytes)})`}
              </span>
            </div>
          )}
          {entry.status === "uploading" && entry.totalChunks === 0 && (
            <span className="text-gray-500">Завантаження…</span>
          )}
          {entry.status === "success" && (
            <a href={entry.resultUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              Переглянути файл
            </a>
          )}
          {entry.status === "duplicate" && (
            <span className="text-yellow-700">
              Файл з таким вмістом вже існує у Вікісховищі.{" "}
              <a href={entry.duplicateUrl} target="_blank" rel="noreferrer" className="hover:underline break-all">
                Переглянути існуючий файл
              </a>
            </span>
          )}
          {entry.status === "error" && (
            <span className="text-red-600">{entry.errorMessage}</span>
          )}
        </div>
      </div>

      {uploadEnded && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {wikisourceIcon}
            <span className={`text-sm ${entry.status === "duplicate" ? "text-gray-400 line-through" : "text-gray-700"}`}>
              Оновлення сторінок у Вікіджерелах
            </span>
          </div>
          {entry.wikisourceStatus === "success" && entry.wikisourceResult && (
            <div className="ml-7 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {entry.wikisourceResult.sprava && (
                <a href={entry.wikisourceResult.sprava.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Переглянути справу
                </a>
              )}
              {entry.wikisourceResult.opys && (
                <a href={entry.wikisourceResult.opys.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Переглянути опис
                </a>
              )}
              {entry.wikisourceResult.fond && (
                <a href={entry.wikisourceResult.fond.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Переглянути фонд
                </a>
              )}
              {entry.wikisourceResult.archive && (
                <a href={entry.wikisourceResult.archive.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Переглянути архів
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadStatusView({ fileStates }: { fileStates: FileEntry[] }) {
  return (
    <div className="flex flex-col gap-4">
      {fileStates.map((entry, i) => (
        <FileStatusCard key={i} entry={entry} />
      ))}
    </div>
  );
}
