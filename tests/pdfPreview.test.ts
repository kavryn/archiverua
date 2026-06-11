import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderThumbsLoop } from "@/upload/pdfPreview";

// renderThumbsLoop is the URL-creating seam of renderPdfThumbnails. Its
// invariant: any URL minted via URL.createObjectURL inside the loop MUST
// be matched by a URL.revokeObjectURL if the loop fails partway. These
// tests pin that invariant so future refactors of the surrounding pdf.js
// orchestration can't quietly leak.

type UrlSpy = {
  created: string[];
  revoked: string[];
  restore: () => void;
};

function spyUrls(): UrlSpy {
  const created: string[] = [];
  const revoked: string[] = [];
  let seq = 0;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${++seq}`;
    created.push(url);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;
  return {
    created,
    revoked,
    restore: () => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    },
  };
}

function fakeBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
}

describe("renderThumbsLoop", () => {
  let urls: UrlSpy;

  beforeEach(() => {
    urls = spyUrls();
    return () => urls.restore();
  });

  it("returns thumbs with one URL per page on success", async () => {
    const result = await renderThumbsLoop(3, async (i) => ({
      blob: fakeBlob(),
      width: i * 10,
      height: i * 20,
    }));
    expect(result).toHaveLength(3);
    expect(urls.created).toHaveLength(3);
    expect(urls.revoked).toHaveLength(0);
    expect(result.map((t) => t.url)).toEqual(urls.created);
    expect(result[0]).toMatchObject({ width: 10, height: 20, name: "Сторінка 1" });
  });

  it("revokes every minted URL when renderPage throws mid-loop", async () => {
    await expect(
      renderThumbsLoop(5, async (i) => {
        if (i === 3) throw new Error("boom on page 3");
        return { blob: fakeBlob(), width: 1, height: 1 };
      }),
    ).rejects.toThrow("boom on page 3");

    // Pages 1 and 2 each minted a URL; page 3 threw before its push, so
    // exactly two URLs were created. Both must be revoked.
    expect(urls.created).toHaveLength(2);
    expect(urls.revoked).toEqual(urls.created);
  });

  it("revokes every minted URL when signal aborts mid-loop", async () => {
    const ctrl = new AbortController();
    await expect(
      renderThumbsLoop(
        5,
        async (i) => {
          if (i === 4) ctrl.abort();
          return { blob: fakeBlob(), width: 1, height: 1 };
        },
        ctrl.signal,
      ),
    ).rejects.toThrow();

    // The abort fires inside renderPage for page 4, so page 4's URL is
    // also minted before the next iteration's signal check throws. All
    // four (pages 1..4) must be revoked.
    expect(urls.created).toHaveLength(4);
    expect(urls.revoked).toEqual(urls.created);
  });

  it("revokes nothing on a count of zero", async () => {
    const result = await renderThumbsLoop(0, async () => ({
      blob: fakeBlob(),
      width: 1,
      height: 1,
    }));
    expect(result).toEqual([]);
    expect(urls.created).toHaveLength(0);
    expect(urls.revoked).toHaveLength(0);
  });

  it("never calls renderPage when signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const renderPage = vi.fn();
    await expect(renderThumbsLoop(3, renderPage, ctrl.signal)).rejects.toThrow();
    expect(renderPage).not.toHaveBeenCalled();
    expect(urls.created).toHaveLength(0);
  });
});
