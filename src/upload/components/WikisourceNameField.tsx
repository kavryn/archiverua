import FieldError from "./FieldError";
import type { NameFieldState } from "../types";
import { wikisource } from "@/lib/wikimedia";

interface WikisourceNameFieldProps {
  label: string;
  compactLabel?: string;
  optional?: boolean;
  state: NameFieldState;
  enabled: boolean;
  placeholder: string;
  error?: string | null;
  onChange: (value: string) => void;
}

export default function WikisourceNameField({
  label,
  compactLabel,
  optional = false,
  state,
  enabled,
  placeholder,
  error,
  onChange,
}: WikisourceNameFieldProps) {
  const wikisourceUrl = state.lastFetchedTitle
    ? wikisource.pageUrl(state.lastFetchedTitle)
    : "";
  const hasLookupStarted = state.lastFetchedTitle !== "" || state.loading;
  const isCompactState = state.exists || state.loading;

  if (!hasLookupStarted) {
    return null;
  }

  return (
    <div>
      {isCompactState ? (
        <p className="text-sm text-zinc-500">
          <span className="font-medium text-zinc-600">
            {compactLabel ?? label}:
          </span>{" "}
          {state.exists && wikisourceUrl ? (
            <a
              href={wikisourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {state.fetched || "Без назви"}
            </a>
          ) : state.loading ? (
            "Завантаження…"
          ) : null}
        </p>
      ) : (
        <>
          <label className="label">
            {label} {optional && <span className="text-zinc-400">(необовʼязково)</span>}
          </label>
          <input
            type="text"
            disabled={!enabled}
            value={state.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="input"
          />
        </>
      )}

      <FieldError error={error ?? null} />
    </div>
  );
}
