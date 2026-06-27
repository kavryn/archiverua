import { ARCHIVES, type Archive } from "@/lib/archives";

const LETTERS = "A-Za-zА-ЯІЇЄҐа-яіїєґ";

// A code part is digits with an optional letter suffix ("4", "4а"). The fond may also carry a
// leading letter prefix of up to three letters, attached or dashed ("Р203", "Р-203", "КМФ-9").
const PART = `\\d+[${LETTERS}]*`;
const FOND = `(?:[${LETTERS}]{1,3}-?)?${PART}`;
// The code segment must be exactly "fond-opys-sprava" — the whole segment, no trailing junk.
const CODE_RE = new RegExp(`^(${FOND})-(${PART})-(${PART})$`, "u");
// The years segment is a single year or a "from-to" range.
const YEARS_RE = /^(\d{4})(?:-(\d{4}))?$/u;

export interface ParsedArchivalReference {
  archive: Archive;
  fond: string;
  opys: string;
  sprava: string;
  dateFrom: string;
  dateTo: string;
  title: string;
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^(0+)(\d)/, "$2");
}

/**
 * Changes from "р203" to "Р-203", "кмф9" to "КМФ-9"
 */
export function normalizeFond(value: string): string {
  let result = value.replace(/\s/g, "").toUpperCase();
  // Insert a dash between a leading letter prefix (up to three letters) and the number.
  const prefix = result.match(/^([A-ZА-ЯІЇЄҐ]{1,3})(?=\d)/);
  if (prefix) {
    result = `${prefix[1]}-${result.slice(prefix[1].length)}`;
  }
  const dashIndex = result.indexOf("-");
  if (dashIndex >= 0) {
    return `${result.slice(0, dashIndex + 1)}${stripLeadingZeros(result.slice(dashIndex + 1))}`;
  }
  return stripLeadingZeros(result);
}

/**
 * Changes from "4-А" to "4а"
 */
export function normalizeOpysSprava(value: string): string {
  return stripLeadingZeros(value.replace(/[\s-]/g, "").toLowerCase());
}

function getFileNameStem(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Example: "ІР НБУВ" becomes /^ІР[\s._-]+НБУВ(?=$|[\s._-])/iu,
// so file names like "ІР_НБУВ_123-4-5.pdf" and "ІР-НБУВ 123-4-5.pdf" both match.
function getArchivePrefixPattern(abbr: string): RegExp {
  // Allow file names to replace spaces inside archive abbreviations with common separators.
  const parts = abbr.trim().split(/\s+/u).map(escapeRegExp);
  const pattern = parts.join("[\\s._-]+");
  return new RegExp(`^${pattern}(?=$|[\\s._-])`, "iu");
}

function findArchivePrefix(fileNameStem: string): { archive: Archive; rest: string } | null {
  const trimmed = fileNameStem.trim();

  // Prefer the most specific abbreviation when one archive prefix is contained in another.
  const sorted = [...ARCHIVES].sort(
    (a, b) => b.abbr.replace(/\s+/gu, "").length - a.abbr.replace(/\s+/gu, "").length,
  );

  for (const candidate of sorted) {
    const match = trimmed.match(getArchivePrefixPattern(candidate.abbr));
    if (!match) continue;

    // Strip the matched archive prefix so the remaining text can be parsed as the code.
    const rest = trimmed.slice(match[0].length).replace(/^[\s._-]+/u, "");
    return { archive: candidate, rest };
  }

  return null;
}

// Splits on the first ".". The tail is null when there is no dot, which lets the caller tell
// "no further segment" apart from "an empty segment".
function splitFirstDot(value: string): [string, string | null] {
  const dot = value.indexOf(".");
  return dot === -1 ? [value, null] : [value.slice(0, dot), value.slice(dot + 1)];
}

// File name format: "<Archive> <fond>-<opys>-<sprava>. <Роки>. <Назва>". Each field is consumed
// in turn; when a field does not parse cleanly we stop and return whatever was collected so far.
export function parseArchivalReferenceFromFileName(fileName: string): ParsedArchivalReference | null {
  const prefix = findArchivePrefix(getFileNameStem(fileName));
  if (!prefix) return null;

  const result: ParsedArchivalReference = {
    archive: prefix.archive,
    fond: "",
    opys: "",
    sprava: "",
    dateFrom: "",
    dateTo: "",
    title: "",
  };

  const [codeSegment, afterCode] = splitFirstDot(prefix.rest);
  const code = codeSegment.trim().match(CODE_RE);
  if (!code) return result;
  result.fond = normalizeFond(code[1]);
  result.opys = normalizeOpysSprava(code[2]);
  result.sprava = normalizeOpysSprava(code[3]);
  if (afterCode === null) return result;

  const [yearsSegment, afterYears] = splitFirstDot(afterCode);
  const years = yearsSegment.trim().match(YEARS_RE);
  if (!years) return result;
  result.dateFrom = years[1];
  result.dateTo = years[2] ?? years[1];
  if (afterYears === null) return result;

  result.title = afterYears.trim();
  return result;
}
