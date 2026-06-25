export type QuestionnaireFormType = 'cervical' | 'lombaire'

export type QuestionnaireFormTypePreset = QuestionnaireFormType | 'combined'

const ORDER: Record<QuestionnaireFormType, number> = {
  cervical: 0,
  lombaire: 1,
}

/** Normalise et trie (cervical puis lombaire). */
export function normalizeFormTypes(
  types: readonly QuestionnaireFormType[],
): QuestionnaireFormType[] {
  const unique = [...new Set(types)]
  return unique.sort((a, b) => ORDER[a] - ORDER[b])
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
  const filtered = input.filter(
    (t): t is QuestionnaireFormType => t === 'cervical' || t === 'lombaire',
  )
  if (filtered.length === 0) return null
  return normalizeFormTypes(filtered)
}

export function formTypesForPreset(preset: QuestionnaireFormTypePreset): QuestionnaireFormType[] {
  if (preset === 'combined') return ['cervical', 'lombaire']
  return [preset]
}

export function formatFormTypesLabel(types: readonly QuestionnaireFormType[]): string {
  const norm = normalizeFormTypes([...types])
  if (norm.length === 2) return 'Cervical + lombaire'
  return norm[0] === 'lombaire' ? 'Lombaire' : 'Cervical'
}
