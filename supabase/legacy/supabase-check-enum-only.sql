-- Vérifier l'enum user_role actuel
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
