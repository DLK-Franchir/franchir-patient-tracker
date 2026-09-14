-- Supprimer le trigger ET la fonction avec CASCADE
DROP TRIGGER IF EXISTS trigger_notify_doctor_on_new_patient ON patients;
DROP FUNCTION IF EXISTS notify_doctor_on_new_patient() CASCADE;

-- Créer un nouveau trigger qui notifie Gilles (rôle médical)
CREATE OR REPLACE FUNCTION notify_gilles_on_new_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notifier TOUS les utilisateurs avec le rôle 'gilles' (médecin)
  INSERT INTO public.notifications (user_id, patient_id, title, message, type)
  SELECT
    profiles.id,
    NEW.id,
    'Nouveau patient à examiner',
    'Un nouveau dossier patient (' || NEW.patient_name || ') a été créé et attend votre revue médicale.',
    'info'
  FROM public.profiles
  WHERE profiles.role = 'gilles';

  RETURN NEW;
END;
$$;

-- Recréer le trigger avec la nouvelle fonction
CREATE TRIGGER trigger_notify_gilles_on_new_patient
  AFTER INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION notify_gilles_on_new_patient();
