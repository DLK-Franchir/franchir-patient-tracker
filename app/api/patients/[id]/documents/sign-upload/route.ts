/**
 * ============================================================================
 * FICHIERS PATIENT — émission d'URLs signées d'upload (upload DIRECT navigateur)
 *
 * Pourquoi : un upload multipart classique transite par la fonction serverless
 * Vercel, plafonnée à ~4,5 Mo par requête → un lot de DICOM dépasse vite. Cette
 * route ne fait PAS transiter les octets : elle génère, pour un patient + une
 * liste de fichiers, des URLs signées d'upload (`createSignedUploadUrl`) vers le
 * bucket privé `patient-documents`. Le navigateur uploade ENSUITE directement
 * vers Storage (`uploadToSignedUrl`), puis enregistre les métadonnées via
 * /documents/finalize. Plus de limite pratique sur la taille / le nombre.
 *
 * Réservé aux créateurs de dossier (marcel / franchir / admin). La génération
 * des URLs signées passe par le client SERVICE-ROLE après contrôle d'accès.
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { canManagePatientDocuments } from '@/lib/access-control'
import {
  PATIENT_DOCUMENTS_BUCKET,
  MAX_DOCUMENTS_PER_REQUEST,
  buildPatientDocumentObjectKey,
  validateDocumentFile,
  DOCUMENT_VALIDATION_MESSAGES,
} from '@/lib/documents/patient-documents'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/documents/sign-upload')

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
    .max(MAX_DOCUMENTS_PER_REQUEST),
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

  const body = await req.json().catch(() => null)
  const parsed = signUploadRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  // Validation type/taille AVANT de signer (un fichier refusé ne reçoit pas d'URL).
  for (const file of parsed.data.files) {
    const validationError = validateDocumentFile({
      name: file.name,
      size: file.size,
      type: file.type ?? null,
    })
    if (validationError) {
      return NextResponse.json(
        { error: `${file.name} : ${DOCUMENT_VALIDATION_MESSAGES[validationError]}` },
        { status: 400 },
      )
    }
  }

  const service = createServiceRoleClient()

  const { data: patient, error: patientError } = await service
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .maybeSingle()
  if (patientError || !patient) {
    return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })
  }

  try {
    const now = Date.now()
    const uploads: Array<{
      fileName: string
      path: string
      token: string
      signedUrl: string
    }> = []

    for (let index = 0; index < parsed.data.files.length; index += 1) {
      const file = parsed.data.files[index]
      // +index garantit l'unicité des clés au sein du même lot.
      const objectKey = buildPatientDocumentObjectKey(patientId, file.name, now + index)
      const { data, error } = await service.storage
        .from(PATIENT_DOCUMENTS_BUCKET)
        .createSignedUploadUrl(objectKey)

      if (error || !data) {
        throw new Error(`sign ${file.name}: ${error?.message ?? 'unknown'}`)
      }

      uploads.push({
        fileName: file.name,
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
      })
    }

    const response = NextResponse.json({ uploads })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    log.error('Erreur génération URLs signées upload', error)
    return NextResponse.json({ error: "Échec de la préparation de l'upload" }, { status: 500 })
  }
}
