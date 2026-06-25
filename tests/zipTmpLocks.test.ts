import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireTmpFileLock,
  cleanupStaleTmpFiles,
  releaseTmpFileLock,
} from "@/upload/zipToPdf";

// Drain pending microtasks + the queued grant. A macrotask boundary flushes
// everything the fake schedules.
const flush = () => new Promise((r) => setTimeout(r, 0));

// Faithful-enough fake of the Web Locks API. Locks are origin-scoped, so a
// single shared instance models "all tabs of this origin". The holding form
// (request(name, cb)) keeps the lock until the callback's promise resolves;
// the probing form (request(name, { ifAvailable: true }, cb)) gets a null lock
// when the name is already held. Crucially, the grant is asynchronous — like
// the real API — so a release racing ahead of the grant is exercised, not
// papered over by a synchronous callback.
class FakeLockManager {
  held = new Set<string>();

  request(
    name: string,
    optionsOrCb: unknown,
    maybeCb?: (lock: unknown) => unknown,
  ): Promise<unknown> {
    const options = (typeof optionsOrCb === "function" ? {} : optionsOrCb) as {
      ifAvailable?: boolean;
    };
    const cb = (typeof optionsOrCb === "function" ? optionsOrCb : maybeCb) as (
      lock: unknown,
    ) => unknown;

    if (options.ifAvailable) {
      if (this.held.has(name)) return Promise.resolve(cb(null));
      this.held.add(name);
      return Promise.resolve(cb({ name })).finally(() => this.held.delete(name));
    }
    // Holding form: grant on a later microtask, then hold until the callback's
    // promise settles.
    return new Promise((resolve, reject) => {
      queueMicrotask(() => {
        this.held.add(name);
        Promise.resolve(cb({ name }))
          .finally(() => this.held.delete(name))
          .then(resolve, reject);
      });
    });
  }
}

// Minimal OPFS root: a name → handle map exposing entries() + removeEntry.
let locks: FakeLockManager;
let entries: Map<string, unknown>;

function installNavigator(initialFiles: string[]) {
  locks = new FakeLockManager();
  const root = {
    _map: new Map(initialFiles.map((n) => [n, { name: n }])),
    entries() {
      return this._map.entries();
    },
    async removeEntry(name: string) {
      this._map.delete(name);
    },
  };
  entries = root._map;
  vi.stubGlobal("navigator", {
    locks,
    storage: { getDirectory: async () => root },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OPFS tmp-file locking (cross-tab cleanup)", () => {
  it("removes an unlocked ziptmp file but skips one another tab holds", async () => {
    installNavigator(["ziptmp-locked.pdf", "ziptmp-orphan.pdf"]);

    // Simulate "tab A" mid-upload: it holds the lock for its file.
    acquireTmpFileLock("ziptmp-locked.pdf");
    await flush();

    // "Tab B" mounts the wizard and runs cleanup.
    await cleanupStaleTmpFiles();

    expect([...entries.keys()]).toEqual(["ziptmp-locked.pdf"]);

    // Once tab A finishes and releases, the file becomes collectable.
    releaseTmpFileLock("ziptmp-locked.pdf");
    await flush();
    await cleanupStaleTmpFiles();
    expect([...entries.keys()]).toEqual([]);
  });

  it("does not leak the lock when release races ahead of the grant", async () => {
    installNavigator(["ziptmp-racy.pdf"]);

    // Release fires before the asynchronous grant callback has run — the bug
    // a synchronous fake would hide.
    acquireTmpFileLock("ziptmp-racy.pdf");
    releaseTmpFileLock("ziptmp-racy.pdf");
    await flush();

    // The lock must not be left held forever...
    expect(locks.held.has("ziptmp-lock:ziptmp-racy.pdf")).toBe(false);
    // ...so the file is still collectable.
    await cleanupStaleTmpFiles();
    expect([...entries.keys()]).toEqual([]);
  });

  it("never touches non-ziptmp entries", async () => {
    installNavigator(["ziptmp-orphan.pdf", "user-document.pdf"]);
    await cleanupStaleTmpFiles();
    expect([...entries.keys()]).toEqual(["user-document.pdf"]);
  });

  it("is conservative (deletes nothing) when Web Locks is unavailable", async () => {
    // navigator.storage present, but no locks API.
    const root = {
      _map: new Map([["ziptmp-orphan.pdf", { name: "x" }]]),
      entries() {
        return this._map.entries();
      },
      async removeEntry(name: string) {
        this._map.delete(name);
      },
    };
    vi.stubGlobal("navigator", { storage: { getDirectory: async () => root } });
    await cleanupStaleTmpFiles();
    expect([...root._map.keys()]).toEqual(["ziptmp-orphan.pdf"]);
  });
});
