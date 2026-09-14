-- Vérifier le rôle actuel de Marcel
SELECT u.id, u.email, p.role, p.created_at, p.updated_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'marcel@example.com';

-- Vérifier tous les profils avec des rôles invalides
SELECT p.id, p.role, p.created_at
FROM profiles p
WHERE p.role::text NOT IN ('marcel', 'franchir', 'gilles', 'admin');
