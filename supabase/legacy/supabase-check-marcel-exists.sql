-- Vérifier si Marcel existe dans auth.users
SELECT id, email, created_at
FROM auth.users
WHERE email = 'marcel@example.com';
