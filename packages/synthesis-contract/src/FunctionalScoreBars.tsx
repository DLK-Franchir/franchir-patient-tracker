import type { FunctionalScoreRow } from "./types";
import { severityClassForRow, type ScoreBarTheme } from "./score-severity";

type FunctionalScoreBarsProps = {
  rows: FunctionalScoreRow[];
  theme: ScoreBarTheme;
  emptyMessage?: string;
  labelClassName?: string;
  metaClassName?: string;
  trackClassName?: string;
};

function ScoreBar({
  row,
  theme,
  labelClassName,
  metaClassName,
  trackClassName,
}: {
  row: FunctionalScoreRow;
  theme: ScoreBarTheme;
  labelClassName: string;
  metaClassName: string;
  trackClassName: string;
}) {
  const pct = row.value !== null ? Math.round((row.value / row.max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={labelClassName}>{row.label}</span>
        <span className={metaClassName}>
          {row.value !== null ? `${row.value}/${row.max}` : "—"} · {row.interpretation}
        </span>
      </div>
      <div className={`h-2.5 overflow-hidden rounded-full ${trackClassName}`}>
        <div
          className={`synthesis-bar-animate h-full rounded-full ${severityClassForRow(row, theme)}`}
          style={{ width: row.value !== null ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}

export function FunctionalScoreBars({
  rows,
  theme,
  emptyMessage = "Aucun score renseigné.",
  labelClassName = "text-sm font-semibold text-neutral-text",
  metaClassName = "text-sm text-neutral-text-muted",
  trackClassName = "bg-neutral-surface-muted",
}: FunctionalScoreBarsProps) {
  if (rows.length === 0) {
    return <p className={`${metaClassName} italic`}>{emptyMessage}</p>;
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <ScoreBar
          key={row.id}
          row={row}
          theme={theme}
          labelClassName={labelClassName}
          metaClassName={metaClassName}
          trackClassName={trackClassName}
        />
      ))}
    </div>
  );
}
