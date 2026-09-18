-- ============================================================
-- FRANCHIR PATIENT TRACKER — sandbox imagerie : accès Yves = Erik
-- Date: 2026-09-18
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- Étend is_gilles_or_erik_staff() / can_view_patient_id() à
-- yves.merillon@franchir.eu (même accès qu'Erik : fiche + visionneuse + upload).
-- Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.is_gilles_or_erik_staff()
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
      AND lower(email) IN (
        'duboisgilles31@gmail.com',
        'duboisgilles31@franchir.eu',
        'erik.boulard@franchir.eu',
        'yves.merillon@franchir.eu'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_patient_id(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients p
    JOIN public.profiles pr ON pr.id = auth.uid()
    WHERE p.id = pid
      AND pr.is_active
      AND pr.role::text IN ('marcel', 'franchir', 'gilles', 'admin')
      AND (
        coalesce(p.visibility_scope, 'all_staff') IS DISTINCT FROM 'gilles_erik'
        OR lower(pr.email) IN (
          'duboisgilles31@gmail.com',
          'duboisgilles31@franchir.eu',
          'erik.boulard@franchir.eu',
          'yves.merillon@franchir.eu'
        )
      )
  );
$$;

COMMENT ON COLUMN public.patients.visibility_scope IS
  'all_staff = cockpit partagé. gilles_erik = dossier interne (imagerie), visible Gilles + Erik + Yves.';
