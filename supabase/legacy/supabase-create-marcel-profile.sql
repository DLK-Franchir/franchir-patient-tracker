-- Créer le profil de Marcel avec le bon rôle
INSERT INTO profiles (id, role, full_name)
SELECT u.id, 'marcel'::user_role, 'Marcel'
FROM auth.users u
WHERE u.email = 'marcel@example.com'
ON CONFLICT (id) DO UPDATE
SET role = 'marcel'::user_role,
    full_name = 'Marcel',
    updated_at = NOW();

-- Vérifier que le profil a été créé
SELECT p.id, p.role, p.full_name, p.created_at, p.updated_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'marcel@example.com';
