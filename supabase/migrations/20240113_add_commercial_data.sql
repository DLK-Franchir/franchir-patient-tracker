-- Add commercial data columns to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS quote_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS proposed_date TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN patients.quote_amount IS 'Budget indicatif proposé par Franchir (en euros)';
COMMENT ON COLUMN patients.proposed_date IS 'Date proposée pour l''intervention';
