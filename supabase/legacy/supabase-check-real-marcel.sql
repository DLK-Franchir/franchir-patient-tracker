-- Vérifier le profil de Marcel avec son vrai email
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.full_name,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'marcel.mazaltarim@gmail.com';
