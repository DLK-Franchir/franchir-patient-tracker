-- Schema-only migration : statut terminal « Dossier fermé ».
--
-- Les opérations données ponctuelles prod (archivage Linda G Maslechko, suppression
-- dossiers test) sont dans supabase/scripts/one-time-prod-ops-case-closed.sql
-- et ne doivent PAS être rejouées sur staging / nouvelles bases.
-- Voir docs/migrations-one-time-ops.md

INSERT INTO public.workflow_statuses (code, label, order_position, is_terminal, color)
SELECT 'case_closed', 'Dossier fermé', 10, true, '#9CA3AF'
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflow_statuses WHERE code = 'case_closed'
);
