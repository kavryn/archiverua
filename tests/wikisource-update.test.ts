import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  wikisource,
  updateWikisourcePage,
  EditConflictError,
  WIKISOURCE_EDIT_MAX_ATTEMPTS,
  type WikisourcePageRevision,
} from "@/lib/wikimedia";

const args = {
  accessToken: "tok",
  csrfToken: "csrf",
  title: "Архів:X/1/1",
  summary: "summary",
};

function rev(content: string | null, ts: string): WikisourcePageRevision {
  return {
    content,
    basetimestamp: content === null ? undefined : `base-${ts}`,
    starttimestamp: `start-${ts}`,
  };
}

describe("updateWikisourcePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on EditConflictError and rebuilds content from the FRESH revision", async () => {
    const getPage = vi
      .spyOn(wikisource, "getPageContent")
      .mockResolvedValueOnce(rev("v1", "t1"))
      .mockResolvedValueOnce(rev("v2", "t2"));

    const editPage = vi
      .spyOn(wikisource, "editPage")
      .mockRejectedValueOnce(new EditConflictError())
      .mockResolvedValueOnce("https://wiki/page");

    const buildInputs: (string | null)[] = [];
    const result = await updateWikisourcePage({
      ...args,
      build: (existing) => {
        buildInputs.push(existing);
        return `built-from-${existing}`;
      },
    });

    expect(result).toEqual({ url: "https://wiki/page", created: false });
    expect(getPage).toHaveBeenCalledTimes(2);
    // Regression: the rebuild MUST see the second (fresh) content, not the
    // first stale snapshot — otherwise the retry overwrites concurrent edits.
    expect(buildInputs).toEqual(["v1", "v2"]);
    // Second edit must carry the fresh basetimestamp, not the stale one.
    expect(editPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: "built-from-v2",
        basetimestamp: "base-t2",
        starttimestamp: "start-t2",
      })
    );
  });

  it("passes starttimestamp on create even when the page is missing (P1 regression)", async () => {
    vi.spyOn(wikisource, "getPageContent").mockResolvedValue(rev(null, "t0"));
    const editPage = vi
      .spyOn(wikisource, "editPage")
      .mockResolvedValue("https://wiki/new");

    const result = await updateWikisourcePage({
      ...args,
      build: () => "new-content",
    });

    expect(result).toEqual({ url: "https://wiki/new", created: true });
    expect(editPage).toHaveBeenCalledWith(
      expect.objectContaining({
        starttimestamp: "start-t0",
        basetimestamp: undefined,
      })
    );
  });

  it("throws EditConflictError after MAX attempts of conflicts", async () => {
    vi.spyOn(wikisource, "getPageContent").mockResolvedValue(rev("v", "t"));
    const editPage = vi
      .spyOn(wikisource, "editPage")
      .mockRejectedValue(new EditConflictError());

    await expect(
      updateWikisourcePage({ ...args, build: () => "x" })
    ).rejects.toBeInstanceOf(EditConflictError);
    expect(editPage).toHaveBeenCalledTimes(WIKISOURCE_EDIT_MAX_ATTEMPTS);
  });

  it("does not retry on non-conflict errors", async () => {
    vi.spyOn(wikisource, "getPageContent").mockResolvedValue(rev("v", "t"));
    const editPage = vi
      .spyOn(wikisource, "editPage")
      .mockRejectedValue(new Error("badtoken"));

    await expect(
      updateWikisourcePage({ ...args, build: () => "x" })
    ).rejects.toThrow("badtoken");
    expect(editPage).toHaveBeenCalledTimes(1);
  });
});
