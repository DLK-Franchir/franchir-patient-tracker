-- ============================================================
-- FRANCHIR PATIENT TRACKER — verrou « staff actif » en base (RLS)
-- Date: 2026-09-14
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ✅ APPLIQUÉE EN PROD le 2026-09-14 (go explicite, via Supabase MCP
-- apply_migration). Ce fichier est la trace versionnée ; il est IDEMPOTENT
-- (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS) et
-- peut être rejoué sans effet supplémentaire.
--
-- Contexte (audit 2026-09-14, reports/00_architecture_inventory.md §6) :
--   - Toutes les policies de `patients`, `patient_messages`, `profiles`,
--     `medical_decisions`, `quotes`, `calendar_events`, `audit_logs`,
--     `workflow_statuses`, `surgeons` étaient `true` pour tout rôle
--     `authenticated` : n'importe quel compte Supabase Auth du projet (dont
--     2 profils hors staff, créés en février/mars 2026 et jamais réutilisés)
--     pouvait lire et écrire tous les dossiers via PostgREST / Realtime, en
--     contournant les contrôles TypeScript (`lib/access-control.ts`).
--   - `is_active_staff()` prod ne vérifiait que le rôle ; or `handle_new_user`
--     attribue le rôle `franchir` par défaut à tout nouveau compte Auth.
--   - La policy « Users can view messages for their patients » (filtre topic
--     pour Gilles) était inopérante (PERMISSIVE en OR avec `true`).
--
-- Décisions :
--   1. Nouvelle colonne `profiles.is_active` (défaut FALSE). Un compte n'a
--      accès aux données qu'une fois explicitement activé (scripts
--      `scripts/create-*-account.mjs`, ou UPDATE service-role). Choix préféré
--      à une whitelist d'e-mails codée dans la fonction SQL (celle du repo
--      avait déjà dérivé de `ACTIVE_STAFF_EMAILS`).
--   2. `is_active_staff()` = profil existant + `is_active` + rôle staff.
--   3. Toutes les policies `true` deviennent `is_active_staff()`. Le
--      cloisonnement PAR RÔLE (Gilles ne voit que certains statuts, seuls
--      marcel/franchir/admin créent…) reste volontairement côté API : le
--      reproduire en SQL doublerait la logique métier.
--   4. `patient_messages` : LECTURE DE TOUS LES MESSAGES PAR TOUT LE STAFF
--      ACTIF, quel que soit le topic (exigence produit + Realtime). La policy
--      « filtre topic Gilles » morte est supprimée. INSERT : staff actif et
--      `author_id = auth.uid()` (les événements système passent par le
--      service-role, qui ignore la RLS).
--   5. `profiles` : lisible par le staff actif, ou par soi-même (le flux de
--      login lit son propre profil avant de connaître son statut).
--   6. Hygiène advisors : fonctions SECURITY DEFINER plus exécutables par
--      `anon`/`authenticated` via RPC (sauf `is_active_staff`, nécessaire aux
--      policies, retirée à `anon` seulement) ; `search_path` fixé sur
--      `test_set_auth_uid`.
--
-- Effet pour les utilisateurs :
--   - Staff actif (6 e-mails de `ACTIVE_STAFF_EMAILS`) : AUCUN changement
--     fonctionnel (lecture/écriture identiques, Realtime identique).
--   - Comptes hors whitelist : plus aucune lecture/écriture en base (ils
--     étaient déjà refusés par l'API ; seul l'accès direct PostgREST se ferme).
--   - Nouveau compte : inerte tant que `is_active` n'est pas posé.
-- ============================================================

-- 1. Colonne d'activation ---------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_active IS
  'Verrou d''accès aux données (RLS via is_active_staff()). FALSE par défaut : un compte Auth ne voit rien tant qu''il n''est pas activé explicitement (service-role).';

-- Backfill : miroir de ACTIVE_STAFF_EMAILS (lib/access-control.ts) au 2026-09-14.
UPDATE public.profiles
SET is_active = true
WHERE lower(email) IN (
  'marcel.mazaltarim@gmail.com',
  'pmazaltarim@neuromtl.com',
  'duboisgilles31@gmail.com',
  'duboisgilles31@franchir.eu',
  'erik.boulard@franchir.eu',
  'yves.merillon@franchir.eu'
)
  AND role::text IN ('marcel', 'franchir', 'gilles', 'admin')
  AND is_active = false;

-- 2. Fonction de garde -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active
      AND role::text IN ('marcel', 'franchir', 'gilles', 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_active_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated, service_role;

-- 3. Hygiène fonctions SECURITY DEFINER (advisors Supabase) ------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_gilles_on_new_patient() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.test_set_auth_uid(uuid) SET search_path = public, pg_temp;

-- 4. Policies : `true` -> staff actif ---------------------------------------
-- patients
DROP POLICY IF EXISTS "Authenticated users can view all patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients" ON public.patients;
DROP POLICY IF EXISTS staff_select_patients ON public.patients;
DROP POLICY IF EXISTS staff_insert_patients ON public.patients;
DROP POLICY IF EXISTS staff_update_patients ON public.patients;
CREATE POLICY staff_select_patients ON public.patients
  FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));
CREATE POLICY staff_insert_patients ON public.patients
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_active_staff()));
CREATE POLICY staff_update_patients ON public.patients
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_active_staff()))
  WITH CHECK ((SELECT public.is_active_staff()));

-- patient_messages : lecture de tous les messages par tout le staff actif.
DROP POLICY IF EXISTS "Authenticated users can view all messages" ON public.patient_messages;
DROP POLICY IF EXISTS "Users can view messages for their patients" ON public.patient_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.patient_messages;
DROP POLICY IF EXISTS staff_select_patient_messages ON public.patient_messages;
DROP POLICY IF EXISTS staff_insert_own_patient_messages ON public.patient_messages;
CREATE POLICY staff_select_patient_messages ON public.patient_messages
  FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));
CREATE POLICY staff_insert_own_patient_messages ON public.patient_messages
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_active_staff()) AND author_id = (SELECT auth.uid()));

-- notifications : SELECT/UPDATE « own » inchangés ; INSERT réservé au staff actif
-- (l'émetteur notifie d'autres user_id, on ne peut pas contraindre user_id = uid).
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS staff_insert_notifications ON public.notifications;
CREATE POLICY staff_insert_notifications ON public.notifications
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_active_staff()));

-- profiles : staff actif, ou son propre profil.
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_staff_or_self ON public.profiles;
CREATE POLICY profiles_select_staff_or_self ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT public.is_active_staff()) OR id = (SELECT auth.uid()));

-- Référentiels
DROP POLICY IF EXISTS "Authenticated users can view all statuses" ON public.workflow_statuses;
DROP POLICY IF EXISTS staff_select_workflow_statuses ON public.workflow_statuses;
CREATE POLICY staff_select_workflow_statuses ON public.workflow_statuses
  FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));

DROP POLICY IF EXISTS "Authenticated users can view all surgeons" ON public.surgeons;
DROP POLICY IF EXISTS staff_select_surgeons ON public.surgeons;
CREATE POLICY staff_select_surgeons ON public.surgeons
  FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));

-- Tables vides / non utilisées par l'application (alignées par cohérence)
DROP POLICY IF EXISTS "Authenticated users can view all decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "Users can insert medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "Users can update medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS staff_all_medical_decisions ON public.medical_decisions;
CREATE POLICY staff_all_medical_decisions ON public.medical_decisions
  FOR ALL TO authenticated
  USING ((SELECT public.is_active_staff()))
  WITH CHECK ((SELECT public.is_active_staff()));

DROP POLICY IF EXISTS "Authenticated users can view all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update quotes" ON public.quotes;
DROP POLICY IF EXISTS staff_all_quotes ON public.quotes;
CREATE POLICY staff_all_quotes ON public.quotes
  FOR ALL TO authenticated
  USING ((SELECT public.is_active_staff()))
  WITH CHECK ((SELECT public.is_active_staff()));

DROP POLICY IF EXISTS "Authenticated users can view all events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can insert calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS staff_all_calendar_events ON public.calendar_events;
CREATE POLICY staff_all_calendar_events ON public.calendar_events
  FOR ALL TO authenticated
  USING ((SELECT public.is_active_staff()))
  WITH CHECK ((SELECT public.is_active_staff()));

DROP POLICY IF EXISTS "Authenticated users can view all logs" ON public.audit_logs;
DROP POLICY IF EXISTS staff_select_audit_logs ON public.audit_logs;
CREATE POLICY staff_select_audit_logs ON public.audit_logs
  FOR SELECT TO authenticated USING ((SELECT public.is_active_staff()));

-- Non touché ici : patient_documents et storage.objects (déjà sur
-- is_active_staff(), bénéficient automatiquement du nouveau verrou) ;
-- policies « own » de notifications ; INSERT/DELETE profiles (false).
