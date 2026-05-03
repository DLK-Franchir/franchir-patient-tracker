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
      AND lower(email) IN (
        'marcel.mazaltarim@gmail.com',
        'duboisgilles31@gmail.com',
        'duboisgilles31@franchir.eu',
        'erik.boulard@franchir.eu',
        'yves.merillon@franchir.eu'
      )
      AND role::text IN ('marcel', 'franchir', 'gilles', 'admin')
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "All authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can view all patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Only marcel franchir and admin can create patients" ON public.patients;
DROP POLICY IF EXISTS "Only marcel franchir and admin can update patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can view all decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "All authenticated users can view medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "Only gilles can create medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "Authenticated users can view all statuses" ON public.workflow_statuses;
DROP POLICY IF EXISTS "Authenticated users can view all surgeons" ON public.surgeons;
DROP POLICY IF EXISTS "Authenticated users can view all quotes" ON public.quotes;
DROP POLICY IF EXISTS "All authenticated users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only marcel franchir and admin can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only marcel franchir and admin can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can view all events" ON public.calendar_events;
DROP POLICY IF EXISTS "All authenticated users can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Only marcel franchir and admin can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Only marcel franchir and admin can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can view all messages" ON public.patient_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.patient_messages;
DROP POLICY IF EXISTS "Staff can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;
DROP POLICY IF EXISTS "Marcel Franchir and admin can create patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can update patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can view workflow statuses" ON public.workflow_statuses;
DROP POLICY IF EXISTS "Staff can view surgeons" ON public.surgeons;
DROP POLICY IF EXISTS "Staff can view medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "Gilles and admin can create medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "Staff can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Commercial roles can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Commercial roles can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Staff can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Commercial roles can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Commercial roles can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Staff can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can view patient messages" ON public.patient_messages;
DROP POLICY IF EXISTS "Staff can create patient messages" ON public.patient_messages;

CREATE OR REPLACE FUNCTION public.has_staff_role(required_roles text[])
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
      AND public.is_active_staff()
      AND role::text = ANY(required_roles)
  );
$$;

CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can view patients" ON public.patients FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Marcel Franchir and admin can create patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(ARRAY['marcel', 'franchir', 'admin']) AND created_by = auth.uid());
CREATE POLICY "Staff can update patients" ON public.patients FOR UPDATE TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can view workflow statuses" ON public.workflow_statuses FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can view surgeons" ON public.surgeons FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can view medical decisions" ON public.medical_decisions FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Gilles and admin can create medical decisions" ON public.medical_decisions FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(ARRAY['gilles', 'admin']) AND decided_by = auth.uid());
CREATE POLICY "Staff can view quotes" ON public.quotes FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Commercial roles can create quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(ARRAY['marcel', 'franchir', 'admin']) AND created_by = auth.uid());
CREATE POLICY "Commercial roles can update quotes" ON public.quotes FOR UPDATE TO authenticated USING (public.has_staff_role(ARRAY['marcel', 'franchir', 'admin'])) WITH CHECK (public.has_staff_role(ARRAY['marcel', 'franchir', 'admin']));
CREATE POLICY "Staff can view calendar events" ON public.calendar_events FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Commercial roles can create calendar events" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(ARRAY['marcel', 'franchir', 'admin']) AND created_by = auth.uid());
CREATE POLICY "Commercial roles can update calendar events" ON public.calendar_events FOR UPDATE TO authenticated USING (public.has_staff_role(ARRAY['marcel', 'franchir', 'admin'])) WITH CHECK (public.has_staff_role(ARRAY['marcel', 'franchir', 'admin']));
CREATE POLICY "Staff can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff can view patient messages" ON public.patient_messages FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "Staff can create patient messages" ON public.patient_messages FOR INSERT TO authenticated WITH CHECK (public.is_active_staff() AND author_id = auth.uid());
