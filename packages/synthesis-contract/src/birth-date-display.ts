/** Parse birth dates stored as JJ/MM/AAAA (questionnaire) or ISO (DB prefill). */
export function parsePatientBirthDate(raw: string | undefined | null): Date | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const frMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (frMatch) {
    const day = Number(frMatch[1]);
    const month = Number(frMatch[2]);
    const year = Number(frMatch[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return null;
    }
    return d;
  }
  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function formatBirthDateFr(raw: string | undefined | null): string | null {
  const d = parsePatientBirthDate(raw);
  if (!d) return raw?.trim() || null;
  return d.toLocaleDateString("fr-CA", { day: "2-digit", month: "long", year: "numeric" });
}

export function calcAgeFromBirthDate(raw: string | undefined | null): string | null {
  const d = parsePatientBirthDate(raw);
  if (!d) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age -= 1;
  }
  return age >= 0 ? `${age} ans` : null;
}

/** Canonical raw key from flat answers (questionnaire + legacy alias). */
export function resolveBirthDateRaw(answers: Record<string, string | undefined>): string | undefined {
  return (answers.birth_date ?? answers.identity_birth_date)?.trim() || undefined;
}
