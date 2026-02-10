"use client";

const CURRENT_YEAR = new Date().getFullYear();
const THRESHOLD_75 = CURRENT_YEAR - 75;
const THRESHOLD_125 = CURRENT_YEAR - 125;

export interface DateState {
  dateFrom: string;
  dateTo: string;
  isArbitraryDate: boolean;
  isOver75Years: boolean;
  isRussianEmpire: boolean;
}

interface Props {
  state: DateState;
  onChange: (update: Partial<DateState>) => void;
  disabled?: boolean;
}

function getEndYear(dateTo: string): number | null {
  const match = dateTo.match(/\d{4}/);
  if (!match) return null;
  return parseInt(match[0], 10);
}

export function getDateError(state: DateState): string | null {
  if (state.isArbitraryDate) {
    if (!state.isOver75Years) return null;
    return null;
  }
  const endYear = getEndYear(state.dateTo);
  if (endYear === null) return null;
  if (endYear > THRESHOLD_75) {
    return `Документи молодші за ${THRESHOLD_75} р. не можна публікувати на Commons`;
  }
  return null;
}

export function showRussianEmpireCheckbox(state: DateState): boolean {
  if (state.isArbitraryDate) return false;
  const endYear = getEndYear(state.dateTo);
  if (endYear === null) return false;
  return endYear > THRESHOLD_125 && endYear <= THRESHOLD_75;
}

export default function DateFields({ state, onChange, disabled }: Props) {
  const error = getDateError(state);
  const showRussianEmpire = showRussianEmpireCheckbox(state);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={state.isArbitraryDate}
          onChange={(e) =>
            onChange({
              isArbitraryDate: e.target.checked,
              isOver75Years: false,
              isRussianEmpire: false,
            })
          }
          disabled={disabled}
          className="rounded border-zinc-300"
        />
        Довільний формат дат
      </label>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Від</label>
          <input
            type="text"
            value={state.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            disabled={disabled}
            placeholder={state.isArbitraryDate ? "напр. 1890-ті" : "1890"}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">До</label>
          <input
            type="text"
            value={state.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            disabled={disabled}
            placeholder={state.isArbitraryDate ? "напр. 1900-ті" : "1900"}
            className={`w-full rounded-md border px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:placeholder-zinc-500 dark:disabled:bg-zinc-900 ${
              error
                ? "border-red-500 bg-white text-zinc-900 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            }`}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {state.isArbitraryDate && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={state.isOver75Years}
            onChange={(e) => onChange({ isOver75Years: e.target.checked })}
            disabled={disabled}
            className="rounded border-zinc-300"
          />
          Цій справі більше 75 років
        </label>
      )}

      {showRussianEmpire && (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={state.isRussianEmpire}
            onChange={(e) => onChange({ isRussianEmpire: e.target.checked })}
            disabled={disabled}
            className="rounded border-zinc-300"
          />
          Документ Російської імперії
        </label>
      )}
    </div>
  );
}
