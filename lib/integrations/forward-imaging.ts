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

import type { SupabaseClient } from '@supabase/supabase-js'
import { Logger } from '@/lib/logger'

const log = new Logger('forward-imaging')

export type ForwardableFile = {
  name: string
  type: string | null
  data: ArrayBuffer
}

/**
 * Référence à un objet déjà stocké (upload direct navigateur → Storage). Les
 * octets ne sont plus en mémoire côté serveur : on les relit depuis le bucket
 * au moment du forward (best-effort).
 */
export type ForwardableObject = {
  path: string
  name: string
  type: string | null
}

/**
 * Plafond de taille pour le forward d'un fichier vers le récepteur
 * questionnaires : ce dernier reçoit l'imagerie en multipart via une fonction
 * serverless (~4,5 Mo par requête). On ne forwarde donc QUE les fichiers
 * raisonnablement petits (comptes rendus, images), un par requête. L'imagerie
 * lourde reste consultable dans le tracker (source de vérité) ; le forward est
 * best-effort et documenté comme tel.
 */
const FORWARD_MAX_FILE_SIZE = 4 * 1024 * 1024

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

/**
 * Variante pour l'upload DIRECT (Item A) : les octets ne transitent plus par la
 * fonction, on les relit donc depuis le bucket pour les forwarder. Best-effort,
 * fire-and-forget : ne lève jamais. Les fichiers > FORWARD_MAX_FILE_SIZE sont
 * ignorés (le récepteur questionnaires est multipart serverless, ~4,5 Mo par
 * requête) ; ils restent consultables dans le tracker (source de vérité).
 */
export async function forwardImagingFromStorage(
  service: SupabaseClient,
  bucket: string,
  trackerPatientId: string,
  objects: ForwardableObject[],
): Promise<void> {
  const url = process.env.QUESTIONNAIRES_IMAGING_URL
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!url || !token || objects.length === 0) return

  for (const object of objects) {
    try {
      const { data, error } = await service.storage.from(bucket).download(object.path)
      if (error || !data) {
        log.error('Lecture objet à forwarder échouée', { status: 'download_failed' })
        continue
      }
      if (data.size > FORWARD_MAX_FILE_SIZE) {
        // Trop volumineux pour le récepteur serverless : ignoré (best-effort).
        continue
      }

      const arrayBuffer = await data.arrayBuffer()
      await forwardImagingToQuestionnaires(trackerPatientId, [
        { name: object.name, type: object.type, data: arrayBuffer },
      ])
    } catch (error) {
      log.error('Échec forward objet depuis Storage', error)
    }
  }
}
