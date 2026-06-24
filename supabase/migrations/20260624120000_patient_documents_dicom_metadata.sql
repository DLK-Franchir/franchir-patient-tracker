-- ============================================================
-- FRANCHIR PATIENT TRACKER — métadonnées DICOM sur patient_documents
-- Date: 2026-06-24
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE DB : déjà APPLIQUÉE en prod via Supabase MCP (apply_migration
-- "patient_documents_dicom_metadata") le 2026-06-24. Ce fichier sert de trace
-- versionnée et de rejeu idempotent (IF NOT EXISTS partout).
--
-- Migration ADDITIVE : ajoute des colonnes de métadonnées DICOM extraites de
-- l'en-tête (cf. lib/imaging/dicom-content.ts) pour permettre :
--   1. l'anti-doublon par SOPInstanceUID (0008,0018) — index unique partiel ;
--   2. le regroupement des coupes en séries par SeriesInstanceUID (0020,000E)
--      côté serveur (cervical vs lombaire), sans relire les octets à l'affichage.
--
-- Aucune colonne existante modifiée. RLS de la table inchangée (déjà activée par
-- 20260613190000) : les nouvelles colonnes en héritent automatiquement.
-- ============================================================

ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS sop_instance_uid TEXT,
  ADD COLUMN IF NOT EXISTS series_instance_uid TEXT,
  ADD COLUMN IF NOT EXISTS series_description TEXT,
  ADD COLUMN IF NOT EXISTS body_part TEXT,
  ADD COLUMN IF NOT EXISTS instance_number INTEGER,
  ADD COLUMN IF NOT EXISTS acquisition_datetime TEXT;

-- Anti-doublon imagerie : un SOPInstanceUID unique par patient (les NULL des
-- fichiers non-DICOM / legacy non backfillés sont exclus).
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_documents_patient_sop
  ON public.patient_documents (patient_id, sop_instance_uid)
  WHERE sop_instance_uid IS NOT NULL;

-- Regroupement séries côté serveur : tri par série puis numéro d'instance.
CREATE INDEX IF NOT EXISTS idx_patient_documents_series
  ON public.patient_documents (patient_id, series_instance_uid, instance_number)
  WHERE series_instance_uid IS NOT NULL;

COMMENT ON COLUMN public.patient_documents.sop_instance_uid IS
  'DICOM SOPInstanceUID (0008,0018) — identifie de manière unique une instance image ; base de l''anti-doublon par patient.';
COMMENT ON COLUMN public.patient_documents.series_instance_uid IS
  'DICOM SeriesInstanceUID (0020,000E) — regroupement des coupes en séries (cervical vs lombaire).';
COMMENT ON COLUMN public.patient_documents.series_description IS
  'DICOM SeriesDescription (0008,103E) — libellé humain de la série.';
COMMENT ON COLUMN public.patient_documents.body_part IS
  'DICOM BodyPartExamined (0018,0015) — région anatomique (ex. CSPINE, LSPINE).';
COMMENT ON COLUMN public.patient_documents.instance_number IS
  'DICOM InstanceNumber (0020,0013) — ordre de la coupe dans la série.';
COMMENT ON COLUMN public.patient_documents.acquisition_datetime IS
  'Horodatage d''acquisition normalisé YYYYMMDDHHMMSS (AcquisitionDateTime, sinon Date+Time, sinon Series/StudyDate) pour tri et fallback de grouping.';
