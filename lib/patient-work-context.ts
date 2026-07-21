import type { GlobalStatus, UserRole } from '@/lib/workflow-v2'

export type WorkContextType = 'urgent' | 'action' | 'ok'

export interface PatientWorkContext {
  type: WorkContextType
  title: string
  desc: string
  actionTitle: string
}

export interface PatientCommercialFields {
  quoteAmount?: number | null
  proposedDate?: string | null
  quoteAccepted?: boolean
  dateAccepted?: boolean
  assignedSurgeonName?: string | null
}

export interface PatientWorkContextInput extends PatientCommercialFields {
  globalStatus: GlobalStatus
  role: UserRole
  patientName: string
  /** Détail affiché pour medical_more_info / rejected */
  progressDetail?: string | null
}

function formatQuote(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} €`
}

function formatProposedDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/** Libellé « étape courante » phase commerciale — aligné prototype V3. */
export function getCommercialProgressDescription(fields: PatientCommercialFields): string {
  const {
    quoteAmount,
    quoteAccepted = false,
    proposedDate,
    dateAccepted = false,
    assignedSurgeonName,
  } = fields

  if (!quoteAmount) {
    return assignedSurgeonName
      ? 'Chirurgien assigné — devis à saisir'
      : 'Aucun devis — à saisir'
  }

  if (!proposedDate && !quoteAccepted) {
    return 'Budget renseigné — date à proposer'
  }

  if (quoteAmount && !quoteAccepted && proposedDate) {
    return `Devis ${formatQuote(quoteAmount)} transmis — en attente confirmation`
  }

  if (quoteAccepted && proposedDate && !dateAccepted) {
    return 'Devis confirmé — date à confirmer avec le patient'
  }

  if (!quoteAccepted && proposedDate) {
    return 'Date proposée — devis à confirmer'
  }

  if (quoteAmount && !quoteAccepted) {
    return `Devis ${formatQuote(quoteAmount)} — en attente confirmation`
  }

  return `Devis ${formatQuote(quoteAmount)} — données commerciales en cours`
}

/**
 * Contexte de travail fiche patient (bandeau + titre panneau actions).
 * Port de getWorkContext V3 sur GlobalStatus + UserRole + champs patient.
 */
export function getWorkContext(input: PatientWorkContextInput): PatientWorkContext | null {
  const {
    globalStatus,
    role,
    patientName,
    quoteAmount,
    proposedDate,
    quoteAccepted = false,
    dateAccepted = false,
    assignedSurgeonName,
    progressDetail,
  } = input

  const commercialDesc = getCommercialProgressDescription({
    quoteAmount,
    proposedDate,
    quoteAccepted,
    dateAccepted,
    assignedSurgeonName,
  })

  if (role === 'gilles') {
    if (globalStatus === 'medical_review') {
      return {
        type: 'urgent',
        title: 'Validation médicale requise',
        desc: `Le dossier de ${patientName} attend votre avis.`,
        actionTitle: 'Valider ou refuser le dossier',
      }
    }
    return null
  }

  if (role === 'admin') {
    if (globalStatus === 'rejected') {
      return {
        type: 'action',
        title: 'Dossier refusé',
        desc: 'Vous pouvez réouvrir ce dossier.',
        actionTitle: 'Gérer le dossier',
      }
    }
    if (globalStatus === 'closed') {
      return {
        type: 'action',
        title: 'Dossier fermé',
        desc: 'Historique conservé. Vous pouvez réouvrir si nécessaire.',
        actionTitle: 'Administration',
      }
    }
    return {
      type: 'ok',
      title: 'Supervision active',
      desc: 'Accès complet lecture/écriture.',
      actionTitle: 'Administration',
    }
  }

  if ((role === 'marcel' || role === 'franchir') && globalStatus === 'rejected') {
    return {
      type: 'action',
      title: 'Dossier refusé',
      desc: progressDetail?.trim() || 'Vous pouvez réouvrir ce dossier pour le remettre en circuit.',
      actionTitle: 'Réouvrir le dossier',
    }
  }

  if ((role === 'marcel' || role === 'franchir') && globalStatus === 'closed') {
    return {
      type: 'action',
      title: 'Dossier fermé',
      desc: 'Historique conservé. Vous pouvez réouvrir si nécessaire.',
      actionTitle: 'Réouvrir le dossier',
    }
  }

  if (globalStatus === 'draft') {
    return {
      type: 'action',
      title: 'Dossier à soumettre',
      desc: 'Prêt à envoyer en revue médicale au Dr Dubois.',
      actionTitle: 'Soumettre au médecin',
    }
  }

  if (globalStatus === 'medical_more_info') {
    return {
      type: 'urgent',
      title: 'Action requise — pièces manquantes',
      desc: progressDetail?.trim() || 'Complétez le dossier puis renvoyez-le en revue médicale.',
      actionTitle: 'Compléter le dossier',
    }
  }

  if (globalStatus === 'medical_review') {
    return {
      type: 'ok',
      title: 'En revue médicale',
      desc: 'Le Dr Dubois examine le dossier. Vous serez notifié dès sa décision.',
      actionTitle: 'En attente de validation',
    }
  }

  if (globalStatus === 'commercial_in_progress') {
    const actionTitle =
      role === 'franchir' ? 'Saisir devis et dates' : 'Saisir les données commerciales'
    return {
      type: 'action',
      title: 'Phase commerciale',
      desc: commercialDesc,
      actionTitle,
    }
  }

  if (globalStatus === 'scheduled' && !dateAccepted) {
    const dateLabel = proposedDate ? formatProposedDate(proposedDate) : 'Date à confirmer'
    const surgeon = assignedSurgeonName ? ` · ${assignedSurgeonName}` : ''
    return {
      type: 'action',
      title: 'Confirmation de date requise',
      desc: `L'intervention est planifiée — date à confirmer avec le patient (${dateLabel}${surgeon}).`,
      actionTitle: 'Confirmer l\'intervention',
    }
  }

  if (globalStatus === 'scheduled' && dateAccepted) {
    const dateLabel = proposedDate ? formatProposedDate(proposedDate) : ''
    const surgeon = assignedSurgeonName ?? 'Chirurgien non assigné'
    return {
      type: 'ok',
      title: 'Intervention programmée et confirmée',
      desc: [dateLabel, surgeon].filter(Boolean).join(' · '),
      actionTitle: 'Dossier complet ✓',
    }
  }

  if (globalStatus === 'rejected') {
    return {
      type: 'urgent',
      title: 'Dossier refusé',
      desc: progressDetail?.trim() || 'Ce dossier a été refusé et est en lecture seule.',
      actionTitle: 'Dossier refusé',
    }
  }

  if (globalStatus === 'closed') {
    return {
      type: 'ok',
      title: 'Dossier fermé',
      desc: 'Historique conservé — aucune action workflow en cours.',
      actionTitle: 'Consultation',
    }
  }

  return null
}

export interface PipelineStep {
  label: string
  done: boolean
  active: boolean
}

/** 4 étapes V3 : Dossier → Validation → Commercial → Programmé */
export function getPipelineSteps(
  globalStatus: GlobalStatus,
  dateAccepted = false,
): PipelineStep[] {
  if (globalStatus === 'rejected' || globalStatus === 'closed') {
    return []
  }

  const pastDossier =
    globalStatus !== 'draft' && globalStatus !== 'medical_more_info'
  const pastValidation =
    globalStatus === 'commercial_in_progress' || globalStatus === 'scheduled'

  return [
    {
      label: 'Dossier',
      done: pastDossier,
      active: globalStatus === 'draft' || globalStatus === 'medical_more_info',
    },
    {
      label: 'Validation',
      done: pastValidation,
      active: globalStatus === 'medical_review',
    },
    {
      label: 'Commercial',
      done: globalStatus === 'scheduled',
      active: globalStatus === 'commercial_in_progress',
    },
    {
      label: 'Programmé',
      done: globalStatus === 'scheduled' && dateAccepted,
      active: globalStatus === 'scheduled',
    },
  ]
}
