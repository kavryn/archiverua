import { ARCHIVES, type Archive } from "@/lib/archives";

const LETTERS = "A-Za-zА-ЯІЇЄҐа-яіїєґ";
const FOND_FORMAT_RE = new RegExp(`^(?:[${LETTERS}]-)?\\d+[${LETTERS}]*$`, "u");
const OPYS_OR_SPRAVA_FORMAT_RE = new RegExp(`^\\d+[${LETTERS}]*$`, "u");

export interface ParsedArchivalReference {
  archive: Archive;
  fond: string;
  opys: string;
  sprava: string;
  dateFrom: string;
  dateTo: string;
  title: string;
}

interface ParsedTail {
  dateFrom: string;
  dateTo: string;
  title: string;
}

interface ParsedCode {
  fond: string;
  opys: string;
  sprava: string;
}

// Matches the ". Роки. Назва" tail that directly follows the code, anchored at the start
// of the remainder, e.g. ". 1925-1930. Листування". Years and title are delimited by a
// dot, optionally followed by spaces.
const TAIL_RE = /^\.\s*(\d{4})(?:-(\d{4}))?\.\s*(.+)$/u;

function stripLeadingZeros(value: string): string {
  return value.replace(/^(0+)(\d)/, "$2");
}

/**
 * Changes from "р203" to "Р-203"
 */
export function normalizeFond(value: string): string {
  let result = value.replace(/\s/g, "").toUpperCase();
  if (result.length >= 2 && /[A-ZА-ЯІЇЄҐ]/.test(result[0]) && /\d/.test(result[1])) {
    result = `${result[0]}-${result.slice(1)}`;
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

function isValidFond(value: string): boolean {
  return FOND_FORMAT_RE.test(value);
}

function isValidOpysOrSprava(value: string): boolean {
  return OPYS_OR_SPRAVA_FORMAT_RE.test(value);
}

function parseCodeParts(fond: string, opys: string, sprava: string): ParsedCode | null {
  const normalizedFond = normalizeFond(fond);
  const normalizedOpys = normalizeOpysSprava(opys);
  const normalizedSprava = normalizeOpysSprava(sprava);

  if (
    !isValidFond(normalizedFond) ||
    !isValidOpysOrSprava(normalizedOpys) ||
    !isValidOpysOrSprava(normalizedSprava)
  ) {
    return null;
  }

  return {
    fond: normalizedFond,
    opys: normalizedOpys,
    sprava: normalizedSprava,
  };
}

// Parses a complete "fond-opys-sprava" code. Hyphen-delimited codes ("123-4-56", or
// "Р-234-4-38" where the leading letter belongs to the fond) are by far the most common
// form, so they are tried first; "_"/"/" separators are a fallback. A given split is only
// one possible reading, so if its parts are not valid we fall through to the next variant
// rather than giving up. The whole string must be the code — any leftover token makes it
// fail.
function parseCode(code: string): ParsedCode | null {
  const dashed = code.split("-").filter(Boolean);
  if (dashed.length === 3) {
    const parsed = parseCodeParts(dashed[0], dashed[1], dashed[2]);
    if (parsed) return parsed;
  }
  if (dashed.length === 4) {
    const parsed = parseCodeParts(`${dashed[0]}-${dashed[1]}`, dashed[2], dashed[3]);
    if (parsed) return parsed;
  }

  const tokens = code.split(/[_/]+/u).filter(Boolean);
  if (tokens.length === 3) {
    const parsed = parseCodeParts(tokens[0], tokens[1], tokens[2]);
    if (parsed) return parsed;
  }

  return null;
}

// Parses the code from the segment before the tail. First tries the whole segment as a
// clean code; if that fails, the segment may be a code with trailing junk
// ("123-4-56_scan001", "123-4-56 scan001"), so it retries on the leading token delimited
// by a space, "_" or "/". Note that "parseCode" itself never splits on whitespace, so a
// space-separated first token must already be a complete code — "5 1 3" still fails. The
// two parseCode calls run on different strings (whole segment vs. its first token), never
// the same one. `exact` is false in the junk case, telling the caller to drop the tail.
function parseCodeSegment(segment: string): { code: ParsedCode; exact: boolean } | null {
  const whole = parseCode(segment);
  if (whole) return { code: whole, exact: true };

  const leading = segment.split(/[\s_/]+/u)[0];
  if (leading && leading !== segment) {
    const code = parseCode(leading);
    if (code) return { code, exact: false };
  }

  return null;
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

    // Strip the matched archive prefix so the remaining tokens can be parsed as fond/opys/sprava.
    const rest = trimmed.slice(match[0].length).replace(/^[\s._-]+/u, "");
    if (!rest) return null;

    return { archive: candidate, rest };
  }

  return null;
}

// Parses the optional ". Роки. Назва" tail that directly follows the code. A single year
// sets dateFrom and dateTo to the same value. Returns null when the remainder is not a
// well-formed tail.
function parseTail(remainder: string): ParsedTail | null {
  const match = remainder.match(TAIL_RE);
  if (!match) return null;

  const title = match[3].trim();
  if (!title) return null;

  return { dateFrom: match[1], dateTo: match[2] ?? match[1], title };
}

const EMPTY_TAIL: ParsedTail = { dateFrom: "", dateTo: "", title: "" };

export function parseArchivalReferenceFromFileName(fileName: string): ParsedArchivalReference | null {
  const prefix = findArchivePrefix(getFileNameStem(fileName));
  if (!prefix) return null;

  // Once the archive prefix is recognized we always return at least that. The body starts
  // with a fond-opys-sprava code (which never contains a dot), optionally followed by a
  // ". Роки. Назва" tail. The segment before the first dot is the code; everything from the
  // dot on is the potential tail.
  const { rest } = prefix;
  const dotIndex = rest.indexOf(".");
  const codeSegment = dotIndex === -1 ? rest : rest.slice(0, dotIndex);
  const parsed = parseCodeSegment(codeSegment);

  // The tail counts only when the code fills the whole segment before it. If the code
  // needed junk stripped (e.g. "123-4-56_scan001"), that junk sits between the code and the
  // tail, so the tail — and everything after the code — is dropped.
  const tail = parsed?.exact && dotIndex !== -1 ? parseTail(rest.slice(dotIndex)) : null;

  return {
    archive: prefix.archive,
    fond: parsed?.code.fond ?? "",
    opys: parsed?.code.opys ?? "",
    sprava: parsed?.code.sprava ?? "",
    ...(tail ?? EMPTY_TAIL),
  };
}
