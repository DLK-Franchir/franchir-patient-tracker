/**
 * Proxy cockpit → pont questionnaires : émission d'URLs signées d'upload direct
 * vers le bucket patient-images (DICOM volumineux, Item A Option A).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { canManagePatientDocuments, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { signQuestionnaireImagingUpload } from '@/lib/integrations/fetch-questionnaire-imaging'
/** Plafond aligné sur MAX_IMAGING_FILES côté portail questionnaires. */
const QUESTIONNAIRES_IMAGING_SIGN_MAX = 10

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const signUploadRequestSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        size: z.number().int().nonnegative(),
        type: z.string().max(255).nullable().optional(),
      }),
    )
    .min(1)
    .max(QUESTIONNAIRES_IMAGING_SIGN_MAX),
})

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

  const archivedDeny = await denyIfArchivedPatientWrite(
    supabase,
    patientId,
    profile.role as StaffRole,
  )
  if (archivedDeny) return archivedDeny

  const body = await req.json().catch(() => null)
  const parsed = signUploadRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const signed = await signQuestionnaireImagingUpload(
    patientId,
    parsed.data.files.map((f) => ({ name: f.name, size: f.size, type: f.type ?? null })),
  )

  if (!signed) {
    return NextResponse.json(
      {
        error:
          "Pont questionnaires indisponible ou dossier pas encore synchronisé. Réessayez dans un instant.",
      },
      { status: 503 },
    )
  }

  const response = NextResponse.json(signed)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
