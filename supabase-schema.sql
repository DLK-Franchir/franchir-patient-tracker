-- ============================================================
-- FRANCHIR PATIENT TRACKER — schéma de référence / bootstrap
-- ============================================================
-- Ce fichier décrit le schéma initial (bootstrap d'une base vierge). Il n'est
-- PAS l'état exact de la prod : la prod (projet zdmeidekszdrzmjuasee) fait foi.
-- Écarts connus et inventaire complet : reports/00_architecture_inventory.md.
-- Les évolutions du schéma vivent dans supabase/migrations/ (additives,
-- idempotentes, gate DB manuel).
-- ============================================================

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

-- Insertion des statuts par défaut — seed aligné sur la prod (11 codes).
-- Codes produits par l'application : prospect_created, medical_review, need_info,
-- validated_medical, surgery_scheduled, case_closed, rejected_medical.
-- Codes présents en base mais non produits par l'application : quote_issued,
-- quote_accepted, surgery_done, completed (mappés dans lib/workflow-v2.ts).
INSERT INTO workflow_statuses (code, label, order_position, is_terminal, color) VALUES
  ('prospect_created', 'Dossier créé', 1, FALSE, '#9CA3AF'),
  ('medical_review', 'En revue médicale', 2, FALSE, '#3B82F6'),
  ('need_info', 'À compléter', 3, FALSE, '#F59E0B'),
  ('validated_medical', 'Validé médicalement', 4, FALSE, '#10B981'),
  ('quote_issued', 'Devis envoyé', 5, FALSE, '#8B5CF6'),
  ('quote_accepted', 'Devis accepté', 6, FALSE, '#10B981'),
  ('surgery_scheduled', 'Chirurgie programmée', 7, FALSE, '#6366F1'),
  ('surgery_done', 'Chirurgie effectuée', 8, FALSE, '#059669'),
  ('completed', 'Dossier terminé', 9, TRUE, '#14B8A6'),
  ('case_closed', 'Dossier fermé', 10, TRUE, '#9CA3AF'),
  ('rejected_medical', 'Refusé médicalement', 99, TRUE, '#EF4444');

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

-- Évolutions du schéma : voir supabase/migrations/ (source des changements post-bootstrap).
