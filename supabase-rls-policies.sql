-- FRANCHIR - Renforcement des RLS Policies
-- À exécuter dans Supabase SQL Editor

-- ============================================
-- 0. CRÉATION DE LA TABLE NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON public.notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Activer RLS sur la table notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. NETTOYAGE DE TOUTES LES POLICIES EXISTANTES
-- ============================================

DROP POLICY IF EXISTS "Users can see all patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "All authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "Only marcel franchir and admin can create patients" ON public.patients;
DROP POLICY IF EXISTS "Only marcel franchir and admin can update patients" ON public.patients;

DROP POLICY IF EXISTS "Anyone can insert medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "All authenticated users can view medical decisions" ON public.medical_decisions;
DROP POLICY IF EXISTS "Only gilles can create medical decisions" ON public.medical_decisions;

DROP POLICY IF EXISTS "Anyone can manage quotes" ON public.quotes;
DROP POLICY IF EXISTS "All authenticated users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only marcel franchir and admin can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only marcel franchir and admin can update quotes" ON public.quotes;

DROP POLICY IF EXISTS "Anyone can manage calendar" ON public.calendar_events;
DROP POLICY IF EXISTS "All authenticated users can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Only marcel franchir and admin can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Only marcel franchir and admin can update calendar events" ON public.calendar_events;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

-- ============================================
-- 2. POLICIES POUR LA TABLE PATIENTS
-- ============================================

CREATE POLICY "All authenticated users can view patients"
ON public.patients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only marcel franchir and admin can create patients"
ON public.patients FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('marcel', 'franchir', 'admin')
  )
);

CREATE POLICY "Only marcel franchir and admin can update patients"
ON public.patients FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('marcel', 'franchir', 'admin')
  )
);

-- ============================================
-- 3. POLICIES POUR MEDICAL_DECISIONS
-- ============================================

CREATE POLICY "All authenticated users can view medical decisions"
ON public.medical_decisions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only gilles can create medical decisions"
ON public.medical_decisions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gilles'
  )
);

-- ============================================
-- 4. POLICIES POUR QUOTES
-- ============================================

CREATE POLICY "All authenticated users can view quotes"
ON public.quotes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only marcel franchir and admin can create quotes"
ON public.quotes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('marcel', 'franchir', 'admin')
  )
);

CREATE POLICY "Only marcel franchir and admin can update quotes"
ON public.quotes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('marcel', 'franchir', 'admin')
  )
);

-- ============================================
-- 5. POLICIES POUR CALENDAR_EVENTS
-- ============================================

CREATE POLICY "All authenticated users can view calendar events"
ON public.calendar_events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only marcel franchir and admin can create calendar events"
ON public.calendar_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('marcel', 'franchir', 'admin')
  )
);

CREATE POLICY "Only marcel franchir and admin can update calendar events"
ON public.calendar_events FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('marcel', 'franchir', 'admin')
  )
);

-- ============================================
-- 6. POLICIES POUR NOTIFICATIONS
-- ============================================

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- 7. TRIGGERS POUR NOTIFICATIONS AUTOMATIQUES
-- ============================================

CREATE OR REPLACE FUNCTION notify_doctor_on_new_patient()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, patient_id, title, message, type)
  SELECT
    profiles.id,
    NEW.id,
    'Nouveau patient à examiner',
    'Un nouveau dossier patient (' || NEW.patient_name || ') a été créé et attend votre revue médicale.',
    'info'
  FROM public.profiles
  WHERE profiles.role = 'gilles';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_doctor_on_new_patient ON public.patients;
CREATE TRIGGER trigger_notify_doctor_on_new_patient
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION notify_doctor_on_new_patient();

-- ============================================
-- 8. VÉRIFICATION
-- ============================================

-- SELECT * FROM pg_policies WHERE schemaname = 'public';
