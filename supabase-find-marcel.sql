-- Trouver l'ID de Marcel dans auth.users
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'marcel@franchir.eu';

-- Vérifier le profil Marcel
SELECT 
  id,
  email,
  full_name,
  role
FROM public.profiles
WHERE email = 'marcel@franchir.eu' OR role = 'marcel';
