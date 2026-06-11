import type { NameFieldState } from "../types";
import { wikisource } from "@/lib/wikimedia";

interface WikisourceNameFieldProps {
  label: string;
  state: NameFieldState;
}

export default function WikisourceNameField({
  label,
  state,
}: WikisourceNameFieldProps) {
  const hasLookupStarted = state.lastFetchedTitle !== "" || state.loading;
  if (!hasLookupStarted) return null;

  const wikisourceUrl = state.lastFetchedTitle
    ? wikisource.pageUrl(state.lastFetchedTitle)
    : "";

  return (
    <p className="text-sm text-zinc-500">
      <span className="font-medium text-zinc-600">{label}:</span>{" "}
      {state.loading ? (
        "Завантаження…"
      ) : state.exists && wikisourceUrl ? (
        <a
          href={wikisourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {state.fetched || "Без назви"}
        </a>
      ) : (
        <span className="text-zinc-400">назву не знайдено</span>
      )}
    </p>
  );
}
