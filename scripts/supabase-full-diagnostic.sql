-- Diagnostic complet de l'état actuel
-- 1. Vérifier l'enum user_role
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;

-- 2. Vérifier le trigger handle_new_user
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 3. Vérifier si Marcel existe
SELECT u.id, u.email, u.created_at, p.role, p.full_name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'marcel@example.com';

-- 4. Vérifier les policies sur profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
