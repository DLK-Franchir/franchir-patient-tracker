-- ============================================================
-- FRANCHIR PATIENT TRACKER — extraits de comptes rendus PDF
-- Date: 2026-10-01
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ADDITIVE : nouvelle table patient_document_reports.
-- Stocke une synthèse EXTRACTIVE (phrases du PDF uniquement), jamais
-- d'interprétation clinique. Pas de PHI dans les logs applicatifs.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_document_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.patient_documents(id) ON DELETE CASCADE,
  -- ok | no_text (PDF scanné sans couche texte) | error
  status TEXT NOT NULL CHECK (status IN ('ok', 'no_text', 'error')),
  -- Sections structurées : [{ id, title, text, present }]
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- SHA-256 des octets PDF (ou PDF encapsulé) pour invalider un re-extract.
  source_sha TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Code machine non-PHI (ex. extract_failed, unsupported_mime).
  error_code TEXT,
  CONSTRAINT patient_document_reports_document_unique UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_document_reports_patient_id
  ON public.patient_document_reports (patient_id, extracted_at DESC);

COMMENT ON TABLE public.patient_document_reports IS
  'Synthèse extractive des PDF / DOC radiologues (phrases du document uniquement). Aucune interprétation.';
COMMENT ON COLUMN public.patient_document_reports.sections IS
  'JSONB : sections Indication / Technique / Résultats / Conclusion / Avis reconstruites depuis les titres FR du PDF.';
COMMENT ON COLUMN public.patient_document_reports.source_sha IS
  'Empreinte SHA-256 des octets PDF extraits ; pas de contenu clinique.';

ALTER TABLE public.patient_document_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_patient_document_reports" ON public.patient_document_reports;
CREATE POLICY "staff_select_patient_document_reports"
  ON public.patient_document_reports
  FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

DROP POLICY IF EXISTS "staff_insert_patient_document_reports" ON public.patient_document_reports;
CREATE POLICY "staff_insert_patient_document_reports"
  ON public.patient_document_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS "staff_update_patient_document_reports" ON public.patient_document_reports;
CREATE POLICY "staff_update_patient_document_reports"
  ON public.patient_document_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS "staff_delete_patient_document_reports" ON public.patient_document_reports;
CREATE POLICY "staff_delete_patient_document_reports"
  ON public.patient_document_reports
  FOR DELETE
  TO authenticated
  USING (public.is_active_staff());
