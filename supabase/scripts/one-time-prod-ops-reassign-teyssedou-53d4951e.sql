-- Opérations données PONCTUELLES prod — ne pas versionner comme migration récurrente.
-- Exécuter manuellement une seule fois sur le projet Supabase prod tracker
-- (zdmeidekszdrzmjuasee) dans le SQL Editor.
--
-- Contexte : dossier 53d4951e-b9d6-4649-8a8f-2b00c573b4ce
--   réaffectation Brauge → Simon Teyssedou (ops mobile / UI réassignation).

-- 1) État courant + résolution UUID Teyssedou
SELECT
  p.id,
  p.patient_name,
  p.assigned_surgeon_id,
  s.full_name AS current_surgeon,
  ws.code AS status_code
FROM public.patients p
LEFT JOIN public.surgeons s ON s.id = p.assigned_surgeon_id
LEFT JOIN public.workflow_statuses ws ON ws.id = p.current_status_id
WHERE p.id = '53d4951e-b9d6-4649-8a8f-2b00c573b4ce';

SELECT id, full_name, email, is_active
FROM public.surgeons
WHERE lower(email) = lower('s.teyssedou@gmail.com');

-- 2) Réaffectation (idempotent si déjà Teyssedou)
UPDATE public.patients p
SET
  assigned_surgeon_id = s.id,
  updated_at = NOW()
FROM public.surgeons s
WHERE p.id = '53d4951e-b9d6-4649-8a8f-2b00c573b4ce'
  AND lower(s.email) = lower('s.teyssedou@gmail.com')
  AND s.is_active = true
  AND (
    p.assigned_surgeon_id IS DISTINCT FROM s.id
  );

-- 3) Journal d'actions (audit)
INSERT INTO public.patient_messages (
  patient_id,
  kind,
  title,
  body,
  topic,
  author_name,
  author_role,
  meta
)
SELECT
  '53d4951e-b9d6-4649-8a8f-2b00c573b4ce',
  'action',
  'Chirurgien assigné',
  'Chirurgien assigné : Simon Teyssedou. Réaffectation ops Brauge → Teyssedou.',
  'medical',
  'Ops',
  'admin',
  '{"action_id":"assign_surgeon","source":"ops_sql"}'::jsonb
WHERE EXISTS (
  SELECT 1
  FROM public.patients p
  JOIN public.surgeons s ON s.id = p.assigned_surgeon_id
  WHERE p.id = '53d4951e-b9d6-4649-8a8f-2b00c573b4ce'
    AND lower(s.email) = lower('s.teyssedou@gmail.com')
)
AND NOT EXISTS (
  SELECT 1
  FROM public.patient_messages m
  WHERE m.patient_id = '53d4951e-b9d6-4649-8a8f-2b00c573b4ce'
    AND m.kind = 'action'
    AND m.meta->>'source' = 'ops_sql'
    AND m.meta->>'action_id' = 'assign_surgeon'
);

-- 4) Vérification
SELECT
  p.id,
  p.patient_name,
  s.full_name AS assigned_surgeon,
  s.email AS surgeon_email
FROM public.patients p
LEFT JOIN public.surgeons s ON s.id = p.assigned_surgeon_id
WHERE p.id = '53d4951e-b9d6-4649-8a8f-2b00c573b4ce';
