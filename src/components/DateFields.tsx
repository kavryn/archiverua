"use client";

export type DateMode = "single" | "range" | "other";

export interface DateState {
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  state: DateState;
  onChange: (update: Partial<DateState>) => void;
  disabled?: boolean;
  label?: string;
}

export function getEndYear(state: DateState): number | null {
  const endStr = state.dateMode === "single" ? state.dateFrom : state.dateTo;
  const match = endStr.match(/\d{4}/);
  if (!match) return null;
  return parseInt(match[0], 10);
}


const MODE_LABELS: { mode: DateMode; label: string }[] = [
  { mode: "single", label: "Одна дата" },
  { mode: "range", label: "Діапазон" },
  { mode: "other", label: "Інше" },
];

function Switcher({
  current,
  onSelect,
  disabled,
}: {
  current: DateMode;
  onSelect: (mode: DateMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-300">
      {MODE_LABELS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onSelect(mode)}
          disabled={disabled}
          className={`h-full px-3 text-base transition-colors disabled:cursor-not-allowed ${
            current === mode
              ? "bg-blue-600 text-white"
              : "bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function DateFields({ state, onChange, disabled, label }: Props) {

  function handleModeChange(mode: DateMode) {
    onChange({ dateMode: mode, dateFrom: "", dateTo: "" });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 2-row grid for all modes: row 1 = labels, row 2 = controls */}
      <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: "auto 1fr 1fr" }}>
        {/* Labels row */}
        <div className="flex items-end">
          {label && (
            <span className="text-base font-medium text-zinc-700">{label}</span>
          )}
        </div>
        {state.dateMode === "range" ? (
          <>
            <div className="text-sm text-zinc-500">Початкова</div>
            <div className="text-sm text-zinc-500">Кінцева</div>
          </>
        ) : (
          <div className="col-span-2" />
        )}

        {/* Controls row */}
        <Switcher current={state.dateMode} onSelect={handleModeChange} disabled={disabled} />
        {state.dateMode === "range" ? (
          <>
            <input
              type="text"
              value={state.dateFrom}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
              disabled={disabled}
              placeholder="напр. 1890"
              className="input"
            />
            <input
              type="text"
              value={state.dateTo}
              onChange={(e) => onChange({ dateTo: e.target.value })}
              disabled={disabled}
              placeholder="напр. 1900"
              className="input"
            />
          </>
        ) : (
          <input
            type="text"
            value={state.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            disabled={disabled}
            placeholder={state.dateMode === "other" ? "кінець XVII ст., пр. 1870-ті тощо" : "напр. 1890"}
            className="col-span-2 input"
          />
        )}
      </div>

    </div>
  );
}
