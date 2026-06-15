/**
 * Émission du lien questionnaire patient PILOTÉE depuis le cockpit tracker
 * (orchestration). Le tracker ne génère pas le lien lui-même : il délègue à
 * l'app questionnaires (source de vérité) via l'endpoint service-token
 * `/api/integrations/tracker/questionnaire-link`, corrélé par l'id patient
 * tracker (= `external_tracker_id` côté questionnaires).
 *
 * Réservé au staff gestionnaire (marcel / franchir / admin). Le token de pont
 * ne quitte jamais le serveur. À la réussite, on note l'état `sent` côté tracker
 * (sans jamais rétrograder un questionnaire déjà `completed`).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { canManagePatientDocuments } from '@/lib/access-control'
import { syncPatientToQuestionnaires } from '@/lib/integrations/questionnaire-portal'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/questionnaire-link')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const QUESTIONNAIRE_LINK_URL = `${
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://questionnaire.franchir.eu/api/integrations/tracker'
}/questionnaire-link`

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params
  if (!UUID_RE.test(patientId)) {
    return NextResponse.json({ error: 'Identifiant patient invalide' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (!canManagePatientDocuments(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: "Pont questionnaires non configuré (TRACKER_SYNC_SERVICE_TOKEN absent)" },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const newSession = Boolean(body?.newSession)

  // Règle métier (item 7) : un dossier dont le questionnaire est déjà complété
  // ne peut PLUS recevoir de lien (ni renvoi, ni nouveau questionnaire de suivi).
  // Une nouvelle évaluation nécessite un NOUVEAU dossier patient → 409.
  const guard = createServiceRoleClient()
  const { data: existing } = await guard
    .from('patients')
    .select('questionnaire_status')
    .eq('id', patientId)
    .maybeSingle()
  if (existing?.questionnaire_status === 'completed') {
    return NextResponse.json(
      {
        error:
          'Questionnaire déjà complété — pour une nouvelle évaluation, créez un nouveau dossier patient.',
      },
      { status: 409 },
    )
  }

  try {
    let response = await fetch(QUESTIONNAIRE_LINK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trackerPatientId: patientId, newSession }),
    })

    if (response.status === 404) {
      log.warn('Dossier non corrélé — tentative de sync rattrapage', { patientId })
      const synced = await syncPatientToQuestionnaires(patientId)
      if (synced) {
        response = await fetch(QUESTIONNAIRE_LINK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ trackerPatientId: patientId, newSession }),
        })
      }
    }

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Le dossier n'est pas encore synchronisé côté questionnaires. Réessayez dans un instant." },
          { status: 409 },
        )
      }
      if (response.status === 409) {
        return NextResponse.json(
          {
            error:
              'Questionnaire déjà complété — pour une nouvelle évaluation, créez un nouveau dossier patient.',
          },
          { status: 409 },
        )
      }
      log.error('Émission lien questionnaire échouée', { status: response.status, detail })
      const upstreamCode = typeof detail?.error === 'string' ? detail.error : 'inconnu'
      return NextResponse.json(
        { error: `Échec émission lien (questionnaires ${response.status} : ${upstreamCode})` },
        { status: 502 },
      )
    }

    const result = await response.json()

    // Note l'état `sent` côté tracker (sans rétrograder un `completed`).
    const service = createServiceRoleClient()
    const { data: current } = await service
      .from('patients')
      .select('questionnaire_status')
      .eq('id', patientId)
      .maybeSingle()
    if (current?.questionnaire_status !== 'completed') {
      await service
        .from('patients')
        .update({ questionnaire_status: 'sent' })
        .eq('id', patientId)
    }

    return NextResponse.json({
      success: true,
      emailSent: result.emailSent ?? false,
      expiresAt: result.expiresAt ?? null,
    })
  } catch (error) {
    log.error('Erreur émission lien questionnaire', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
