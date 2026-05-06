-- Migration: add severity column to notifications
-- Sprint 3 — Étape 8: Préparation évolutivité
-- Supabase preprod

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'action_required'));

COMMENT ON COLUMN notifications.severity IS
  'Niveau de sévérité de la notification : info (informatif) ou action_required (action attendue de l''utilisateur).';

CREATE INDEX IF NOT EXISTS notifications_severity_idx
  ON notifications (severity)
  WHERE is_read = FALSE;

COMMIT;
