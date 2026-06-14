-- FRANCHIR PATIENT TRACKER — Item B : types de questionnaire (cervical / lombaire)
-- Transmis par le webhook Edge Function → pont questionnaires (neuro_patients.form_types).
-- ⚠️ GATE : appliquer manuellement sur le projet tracker (zdmeidekszdrzmjuasee).

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS form_types TEXT[] NOT NULL DEFAULT ARRAY['cervical'];

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_form_types_check;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_form_types_check
  CHECK (
    form_types <@ ARRAY['cervical', 'lombaire']::TEXT[]
    AND cardinality(form_types) >= 1
    AND cardinality(form_types) <= 2
  );

COMMENT ON COLUMN public.patients.form_types IS
  'Types de questionnaire émis au patient (cervical, lombaire, ou les deux). Synchronisé vers neuro_patients.form_types via le pont questionnaires.';
