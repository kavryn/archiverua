import * as Sentry from "@sentry/nextjs";
import { getEffectiveFileName } from "./hooks/usePublicFileName";
import type { FileEntry } from "./types";

export type UploadTransport = "direct" | "proxy";
export type UploadFailurePhase = "session" | "uploading" | "assembling" | "publishing";

export type UploadFailureContext = {
  transport: UploadTransport;
  uploadPhase: UploadFailurePhase;
  publicFileName: string | null;
  diskFileName: string;
  fileSize: number;
  fileType?: string;
  totalChunks?: number;
  currentChunk?: number;
  chunkStart?: number;
  chunkSize?: number;
  filekey?: string | null;
  serverStage?: string;
  useAsync?: boolean;
  archiveAbbr?: string | null;
  fond?: string;
  opys?: string;
  sprava?: string;
};

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim() !== "") return new Error(error);
  return new Error("Unknown upload failure");
}

export function captureUploadFailure(error: unknown, context: UploadFailureContext): void {
  const normalizedError = normalizeError(error);

  Sentry.withScope((scope) => {
    scope.setTag("feature", "upload");
    scope.setTag("upload_transport", context.transport);
    scope.setTag("upload_phase", context.uploadPhase);
    if (context.serverStage) {
      scope.setTag("upload_server_stage", context.serverStage);
    }
    scope.setContext("upload", {
      ...context,
      errorMessage: normalizedError.message,
    });
    Sentry.captureException(normalizedError);
  });
}

export function captureEntryUploadFailure(
  error: unknown,
  entry: FileEntry,
  transport: UploadTransport,
  uploadPhase: UploadFailurePhase = entry.uploadPhase
): void {
  captureUploadFailure(error, {
    transport,
    uploadPhase,
    publicFileName: getEffectiveFileName(entry).trim() || null,
    diskFileName: entry.file.name,
    fileSize: entry.file.size,
    fileType: entry.file.type || undefined,
    totalChunks: entry.totalChunks || undefined,
    currentChunk: entry.currentChunk || undefined,
    serverStage: entry.serverStage || undefined,
    archiveAbbr: entry.archive?.abbr ?? null,
    fond: entry.fond || undefined,
    opys: entry.opys || undefined,
    sprava: entry.sprava || undefined,
  });
}
