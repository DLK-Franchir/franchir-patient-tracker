import type { DbFormType, SpineRegionKind } from "./types";

const FORM_TYPE_ORDER: Record<DbFormType, number> = {
  cervical: 0,
  lombaire: 1,
};

export function normalizeDbFormTypes(types: readonly DbFormType[]): DbFormType[] {
  const unique = [...new Set(types)];
  return unique.sort((a, b) => FORM_TYPE_ORDER[a] - FORM_TYPE_ORDER[b]);
}

export function formatFormTypesLabel(types: readonly DbFormType[]): string {
  const norm = normalizeDbFormTypes(types);
  if (norm.length === 2) return "Cervical + Lombaire";
  return norm[0] === "lombaire" ? "Lombaire" : "Cervical";
}

export function formatSpineRegionKindsLabel(regions: readonly SpineRegionKind[]): string {
  if (regions.length === 2) return "Cervical + Lombaire";
  return regions[0] === "lumbar" ? "Lombaire" : "Cervical";
}

export function formTypesFromSpineRegionLabel(label: string): DbFormType[] | null {
  const trimmed = label.trim();
  if (trimmed === "Cervical + Lombaire") return ["cervical", "lombaire"];
  if (trimmed === "Lombaire") return ["lombaire"];
  if (trimmed === "Cervical") return ["cervical"];
  return null;
}

export function resolveParcoursDisplayLabel(options: {
  spineRegionLabel?: string | null;
  formTypes?: readonly DbFormType[];
}): string {
  const fromPreview = options.spineRegionLabel?.trim();
  if (fromPreview) return fromPreview;
  if (options.formTypes?.length) return formatFormTypesLabel(options.formTypes);
  return "Cervical";
}
