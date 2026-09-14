-- =====================================================
-- FIX SÉCURISÉ: Politiques RLS pour profiles
-- =====================================================
-- La table profiles a une colonne `id` qui référence auth.users(id)
-- Seul le trigger handle_new_user (SECURITY DEFINER) crée les profils
-- Les utilisateurs peuvent uniquement voir et modifier leur propre profil

-- 1. SUPPRIMER LES POLITIQUES TROP PERMISSIVES
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Allow trigger to insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;

-- 2. POLITIQUES SÉCURISÉES

-- SELECT: Les utilisateurs authentifiés peuvent voir tous les profils
-- (nécessaire pour afficher les noms dans l'application)
CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Seul le service_role peut insérer (via trigger SECURITY DEFINER)
-- Les utilisateurs normaux ne peuvent PAS créer de profils manuellement
-- Le trigger handle_new_user utilise SECURITY DEFINER donc bypass RLS
CREATE POLICY "Only service role can insert profiles" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- Bloque les INSERT clients, le trigger bypass avec SECURITY DEFINER

-- UPDATE: Les utilisateurs peuvent uniquement modifier leur propre profil
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- DELETE: Personne ne peut supprimer de profils (sauf service_role)
CREATE POLICY "No one can delete profiles" ON profiles
  FOR DELETE
  TO authenticated
  USING (false);

-- 3. VÉRIFIER QUE LE TRIGGER EXISTE ET FONCTIONNE
SELECT 'Trigger' AS type, tgname AS name FROM pg_trigger WHERE tgname = 'on_auth_user_created'
UNION ALL
SELECT 'Function', proname FROM pg_proc WHERE proname = 'handle_new_user';

-- 4. VÉRIFIER LES NOUVELLES POLITIQUES
SELECT policyname, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- =====================================================
-- NOTE: Le trigger handle_new_user utilise SECURITY DEFINER
-- ce qui lui permet de bypasser RLS et d'insérer les profils
-- même si la politique INSERT dit WITH CHECK (false)
-- =====================================================

-- =====================================================
-- TEST: Créer un utilisateur de test (optionnel)
-- =====================================================
-- Décommentez pour tester après avoir appliqué les corrections
/*
-- Via Dashboard: Authentication > Users > Invite user
-- Email: test@example.com
-- Puis vérifiez:
SELECT * FROM profiles ORDER BY created_at DESC LIMIT 5;
*/
