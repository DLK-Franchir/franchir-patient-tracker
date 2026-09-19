-- Migration: questionnaire_last_url_caching
-- Description: Stocke la dernière URL émise pour permettre le renvoi/copie sans révocation destructive du lien actif en cours de remplissage

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS last_questionnaire_url text,
  ADD COLUMN IF NOT EXISTS last_questionnaire_url_expires_at timestamptz;

COMMENT ON COLUMN public.patients.last_questionnaire_url IS
  'Dernière URL magique du questionnaire émise pour ce patient. Utilisée pour permettre le dispatch staff (copier / renvoi WhatsApp/email) sans révoquer le lien actif en cours.';

COMMENT ON COLUMN public.patients.last_questionnaire_url_expires_at IS
  'Date d''expiration de la dernière URL magique stockée.';
