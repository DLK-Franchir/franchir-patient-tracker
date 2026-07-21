/** Code stable en base (`workflow_statuses.code`). */
export const CASE_CLOSED_STATUS_CODE = 'case_closed'

/** Présentation liste dashboard pour dossiers archivés. */
export const CLOSED_DOSSIER_GREY = '#9CA3AF'

export type GlobalStatus = 
  | 'draft'
  | 'medical_review'
  | 'medical_more_info'
  | 'rejected'
  | 'commercial_in_progress'
  | 'scheduled'
  | 'closed'

export function isClosedGlobalStatus(status: GlobalStatus): boolean {
  return status === 'closed'
}

export type UserRole = 'marcel' | 'franchir' | 'gilles' | 'admin'

export type MessageTopic = 'medical' | 'commercial' | 'system'

export type ActionId =
  | 'submit_to_medical'
  | 'resubmit_to_medical'
  | 'approve_medical'
  | 'assign_surgeon'
  | 'request_more_info'
  | 'reject_medical'
  | 'confirm_quote'
  | 'confirm_date'
  | 'reopen_case'
  | 'close_case'
  | 'add_budget'
  | 'propose_dates'

/** Dossier validé médicalement (assignation chirurgien autorisée). */
export function isMedicallyValidated(globalStatus: GlobalStatus): boolean {
  return globalStatus === 'commercial_in_progress' || globalStatus === 'scheduled'
}

/** Garde serveur : quel rôle peut exécuter quelle action workflow. */
export function canPerformWorkflowAction(
  role: UserRole,
  actionId: ActionId,
  globalStatus?: GlobalStatus,
): boolean {
  if (globalStatus === 'closed' && actionId !== 'reopen_case') {
    return false
  }

  switch (actionId) {
    case 'approve_medical':
    case 'request_more_info':
      return role === 'gilles' || role === 'admin'
    case 'reject_medical':
      // Gilles (avis médical) ; Marcel/admin peuvent aussi passer en mode refusé
      // (retrait / non-éligibilité) — le dossier reste listé sous « Refusé ».
      return role === 'gilles' || role === 'marcel' || role === 'admin'
    case 'submit_to_medical':
    case 'resubmit_to_medical':
    case 'confirm_quote':
    case 'confirm_date':
      return role === 'marcel' || role === 'admin'
    case 'add_budget':
    case 'propose_dates':
      return role === 'franchir' || role === 'admin'
    case 'assign_surgeon':
      if (globalStatus && !isMedicallyValidated(globalStatus)) {
        return false
      }
      return role === 'marcel' || role === 'franchir' || role === 'admin'
    case 'reopen_case':
      // Aligné README + usage opérationnel : réactivation hors terminal.
      return role === 'admin' || role === 'marcel' || role === 'franchir'
    case 'close_case':
      if (globalStatus === 'rejected' || globalStatus === 'closed') {
        return false
      }
      return role === 'marcel' || role === 'franchir' || role === 'admin'
    default:
      return false
  }
}

export type ActionStatus = 'urgent' | 'available' | 'in_progress' | 'completed'

export interface WorkflowStatus {
  id: string
  code?: string
  label?: string
  name?: string
  key?: string
}

export function globalStatusFromWorkflowStatus(status: WorkflowStatus | null | undefined): GlobalStatus {
  if (!status) {
    return 'draft'
  }

  // PRIORITÉ 1: Utiliser le code (clé stable)
  if (status.code) {
    const code = status.code.toLowerCase()

    // Mapping strict par code
    if (code === 'draft' || code === 'prospect' || code === 'created' || code === 'prospect_created') {
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
    if (code === 'case_closed' || code === 'closed' || code === 'archived') {
      return 'closed'
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

export type WorkflowHandoff = {
  /** Rôle qui doit agir maintenant (null si l'utilisateur courant agit). */
  pendingActor: UserRole | null
  pendingActorLabel: string
  /** Message court pour la zone « Prochaine étape ». */
  guidance: string
  /** Détail affiché quand l'utilisateur attend une action d'un autre rôle. */
  waitingDetail?: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  marcel: 'Marcel (coordinateur)',
  gilles: 'Dr Dubois (revue médicale)',
  franchir: 'Franchir (commercial)',
  admin: 'Administrateur',
}

export function getWorkflowHandoff(globalStatus: GlobalStatus, role: UserRole): WorkflowHandoff {
  if (globalStatus === 'closed') {
    return {
      pendingActor: null,
      pendingActorLabel: '',
      guidance: 'Dossier fermé — historique conservé, aucune action en cours.',
    }
  }

  if (globalStatus === 'rejected') {
    const canReopen = role === 'admin' || role === 'marcel' || role === 'franchir'
    const guidance = canReopen
      ? 'Ce dossier est refusé. Vous pouvez le réouvrir si nécessaire.'
      : 'Ce dossier a été refusé et est en lecture seule.'
    return {
      pendingActor: canReopen ? role : null,
      pendingActorLabel: ROLE_LABELS[role] ?? ROLE_LABELS.admin,
      guidance,
    }
  }

  if (globalStatus === 'draft') {
    if (role === 'marcel' || role === 'admin') {
      return {
        pendingActor: role,
        pendingActorLabel: ROLE_LABELS.marcel,
        guidance: 'Soumettez ce dossier à la validation médicale du Dr Dubois.',
      }
    }
    return {
      pendingActor: 'marcel',
      pendingActorLabel: ROLE_LABELS.marcel,
      guidance: 'En attente de soumission à la revue médicale.',
      waitingDetail: 'Marcel doit soumettre le dossier au Dr Dubois pour validation.',
    }
  }

  if (globalStatus === 'medical_review') {
    if (role === 'gilles' || role === 'admin') {
      return {
        pendingActor: role,
        pendingActorLabel: ROLE_LABELS.gilles,
        guidance: 'Examinez le dossier et prenez une décision médicale.',
      }
    }
    return {
      pendingActor: 'gilles',
      pendingActorLabel: ROLE_LABELS.gilles,
      guidance: 'En attente de la revue médicale du Dr Dubois.',
      waitingDetail:
        'Le Dr Dubois va valider, demander un complément ou refuser le dossier. Vous serez notifié de sa décision.',
    }
  }

  if (globalStatus === 'medical_more_info') {
    if (role === 'marcel' || role === 'admin') {
      return {
        pendingActor: role,
        pendingActorLabel: ROLE_LABELS.marcel,
        guidance:
          'Complétez le dossier (messages ci-contre) puis renvoyez-le au Dr Dubois avec le bouton ci-dessous.',
      }
    }
    return {
      pendingActor: 'marcel',
      pendingActorLabel: ROLE_LABELS.marcel,
      guidance: 'En attente des compléments d\'information de Marcel.',
      waitingDetail:
        'Marcel doit compléter le dossier et le renvoyer à validation. Vous recevrez une notification pour reprendre la revue médicale.',
    }
  }

  if (globalStatus === 'commercial_in_progress') {
    if (role === 'marcel' || role === 'admin') {
      return {
        pendingActor: role,
        pendingActorLabel: ROLE_LABELS.marcel,
        guidance: 'Confirmez le devis et la date proposée pour finaliser le dossier.',
      }
    }
    if (role === 'franchir') {
      return {
        pendingActor: role,
        pendingActorLabel: ROLE_LABELS.franchir,
        guidance: 'Gérez le devis et proposez des dates de chirurgie.',
      }
    }
    return {
      pendingActor: null,
      pendingActorLabel: ROLE_LABELS.marcel,
      guidance: 'Phase commerciale en cours (devis et planification).',
      waitingDetail: 'Marcel et Franchir finalisent le devis et la date de chirurgie.',
    }
  }

  if (globalStatus === 'scheduled') {
    return {
      pendingActor: null,
      pendingActorLabel: '',
      guidance: 'Le dossier est programmé. Aucune action requise.',
    }
  }

  return {
    pendingActor: null,
    pendingActorLabel: '',
    guidance: 'Suivez l\'évolution du dossier.',
  }
}

export function isWaitingOnOther(handoff: WorkflowHandoff, userRole: UserRole): boolean {
  if (!handoff.waitingDetail) {
    return false
  }
  // pendingActor null : attente collective (ex. Gilles en phase commerciale).
  if (handoff.pendingActor === null) {
    return true
  }
  return handoff.pendingActor !== userRole
}

/** @deprecated Préférer getWorkflowHandoff — conservé pour compatibilité. */
export function getGuidance(globalStatus: GlobalStatus, role: UserRole): string {
  return getWorkflowHandoff(globalStatus, role).guidance
}

export interface Action {
  id: ActionId
  label: string
  description?: string
  variant: 'primary' | 'secondary' | 'danger'
  targetGlobalStatus: GlobalStatus | 'stay'
  actionStatus?: ActionStatus
  /** Visible mais non cliquable (ex. assignation avant validation médicale). */
  disabled?: boolean
  disabledReason?: string
  requiresInput?: {
    type: 'surgeons' | 'surgeon_select' | 'message' | 'justification' | 'budget' | 'dates'
    label: string
    required: boolean
  }[]
}

export interface AvailableActions {
  primaryAction?: Action
  secondaryActions: Action[]
  completedActions: Action[]
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
  const result: AvailableActions = {
    secondaryActions: [],
    completedActions: [],
    futureSteps: [],
  }

  if (globalStatus === 'rejected' || globalStatus === 'closed') {
    if (role === 'admin' || role === 'marcel' || role === 'franchir') {
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
    return result
  }

  if (role === 'marcel' || role === 'admin') {
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
      result.futureSteps = [
        { label: 'Revue médicale (Dr Dubois)', reason: 'Après renvoi du dossier complété' },
        { label: 'Proposition commerciale', reason: 'Après validation médicale' },
      ]
      if (role === 'marcel') {
        result.secondaryActions.push({
          id: 'reject_medical',
          label: 'Passer en mode refusé',
          description: 'Retirer le dossier du circuit — reste visible sous Refusé, réactivable ensuite',
          variant: 'danger',
          targetGlobalStatus: 'rejected',
          requiresInput: [
            {
              type: 'justification',
              label: 'Motif du refus',
              required: true,
            },
          ],
        })
      }
    } else if (globalStatus === 'medical_review') {
      result.futureSteps = [
        { label: 'Décision médicale', reason: 'En cours chez le Dr Dubois' },
      ]
      // Coordinateur : peut retirer le dossier (mode refusé) sans attendre Gilles.
      if (role === 'marcel') {
        result.secondaryActions.push({
          id: 'reject_medical',
          label: 'Passer en mode refusé',
          description: 'Retirer le dossier du circuit — reste visible sous Refusé, réactivable ensuite',
          variant: 'danger',
          targetGlobalStatus: 'rejected',
          requiresInput: [
            {
              type: 'justification',
              label: 'Motif du refus',
              required: true,
            },
          ],
        })
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

      // Coordinateur / admin : retrait possible aussi en phase commerciale
      // (devis/date pas encore saisis — panneau sinon perçu comme « vide »).
      if (role === 'marcel' || role === 'admin') {
        result.secondaryActions.push({
          id: 'reject_medical',
          label: 'Passer en mode refusé',
          description:
            'Retirer le dossier du circuit — reste visible sous Refusé, réactivable ensuite',
          variant: 'danger',
          targetGlobalStatus: 'rejected',
          requiresInput: [
            {
              type: 'justification',
              label: 'Motif du refus',
              required: true,
            },
          ],
        })
      }
    }
  }

  if (role === 'gilles' || role === 'admin') {
    if (globalStatus === 'medical_review') {
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
    }
  }

  if (role === 'franchir' || role === 'admin') {
    if (globalStatus === 'commercial_in_progress') {
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

  // Étape 3 (D6) — Assignation chirurgien via action workflow (sidebar Actions
  // disponibles). Gilles recommande des noms dans approve_medical ; l'assignation
  // réelle reste marcel/franchir/admin.
  const canAssignViaWorkflow =
    role === 'marcel' ||
    role === 'franchir' ||
    role === 'admin'

  if (
    canAssignViaWorkflow &&
    globalStatus !== 'scheduled'
  ) {
    const assignEnabled = isMedicallyValidated(globalStatus)
    result.secondaryActions.push({
      id: 'assign_surgeon',
      label: 'Assigner un chirurgien',
      description: 'Désigner le chirurgien qui prend en charge le dossier (transmet le dossier au chirurgien)',
      variant: 'secondary',
      targetGlobalStatus: 'stay',
      disabled: !assignEnabled,
      disabledReason: assignEnabled
        ? undefined
        : 'Disponible après validation médicale',
      requiresInput: [
        {
          type: 'surgeon_select',
          label: 'Chirurgien assigné',
          required: true,
        },
      ],
    })
  }

  if (role === 'marcel' || role === 'franchir' || role === 'admin') {
    result.secondaryActions.push({
      id: 'close_case',
      label: 'Fermer le dossier',
      description: 'Archiver le dossier : conserve l\'historique, aucune action en attente',
      variant: 'danger',
      targetGlobalStatus: 'closed',
      requiresInput: [
        {
          type: 'message',
          label: 'Motif de clôture (optionnel)',
          required: false,
        },
      ],
    })
  }

  return result
}
