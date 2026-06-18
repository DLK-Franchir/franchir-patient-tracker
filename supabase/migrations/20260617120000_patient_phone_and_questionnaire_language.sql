-- ============================================================
-- FRANCHIR PATIENT TRACKER — téléphone patient + langue questionnaire
-- Date: 2026-06-17
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE DB : NE PAS appliquer automatiquement en prod. À appliquer par
-- l'utilisateur via le Dashboard Supabase (SQL Editor) ou la CLI :
--   supabase db push --project-ref zdmeidekszdrzmjuasee
-- Migration ADDITIVE uniquement.
-- ============================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_phone TEXT,
  ADD COLUMN IF NOT EXISTS questionnaire_language TEXT NOT NULL DEFAULT 'fr'
    CHECK (questionnaire_language IN ('fr', 'en'));

COMMENT ON COLUMN public.patients.patient_phone IS
  'Téléphone patient (optionnel). Transmis au pont questionnaires pour pré-remplissage identité.';

COMMENT ON COLUMN public.patients.questionnaire_language IS
  'Langue fixe du questionnaire patient (fr/en). Transmise au pont questionnaires à l''envoi du lien.';
