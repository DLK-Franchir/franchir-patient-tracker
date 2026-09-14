-- ============================================================
-- FRANCHIR PATIENT TRACKER — trigger updated_at sur patients / profiles
-- Date: 2026-09-14
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE DB : NE PAS appliquer automatiquement en prod. À appliquer par
-- l'utilisateur via le Dashboard Supabase (SQL Editor) ou la CLI :
--   supabase db push --project-ref zdmeidekszdrzmjuasee
--
-- Migration ADDITIVE et IDEMPOTENTE (CREATE OR REPLACE / DROP IF EXISTS).
--
-- Contexte (audit 2026-09-14, reports/00_architecture_inventory.md §4 / §8) :
--   supabase-schema.sql déclare les triggers `update_patients_updated_at` et
--   `update_profiles_updated_at`, mais ils sont ABSENTS en prod :
--   `patients.updated_at` n'est pas une horloge fiable de dernière modification
--   (≠ created_at sur 3/33 dossiers seulement, posés à la main par des scripts).
--
-- Effets de bord à connaître :
--   - Le trigger `sync_patient_to_questionnaires` (AFTER INSERT OR UPDATE ON
--     patients) se déclenche déjà à CHAQUE UPDATE : ce trigger BEFORE UPDATE ne
--     provoque AUCUNE synchronisation supplémentaire vers l'app questionnaires
--     (il modifie NEW dans la même écriture).
--   - L'alerte stuck-sent utilise `questionnaire_sent_at` (migration
--     20260717091050) et ne dépend plus de `updated_at` : le fait que
--     `updated_at` bouge désormais à chaque édition n'a pas d'impact ops pont.
--   - Un UPDATE qui pose explicitement `updated_at = ...` est écrasé par NOW().
--
-- Aucune policy RLS ni fonction `is_active_staff()` modifiée.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS
  'Trigger BEFORE UPDATE : positionne NEW.updated_at = NOW(). SECURITY INVOKER, search_path figé.';

-- ── patients ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_patients_updated_at ON public.patients;

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── profiles ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
