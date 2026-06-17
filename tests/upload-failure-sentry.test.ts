import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((fn: (scope: { setTag: ReturnType<typeof vi.fn>; setContext: ReturnType<typeof vi.fn> }) => void) => {
    const scope = { setTag: vi.fn(), setContext: vi.fn() };
    fn(scope);
    return scope;
  }),
}));

import * as Sentry from "@sentry/nextjs";
import { wikicommons } from "@/lib/wikimedia";
import { CHUNK_SIZE, uploadFile } from "@/upload/upload";
import { makeEntry } from "@/upload/types";
import type { FileEntry } from "@/upload/types";
import { captureEntryUploadFailure, captureUploadFailure } from "@/upload/uploadFailureSentry";
import type { Archive } from "@/lib/archives";

const ARCHIVE: Archive = {
  name: "Державний архів Івано-Франківської області",
  abbr: "ДАІФО",
  category: "Funds of State Archive of Ivano-Frankivsk Oblast",
};

function buildEntry(fileSize: number): FileEntry {
  const file = new File([new Uint8Array(fileSize)], "scan.pdf", {
    type: "application/pdf",
  });
  const entry = makeEntry(file);
  return {
    ...entry,
    archive: ARCHIVE,
    fond: "73",
    opys: "1",
    sprava: "1с",
    spravaName: "Іменні списки",
    fileNameEdited: true,
    fileName: "ДАІФО 73-1-1с. 1919-1920. Іменні списки.pdf",
    license: ["{{PD-old}}"],
  };
}

describe("captureUploadFailure", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.withScope).mockClear();
  });

  it("captures an Error with upload tags and context", () => {
    const error = new Error("The filename is not allowed.");

    captureUploadFailure(error, {
      transport: "direct",
      uploadPhase: "uploading",
      publicFileName: "ДАІФО 73-1-1с.pdf",
      diskFileName: "scan#001[final].pdf",
      fileSize: 123,
      currentChunk: 1,
      totalChunks: 2,
      chunkStart: 0,
      chunkSize: 123,
      filekey: null,
      serverStage: "stash",
      useAsync: false,
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(Sentry.withScope).toHaveBeenCalledOnce();

    const scopeFn = vi.mocked(Sentry.withScope).mock.calls[0][0];
    const scope = { setTag: vi.fn(), setContext: vi.fn() };
    scopeFn(scope);

    expect(scope.setTag).toHaveBeenCalledWith("feature", "upload");
    expect(scope.setTag).toHaveBeenCalledWith("upload_transport", "direct");
    expect(scope.setTag).toHaveBeenCalledWith("upload_phase", "uploading");
    expect(scope.setTag).toHaveBeenCalledWith("upload_server_stage", "stash");
    expect(scope.setContext).toHaveBeenCalledWith(
      "upload",
      expect.objectContaining({
        publicFileName: "ДАІФО 73-1-1с.pdf",
        diskFileName: "scan#001[final].pdf",
        errorMessage: "The filename is not allowed.",
      })
    );
  });

  it("derives upload context from a FileEntry", () => {
    const file = new File([new Uint8Array(16)], "scan#001[final].pdf", {
      type: "application/pdf",
    });
    const entry = makeEntry(file);
    entry.archive = {
      name: "Державний архів Івано-Франківської області",
      abbr: "ДАІФО",
      category: "Funds of State Archive of Ivano-Frankivsk Oblast",
    };
    entry.fond = "73";
    entry.opys = "1";
    entry.sprava = "1с";
    entry.spravaName = "Іменні списки";
    entry.fileNameEdited = true;
    entry.fileName = "ДАІФО 73-1-1с. 1919-1920. Іменні списки.pdf";
    entry.currentChunk = 1;
    entry.totalChunks = 4;
    entry.serverStage = "publish";

    captureEntryUploadFailure("Сесія завершилась", entry, "direct", "session");

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(vi.mocked(Sentry.captureException).mock.calls[0][0]).toMatchObject({
      message: "Сесія завершилась",
    });

    const scopeFn = vi.mocked(Sentry.withScope).mock.calls[0][0];
    const scope = { setTag: vi.fn(), setContext: vi.fn() };
    scopeFn(scope);

    expect(scope.setTag).toHaveBeenCalledWith("upload_phase", "session");
    expect(scope.setContext).toHaveBeenCalledWith(
      "upload",
      expect.objectContaining({
        publicFileName: "ДАІФО 73-1-1с. 1919-1920. Іменні списки.pdf",
        diskFileName: "scan#001[final].pdf",
        archiveAbbr: "ДАІФО",
        fond: "73",
        opys: "1",
        sprava: "1с",
      })
    );
  });
});

describe("uploadFile Sentry reporting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.withScope).mockClear();
  });

  it("reports poll-based chunk assembly failures as assembling", async () => {
    const entry = buildEntry(CHUNK_SIZE + 10);
    const assemblyError = new Error("assembly failed");

    vi.spyOn(wikicommons, "getCsrfToken").mockResolvedValue("csrf-token");
    vi.spyOn(wikicommons, "uploadFirstChunk").mockResolvedValue({
      filekey: "fk1",
      offset: CHUNK_SIZE,
      result: "Poll",
      stage: "queued",
    });
    vi.spyOn(wikicommons, "waitForUploadCompletion").mockRejectedValue(assemblyError);

    await expect(uploadFile(entry, undefined, "access-token", true)).rejects.toThrow("assembly failed");

    expect(Sentry.captureException).toHaveBeenCalledWith(assemblyError);

    const scopeFn = vi.mocked(Sentry.withScope).mock.calls.at(-1)?.[0];
    expect(scopeFn).toBeTypeOf("function");

    const scope = { setTag: vi.fn(), setContext: vi.fn() };
    scopeFn!(scope);

    expect(scope.setTag).toHaveBeenCalledWith("upload_phase", "assembling");
    expect(scope.setContext).toHaveBeenCalledWith(
      "upload",
      expect.objectContaining({
        transport: "direct",
        uploadPhase: "assembling",
        currentChunk: 1,
        chunkStart: 0,
        chunkSize: CHUNK_SIZE,
        filekey: null,
        serverStage: "queued",
      })
    );
  });
});
