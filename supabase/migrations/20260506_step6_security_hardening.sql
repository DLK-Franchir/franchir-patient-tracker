DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can create own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can delete patients" ON public.patients;
DROP POLICY IF EXISTS "Authors and admins can update patient messages" ON public.patient_messages;

CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (public.is_active_staff() AND user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (public.is_active_staff() AND user_id = auth.uid())
WITH CHECK (public.is_active_staff() AND user_id = auth.uid());

CREATE POLICY "Staff can create own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_active_staff() AND user_id = auth.uid());

CREATE POLICY "Admins can delete patients"
ON public.patients
FOR DELETE
TO authenticated
USING (public.has_staff_role(ARRAY['admin']));

CREATE POLICY "Authors and admins can update patient messages"
ON public.patient_messages
FOR UPDATE
TO authenticated
USING (author_id = auth.uid() OR public.has_staff_role(ARRAY['admin']))
WITH CHECK (author_id = auth.uid() OR public.has_staff_role(ARRAY['admin']));