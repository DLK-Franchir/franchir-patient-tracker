-- ============================================================
-- FRANCHIR PATIENT TRACKER — table d'attachements patient (DICOM + documents)
-- Date: 2026-06-13
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE DB : NE PAS appliquer automatiquement en prod. À appliquer par
-- l'utilisateur via le Dashboard Supabase (SQL Editor) ou la CLI :
--   supabase db push --project-ref zdmeidekszdrzmjuasee
--
-- Migration ADDITIVE uniquement (nouvelle table + index + policies dédiées).
-- Aucune table existante modifiée. Sans risque pour l'existant.
--
-- Rôle de cette table : métadonnées des fichiers uploadés dans le bucket
-- privé `patient-documents` (cf. migration 20260613190100). Les octets vivent
-- dans Storage sous `patients/{patientId}/...` ; cette table porte le « kind »
-- (dicom | document), le nom d'origine, le mime, la taille et l'auteur.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- 'dicom' = imagerie DICOM (rendue par la visionneuse dwv) ;
  -- 'document' = PDF / image / autre document (rendu inline ou téléchargé).
  kind TEXT NOT NULL CHECK (kind IN ('dicom', 'document')),
  -- Clé de l'objet Storage : `patients/{patientId}/{timestamp}_{nom_securise}`.
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id
  ON public.patient_documents (patient_id, created_at DESC);

COMMENT ON TABLE public.patient_documents IS
  'Métadonnées des fichiers (DICOM + documents) uploadés dans le bucket privé patient-documents. Source de vérité applicative ; les octets vivent dans Storage sous patients/{patientId}/.';
COMMENT ON COLUMN public.patient_documents.kind IS
  'Type de fichier : "dicom" (imagerie, visionneuse dwv) ou "document" (PDF / image / autre).';
COMMENT ON COLUMN public.patient_documents.file_path IS
  'Clé de l''objet Supabase Storage (bucket patient-documents) : patients/{patientId}/{timestamp}_{nom}.';

-- ── RLS ─────────────────────────────────────────────────────
-- L'accès applicatif passe par les routes serveur (client service-role) et des
-- URLs signées ; on active malgré tout RLS (defense-in-depth) et on réserve
-- la lecture/écriture au staff actif (réutilise public.is_active_staff(),
-- défini par 20260503_guard_staff_access.sql).
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_patient_documents" ON public.patient_documents;
CREATE POLICY "staff_select_patient_documents"
  ON public.patient_documents
  FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

DROP POLICY IF EXISTS "staff_insert_patient_documents" ON public.patient_documents;
CREATE POLICY "staff_insert_patient_documents"
  ON public.patient_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS "staff_delete_patient_documents" ON public.patient_documents;
CREATE POLICY "staff_delete_patient_documents"
  ON public.patient_documents
  FOR DELETE
  TO authenticated
  USING (public.is_active_staff());
