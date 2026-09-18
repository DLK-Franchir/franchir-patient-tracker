-- Renomme le dossier imagerie temporaire (seed 20260918170000) : Sandbox → Armandine.

UPDATE public.patients
SET patient_name = 'Armandine',
    clinical_summary = 'Dossier temporaire interne — dépôt et lecture de scanners / IRM. Visible uniquement par Gilles, Erik et Yves. Ne pas traiter comme un parcours patient.'
WHERE id = 'e7165a6d-4f1d-4111-a000-000000000001'::uuid
  AND patient_name IS DISTINCT FROM 'Armandine';
