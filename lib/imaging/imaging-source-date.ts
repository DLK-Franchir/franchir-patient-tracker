/**
 * Date d'examen lue dans le DICOM (Acquisition / Study), jamais la date d'import.
 * Clé `YYYY-MM-DD` sans fuseau : le tag est une date calendaire, pas un instant UTC.
 */

const MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const

export type ImagingDateFilter = 'all' | 'undated' | `date:${string}`
export type ImagingDateSort = 'newest' | 'oldest'

export type ImagingDateOption = {
  id: ImagingDateFilter
  label: string
}

export function sourceDateKey(acquisitionDatetime: string | null | undefined): string | null {
  const digits = (acquisitionDatetime ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

/** Première date d'examen d'une série (la plus ancienne parmi les coupes datées). */
export function imagingSourceDate(values: Array<string | null | undefined>): string | null {
  const keys = values
    .map((value) => sourceDateKey(value))
    .filter((key): key is string => key !== null)
  if (keys.length === 0) return null
  return keys.sort()[0] ?? null
}

export function formatSourceDateLabel(key: string): string {
  const [year, month, day] = key.split('-')
  const monthLabel = MONTHS_FR[Number(month) - 1]
  if (!year || !monthLabel || !day) return key
  return `${Number(day)} ${monthLabel} ${year}`
}

export function imagingDateFilterOptions(dates: Array<string | null>): ImagingDateOption[] {
  const unique = [...new Set(dates.filter((date): date is string => Boolean(date)))].sort().reverse()
  const options: ImagingDateOption[] = [{ id: 'all', label: 'Toutes' }]
  for (const key of unique) {
    options.push({ id: `date:${key}`, label: formatSourceDateLabel(key) })
  }
  if (dates.some((date) => !date)) {
    options.push({ id: 'undated', label: 'Sans date' })
  }
  return options
}

export function filterImagingBySourceDate<T extends { sourceDate: string | null }>(
  items: T[],
  filter: ImagingDateFilter,
  sort: ImagingDateSort,
): T[] {
  const wanted = filter.startsWith('date:') ? filter.slice('date:'.length) : null
  const filtered = items.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'undated') return item.sourceDate === null
    return item.sourceDate === wanted
  })
  const direction = sort === 'newest' ? -1 : 1
  return filtered.sort((a, b) => {
    if (a.sourceDate === b.sourceDate) return 0
    if (!a.sourceDate) return 1
    if (!b.sourceDate) return -1
    return a.sourceDate < b.sourceDate ? -direction : direction
  })
}
