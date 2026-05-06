-- ============================================================
-- MIGRATION PREPROD CONSOLIDEE - A appliquer dans Supabase SQL Editor
-- ============================================================

-- 1. Colonnes Sprint 4 (idem 20260504_sprint4_surgery_date.sql)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS confirmed_surgery_date DATE,
  ADD COLUMN IF NOT EXISTS confirmed_surgeon_name TEXT;

-- 2. Fix RLS: is_active_staff() basé sur le rôle uniquement (plus d'emails hardcodés)
-- Emails can differ between auth and profile records; role is the source of truth
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role::text IN ('marcel', 'franchir', 'gilles', 'admin')
  );
$$;
