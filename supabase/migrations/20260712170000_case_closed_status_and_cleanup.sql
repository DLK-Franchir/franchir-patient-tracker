-- Statut terminal « Dossier fermé » + nettoyage dossiers test + archivage Linda G Maslechko
INSERT INTO public.workflow_statuses (code, label, order_position, is_terminal, color)
SELECT 'case_closed', 'Dossier fermé', 10, true, '#9CA3AF'
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflow_statuses WHERE code = 'case_closed'
);

-- Archiver Linda G Maslechko (dossier inactif conservé en lecture)
UPDATE public.patients
SET current_status_id = (SELECT id FROM public.workflow_statuses WHERE code = 'case_closed' LIMIT 1),
    updated_at = NOW()
WHERE id = '3ad2cf18-94d5-4cdf-b3fa-b14d55f91f38';

-- Supprimer les dossiers test inutiles (cascade messages, documents, etc.)
DELETE FROM public.patients
WHERE id IN (
  '5a542927-0d2d-4cd7-9b30-37d278bf8d3c',
  'f7cff3b2-2c58-4b59-a3cb-88fa5d9fd6ce'
);
