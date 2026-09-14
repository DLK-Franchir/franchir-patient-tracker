-- Vérifier tous les profils et leurs rôles
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- Vérifier quel profil est associé à yves.merillon@franchir.eu
SELECT 
  id,
  email,
  full_name,
  role
FROM public.profiles
WHERE email = 'yves.merillon@franchir.eu';
