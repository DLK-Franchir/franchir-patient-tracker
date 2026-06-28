import {
  formatFormTypesLabel as formatFormTypesLabelShared,
  normalizeDbFormTypes,
  resolveParcoursDisplayLabel,
  type DbFormType,
} from '@franchir/synthesis-contract'

export type QuestionnaireFormType = DbFormType

export type QuestionnaireFormTypePreset = QuestionnaireFormType | 'combined'

/** Normalise et trie (cervical puis lombaire). */
export function normalizeFormTypes(
  types: readonly QuestionnaireFormType[],
): QuestionnaireFormType[] {
  return normalizeDbFormTypes(types)
}

export function formTypesEqual(
  a: readonly QuestionnaireFormType[],
  b: readonly QuestionnaireFormType[],
): boolean {
  const left = normalizeFormTypes([...a])
  const right = normalizeFormTypes([...b])
  return left.length === right.length && left.every((v, i) => v === right[i])
}

export function parseFormTypesInput(input: unknown): QuestionnaireFormType[] | null {
  if (!Array.isArray(input)) return null
  if (input.some((t) => t !== 'cervical' && t !== 'lombaire')) return null
  if (input.length === 0) return null
  return normalizeFormTypes(input as QuestionnaireFormType[])
}

/** Valeur DB ou API → form_types canoniques (filtre valeurs inconnues, défaut cervical). */
export function coercePatientFormTypes(raw: unknown): QuestionnaireFormType[] {
  const parsed = parseFormTypesInput(raw)
  if (parsed) return parsed
  if (Array.isArray(raw)) {
    const filtered = raw.filter(
      (t): t is QuestionnaireFormType => t === 'cervical' || t === 'lombaire',
    )
    if (filtered.length > 0) return normalizeFormTypes(filtered)
  }
  return ['cervical']
}

export function formTypesForPreset(preset: QuestionnaireFormTypePreset): QuestionnaireFormType[] {
  if (preset === 'combined') return ['cervical', 'lombaire']
  return [preset]
}

export function formatFormTypesLabel(types: readonly QuestionnaireFormType[]): string {
  return formatFormTypesLabelShared(types)
}

export { resolveParcoursDisplayLabel }
