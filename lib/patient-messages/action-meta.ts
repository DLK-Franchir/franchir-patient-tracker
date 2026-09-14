/**
 * Builders purs pour `patient_messages.meta` : valeurs structurées (identifiants,
 * montants, dates ISO, booléens) — jamais de texte libre ni de PHI. Les motifs
 * saisis par le staff restent dans `body`.
 */

import type { ActionId } from '@/lib/workflow-v2'
import type { PatientActionMeta } from './log-action'

export type RefusalKind = 'medical' | 'administrative'

/** Refus « médical » si l'auteur est le réviseur médical, « administratif » sinon (Marcel « passer en mode refusé »). */
export function refusalKindForRole(role: string): RefusalKind {
  return role === 'gilles' ? 'medical' : 'administrative'
}

export function hasReason(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().length > 0
}

export function toNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const value = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Date → ISO 8601 ; chaîne non parsable → null. */
export function toIsoDateOrNull(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const parsed = raw instanceof Date ? raw : new Date(String(raw))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export type WorkflowActionMetaContext = {
  actionId: ActionId
  role: string
  oldStatusCode?: string | null
  newStatusCode?: string | null
  /** `assigned_surgeon_id` lu AVANT l'update. */
  previousSurgeonId?: string | null
  /** Chirurgien effectivement assigné par l'action (assign_surgeon / approve_medical). */
  assignedSurgeonId?: string | null
  /** Recommandations Gilles (approve_medical). */
  recommendedSurgeonIds?: string[]
  previousQuoteAmount?: unknown
  quoteAmount?: unknown
  previousProposedDate?: unknown
  proposedDate?: unknown
  /** Motif / justification saisi (non copié dans meta, seule sa présence est tracée). */
  reason?: unknown
}

/** Meta d'un événement `change-status` : `action_id` + transition + valeurs métier structurées. */
export function buildWorkflowActionMeta(ctx: WorkflowActionMetaContext): PatientActionMeta {
  const meta: PatientActionMeta = { action_id: ctx.actionId }

  if (ctx.newStatusCode) {
    meta.old_status = ctx.oldStatusCode ?? null
    meta.new_status = ctx.newStatusCode
  }

  switch (ctx.actionId) {
    case 'assign_surgeon':
      meta.surgeon_id = ctx.assignedSurgeonId ?? null
      meta.previous_surgeon_id = ctx.previousSurgeonId ?? null
      break

    case 'approve_medical':
      meta.recommended_surgeon_ids = ctx.recommendedSurgeonIds ?? []
      if (ctx.assignedSurgeonId) {
        meta.surgeon_id = ctx.assignedSurgeonId
        meta.previous_surgeon_id = ctx.previousSurgeonId ?? null
      }
      break

    case 'add_budget':
      meta.quote_amount = toNumberOrNull(ctx.quoteAmount)
      meta.previous_quote_amount = toNumberOrNull(ctx.previousQuoteAmount)
      break

    case 'propose_dates':
      meta.proposed_date = toIsoDateOrNull(ctx.proposedDate)
      meta.previous_proposed_date = toIsoDateOrNull(ctx.previousProposedDate)
      break

    case 'confirm_quote':
      meta.quote_amount = toNumberOrNull(ctx.quoteAmount)
      break

    case 'confirm_date':
      meta.proposed_date = toIsoDateOrNull(ctx.proposedDate)
      break

    case 'request_more_info':
    case 'close_case':
    case 'reopen_case':
      meta.has_reason = hasReason(ctx.reason)
      break

    case 'reject_medical':
      meta.has_reason = hasReason(ctx.reason)
      meta.refusal_kind = refusalKindForRole(ctx.role)
      break

    default:
      break
  }

  return meta
}

export type CommercialDataSnapshot = {
  quote_amount?: unknown
  proposed_date?: unknown
}

export type CommercialDataEdit = {
  meta: PatientActionMeta
  fieldsChanged: Array<'quote_amount' | 'proposed_date'>
}

/**
 * Diff PATCH commercial-data. `next` ne contient que les champs envoyés par le
 * client (les champs `undefined` ne sont pas comparés). Retourne null si rien
 * ne change réellement.
 */
export function buildCommercialDataEditMeta(
  previous: CommercialDataSnapshot,
  next: CommercialDataSnapshot,
): CommercialDataEdit | null {
  const fieldsChanged: CommercialDataEdit['fieldsChanged'] = []
  const meta: PatientActionMeta = { action_id: 'edit_commercial_data' }

  if (next.quote_amount !== undefined) {
    const before = toNumberOrNull(previous.quote_amount)
    const after = toNumberOrNull(next.quote_amount)
    if (before !== after) {
      fieldsChanged.push('quote_amount')
      meta.previous_quote_amount = before
      meta.quote_amount = after
    }
  }

  if (next.proposed_date !== undefined) {
    const before = toIsoDateOrNull(previous.proposed_date)
    const after = toIsoDateOrNull(next.proposed_date)
    if (before !== after) {
      fieldsChanged.push('proposed_date')
      meta.previous_proposed_date = before
      meta.proposed_date = after
    }
  }

  if (fieldsChanged.length === 0) return null
  meta.fields_changed = fieldsChanged
  return { meta, fieldsChanged }
}

export type SummaryField = 'clinical_summary' | 'sharepoint_link'

export type SummarySnapshot = Partial<Record<SummaryField, unknown>>

function normalizeText(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * Diff PATCH update-summary : seuls les noms de champs modifiés sont tracés,
 * jamais le contenu (résumé clinique = PHI). Retourne null si rien ne change.
 */
export function buildSummaryEditMeta(
  previous: SummarySnapshot,
  next: SummarySnapshot,
): { meta: PatientActionMeta; fieldsChanged: SummaryField[] } | null {
  const fieldsChanged: SummaryField[] = []
  for (const field of ['clinical_summary', 'sharepoint_link'] as const) {
    if (next[field] === undefined) continue
    if (normalizeText(previous[field]) !== normalizeText(next[field])) {
      fieldsChanged.push(field)
    }
  }
  if (fieldsChanged.length === 0) return null
  return { meta: { action_id: 'edit_summary', fields_changed: fieldsChanged }, fieldsChanged }
}

export function buildDocumentDeletedMeta(doc: {
  id: string
  kind: unknown
  size_bytes: unknown
}): PatientActionMeta {
  return {
    action_id: 'document_deleted',
    document_id: doc.id,
    kind: doc.kind === 'dicom' ? 'dicom' : 'document',
    size_bytes: toNumberOrNull(doc.size_bytes),
  }
}

export function buildQuestionnaireCompletedMeta(params: {
  completedAt: string
  summary: unknown
}): PatientActionMeta {
  return {
    action_id: 'questionnaire_completed',
    completed_at: params.completedAt,
    has_summary: typeof params.summary === 'string' && params.summary.trim().length > 0,
  }
}
