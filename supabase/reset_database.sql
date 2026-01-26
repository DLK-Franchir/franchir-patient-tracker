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
