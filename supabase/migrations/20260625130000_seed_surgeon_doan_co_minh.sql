-- Annuaire chirurgien : Dr Doan Co Minh (assignation tracker + sync questionnaires)
INSERT INTO public.surgeons (full_name, email, specialization, is_active)
SELECT 'Dc Doan Co Minh', 'doancominh@gmail.com', 'Neurochirurgie', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.surgeons WHERE lower(email) = lower('doancominh@gmail.com')
);
