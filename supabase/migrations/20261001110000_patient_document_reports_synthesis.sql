-- ============================================================
-- FRANCHIR PATIENT TRACKER — synthèse CR (pas seulement extract)
-- Date: 2026-10-01
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ✅ APPLIQUÉE EN PROD le 2026-10-01 (Supabase MCP apply_migration).
-- ADDITIVE : colonnes de synthèse structurée sur patient_document_reports.
-- ============================================================

ALTER TABLE public.patient_document_reports
  ADD COLUMN IF NOT EXISTS synthesis jsonb,
  ADD COLUMN IF NOT EXISTS synthesis_status text
    CHECK (synthesis_status IS NULL OR synthesis_status IN ('pending', 'ok', 'error', 'skipped')),
  ADD COLUMN IF NOT EXISTS synthesis_model text,
  ADD COLUMN IF NOT EXISTS synthesized_at timestamptz;

COMMENT ON COLUMN public.patient_document_reports.synthesis IS
  'Synthèse structurée pour le staff : { headline, context, keyFindings[], conclusion, absentNotes[] }. Ancrée au texte du PDF.';
COMMENT ON COLUMN public.patient_document_reports.synthesis_status IS
  'pending | ok | error | skipped — distinct du statut d''extraction texte.';
