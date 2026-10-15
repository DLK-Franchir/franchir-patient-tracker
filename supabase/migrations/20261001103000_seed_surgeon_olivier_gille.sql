-- Annuaire: Dr Olivier Gille (CHU Bordeaux) — idempotent par email.
INSERT INTO public.surgeons (full_name, email, specialization, hospital, is_active)
SELECT 'Olivier Gille', 'olivier.gille@chu-bordeaux.fr', 'Neurochirurgie', 'CHU Bordeaux', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.surgeons WHERE lower(email) = lower('olivier.gille@chu-bordeaux.fr')
);

UPDATE public.surgeons
SET full_name = 'Olivier Gille',
    specialization = 'Neurochirurgie',
    hospital = 'CHU Bordeaux',
    is_active = true
WHERE lower(email) = lower('olivier.gille@chu-bordeaux.fr');
