-- Supprimer Marcel s'il existe (dans auth.users ET profiles)
DELETE FROM auth.users WHERE email = 'marcel@example.com';

-- Créer Marcel manuellement avec le bon rôle
-- IMPORTANT: Exécutez cette requête dans Supabase SQL Editor
-- puis allez dans Authentication > Users > Add User pour créer:
-- Email: marcel@example.com
-- Password: Marcel123!
-- Auto Confirm User: YES

-- Après création via le Dashboard, vérifiez le profil:
SELECT u.id, u.email, p.role, p.full_name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'marcel@example.com';
