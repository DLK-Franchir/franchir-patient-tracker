-- =====================================================
-- FIX: Optimisation des politiques RLS pour performance
-- =====================================================
-- Remplace auth.<function>() par (SELECT auth.<function>())
-- pour éviter la réévaluation à chaque ligne
-- Exécutez dans Supabase Dashboard > SQL Editor

-- =====================================================
-- PROFILES
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
CREATE POLICY "Authenticated users can view all profiles" ON profiles 
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- PATIENTS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all patients" ON patients;
DROP POLICY IF EXISTS "Users can insert patients" ON patients;
DROP POLICY IF EXISTS "Users can update patients" ON patients;

CREATE POLICY "Authenticated users can view all patients" ON patients 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert patients" ON patients 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update patients" ON patients 
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- MEDICAL_DECISIONS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all decisions" ON medical_decisions;
DROP POLICY IF EXISTS "Users can insert medical decisions" ON medical_decisions;
DROP POLICY IF EXISTS "Users can update medical decisions" ON medical_decisions;

CREATE POLICY "Authenticated users can view all decisions" ON medical_decisions 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert medical decisions" ON medical_decisions 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update medical decisions" ON medical_decisions 
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- WORKFLOW_STATUSES
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all statuses" ON workflow_statuses;
CREATE POLICY "Authenticated users can view all statuses" ON workflow_statuses 
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- SURGEONS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all surgeons" ON surgeons;
CREATE POLICY "Authenticated users can view all surgeons" ON surgeons 
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- QUOTES
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update quotes" ON quotes;

CREATE POLICY "Authenticated users can view all quotes" ON quotes 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert quotes" ON quotes 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update quotes" ON quotes 
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- CALENDAR_EVENTS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update calendar events" ON calendar_events;

CREATE POLICY "Authenticated users can view all events" ON calendar_events 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert calendar events" ON calendar_events 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update calendar events" ON calendar_events 
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- AUDIT_LOGS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all logs" ON audit_logs;
CREATE POLICY "Authenticated users can view all logs" ON audit_logs 
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- PATIENT_MESSAGES (si existe)
-- =====================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_messages') THEN
    DROP POLICY IF EXISTS "Authenticated users can view all messages" ON patient_messages;
    DROP POLICY IF EXISTS "Authenticated users can insert messages" ON patient_messages;
    
    CREATE POLICY "Authenticated users can view all messages" ON patient_messages 
      FOR SELECT TO authenticated USING (true);
    
    CREATE POLICY "Authenticated users can insert messages" ON patient_messages 
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- NOTIFICATIONS (si existe) - avec auth.uid() optimisé
-- =====================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
    
    CREATE POLICY "Users can view their own notifications" ON notifications 
      FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
    
    CREATE POLICY "Users can update their own notifications" ON notifications 
      FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- =====================================================
-- VÉRIFICATION
-- =====================================================
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
