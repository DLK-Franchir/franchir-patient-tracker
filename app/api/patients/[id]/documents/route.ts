/**
 * ============================================================================
 * FICHIERS PATIENT (DICOM + documents) — liste & upload
 *
 * Stockage 100 % côté TRACKER (bucket privé `patient-documents`, projet
 * zdmeidekszdrzmjuasee). Aucune dépendance au projet questionnaires.
 *
 * - GET  : liste les fichiers d'un patient (métadonnées + URLs signées courtes).
 *          Ouvert à tout le staff actif.
 * - POST : upload multi-fichiers (multipart). Réservé aux créateurs de dossier
 *          (marcel / franchir / admin). Écriture via client SERVICE-ROLE après
 *          contrôle d'accès (jamais de service-role au navigateur).
 *
 * Flux : la session navigateur authentifie + autorise l'utilisateur, puis
 * l'écriture Storage/DB passe par le service-role (bypass RLS, côté serveur).
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { canManagePatientDocuments, isStaffProfile } from '@/lib/access-control'
import { listPatientDocuments } from '@/lib/documents/list-patient-documents'
import {
  PATIENT_DOCUMENTS_BUCKET,
  MAX_DOCUMENTS_PER_REQUEST,
  buildPatientDocumentObjectKey,
  validateDocumentFile,
  inferDocumentKind,
  DOCUMENT_VALIDATION_MESSAGES,
} from '@/lib/documents/patient-documents'
import { isMp4ViewerEnabled, MP4_MIME_TYPE } from '@/lib/features/mp4-viewer'
import { Logger } from '@/lib/logger'
import { forwardImagingToQuestionnaires, type ForwardableFile } from '@/lib/integrations/forward-imaging'

const log = new Logger('api/patients/documents')

/** Imagerie remontée au portail chirurgien : DICOM, PDF de compte rendu, images. */
function isForwardableImaging(file: { type: string | null }, kind: string): boolean {
  if (kind === 'dicom') return true
  const t = (file.type ?? '').toLowerCase()
  if (t === 'application/pdf' || t.startsWith('image/')) return true
  return isMp4ViewerEnabled() && t === MP4_MIME_TYPE
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (!isStaffProfile(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const service = createServiceRoleClient()
    const documents = await listPatientDocuments(service, patientId)
    const response = NextResponse.json({ documents })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    log.error('Erreur listing documents', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Requête multipart invalide' }, { status: 400 })
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  }
  if (files.length > MAX_DOCUMENTS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Trop de fichiers (max ${MAX_DOCUMENTS_PER_REQUEST} par envoi)` },
      { status: 400 },
    )
  }

  for (const file of files) {
    const validationError = validateDocumentFile({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    if (validationError) {
      return NextResponse.json(
        { error: `${file.name} : ${DOCUMENT_VALIDATION_MESSAGES[validationError]}` },
        { status: 400 },
      )
    }
  }

  const service = createServiceRoleClient()

  // Vérifie que le patient existe (le FK l'imposerait, mais on renvoie une
  // erreur claire plutôt qu'une 500 d'insertion).
  const { data: patient, error: patientError } = await service
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .maybeSingle()
  if (patientError || !patient) {
    return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })
  }

  const uploaded: string[] = []
  const forwardable: ForwardableFile[] = []
  try {
    const now = Date.now()
    const rows: Array<{
      patient_id: string
      kind: string
      file_path: string
      file_name: string
      mime_type: string | null
      size_bytes: number
      uploaded_by: string
    }> = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      // +index pour garantir l'unicité des clés au sein du même envoi.
      const objectKey = buildPatientDocumentObjectKey(patientId, file.name, now + index)
      const arrayBuffer = await file.arrayBuffer()
      const contentType = file.type && file.type.length > 0 ? file.type : 'application/octet-stream'

      const { error: uploadError } = await service.storage
        .from(PATIENT_DOCUMENTS_BUCKET)
        .upload(objectKey, arrayBuffer, {
          contentType,
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`upload ${file.name}: ${uploadError.message}`)
      }
      uploaded.push(objectKey)

      const kind = inferDocumentKind(file.name, file.type)
      if (isForwardableImaging({ type: file.type || null }, kind)) {
        forwardable.push({ name: file.name, type: file.type || null, data: arrayBuffer })
      }

      rows.push({
        patient_id: patientId,
        kind,
        file_path: objectKey,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id,
      })
    }

    const { data: inserted, error: insertError } = await service
      .from('patient_documents')
      .insert(rows)
      .select('id')

    if (insertError) {
      throw new Error(`insert metadata: ${insertError.message}`)
    }

    // Option A : remonte l'imagerie vers le portail chirurgien (questionnaires).
    // Best-effort : n'altère jamais la réponse d'upload (stockage tracker = vérité).
    await forwardImagingToQuestionnaires(patientId, forwardable)

    return NextResponse.json({ success: true, count: inserted?.length ?? rows.length })
  } catch (error) {
    // Rollback best-effort des objets déjà poussés pour éviter les orphelins.
    if (uploaded.length > 0) {
      await service.storage
        .from(PATIENT_DOCUMENTS_BUCKET)
        .remove(uploaded)
        .catch(() => {})
    }
    log.error('Erreur upload documents', error)
    return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 })
  }
}
