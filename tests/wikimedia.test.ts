import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DuplicateFileError,
  throwOnUploadWarnings,
  resolveUploadAvailableFrom,
  getUploadAvailableFrom,
  isUploadAllowed,
  wikicommons,
  wikisource,
} from "@/lib/wikimedia";

describe("throwOnUploadWarnings", () => {
  it("ignores an empty warnings object", () => {
    expect(() => throwOnUploadWarnings({})).not.toThrow();
  });

  it("ignores empty warning arrays", () => {
    expect(() => throwOnUploadWarnings({ duplicate: [] })).not.toThrow();
  });

  it("throws DuplicateFileError for duplicate warnings", () => {
    expect(() => throwOnUploadWarnings({ duplicate: ["Existing.pdf"] })).toThrow(DuplicateFileError);
  });

  it("throws a mapped message for named upload warnings", () => {
    expect(() => throwOnUploadWarnings({ badfilename: "Bad filename" })).toThrow(
      "Некоректна назва файлу"
    );
  });

  it("falls back to the warning key for unknown warnings", () => {
    expect(() => throwOnUploadWarnings({ weirdwarning: true })).toThrow(
      "Помилка при завантаженні: weirdwarning"
    );
  });
});

describe("WikiClient.getAccountUploadAccess", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubUserinfo(rights: string[], registrationdate: string | null) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ query: { userinfo: { rights, registrationdate } } }),
      })
    );
  }

  it("reports autoconfirmed status and registration date", async () => {
    stubUserinfo(["upload", "autoconfirmed"], "2024-01-01T00:00:00Z");
    expect(await wikicommons.getAccountUploadAccess("tok")).toEqual({
      isAutoconfirmed: true,
      registrationDate: "2024-01-01T00:00:00Z",
    });
  });

  it("reports a not-yet-autoconfirmed account", async () => {
    stubUserinfo(["upload", "edit"], "2024-01-01T00:00:00Z");
    expect((await wikicommons.getAccountUploadAccess("tok")).isAutoconfirmed).toBe(false);
  });

  it("tolerates a missing registration date for autoconfirmed accounts without logging", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    stubUserinfo(["autoconfirmed"], null);
    expect((await wikicommons.getAccountUploadAccess("tok")).registrationDate).toBeNull();
    expect(err).not.toHaveBeenCalled();
  });

  it("logs an error when a non-autoconfirmed account has no registration date", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    stubUserinfo(["upload"], null);
    const access = await wikicommons.getAccountUploadAccess("tok");
    expect(access).toEqual({ isAutoconfirmed: false, registrationDate: null });
    expect(err).toHaveBeenCalledOnce();
  });
});

describe("resolveUploadAvailableFrom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockAccess(
    commons: { isAutoconfirmed: boolean; registrationDate: string | null },
    source: { isAutoconfirmed: boolean; registrationDate: string | null }
  ) {
    vi.spyOn(wikicommons, "getAccountUploadAccess").mockResolvedValue(commons);
    vi.spyOn(wikisource, "getAccountUploadAccess").mockResolvedValue(source);
  }

  it("returns null when autoconfirmed on both wikis", async () => {
    mockAccess(
      { isAutoconfirmed: true, registrationDate: "2024-01-01T00:00:00Z" },
      { isAutoconfirmed: true, registrationDate: "2024-01-01T00:00:00Z" }
    );
    expect(await resolveUploadAvailableFrom("tok")).toBeNull();
  });

  it("returns the date 4 days after registration when one wiki blocks", async () => {
    mockAccess(
      { isAutoconfirmed: false, registrationDate: "2024-01-01T00:00:00.000Z" },
      { isAutoconfirmed: true, registrationDate: "2024-01-01T00:00:00.000Z" }
    );
    expect(await resolveUploadAvailableFrom("tok")).toBe("2024-01-05T00:00:00.000Z");
  });

  it("returns the later date when both wikis block", async () => {
    mockAccess(
      { isAutoconfirmed: false, registrationDate: "2024-01-01T00:00:00.000Z" },
      { isAutoconfirmed: false, registrationDate: "2024-01-03T00:00:00.000Z" }
    );
    expect(await resolveUploadAvailableFrom("tok")).toBe("2024-01-07T00:00:00.000Z");
  });

  it("returns null when registration is unknown", async () => {
    mockAccess(
      { isAutoconfirmed: false, registrationDate: null },
      { isAutoconfirmed: true, registrationDate: null }
    );
    expect(await resolveUploadAvailableFrom("tok")).toBeNull();
  });
});

describe("getUploadAvailableFrom (cache)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits the wiki API once per user, then serves from cache", async () => {
    const commons = vi
      .spyOn(wikicommons, "getAccountUploadAccess")
      .mockResolvedValue({ isAutoconfirmed: false, registrationDate: "2024-01-01T00:00:00.000Z" });
    vi.spyOn(wikisource, "getAccountUploadAccess").mockResolvedValue({
      isAutoconfirmed: true,
      registrationDate: "2024-01-01T00:00:00.000Z",
    });

    const userId = `user-${Math.random()}`;
    const first = await getUploadAvailableFrom(userId, "tok");
    const second = await getUploadAvailableFrom(userId, "tok");

    expect(first).toBe("2024-01-05T00:00:00.000Z");
    expect(second).toBe(first);
    expect(commons).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures, so a later call retries", async () => {
    const commons = vi
      .spyOn(wikicommons, "getAccountUploadAccess")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ isAutoconfirmed: true, registrationDate: null });
    vi.spyOn(wikisource, "getAccountUploadAccess").mockResolvedValue({
      isAutoconfirmed: true,
      registrationDate: null,
    });

    const userId = `user-${Math.random()}`;
    await expect(getUploadAvailableFrom(userId, "tok")).rejects.toThrow("boom");
    expect(await getUploadAvailableFrom(userId, "tok")).toBeNull();
    expect(commons).toHaveBeenCalledTimes(2);
  });
});

describe("isUploadAllowed", () => {
  it("allows when no date is set", () => {
    expect(isUploadAllowed(null)).toBe(true);
  });

  it("allows when the eligibility date has passed", () => {
    expect(isUploadAllowed("2000-01-01T00:00:00.000Z")).toBe(true);
  });

  it("blocks when the eligibility date is in the future", () => {
    expect(isUploadAllowed("2999-01-01T00:00:00.000Z")).toBe(false);
  });

  it("fails open on an unparseable date", () => {
    expect(isUploadAllowed("not-a-date")).toBe(true);
  });
});
