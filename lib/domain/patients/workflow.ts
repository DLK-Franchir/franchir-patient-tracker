import type {
  ActionAuthorizationResult,
  PatientPermissionContext,
  WorkflowPermissionContext,
} from '@/lib/domain/patients/types'

const WORKFLOW_LOCKS = ['workflow_actions'] as const
const CASE_LOCKS = ['workflow_actions', 'patient_summary', 'commercial_data', 'messages'] as const

function deny(
  reason: string,
  fieldsLocked: ActionAuthorizationResult['fieldsLocked'] = [...WORKFLOW_LOCKS]
): ActionAuthorizationResult {
  return { allowed: false, reason, fieldsLocked }
}

function allow(): ActionAuthorizationResult {
  return { allowed: true }
}

export function canRolePerformWorkflowActionResult({
  role,
  actionId,
  globalStatus,
  quoteAccepted = false,
  dateAccepted = false,
}: WorkflowPermissionContext): ActionAuthorizationResult {
  if (actionId === 'reopen_case') {
    if (globalStatus !== 'rejected') return deny("Le dossier n'est pas refusé.")
    return role === 'admin' ? allow() : deny('Seul un administrateur peut réouvrir ce dossier.')
  }
  if (globalStatus === 'draft') {
    if (actionId !== 'submit_to_medical') return deny('Action indisponible à ce statut.')
    return role === 'marcel' || role === 'admin'
      ? allow()
      : deny('Seuls Marcel ou Admin peuvent soumettre le dossier.')
  }
  if (globalStatus === 'medical_more_info') {
    if (actionId !== 'resubmit_to_medical') return deny('Action indisponible à ce statut.')
    return role === 'marcel' || role === 'admin'
      ? allow()
      : deny('Seuls Marcel ou Admin peuvent renvoyer le dossier.')
  }
  if (globalStatus === 'medical_review') {
    if (!['approve_medical', 'request_more_info', 'reject_medical'].includes(actionId)) {
      return deny('Action indisponible à ce statut.')
    }
    return role === 'gilles' || role === 'admin'
      ? allow()
      : deny('Seuls Gilles ou Admin peuvent décider sur la revue médicale.')
  }
  if (globalStatus === 'commercial_in_progress') {
    if (actionId === 'confirm_quote') {
      if (quoteAccepted) return deny('Le devis est déjà confirmé.')
      return role === 'marcel' || role === 'admin'
        ? allow()
        : deny('Seuls Marcel ou Admin peuvent confirmer le devis.')
    }
    if (actionId === 'confirm_date') {
      if (dateAccepted) return deny('La date est déjà confirmée.')
      return role === 'marcel' || role === 'admin'
        ? allow()
        : deny('Seuls Marcel ou Admin peuvent confirmer la date.')
    }
    if (['add_budget', 'propose_dates'].includes(actionId)) {
      return role === 'franchir' || role === 'admin'
        ? allow()
        : deny('Seuls Franchir ou Admin peuvent gérer la partie commerciale.')
    }
  }
  return deny('Action non autorisée pour ce rôle et ce statut.')
}

export function canRolePerformWorkflowAction(context: WorkflowPermissionContext): boolean {
  return canRolePerformWorkflowActionResult(context).allowed
}

export function canPerformAction({
  role,
  actionId,
  globalStatus,
  quoteAccepted,
  dateAccepted,
}: PatientPermissionContext): ActionAuthorizationResult {
  if (actionId === 'create_patient') {
    return role === 'marcel' || role === 'franchir' || role === 'admin'
      ? allow()
      : deny('Seuls Marcel, Franchir ou Admin peuvent créer un dossier.', ['patient_summary'])
  }
  if (actionId === 'edit_patient_summary') {
    if (globalStatus === 'rejected' && role !== 'admin') {
      return deny('Ce dossier est en lecture seule.', [...CASE_LOCKS])
    }
    if (role === 'admin') return allow()
    if (role === 'marcel' && globalStatus === 'medical_more_info') return allow()
    return deny("Le résumé n'est modifiable que par Marcel en statut à compléter.", [
      'patient_summary',
    ])
  }
  if (actionId === 'edit_commercial_data') {
    if (globalStatus === 'rejected' && role !== 'admin') {
      return deny('Ce dossier est en lecture seule.', [...CASE_LOCKS])
    }
    return role === 'marcel' || role === 'franchir' || role === 'admin'
      ? allow()
      : deny('Vous ne pouvez pas modifier les données commerciales.', ['commercial_data'])
  }
  if (actionId === 'post_message') {
    if (globalStatus === 'rejected' && role !== 'admin') {
      return deny('Ce dossier est en lecture seule.', [...CASE_LOCKS])
    }
    return allow()
  }
  if (!globalStatus) return deny('Le statut du dossier est requis.')
  return canRolePerformWorkflowActionResult({
    role,
    actionId,
    globalStatus,
    quoteAccepted,
    dateAccepted,
  })
}
