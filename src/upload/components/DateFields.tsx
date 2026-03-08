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

function DateControls({ state, onChange, disabled, variant }: {
  state: DateState;
  onChange: (update: Partial<DateState>) => void;
  disabled?: boolean;
  variant: "mobile" | "desktop";
}) {
  const spanClass = variant === "desktop" ? "col-span-2 input" : "input";

  if (state.dateMode === "single") {
    return (
      <input type="number" inputMode="numeric" value={state.dateFrom}
        onChange={(e) => onChange({ dateFrom: e.target.value })}
        disabled={disabled} placeholder="напр. 1890" className={spanClass} />
    );
  }

  if (state.dateMode === "other") {
    return (
      <input type="text" value={state.dateFrom}
        onChange={(e) => onChange({ dateFrom: e.target.value })}
        disabled={disabled} placeholder="кінець XVII ст., 1870-ті тощо"
        className={spanClass} />
    );
  }

  // range
  const fromInput = (
    <input type="number" inputMode="numeric" value={state.dateFrom}
      onChange={(e) => onChange({ dateFrom: e.target.value })}
      disabled={disabled} placeholder="напр. 1890" className="input" />
  );
  const toInput = (
    <input type="number" inputMode="numeric" value={state.dateTo}
      onChange={(e) => onChange({ dateTo: e.target.value })}
      disabled={disabled} placeholder="напр. 1900" className="input" />
  );

  if (variant === "desktop") {
    return <>{fromInput}{toInput}</>;
  }
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <div className="mb-1 text-sm text-zinc-500">Початкова</div>
        {fromInput}
      </div>
      <div className="flex-1">
        <div className="mb-1 text-sm text-zinc-500">Кінцева</div>
        {toInput}
      </div>
    </div>
  );
}

export default function DateFields({ state, onChange, disabled, label }: Props) {

  function handleModeChange(mode: DateMode) {
    onChange({ dateMode: mode, dateFrom: "", dateTo: "" });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile layout (hidden on sm+) */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          {label && <span className="text-base font-medium text-zinc-700">{label}</span>}
          <Switcher current={state.dateMode} onSelect={handleModeChange} disabled={disabled} />
        </div>
        <DateControls state={state} onChange={onChange} disabled={disabled} variant="mobile" />
      </div>

      {/* Desktop layout (hidden on mobile) */}
      <div className="hidden sm:grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: "auto 1fr 1fr" }}>
        <div className="flex items-end">
          {label && <span className="text-base font-medium text-zinc-700">{label}</span>}
        </div>
        {state.dateMode === "range" ? (
          <>
            <div className="text-sm text-zinc-500">Початкова</div>
            <div className="text-sm text-zinc-500">Кінцева</div>
          </>
        ) : (
          <div className="col-span-2" />
        )}
        <Switcher current={state.dateMode} onSelect={handleModeChange} disabled={disabled} />
        <DateControls state={state} onChange={onChange} disabled={disabled} variant="desktop" />
      </div>

    </div>
  );
}
