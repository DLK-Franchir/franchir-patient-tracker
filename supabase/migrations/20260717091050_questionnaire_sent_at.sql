-- Horodatage dédié pour l'alerte stuck-sent (P0).
-- `updated_at` bouge à chaque edit dossier → faux négatifs sur le health pont.
-- Colonne nullable ; backfill best-effort pour les dossiers déjà `sent`.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS questionnaire_sent_at timestamptz;

COMMENT ON COLUMN public.patients.questionnaire_sent_at IS
  'Set when questionnaire_status becomes sent (email link). Used for stuck-sent ops alerts; independent of updated_at.';

UPDATE public.patients
SET questionnaire_sent_at = COALESCE(questionnaire_sent_at, updated_at, created_at)
WHERE questionnaire_status = 'sent'
  AND questionnaire_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS patients_questionnaire_sent_at_sent_idx
  ON public.patients (questionnaire_sent_at)
  WHERE questionnaire_status = 'sent';
