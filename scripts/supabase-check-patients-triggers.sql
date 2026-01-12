-- Vérifier les triggers sur la table patients
SELECT trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'patients';

-- Vérifier les fonctions appelées par ces triggers
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'patients';
