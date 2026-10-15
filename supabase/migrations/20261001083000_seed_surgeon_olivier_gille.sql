-- Annuaire chirurgien : Dr Olivier Gille (CHU Bordeaux) — assignation tracker + sync questionnaires.
-- Déjà présent en prod (zdmeidekszdrzmjuasee) depuis le 2026-10-01 ; idempotent par email,
-- même adresse que le compte clinicien côté questionnaires (vsnjahkrsqxbvspwhaka).
INSERT INTO public.surgeons (full_name, email, specialization, is_active)
SELECT 'Olivier Gille', 'olivier.gille@chu-bordeaux.fr', 'Neurochirurgie', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.surgeons WHERE lower(email) = lower('olivier.gille@chu-bordeaux.fr')
);
