-- Table des messages patients (historique + communication)
CREATE TABLE IF NOT EXISTS public.patient_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id),
  author_name TEXT,
  author_role TEXT,
  kind TEXT NOT NULL DEFAULT 'message',
  title TEXT,
  body TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS patient_messages_patient_id_idx ON patient_messages(patient_id);
CREATE INDEX IF NOT EXISTS patient_messages_created_at_idx ON patient_messages(created_at DESC);

-- RLS
ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all messages" 
  ON patient_messages FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert messages" 
  ON patient_messages FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Activer Realtime sur la table
ALTER PUBLICATION supabase_realtime ADD TABLE patient_messages;
