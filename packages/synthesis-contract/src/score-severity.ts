import type { FunctionalScoreRow } from "./types";

export type ScoreBarTheme = "questionnaires" | "tracker";

const MID_TONE: Record<ScoreBarTheme, string> = {
  questionnaires: "bg-brand",
  tracker: "bg-[#2563EB]",
};

function pctSeverityClass(pct: number | null, theme: ScoreBarTheme): string {
  if (pct === null) return "bg-neutral-text-subtle";
  if (pct <= 20) return "bg-dash-teal";
  if (pct <= 40) return MID_TONE[theme];
  if (pct <= 60) return "bg-dash-gold";
  return "bg-dash-coral";
}

function evaSeverityClass(value: number | null, theme: ScoreBarTheme): string {
  if (value === null) return "bg-neutral-text-subtle";
  if (value <= 3) return "bg-dash-teal";
  if (value <= 5) return MID_TONE[theme];
  if (value <= 7) return "bg-dash-gold";
  return "bg-dash-coral";
}

export function severityClassForRow(row: FunctionalScoreRow, theme: ScoreBarTheme): string {
  return row.max === 10 ? evaSeverityClass(row.value, theme) : pctSeverityClass(row.value, theme);
}
