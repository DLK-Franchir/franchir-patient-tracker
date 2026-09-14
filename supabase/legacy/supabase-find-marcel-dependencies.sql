-- Trouver toutes les dépendances de Marcel dans la base
-- 1. Chercher dans profiles
SELECT 'profiles' as table_name, id, email, role FROM profiles WHERE email = 'marcel@example.com';

-- 2. Chercher dans patients (created_by)
SELECT 'patients' as table_name, id, patient_name, created_by FROM patients WHERE created_by IN (SELECT id FROM profiles WHERE email = 'marcel@example.com');

-- 3. Chercher dans medical_decisions (decided_by)
SELECT 'medical_decisions' as table_name, id, decided_by FROM medical_decisions WHERE decided_by IN (SELECT id FROM profiles WHERE email = 'marcel@example.com');

-- 4. Chercher dans quotes (created_by)
SELECT 'quotes' as table_name, id, created_by FROM quotes WHERE created_by IN (SELECT id FROM profiles WHERE email = 'marcel@example.com');

-- 5. Chercher dans calendar_events (created_by)
SELECT 'calendar_events' as table_name, id, created_by FROM calendar_events WHERE created_by IN (SELECT id FROM profiles WHERE email = 'marcel@example.com');

-- 6. Chercher dans audit_logs (actor_id)
SELECT 'audit_logs' as table_name, id, actor_id FROM audit_logs WHERE actor_id IN (SELECT id FROM profiles WHERE email = 'marcel@example.com');

-- 7. Chercher dans notifications (user_id)
SELECT 'notifications' as table_name, id, user_id FROM notifications WHERE user_id IN (SELECT id FROM profiles WHERE email = 'marcel@example.com');

-- 8. Chercher dans patient_messages (author_id)
SELECT 'patient_messages' as table_name, id, author_id FROM patient_messages WHERE author_id IN (SELECT id FROM profiles WHERE email = 'marcel@example.com');
