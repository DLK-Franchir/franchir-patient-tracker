-- Add acceptance columns to patients table if they don't exist
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS quote_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS date_accepted BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN patients.quote_accepted IS 'Indique si le devis a été accepté par Marcel';
COMMENT ON COLUMN patients.date_accepted IS 'Indique si la date a été acceptée par Marcel';
