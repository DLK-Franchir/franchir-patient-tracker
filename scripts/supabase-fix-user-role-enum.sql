-- Script RADICAL pour corriger l'enum user_role
-- Supprime TOUTES les policies automatiquement, puis modifie l'enum

-- 1. Générer et exécuter les DROP POLICY pour TOUTES les policies existantes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped policy: % on %.%', r.policyname, r.schemaname, r.tablename;
    END LOOP;
END $$;

-- 2. Désactiver RLS sur toutes les tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE medical_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE surgeons DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE patient_messages DISABLE ROW LEVEL SECURITY;

-- 3. Créer un nouvel enum
CREATE TYPE user_role_new AS ENUM ('marcel', 'franchir', 'gilles', 'admin');

-- 4. Supprimer le DEFAULT
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;

-- 5. Modifier la colonne
ALTER TABLE profiles
  ALTER COLUMN role TYPE user_role_new
  USING role::text::user_role_new;

-- 6. Remettre le DEFAULT
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'franchir'::user_role_new;

-- 7. Supprimer l'ancien enum
DROP TYPE user_role CASCADE;

-- 8. Renommer le nouvel enum
ALTER TYPE user_role_new RENAME TO user_role;

-- 9. Remettre le DEFAULT final
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'franchir'::user_role;

-- 10. Réactiver RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

-- 11. Recréer les policies simplifiées
CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all patients" ON patients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all decisions" ON medical_decisions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all statuses" ON workflow_statuses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all surgeons" ON surgeons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all quotes" ON quotes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all events" ON calendar_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all logs" ON audit_logs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert patients" ON patients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update patients" ON patients FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert medical decisions" ON medical_decisions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update medical decisions" ON medical_decisions FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert quotes" ON quotes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update quotes" ON quotes FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert calendar events" ON calendar_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update calendar events" ON calendar_events FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all messages" ON patient_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert messages" ON patient_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
