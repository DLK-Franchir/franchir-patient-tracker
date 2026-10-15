-- ============================================================
-- FRANCHIR PATIENT TRACKER — fix création dossier Marcel (RLS)
-- Date: 2026-09-27
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- Symptôme prod : POST /api/patients →
--   "new row violates row-level security policy for table \"patients\""
--
-- Cause : depuis 20260918170000 (sandbox gilles_erik), staff_select_patients
-- utilise can_view_patient_id(id), qui RE-lit public.patients. Or l'API fait
-- .insert(...).select().single() (= INSERT ... RETURNING). Pendant le check
-- SELECT du RETURNING, la re-lecture ne voit pas encore la nouvelle ligne →
-- WITH CHECK/SELECT échoue alors que l'INSERT seul passerait.
--
-- Fix : évaluer visibility_scope sur la ligne courante (comme staff_insert),
-- sans re-query. can_view_patient_id() reste pour messages / documents
-- (patient_id déjà existant). Idempotent.
-- ============================================================

DROP POLICY IF EXISTS staff_select_patients ON public.patients;
CREATE POLICY staff_select_patients ON public.patients
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_active_staff())
    AND (
      coalesce(visibility_scope, 'all_staff') IS DISTINCT FROM 'gilles_erik'
      OR (SELECT public.is_gilles_or_erik_staff())
    )
  );

DROP POLICY IF EXISTS staff_update_patients ON public.patients;
CREATE POLICY staff_update_patients ON public.patients
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_active_staff())
    AND (
      coalesce(visibility_scope, 'all_staff') IS DISTINCT FROM 'gilles_erik'
      OR (SELECT public.is_gilles_or_erik_staff())
    )
  )
  WITH CHECK (
    (SELECT public.is_active_staff())
    AND (
      coalesce(visibility_scope, 'all_staff') IS DISTINCT FROM 'gilles_erik'
      OR (SELECT public.is_gilles_or_erik_staff())
    )
  );
