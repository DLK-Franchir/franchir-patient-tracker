export type GlobalStatus = 
  | 'draft'
  | 'medical_review'
  | 'medical_more_info'
  | 'rejected'
  | 'commercial_in_progress'
  | 'scheduled'

export type UserRole = 'marcel' | 'franchir' | 'gilles' | 'admin'

export type MessageTopic = 'medical' | 'commercial' | 'system'

export type ActionId =
  | 'submit_to_medical'
  | 'resubmit_to_medical'
  | 'approve_medical'
  | 'request_more_info'
  | 'reject_medical'
  | 'confirm_quote'
  | 'confirm_date'
  | 'reopen_case'
  | 'add_budget'
  | 'propose_dates'

export const SURGEONS = [
  'Doan Co-Minh',
  'Simon Teyssedou',
  'Jean-Patrick Rakover',
  'David BRAUGE',
  'Robin ARVIEU',
]

export interface WorkflowStatus {
  id: string
  code?: string
  label?: string
  name?: string
  key?: string
}

export function globalStatusFromWorkflowStatus(status: WorkflowStatus | null | undefined): GlobalStatus {
  if (!status) {
    console.log('⚠️ [STATUS MAPPING] No status provided, defaulting to draft')
    return 'draft'
  }

  // PRIORITÉ 1: Utiliser le code (clé stable)
  if (status.code) {
    const code = status.code.toLowerCase()

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [STATUS MAPPING] code:', status.code, 'label:', status.label)
    }

    // Mapping strict par code
    if (code === 'draft' || code === 'prospect' || code === 'created') {
      return 'draft'
    }
    if (code === 'medical_review' || code === 'pending_medical' || code === 'awaiting_medical') {
      return 'medical_review'
    }
    if (code === 'need_info' || code === 'medical_more_info' || code === 'incomplete') {
      return 'medical_more_info'
    }
    if (code === 'rejected_medical' || code === 'rejected' || code === 'refused') {
      return 'rejected'
    }
    if (code === 'surgery_scheduled' || code === 'scheduled' || code === 'confirmed') {
      return 'scheduled'
    }
    if (code === 'validated_medical' || code === 'approved_medical' || code === 'commercial' || code === 'quote_pending' || code === 'awaiting_quote') {
      return 'commercial_in_progress'
    }
  }

  // PRIORITÉ 2: Fallback sur label/name (keywords)
  const text = (
    status.label ||
    status.name ||
    status.key ||
    ''
  ).toLowerCase()

  if (text.includes('créé') || text.includes('brouillon') || text.includes('dossier') || text.includes('prospect')) {
    return 'draft'
  }

  if (text.includes('revue médicale') || (text.includes('médicale') && !text.includes('validé'))) {
    return 'medical_review'
  }

  if (
    text.includes('à compléter') ||
    text.includes('incomplet') ||
    text.includes('infos supplémentaires') ||
    text.includes('complément')
  ) {
    return 'medical_more_info'
  }

  if (text.includes('refus') || text.includes('rejet')) {
    return 'rejected'
  }

  if (
    text.includes('programmé') ||
    text.includes('confirmé') ||
    text.includes('acompte')
  ) {
    return 'scheduled'
  }

  if (
    text.includes('validé') ||
    text.includes('devis') ||
    text.includes('date') ||
    text.includes('programmation') ||
    text.includes('chirurgie') ||
    text.includes('chirurgien') ||
    text.includes('commercial')
  ) {
    return 'commercial_in_progress'
  }

  console.warn('⚠️ [STATUS MAPPING] No match found for status:', status, '- defaulting to draft')
  return 'draft'
}

export function getGuidance(globalStatus: GlobalStatus, role: UserRole): string {
  if (globalStatus === 'rejected') {
    return role === 'admin'
      ? 'Ce dossier est refusé. Vous pouvez le réouvrir si nécessaire.'
      : 'Ce dossier a été refusé et est en lecture seule.'
  }

  if (role === 'marcel') {
    if (globalStatus === 'draft') {
      return 'Soumettez ce dossier à la validation médicale du Dr Dubois.'
    }
    if (globalStatus === 'medical_more_info') {
      return 'Le Dr Dubois demande des informations complémentaires. Consultez les messages.'
    }
    if (globalStatus === 'commercial_in_progress') {
      return 'Confirmez le devis et la date proposée pour finaliser le dossier.'
    }
    if (globalStatus === 'scheduled') {
      return 'Le dossier est programmé. Aucune action requise.'
    }
    return 'Le dossier est en cours de traitement.'
  }

  if (role === 'gilles') {
    if (globalStatus === 'medical_review') {
      return 'Examinez le dossier et prenez une décision médicale.'
    }
    if (globalStatus === 'medical_more_info') {
      return 'En attente de compléments d\'information de Marcel.'
    }
    return 'Aucune action médicale requise pour le moment.'
  }

  if (role === 'franchir') {
    if (globalStatus === 'commercial_in_progress') {
      return 'Gérez le devis et proposez des dates de chirurgie.'
    }
    return 'Suivez l\'évolution du dossier.'
  }

  if (role === 'admin') {
    return 'Vous avez accès complet à toutes les actions.'
  }

  return 'Suivez l\'évolution du dossier.'
}

export interface Action {
  id: ActionId
  label: string
  description?: string
  variant: 'primary' | 'secondary' | 'danger'
  targetGlobalStatus: GlobalStatus | 'stay'
  requiresInput?: {
    type: 'surgeons' | 'message' | 'justification' | 'budget' | 'dates'
    label: string
    required: boolean
  }[]
}

export interface AvailableActions {
  primaryAction?: Action
  secondaryActions: Action[]
  futureSteps: Array<{
    label: string
    reason: string
  }>
}

export function getAvailableActions({
  globalStatus,
  role,
  quoteAccepted = false,
  dateAccepted = false,
}: {
  globalStatus: GlobalStatus
  role: UserRole
  quoteAccepted?: boolean
  dateAccepted?: boolean
}): AvailableActions {
  console.log('🔍 [getAvailableActions] Called with:', { globalStatus, role, quoteAccepted, dateAccepted })

  const result: AvailableActions = {
    secondaryActions: [],
    futureSteps: [],
  }

  if (globalStatus === 'rejected') {
    if (role === 'admin') {
      result.primaryAction = {
        id: 'reopen_case',
        label: 'Réouvrir le dossier',
        variant: 'primary',
        targetGlobalStatus: 'draft',
        requiresInput: [
          {
            type: 'message',
            label: 'Raison de la réouverture',
            required: true,
          },
        ],
      }
    }
    console.log('🔍 [getAvailableActions] Status is rejected, returning:', result)
    return result
  }

  if (role === 'marcel') {
    console.log('🔍 [getAvailableActions] Role is marcel, checking status...')
    if (globalStatus === 'draft') {
      result.primaryAction = {
        id: 'submit_to_medical',
        label: 'Soumettre à validation médicale (Dr Dubois)',
        description: 'Envoyer le dossier au Dr Dubois pour revue médicale',
        variant: 'primary',
        targetGlobalStatus: 'medical_review',
      }
      result.futureSteps = [
        { label: 'Validation médicale', reason: 'Après soumission' },
        { label: 'Proposition commerciale', reason: 'Après validation' },
        { label: 'Confirmation', reason: 'Après acceptation devis et date' },
      ]
    } else if (globalStatus === 'medical_more_info') {
      result.primaryAction = {
        id: 'resubmit_to_medical',
        label: 'Renvoyer à validation médicale (Dr Dubois)',
        description: 'Renvoyer le dossier complété au Dr Dubois pour revue médicale',
        variant: 'primary',
        targetGlobalStatus: 'medical_review',
        requiresInput: [
          {
            type: 'message',
            label: 'Informations complémentaires fournies',
            required: false,
          },
        ],
      }
    } else if (globalStatus === 'commercial_in_progress') {
      const actions: Action[] = []

      if (!quoteAccepted) {
        actions.push({
          id: 'confirm_quote',
          label: 'Confirmer le devis',
          variant: 'primary',
          targetGlobalStatus: 'stay',
        })
      }

      if (!dateAccepted) {
        actions.push({
          id: 'confirm_date',
          label: 'Confirmer la date',
          variant: 'primary',
          targetGlobalStatus: 'stay',
        })
      }

      if (actions.length > 0) {
        result.primaryAction = actions[0]
        result.secondaryActions = actions.slice(1)
      }
    }
  }

  if (role === 'gilles' || role === 'admin') {
    console.log('🔍 [getAvailableActions] Role is gilles or admin, checking status...')
    if (globalStatus === 'medical_review') {
      console.log('🔍 [getAvailableActions] Status is medical_review, adding actions for gilles/admin')
      result.primaryAction = {
        id: 'approve_medical',
        label: 'Valider médicalement',
        description: 'Approuver le dossier et recommander des chirurgiens',
        variant: 'primary',
        targetGlobalStatus: 'commercial_in_progress',
        requiresInput: [
          {
            type: 'surgeons',
            label: 'Chirurgiens recommandés (1 ou 2)',
            required: true,
          },
          {
            type: 'message',
            label: 'Commentaire médical',
            required: false,
          },
        ],
      }
      result.secondaryActions = [
        {
          id: 'request_more_info',
          label: 'Demander un complément',
          variant: 'secondary',
          targetGlobalStatus: 'medical_more_info',
          requiresInput: [
            {
              type: 'message',
              label: 'Informations manquantes',
              required: true,
            },
          ],
        },
        {
          id: 'reject_medical',
          label: 'Refuser le dossier',
          variant: 'danger',
          targetGlobalStatus: 'rejected',
          requiresInput: [
            {
              type: 'justification',
              label: 'Justification du refus',
              required: true,
            },
          ],
        },
      ]
    } else {
      console.log('🔍 [getAvailableActions] Role is gilles or admin but status is not medical_review:', globalStatus)
    }
  }

  if (role === 'franchir' || role === 'admin') {
    console.log('🔍 [getAvailableActions] Role is franchir or admin, checking status...')
    if (globalStatus === 'commercial_in_progress') {
      console.log('🔍 [getAvailableActions] Status is commercial_in_progress, adding franchir/admin actions')
      result.secondaryActions.push(
        {
          id: 'add_budget',
          label: 'Renseigner budget indicatif',
          variant: 'secondary',
          targetGlobalStatus: 'stay',
          requiresInput: [
            {
              type: 'budget',
              label: 'Montant et conditions',
              required: true,
            },
          ],
        },
        {
          id: 'propose_dates',
          label: 'Proposer des dates',
          variant: 'secondary',
          targetGlobalStatus: 'stay',
          requiresInput: [
            {
              type: 'dates',
              label: 'Dates proposées (1 à 3)',
              required: true,
            },
          ],
        }
      )
    }
  }

  console.log('🔍 [getAvailableActions] Returning result:', result)
  return result
}
