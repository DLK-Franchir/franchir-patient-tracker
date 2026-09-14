-- Chercher Marcel UNIQUEMENT dans profiles (sans JOIN avec auth.users)
SELECT id, email, role, full_name, created_at
FROM profiles
WHERE email = 'marcel@example.com' OR email LIKE '%marcel%';

-- Chercher Marcel UNIQUEMENT dans auth.users
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'marcel@example.com' OR email LIKE '%marcel%';
