import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFile, CHUNK_SIZE } from "@/upload/upload";
import { makeEntry, type FileEntry } from "@/upload/types";
import { wikicommons } from "@/lib/wikimedia";
import type { Archive } from "@/lib/archives";

// Regression for "The filename is not allowed." (MediaWiki `illegal-filename`):
// the chunked upload path used to stash chunks under the raw on-disk `file.name`
// instead of the validated public name, so an illegal disk filename was rejected
// by the server while stashing the very first chunk — before the (valid) public
// name was ever used at commit time.

const ARCHIVE: Archive = {
  name: "Державний архів Івано-Франківської області",
  abbr: "ДАІФО",
  category: "Funds of State Archive of Ivano-Frankivsk Oblast",
};

const PUBLIC_NAME =
  "ДАІФО 73-1-1с. 1919-1920. Іменні списки військово-службовців.pdf";

// A disk filename MediaWiki would reject as a title: contains `#`, `[`, `]`.
const ILLEGAL_DISK_NAME = "scan#001[final].pdf";

function buildEntry(fileSize: number): FileEntry {
  const file = new File([new Uint8Array(fileSize)], ILLEGAL_DISK_NAME, {
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
    fileName: PUBLIC_NAME,
    license: ["{{PD-old}}"],
  };
}

describe("uploadFile (direct chunked) stash filename", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stashes and commits every chunk under the public name, never the disk file.name", async () => {
    // Two chunks: exercises both uploadFirstChunk and uploadNextChunk.
    const entry = buildEntry(CHUNK_SIZE + 10);

    vi.spyOn(wikicommons, "getCsrfToken").mockResolvedValue("csrf-token");
    const first = vi
      .spyOn(wikicommons, "uploadFirstChunk")
      .mockResolvedValue({ filekey: "fk1", offset: CHUNK_SIZE });
    const next = vi
      .spyOn(wikicommons, "uploadNextChunk")
      .mockResolvedValue({ filekey: "fk1", offset: CHUNK_SIZE + 10 });
    const commit = vi
      .spyOn(wikicommons, "commitChunkedUpload")
      .mockResolvedValue("https://commons.wikimedia.org/wiki/File:ok.pdf");

    const result = await uploadFile(entry, undefined, "access-token", true);

    expect(result.status).toBe("success");

    // The crux: the stash chunks must carry the validated public name.
    expect(first).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0][0].filename).toBe(PUBLIC_NAME);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].filename).toBe(PUBLIC_NAME);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0].filename).toBe(PUBLIC_NAME);

    // Guard against the regression specifically: the illegal disk name must
    // never reach the wiki API.
    for (const call of [...first.mock.calls, ...next.mock.calls, ...commit.mock.calls]) {
      expect(call[0].filename).not.toBe(ILLEGAL_DISK_NAME);
    }
  });
});
