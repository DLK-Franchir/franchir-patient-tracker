-- Vérifier les profils avec des rôles invalides
SELECT id, email, full_name, role 
FROM profiles 
WHERE role NOT IN ('marcel', 'franchir', 'gilles', 'admin');

-- Si des profils ont un rôle invalide, les corriger
-- UPDATE profiles SET role = 'franchir' WHERE role = 'doctor';
