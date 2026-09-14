-- ============================================================
-- FRANCHIR PATIENT TRACKER — trace versionnée : patients.last_questionnaire_url(_expires_at)
-- Date: 2026-09-14
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE DB : déjà APPLIQUÉE en prod le 2026-09-09 (migration
-- `questionnaire_last_url_caching`, appliquée hors historique du repo). Ce
-- fichier sert de trace versionnée et de rejeu idempotent (IF NOT EXISTS) ;
-- il ne doit pas être appliqué automatiquement ailleurs sans revue.
--
-- Migration ADDITIVE uniquement. Aucune colonne existante modifiée.
--
-- Contexte (audit 2026-09-14, reports/00_architecture_inventory.md §2.1 / §7) :
--   colonnes présentes en prod, absentes du repo, non lues par le code tracker.
--
-- ⚠️ SÉCURITÉ : `last_questionnaire_url` stocke un SECRET patient en clair
-- (lien magique = accès direct au questionnaire), lisible par tout compte
-- `authenticated` via la policy SELECT `true` de `patients`. À traiter dans un
-- chantier RLS séparé (colonne dédiée / vue / masquage) — NE PAS modifier de
-- policy ici. Ne jamais journaliser la valeur (logs, patient_messages.meta).
--
-- Aucune policy RLS ni fonction `is_active_staff()` modifiée.
-- ============================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS last_questionnaire_url text,
  ADD COLUMN IF NOT EXISTS last_questionnaire_url_expires_at timestamptz;

COMMENT ON COLUMN public.patients.last_questionnaire_url IS
  'Dernière URL magique du questionnaire émise pour ce patient. Utilisée pour permettre le dispatch staff (copier / renvoi WhatsApp/email) sans révoquer le lien actif en cours.';

COMMENT ON COLUMN public.patients.last_questionnaire_url_expires_at IS
  'Date d''expiration de la dernière URL magique stockée.';
