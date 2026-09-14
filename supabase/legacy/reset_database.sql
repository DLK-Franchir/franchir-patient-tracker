-- ⚠️ ARCHIVE LEGACY — NE PAS EXÉCUTER EN PROD (destructeur : TRUNCATE CASCADE de patients,
-- patient_messages, medical_decisions, quotes, calendar_events, audit_logs — perte totale des données métier).
-- Script to clear all transactional data (keeps configuration and users)

-- Truncate tables with cascade to handle foreign keys
TRUNCATE TABLE 
  medical_decisions,
  quotes,
  calendar_events,
  patient_messages,
  audit_logs,
  patients
CASCADE;

-- Optional: Reset sequences if you want IDs to start over (only if using serial/bigserial, but here using UUIDs so not needed)
