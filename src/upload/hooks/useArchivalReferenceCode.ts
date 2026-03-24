import { useEffect, useRef, useState } from "react";
import { emptyNameState, emptySpravaWikisource, type FileEntry, type NameFieldState, type SpravaWikisourceState } from "../types";
import type { Archive } from "@/lib/archives";
import { apiFetch } from "@/lib/api-fetch";

type Patch = Partial<FileEntry> | ((e: FileEntry) => Partial<FileEntry>);

const wikisourceNameCache = new Map<string, { name: string | null; exists: boolean }>();

async function fetchWikisourceName(
  pageTitle: string
): Promise<{ name: string | null; exists: boolean }> {
  const cached = wikisourceNameCache.get(pageTitle);
  if (cached) return cached;
  const res = await apiFetch(`/api/wikisource/name?title=${encodeURIComponent(pageTitle)}`);
  const result = await res.json();
  wikisourceNameCache.set(pageTitle, result);
  return result;
}

async function fetchNameField(
  title: string,
  key: "fondName" | "opysName",
  currentState: NameFieldState,
  onUpdate: (patch: Patch) => void
): Promise<void> {
  if (currentState.lastFetchedTitle === title) return;
  onUpdate({ [key]: { ...currentState, loading: true } });
  try {
    const result = await fetchWikisourceName(title);
    onUpdate({ [key]: { value: "", fetched: result.name ?? "", exists: result.exists, loading: false, lastFetchedTitle: title } });
  } catch {
    onUpdate((e) => ({ [key]: { ...(e[key] as NameFieldState), loading: false } }));
  }
}

async function fetchSprava(
  title: string,
  currentState: SpravaWikisourceState,
  onUpdate: (patch: Patch) => void
): Promise<void> {
  if (currentState.lastFetchedTitle === title) return;
  onUpdate({ spravaWikisource: { ...currentState, loading: true } });
  try {
    const result = await fetchWikisourceName(title);
    onUpdate({ spravaWikisource: { name: result.name, exists: result.exists, loading: false, lastFetchedTitle: title } });
  } catch {
    onUpdate((e) => ({ spravaWikisource: { ...e.spravaWikisource, loading: false } }));
  }
}

/**
 * Changes from "р203" to "Р-203"
 */
function normalizeFond(v: string): string {
  let r = v.replace(/[\s\/]/g, "").toUpperCase();
  if (r.length >= 2 && /[A-ZА-ЯІЇЄҐ]/.test(r[0]) && /\d/.test(r[1])) {
    r = r[0] + "-" + r.slice(1);
  }
  return r;
}

/**
 * Changes from "4-А" to "4а"
 */
function normalizeOpysSprava(v: string): string {
  return v.replace(/[\s\-\/]/g, "").toLowerCase();
}

export function useArchivalReferenceCode(
  entry: FileEntry,
  onUpdate: (patch: Patch) => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const [fetchTick, setFetchTick] = useState(0);
  function triggerFetch() { setFetchTick(t => t + 1); }

  function handleFondBlur(value: string) {
    onUpdate({ fond: normalizeFond(value) });
    triggerFetch();
  }

  function handleOpysBlur(value: string) {
    onUpdate({ opys: normalizeOpysSprava(value) });
    triggerFetch();
  }

  function handleSpravaBlur(value: string) {
    onUpdate({ sprava: normalizeOpysSprava(value) });
    triggerFetch();
  }

  function handleArchiveChange(newArchive: Archive | null) {
    onUpdate({ archive: newArchive });
    triggerFetch();
  }

  useEffect(() => {
    if (fetchTick === 0) return;
    const { archive, fond, opys, sprava } = entry;
    const onUpd = onUpdateRef.current;

    if (!archive || !fond) {
      onUpd({ fondName: emptyNameState, opysName: emptyNameState, spravaWikisource: emptySpravaWikisource });
      return;
    }

    const abbr = archive.abbr;
    const fetches: Promise<void>[] = [
      fetchNameField(`Архів:${abbr}/${fond}`, "fondName", entry.fondName, onUpd),
    ];

    if (!opys) {
      onUpd({ opysName: emptyNameState, spravaWikisource: emptySpravaWikisource });
    } else {
      fetches.push(fetchNameField(`Архів:${abbr}/${fond}/${opys}`, "opysName", entry.opysName, onUpd));
      if (!sprava) {
        onUpd({ spravaWikisource: emptySpravaWikisource });
      } else {
        fetches.push(fetchSprava(`Архів:${abbr}/${fond}/${opys}/${sprava}`, entry.spravaWikisource, onUpd));
      }
    }

    Promise.all(fetches);
  }, [fetchTick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleFondBlur, handleOpysBlur, handleSpravaBlur, handleArchiveChange };
}
