-- ============================================================================
-- 00 — Inventaire schéma tracker (LECTURE SEULE)
-- Projet : zdmeidekszdrzmjuasee (Franchir_Suivi_Patients — prod tracker)
-- Date   : 2026-09-14
--
-- Règles :
--   * SELECT uniquement, aucune DDL / DML.
--   * Aucune colonne nominative (patient_name, patient_email, patient_phone,
--     clinical_summary, questionnaire_summary, body, message, emails staff…)
--     n'est projetée : uniquement catalogue système et agrégats.
--   * Exécutable dans le SQL Editor Supabase ou via MCP execute_sql.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tables et colonnes du schéma public
-- ----------------------------------------------------------------------------
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  col_description(format('%I.%I', c.table_schema, c.table_name)::regclass, c.ordinal_position) AS column_comment
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;


-- ----------------------------------------------------------------------------
-- 2. RLS activée / forcée par table
-- ----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;


-- ----------------------------------------------------------------------------
-- 3. Clés étrangères (relations)
-- ----------------------------------------------------------------------------
SELECT
  con.conname AS constraint_name,
  src.relname AS source_table,
  array_agg(sa.attname ORDER BY u.ord) AS source_columns,
  tn.nspname || '.' || tgt.relname AS target_table,
  array_agg(ta.attname ORDER BY u.ord) AS target_columns,
  CASE con.confdeltype
    WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT'
    WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION'
  END AS on_delete
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.conrelid
JOIN pg_namespace sn ON sn.oid = src.relnamespace
JOIN pg_class tgt ON tgt.oid = con.confrelid
JOIN pg_namespace tn ON tn.oid = tgt.relnamespace
JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS u(src_att, tgt_att, ord) ON TRUE
JOIN pg_attribute sa ON sa.attrelid = src.oid AND sa.attnum = u.src_att
JOIN pg_attribute ta ON ta.attrelid = tgt.oid AND ta.attnum = u.tgt_att
WHERE con.contype = 'f'
  AND sn.nspname = 'public'
GROUP BY con.conname, src.relname, tn.nspname, tgt.relname, con.confdeltype
ORDER BY src.relname, con.conname;


-- ----------------------------------------------------------------------------
-- 4. Contraintes CHECK / UNIQUE
-- ----------------------------------------------------------------------------
SELECT
  rel.relname AS table_name,
  con.conname AS constraint_name,
  con.contype::text AS constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND con.contype IN ('c', 'u', 'p')
ORDER BY rel.relname, con.contype, con.conname;


-- ----------------------------------------------------------------------------
-- 5. Index
-- ----------------------------------------------------------------------------
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ----------------------------------------------------------------------------
-- 6. Politiques RLS (public + storage) — lecture seule, aucune modification
-- ----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text AS roles,
  cmd,
  qual AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- 7. Fonctions du schéma public (sécurité, search_path, définition)
-- ----------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS returns,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  p.proconfig AS config_settings,
  l.lanname AS language,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
ORDER BY p.proname;


-- ----------------------------------------------------------------------------
-- 8. Triggers (public, auth, storage) — hors triggers internes
-- ----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  t.tgenabled AS enabled_flag,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'auth', 'storage')
  AND NOT t.tgisinternal
ORDER BY n.nspname, c.relname, t.tgname;

-- Event triggers (ex. rls_auto_enable)
SELECT evtname, evtevent, evtenabled, evtfoid::regproc AS function_name
FROM pg_event_trigger
ORDER BY evtname;


-- ----------------------------------------------------------------------------
-- 9. Types énumérés
-- ----------------------------------------------------------------------------
SELECT
  t.typname AS enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS labels
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;


-- ----------------------------------------------------------------------------
-- 10. Publications Realtime, buckets Storage, vues
-- ----------------------------------------------------------------------------
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE schemaname = 'public'
ORDER BY pubname, tablename;

SELECT id, name, public, created_at
FROM storage.buckets
ORDER BY id;

SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;


-- ----------------------------------------------------------------------------
-- 11. Migrations enregistrées côté Supabase
-- ----------------------------------------------------------------------------
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;


-- ----------------------------------------------------------------------------
-- 12. Volumétrie exacte par table (aucune donnée nominative)
-- ----------------------------------------------------------------------------
SELECT 'profiles'          AS table_name, count(*) AS rows FROM public.profiles
UNION ALL SELECT 'workflow_statuses', count(*) FROM public.workflow_statuses
UNION ALL SELECT 'surgeons',          count(*) FROM public.surgeons
UNION ALL SELECT 'patients',          count(*) FROM public.patients
UNION ALL SELECT 'medical_decisions', count(*) FROM public.medical_decisions
UNION ALL SELECT 'quotes',            count(*) FROM public.quotes
UNION ALL SELECT 'calendar_events',   count(*) FROM public.calendar_events
UNION ALL SELECT 'audit_logs',        count(*) FROM public.audit_logs
UNION ALL SELECT 'notifications',     count(*) FROM public.notifications
UNION ALL SELECT 'patient_messages',  count(*) FROM public.patient_messages
UNION ALL SELECT 'patient_documents', count(*) FROM public.patient_documents
ORDER BY table_name;


-- ----------------------------------------------------------------------------
-- 13. Référentiel workflow_statuses (données de configuration, non PHI)
-- ----------------------------------------------------------------------------
SELECT code, label, order_position, is_terminal, color
FROM public.workflow_statuses
ORDER BY order_position;


-- ----------------------------------------------------------------------------
-- 14. Répartition des dossiers par statut et complétude des champs
--     (agrégats uniquement — aucune identité)
-- ----------------------------------------------------------------------------
SELECT
  ws.code AS status_code,
  p.status AS legacy_status_text,
  p.questionnaire_status,
  count(*) AS n,
  count(p.assigned_surgeon_id) AS with_surgeon,
  count(p.quote_amount) AS with_quote_amount,
  count(p.proposed_date) AS with_proposed_date,
  sum(p.quote_accepted::int) AS quote_accepted,
  sum(p.date_accepted::int) AS date_accepted,
  count(p.patient_email) AS with_email,
  count(p.patient_phone) AS with_phone,
  count(p.questionnaire_sent_at) AS with_sent_at,
  count(p.questionnaire_completed_at) AS with_completed_at,
  count(p.last_questionnaire_url) AS with_cached_url,
  sum((jsonb_array_length(coalesce(p.recommended_surgeons, '[]'::jsonb)) > 0)::int) AS with_recommended,
  sum((p.updated_at IS DISTINCT FROM p.created_at)::int) AS updated_at_differs
FROM public.patients p
LEFT JOIN public.workflow_statuses ws ON ws.id = p.current_status_id
GROUP BY 1, 2, 3
ORDER BY n DESC;


-- ----------------------------------------------------------------------------
-- 15. Taxonomie des événements patient_messages (kind × topic × action_id)
-- ----------------------------------------------------------------------------
SELECT
  kind,
  topic,
  author_role,
  meta ->> 'action_id' AS action_id,
  (meta ? 'old_status') AS has_old_status,
  (meta ? 'new_status') AS has_new_status,
  meta ->> 'source' AS source,
  count(*) AS n,
  min(created_at)::date AS first_seen,
  max(created_at)::date AS last_seen
FROM public.patient_messages
GROUP BY 1, 2, 3, 4, 5, 6, 7
ORDER BY n DESC;

-- Clés JSON présentes dans meta
SELECT k AS meta_key, count(*) AS n
FROM public.patient_messages, jsonb_object_keys(coalesce(meta, '{}'::jsonb)) k
GROUP BY k
ORDER BY n DESC;

-- Paires de transition observées
SELECT
  coalesce(meta ->> 'old_status', '∅') || ' -> ' || coalesce(meta ->> 'new_status', '∅') AS transition,
  count(*) AS n
FROM public.patient_messages
WHERE kind = 'status_change'
GROUP BY 1
ORDER BY n DESC;


-- ----------------------------------------------------------------------------
-- 16. Intégrité de la chaîne de statuts (old_status = new_status précédent)
-- ----------------------------------------------------------------------------
WITH sc AS (
  SELECT
    patient_id,
    created_at,
    meta ->> 'old_status' AS o,
    meta ->> 'new_status' AS nw,
    lag(meta ->> 'new_status') OVER (PARTITION BY patient_id ORDER BY created_at) AS prev_new
  FROM public.patient_messages
  WHERE kind = 'status_change'
)
SELECT
  count(*) AS transitions,
  sum((prev_new IS NULL)::int) AS first_transitions,
  sum((prev_new IS NULL AND o <> 'prospect_created')::int) AS first_transition_not_from_created,
  sum((prev_new IS NOT NULL AND o IS DISTINCT FROM prev_new)::int) AS chain_breaks,
  sum((o IS NULL OR nw IS NULL)::int) AS missing_meta
FROM sc;

-- Cohérence statut courant vs dernier événement ; couverture création / assignation
WITH sc AS (
  SELECT patient_id, created_at, meta ->> 'new_status' AS nw
  FROM public.patient_messages
  WHERE kind = 'status_change'
),
per_patient AS (
  SELECT
    p.id,
    ws.code AS current_code,
    (SELECT count(*) FROM sc WHERE sc.patient_id = p.id) AS n_status_events,
    (SELECT nw FROM sc WHERE sc.patient_id = p.id ORDER BY created_at DESC LIMIT 1) AS last_event_new_status,
    (SELECT count(*) FROM public.patient_messages m
       WHERE m.patient_id = p.id AND m.kind = 'action' AND m.meta ->> 'action_id' = 'assign_surgeon') AS n_assign_events,
    (p.assigned_surgeon_id IS NOT NULL) AS has_surgeon,
    (SELECT count(*) FROM public.patient_messages m
       WHERE m.patient_id = p.id AND m.meta ->> 'action_id' = 'create_patient') AS n_create_events
  FROM public.patients p
  LEFT JOIN public.workflow_statuses ws ON ws.id = p.current_status_id
)
SELECT
  count(*) AS patients,
  sum((n_status_events = 0)::int) AS patients_without_status_events,
  sum((current_code IS DISTINCT FROM coalesce(last_event_new_status, 'prospect_created'))::int) AS current_status_mismatch_vs_last_event,
  sum((has_surgeon AND n_assign_events = 0)::int) AS surgeon_set_without_assign_event,
  sum((NOT has_surgeon AND n_assign_events > 0)::int) AS assign_event_but_no_surgeon,
  sum((n_create_events = 0)::int) AS patients_without_create_event
FROM per_patient;


-- ----------------------------------------------------------------------------
-- 17. Notifications : types et titres (libellés système, sans le champ message)
-- ----------------------------------------------------------------------------
SELECT type, title, count(*) AS n, sum((NOT is_read)::int) AS unread
FROM public.notifications
GROUP BY type, title
ORDER BY n DESC;


-- ----------------------------------------------------------------------------
-- 18. Avertissements linter Supabase (équivalent get_advisors — à exécuter via
--     MCP `get_advisors` type=security / performance ; pas de vue SQL directe)
-- ----------------------------------------------------------------------------
-- (documenté dans reports/00_architecture_inventory.md §6)
