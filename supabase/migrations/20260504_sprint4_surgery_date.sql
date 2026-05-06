-- Sprint 4: confirmed surgery date + surgeon name on patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS confirmed_surgery_date DATE,
  ADD COLUMN IF NOT EXISTS confirmed_surgeon_name TEXT;

COMMENT ON COLUMN patients.confirmed_surgery_date IS 'Date de chirurgie confirmée (lecture seule sauf admin)';
COMMENT ON COLUMN patients.confirmed_surgeon_name IS 'Nom du chirurgien confirmé au moment de la planification';
