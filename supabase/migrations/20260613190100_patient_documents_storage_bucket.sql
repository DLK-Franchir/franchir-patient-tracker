-- ============================================================
-- FRANCHIR PATIENT TRACKER — bucket Storage privé `patient-documents`
-- Date: 2026-06-13
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE STORAGE/PROD : NE PAS appliquer automatiquement. À coller dans le
-- Dashboard Supabase du projet tracker → SQL Editor, OU via la CLI :
--   supabase db push --project-ref zdmeidekszdrzmjuasee
--
-- Crée un bucket PRIVÉ pour les fichiers patients (DICOM + documents) DANS LE
-- PROJET TRACKER UNIQUEMENT (aucune dépendance au projet questionnaires ni à
-- son bucket patient-images).
--
-- Layout des objets : `patients/{patientId}/{timestamp}_{nom_securise}`
--   => (storage.foldername(name))[1] = 'patients'
--   => (storage.foldername(name))[2] = UUID du patient
--
-- Accès applicatif : les routes serveur du tracker écrivent/lisent via le
-- client SERVICE-ROLE (qui bypass la RLS), et le navigateur ne reçoit que des
-- URLs signées courtes. Les policies ci-dessous sont une défense en profondeur
-- pour le cas d'un accès authentifié direct : réservées au staff actif
-- (réutilise public.is_active_staff(), défini par 20260503_guard_staff_access).
--
-- Idempotent : ré-exécutable sans risque.
-- ============================================================

-- 1. Bucket PRIVÉ (public = false). Jamais de getPublicUrl : URLs signées only.
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. RLS storage.objects scoping au bucket patient-documents.

-- Staff actif : accès complet (lecture/écriture/suppression).
DROP POLICY IF EXISTS "staff_full_access_patient_documents" ON storage.objects;
CREATE POLICY "staff_full_access_patient_documents"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'patient-documents'
    AND public.is_active_staff()
  )
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND public.is_active_staff()
  );
