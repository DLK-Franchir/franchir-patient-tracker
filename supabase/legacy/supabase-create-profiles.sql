-- =====================================================
-- CRÉATION DES PROFILS UTILISATEURS
-- =====================================================
-- Rôles disponibles : 'marcel', 'franchir', 'gilles', 'admin'

-- =====================================================
-- ÉTAPE 1 : Créer les utilisateurs dans Supabase Auth
-- =====================================================
-- Va dans Supabase Dashboard > Authentication > Users > Invite user
--
-- 1. Marcel (Coordinateur)
--    Email: marcel@franchir.eu
--    Rôle: marcel
--
-- 2. Dr Gilles Dubois (Médecin)
--    Email: gilles.dubois@franchir.eu
--    Rôle: gilles


-- =====================================================
-- ÉTAPE 2 : Insérer/Mettre à jour les profils
-- =====================================================

-- Profil Marcel (Coordinateur)
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  '432425d8-ef14-4c28-9113-0dda12c72395',
  'marcel@franchir.eu',
  'Marcel',
  'marcel'
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Profil Dr Gilles Dubois (Médecin)
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  '50cb15a1-664b-4f44-8862-ee30bebe5169',
  'gilles.dubois@franchir.eu',
  'Dr Gilles Dubois',
  'gilles'
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Mettre à jour ton profil en 'admin'
UPDATE public.profiles
SET role = 'admin'
WHERE id = '4c5ec3d7-9e29-4936-a504-dd46a326bb3f';


-- =====================================================
-- ÉTAPE 3 : Vérifier les profils créés
-- =====================================================
SELECT id, email, full_name, role FROM public.profiles ORDER BY created_at DESC;


-- =====================================================
-- ALTERNATIVE : Utiliser un trigger automatique
-- =====================================================
-- Si tu veux que les profils soient créés automatiquement lors de l'inscription,
-- tu peux créer ce trigger :

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'marcel')  -- Rôle par défaut
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
