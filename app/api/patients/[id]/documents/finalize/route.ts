/**
 * ============================================================================
 * FICHIERS PATIENT — finalisation après upload DIRECT navigateur → Storage
 *
 * Cette route NE reçoit QUE des métadonnées (jamais les octets) : pour chaque
 * fichier déjà uploadé via une URL signée (cf. /documents/sign-upload), elle
 * enregistre la ligne `patient_documents` correspondante. Anti-IDOR : chaque
 * `path` doit vivre sous `patients/{patientId}/` (re-validé serveur).
 *
 * Réservé aux créateurs de dossier (marcel / franchir / admin). Écriture via le
 * client SERVICE-ROLE après contrôle d'accès. Le forward cross-portail est
 * déclenché côté navigateur lors de l'upload (upload-client.ts).
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { canManagePatientDocuments, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import {
  PATIENT_DOCUMENTS_BUCKET,
  finalizeDocumentsRequestSchema,
  inferDocumentKind,
  isObjectKeyOwnedByPatient,
} from '@/lib/documents/patient-documents'
import { forwardDocumentsViaSignedUpload } from '@/lib/integrations/forward-imaging'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/documents/finalize')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  if (!profile || !canManagePatientDocuments(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const archivedDeny = await denyIfArchivedPatientWrite(
    supabase,
    patientId,
    profile.role as StaffRole,
  )
  if (archivedDeny) return archivedDeny

  const body = await req.json().catch(() => null)
  const parsed = finalizeDocumentsRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  // Anti-IDOR : chaque clé d'objet doit appartenir au dossier du patient ciblé.
  for (const doc of parsed.data.documents) {
    if (!isObjectKeyOwnedByPatient(doc.path, patientId)) {
      return NextResponse.json({ error: 'Chemin de fichier non rattaché au patient' }, { status: 400 })
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

  // ── Anti-doublon DICOM par SOPInstanceUID (filet de sécurité serveur) ──────
  // Le client saute déjà les doublons avant d'uploader (cf. sign-upload), mais
  // on re-filtre ici : les SOPInstanceUID déjà présents pour ce patient OU
  // répétés dans la requête sont écartés, et leurs objets Storage (déjà poussés)
  // sont supprimés pour ne pas laisser d'orphelins.
  const requestedSops = parsed.data.documents
    .map((doc) => doc.dicom?.sopInstanceUid)
    .filter((sop): sop is string => typeof sop === 'string' && sop.length > 0)

  const existingSops = new Set<string>()
  if (requestedSops.length > 0) {
    const { data: existing } = await service
      .from('patient_documents')
      .select('sop_instance_uid')
      .eq('patient_id', patientId)
      .in('sop_instance_uid', requestedSops)
    for (const row of existing ?? []) {
      const sop = row.sop_instance_uid as string | null
      if (sop) existingSops.add(sop)
    }
  }

  const seenSops = new Set<string>()
  const accepted: typeof parsed.data.documents = []
  const skippedPaths: string[] = []
  for (const doc of parsed.data.documents) {
    const sop = doc.dicom?.sopInstanceUid ?? null
    if (sop && (existingSops.has(sop) || seenSops.has(sop))) {
      skippedPaths.push(doc.path)
      continue
    }
    if (sop) seenSops.add(sop)
    accepted.push(doc)
  }

  if (skippedPaths.length > 0) {
    await service.storage.from(PATIENT_DOCUMENTS_BUCKET).remove(skippedPaths).catch(() => {})
  }

  if (accepted.length === 0) {
    return NextResponse.json({ success: true, count: 0, skipped: skippedPaths.length })
  }

  const rows = accepted.map((doc) => ({
    patient_id: patientId,
    kind: inferDocumentKind(doc.fileName, doc.type ?? null),
    file_path: doc.path,
    file_name: doc.fileName,
    mime_type: doc.type ?? null,
    size_bytes: doc.size,
    uploaded_by: user.id,
    sop_instance_uid: doc.dicom?.sopInstanceUid ?? null,
    series_instance_uid: doc.dicom?.seriesInstanceUid ?? null,
    series_description: doc.dicom?.seriesDescription ?? null,
    body_part: doc.dicom?.bodyPart ?? null,
    instance_number: doc.dicom?.instanceNumber ?? null,
    acquisition_datetime: doc.dicom?.acquisitionDatetime ?? null,
  }))

  const { data: inserted, error: insertError } = await service
    .from('patient_documents')
    .insert(rows)
    .select('id')

  if (insertError) {
    log.error('Erreur insertion métadonnées documents', insertError)
    return NextResponse.json({ error: "Échec de l'enregistrement des fichiers" }, { status: 500 })
  }

  // Best-effort : re-forward serveur vers le portail chirurgien (URLs signées).
  void forwardDocumentsViaSignedUpload(
    service,
    patientId,
    accepted.map((doc) => ({
      path: doc.path,
      name: doc.fileName,
      type: doc.type ?? null,
      size: doc.size,
    })),
  )

  return NextResponse.json({
    success: true,
    count: inserted?.length ?? rows.length,
    skipped: skippedPaths.length,
  })
}
