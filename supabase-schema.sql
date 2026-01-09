-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des rôles (enum)
CREATE TYPE user_role AS ENUM ('marcel', 'franchir', 'gilles', 'admin');

-- Table des utilisateurs (étend auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'franchir',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des statuts de workflow (configurable)
CREATE TABLE public.workflow_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_terminal BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des neurochirurgiens (pour assignation future)
CREATE TABLE public.surgeons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT,
  specialization TEXT,
  hospital TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table principale des patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_name TEXT NOT NULL,
  clinical_summary TEXT,
  sharepoint_link TEXT,
  current_status_id UUID REFERENCES workflow_statuses(id),
  assigned_surgeon_id UUID REFERENCES surgeons(id),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des décisions médicales (Gilles)
CREATE TABLE public.medical_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  decided_by UUID REFERENCES profiles(id) NOT NULL,
  decision_type TEXT NOT NULL,
  justification TEXT NOT NULL,
  assigned_surgeon_id UUID REFERENCES surgeons(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des devis (Phase 3, structure préparée)
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  conditions TEXT,
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des événements calendrier (Phase 3, structure préparée)
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  surgeon_id UUID REFERENCES surgeons(id),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table d'audit (append-only, non modifiable)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des statuts par défaut
INSERT INTO workflow_statuses (code, label, order_position, is_terminal, color) VALUES
  ('prospect_created', 'Prospect créé', 1, FALSE, '#3B82F6'),
  ('medical_review', 'En revue médicale', 2, FALSE, '#F59E0B'),
  ('need_info', 'À compléter', 3, FALSE, '#EF4444'),
  ('rejected_medical', 'Refusé médicalement', 4, TRUE, '#DC2626'),
  ('validated_medical', 'Validé médicalement', 5, FALSE, '#10B981'),
  ('sent_to_surgeon', 'Envoyé au chirurgien', 6, FALSE, '#8B5CF6'),
  ('surgeon_rejected', 'Refus chirurgien', 7, TRUE, '#DC2626'),
  ('surgeon_accepted', 'Accord chirurgien', 8, FALSE, '#10B981'),
  ('quote_issued', 'Devis émis', 9, FALSE, '#F59E0B'),
  ('quote_rejected', 'Devis refusé', 10, TRUE, '#DC2626'),
  ('quote_accepted', 'Devis accepté', 11, FALSE, '#10B981'),
  ('surgery_scheduled', 'Date chirurgie confirmée', 12, FALSE, '#8B5CF6'),
  ('deposit_received', 'Acompte 30% reçu', 13, FALSE, '#10B981'),
  ('confirmed', 'Dossier confirmé', 14, FALSE, '#059669');

-- Row Level Security (RLS) - Tout le monde voit tout
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique : utilisateurs authentifiés voient tout
CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all patients" ON patients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all decisions" ON medical_decisions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all statuses" ON workflow_statuses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all surgeons" ON surgeons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all quotes" ON quotes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all events" ON calendar_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view all logs" ON audit_logs FOR SELECT USING (auth.role() = 'authenticated');

-- Politique : insertion / update (à affiner en Phase 2)
CREATE POLICY "Users can insert patients" ON patients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update patients" ON patients FOR UPDATE USING (auth.role() = 'authenticated');

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
