-- Forcer la régénération du token JWT de Marcel
-- en mettant à jour son profil

UPDATE profiles
SET updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'marcel@example.com');

-- Vérifier que la mise à jour a bien eu lieu
SELECT u.id, u.email, p.role, p.updated_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'marcel@example.com';
