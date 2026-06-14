/**
 * Transfert best-effort de l'imagerie patient vers l'app questionnaires
 * (Option A — portail chirurgien unique). Le chirurgien retrouve ainsi, dans le
 * portail clinicien questionnaires, l'analyse du questionnaire ET l'imagerie au
 * même endroit, en réutilisant la visionneuse existante.
 *
 * Fail-closed + fire-and-forget : si le pont n'est pas configuré
 * (`QUESTIONNAIRES_IMAGING_URL` + `TRACKER_SYNC_SERVICE_TOKEN`), on ne fait
 * rien. Une erreur réseau/HTTP ne casse JAMAIS l'upload local (le stockage
 * tracker reste la source de vérité ; l'imagerie est aussi visible dans le
 * tracker). La corrélation se fait côté questionnaires via
 * `neuro_patients.external_tracker_id = trackerPatientId`.
 *
 * Limite assumée : si le dossier n'est pas encore synchronisé côté
 * questionnaires (course avec le webhook de création), le récepteur répond 404
 * et le transfert est ignoré ; il repartira au prochain upload une fois la
 * corrélation établie.
 */

import { Logger } from '@/lib/logger'

const log = new Logger('forward-imaging')

export type ForwardableFile = {
  name: string
  type: string | null
  data: ArrayBuffer
}

export async function forwardImagingToQuestionnaires(
  trackerPatientId: string,
  files: ForwardableFile[],
): Promise<void> {
  const url = process.env.QUESTIONNAIRES_IMAGING_URL
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!url || !token || files.length === 0) return

  try {
    const form = new FormData()
    form.append('trackerPatientId', trackerPatientId)
    for (const file of files) {
      const blob = new Blob([file.data], {
        type: file.type && file.type.length > 0 ? file.type : 'application/octet-stream',
      })
      form.append('files', blob, file.name)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    if (!response.ok) {
      // 404 = dossier pas encore corrélé (course de sync) ; les autres = à surveiller.
      log.error('Transfert imagerie vers questionnaires non abouti', {
        status: response.status,
      })
    }
  } catch (error) {
    log.error('Échec transfert imagerie vers questionnaires', error)
  }
}
