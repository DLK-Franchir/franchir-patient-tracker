/**
 * ============================================================================
 * FICHIER PATIENT — suppression d'un document
 *
 * DELETE : supprime l'objet Storage puis sa ligne patient_documents. Réservé
 * aux créateurs de dossier (marcel / franchir / admin). Écriture via le client
 * SERVICE-ROLE après contrôle d'accès. Garde anti-IDOR : la clé d'objet doit
 * appartenir au dossier du patient ciblé.
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { canManagePatientDocuments, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import {
  PATIENT_DOCUMENTS_BUCKET,
  isObjectKeyOwnedByPatient,
} from '@/lib/documents/patient-documents'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/documents/delete')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id: patientId, docId } = await params
  if (!UUID_RE.test(patientId) || !UUID_RE.test(docId)) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
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

  const service = createServiceRoleClient()

  const { data: doc, error: fetchError } = await service
    .from('patient_documents')
    .select('id, file_path, patient_id')
    .eq('id', docId)
    .eq('patient_id', patientId)
    .maybeSingle()

  if (fetchError) {
    log.error('Erreur lecture document', fetchError)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
  if (!doc) {
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  }

  // Anti-IDOR : la clé doit bien vivre sous patients/{patientId}/.
  if (!isObjectKeyOwnedByPatient(doc.file_path as string, patientId)) {
    return NextResponse.json({ error: 'Document non rattaché au patient' }, { status: 400 })
  }

  const { error: removeError } = await service.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .remove([doc.file_path as string])

  if (removeError) {
    log.error('Erreur suppression objet Storage', removeError)
    return NextResponse.json({ error: 'Échec de la suppression' }, { status: 500 })
  }

  const { error: deleteError } = await service
    .from('patient_documents')
    .delete()
    .eq('id', docId)

  if (deleteError) {
    log.error('Erreur suppression ligne document', deleteError)
    return NextResponse.json({ error: 'Échec de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
