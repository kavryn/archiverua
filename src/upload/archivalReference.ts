import { ARCHIVES, type Archive } from "@/lib/archives";

const LETTERS = "A-Za-zА-ЯІЇЄҐа-яіїєґ";
const FOND_FORMAT_RE = new RegExp(`^(?:[${LETTERS}]-)?\\d+[${LETTERS}]*$`, "u");
const OPYS_OR_SPRAVA_FORMAT_RE = new RegExp(`^\\d+[${LETTERS}]*$`, "u");

export interface ParsedArchivalReference {
  archive: Archive;
  fond: string;
  opys: string;
  sprava: string;
}

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

function parseCodeParts(fond: string, opys: string, sprava: string): {
  fond: string;
  opys: string;
  sprava: string;
} | null {
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

function parseCodeFromSingleToken(token: string): {
  fond: string;
  opys: string;
  sprava: string;
} | null {
  const parts = token.split("-").filter(Boolean);
  if (parts.length === 3) {
    return parseCodeParts(parts[0], parts[1], parts[2]);
  }

  if (parts.length === 4) {
    return parseCodeParts(`${parts[0]}-${parts[1]}`, parts[2], parts[3]);
  }

  return null;
}

function parseCodeFromTokens(rest: string): {
  fond: string;
  opys: string;
  sprava: string;
} | null {
  const tokens = rest.split(/[\s._/]+/u).filter(Boolean);
  if (tokens.length === 0) return null;

  const fromSingleToken = parseCodeFromSingleToken(tokens[0]);
  if (fromSingleToken) return fromSingleToken;

  if (tokens.length < 3) return null;
  return parseCodeParts(tokens[0], tokens[1], tokens[2]);
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

export function parseArchivalReferenceFromFileName(fileName: string): ParsedArchivalReference | null {
  const prefix = findArchivePrefix(getFileNameStem(fileName));
  if (!prefix) return null;

  const code = parseCodeFromTokens(prefix.rest);
  if (!code) return null;

  return {
    archive: prefix.archive,
    ...code,
  };
}
