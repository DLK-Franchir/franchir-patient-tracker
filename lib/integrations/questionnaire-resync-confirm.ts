/**
 * Décide si Marcel doit confirmer avant un renvoi / resync identité
 * (langue ou pathologie) vers le portail questionnaires.
 */

export type QuestionnaireResyncConfirmInput = {
  languageDirty: boolean
  formTypesChanged: boolean
  questionnaireStatus: string | null | undefined
  hasActiveLink: boolean
  hasInProgressSession: boolean
}

export function needsQuestionnaireResyncConfirm(
  input: QuestionnaireResyncConfirmInput,
): boolean {
  const { languageDirty, formTypesChanged } = input
  if (!languageDirty && !formTypesChanged) return false

  // Changement de pathologie avec session ouverte : déjà couvert historiquement.
  if (formTypesChanged && input.hasInProgressSession) return true

  // Après envoi / lien actif : toute modif langue ou pathologie = resync explicite.
  const postSend =
    input.questionnaireStatus === 'sent' ||
    input.hasActiveLink ||
    input.hasInProgressSession

  return postSend && (languageDirty || formTypesChanged)
}

export function questionnaireResyncConfirmMessage(options: {
  languageDirty: boolean
  formTypesChanged: boolean
  fromPathologyLabel?: string
  toPathologyLabel?: string
}): string {
  if (options.formTypesChanged && options.fromPathologyLabel && options.toPathologyLabel) {
    return (
      `Ceci resynchronise le dossier vers le questionnaire. ` +
      `Passer de ${options.fromPathologyLabel} à ${options.toPathologyLabel} ` +
      `ouvrira une nouvelle session (réponses en cours perdues). Continuer ?`
    )
  }
  if (options.languageDirty && !options.formTypesChanged) {
    return (
      'Ceci resynchronise la langue du questionnaire vers le portail patient. Continuer ?'
    )
  }
  return (
    'Ceci resynchronise le dossier (langue / pathologie) vers le questionnaire. Continuer ?'
  )
}
