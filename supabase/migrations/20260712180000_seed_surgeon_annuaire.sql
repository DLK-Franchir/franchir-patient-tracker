-- Annuaire chirurgiens actifs (aligné prod) — idempotent par email.
-- Dr Doan Co Minh : voir 20260625130000_seed_surgeon_doan_co_minh.sql

INSERT INTO public.surgeons (full_name, email, specialization, is_active)
SELECT 'Simon Teyssedou', 's.teyssedou@gmail.com', 'Neurochirurgie', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.surgeons WHERE lower(email) = lower('s.teyssedou@gmail.com')
);

INSERT INTO public.surgeons (full_name, email, specialization, is_active)
SELECT 'David Brauge', 'david.brauge@ramsaysante.fr', 'Neurochirurgie', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.surgeons WHERE lower(email) = lower('david.brauge@ramsaysante.fr')
);

INSERT INTO public.surgeons (full_name, email, specialization, is_active)
SELECT 'Jean Patrick Rakover', 'jeanpatrickrakover@me.com', 'Neurochirurgie', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.surgeons WHERE lower(email) = lower('jeanpatrickrakover@me.com')
);

INSERT INTO public.surgeons (full_name, email, specialization, is_active)
SELECT 'Soufiane GHAILANE', 'soufiane.ghailane@gmail.com', 'Neurochirurgie', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.surgeons WHERE lower(email) = lower('soufiane.ghailane@gmail.com')
);
