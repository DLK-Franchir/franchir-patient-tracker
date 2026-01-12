-- Vérifier le profil de Marcel
SELECT p.id, p.role, p.full_name, p.created_at, p.updated_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'marcel@example.com';

-- Si le profil n'existe pas, le créer avec le bon rôle
INSERT INTO profiles (id, role, full_name)
SELECT u.id, 'marcel'::user_role, 'Marcel'
FROM auth.users u
WHERE u.email = 'marcel@example.com'
AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = u.id);

-- Vérifier à nouveau
SELECT p.id, p.role, p.full_name, p.created_at, p.updated_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'marcel@example.com';
