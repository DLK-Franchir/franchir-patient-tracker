-- ============================================================
-- FRANCHIR PATIENT TRACKER — intégration révisée questionnaires
-- Date: 2026-06-13
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE DB : NE PAS appliquer automatiquement en prod. À appliquer par
-- l'utilisateur via le Dashboard Supabase (SQL Editor) ou la CLI :
--   supabase db push --project-ref zdmeidekszdrzmjuasee
-- Migration ADDITIVE uniquement (aucune colonne supprimée, aucun NOT NULL
-- ajouté, aucune policy modifiée). Sans risque pour l'existant.
-- ============================================================

-- ── T2 : email patient (D1) ─────────────────────────────────
-- Indispensable pour que l'app questionnaires envoie le lien au patient.
-- Transmis par le webhook (Edge Function) au pont questionnaires.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_email TEXT;

COMMENT ON COLUMN public.patients.patient_email IS
  'Email patient réel (D1). Saisi à la création, transmis par le webhook au pont questionnaires pour l''envoi du lien de questionnaire. Nullable.';

-- ── T4 : retour « questionnaire complété » → tracker ────────
-- Sous-état de complétion du questionnaire (NE remplace PAS le code workflow,
-- qui reste medical_review — décision D7). Posé par le récepteur du callback
-- questionnaires → tracker (app/api/integrations/questionnaires/session-status).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS questionnaire_status TEXT,
  ADD COLUMN IF NOT EXISTS questionnaire_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS questionnaire_summary TEXT;

COMMENT ON COLUMN public.patients.questionnaire_status IS
  'Sous-état de complétion du questionnaire patient (ex. "completed"). Indépendant du code workflow (D7) — posé par le callback retour questionnaires → tracker.';
COMMENT ON COLUMN public.patients.questionnaire_completed_at IS
  'Horodatage de complétion du questionnaire (callback retour).';
COMMENT ON COLUMN public.patients.questionnaire_summary IS
  'Résumé synthétique (PHI-minimal) poussé par l''app questionnaires à la complétion.';
