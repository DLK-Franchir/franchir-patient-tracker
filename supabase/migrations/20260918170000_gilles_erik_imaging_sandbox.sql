-- ============================================================
-- FRANCHIR PATIENT TRACKER — dossier imagerie temporaire Gilles + Erik
-- Date: 2026-09-18
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- Dossier sandbox (scanners / IRM), hors parcours Marcel.
-- visibilité = e-mails Gilles + Erik (Erik est rôle `franchir` en prod,
-- pas `admin` — ne PAS filtrer sur le rôle).
-- Idempotent.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'all_staff';

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_visibility_scope_check;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_visibility_scope_check
  CHECK (visibility_scope IN ('all_staff', 'gilles_erik'));

COMMENT ON COLUMN public.patients.visibility_scope IS
  'all_staff = cockpit partagé. gilles_erik = dossier interne (imagerie), visible uniquement Gilles + Erik.';

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
        'erik.boulard@franchir.eu'
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_gilles_or_erik_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gilles_or_erik_staff() TO authenticated, service_role;

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
          'erik.boulard@franchir.eu'
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_patient_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_patient_id(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS staff_select_patients ON public.patients;
DROP POLICY IF EXISTS staff_insert_patients ON public.patients;
DROP POLICY IF EXISTS staff_update_patients ON public.patients;
CREATE POLICY staff_select_patients ON public.patients
  FOR SELECT TO authenticated
  USING ((SELECT public.can_view_patient_id(id)));
CREATE POLICY staff_insert_patients ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_active_staff())
    AND (
      visibility_scope IS DISTINCT FROM 'gilles_erik'
      OR (SELECT public.is_gilles_or_erik_staff())
    )
  );
CREATE POLICY staff_update_patients ON public.patients
  FOR UPDATE TO authenticated
  USING ((SELECT public.can_view_patient_id(id)))
  WITH CHECK ((SELECT public.can_view_patient_id(id)));

DROP POLICY IF EXISTS staff_select_patient_messages ON public.patient_messages;
DROP POLICY IF EXISTS staff_insert_own_patient_messages ON public.patient_messages;
CREATE POLICY staff_select_patient_messages ON public.patient_messages
  FOR SELECT TO authenticated
  USING ((SELECT public.can_view_patient_id(patient_id)));
CREATE POLICY staff_insert_own_patient_messages ON public.patient_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.can_view_patient_id(patient_id))
    AND author_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "staff_select_patient_documents" ON public.patient_documents;
DROP POLICY IF EXISTS "staff_insert_patient_documents" ON public.patient_documents;
DROP POLICY IF EXISTS "staff_delete_patient_documents" ON public.patient_documents;
CREATE POLICY "staff_select_patient_documents"
  ON public.patient_documents
  FOR SELECT TO authenticated
  USING ((SELECT public.can_view_patient_id(patient_id)));
CREATE POLICY "staff_insert_patient_documents"
  ON public.patient_documents
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.can_view_patient_id(patient_id)));
CREATE POLICY "staff_delete_patient_documents"
  ON public.patient_documents
  FOR DELETE TO authenticated
  USING ((SELECT public.can_view_patient_id(patient_id)));

INSERT INTO public.patients (
  id,
  patient_name,
  patient_email,
  patient_phone,
  questionnaire_language,
  clinical_summary,
  form_types,
  current_status_id,
  created_by,
  visibility_scope
)
SELECT
  'e7165a6d-4f1d-4111-a000-000000000001'::uuid,
  'Sandbox imagerie (temporaire)',
  NULL,
  NULL,
  'fr',
  'Dossier temporaire interne — dépôt et lecture de scanners / IRM. Visible uniquement par Gilles et Erik. Ne pas traiter comme un parcours patient.',
  ARRAY['cervical'::text],
  ws.id,
  pr.id,
  'gilles_erik'
FROM public.workflow_statuses ws
JOIN public.profiles pr ON lower(pr.email) = 'erik.boulard@franchir.eu'
WHERE ws.code = 'validated_medical'
  AND NOT EXISTS (
    SELECT 1
    FROM public.patients existing
    WHERE existing.id = 'e7165a6d-4f1d-4111-a000-000000000001'::uuid
       OR (
         existing.visibility_scope = 'gilles_erik'
         AND existing.patient_name = 'Sandbox imagerie (temporaire)'
       )
  );
