export type FunctionalScoreRow = {
  id: string;
  label: string;
  value: number | null;
  max: number;
  interpretation: string;
};

export type OrientationSummaryField = {
  id: string;
  label: string;
  value: string;
};

export type DbFormType = "cervical" | "lombaire";

export type SpineRegionKind = "cervical" | "lumbar";
