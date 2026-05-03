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
