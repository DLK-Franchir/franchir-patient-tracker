-- Créer une notification de test pour l'admin (yves.merillon@franchir.eu)
INSERT INTO public.notifications (user_id, title, message, type)
SELECT 
  id,
  'Test Notification Admin',
  'Notification de test pour vérifier le Realtime sur votre compte admin',
  'info'
FROM public.profiles
WHERE email = 'yves.merillon@franchir.eu'
LIMIT 1;

-- Vérifier
SELECT 
  n.id,
  n.created_at,
  n.title,
  n.message,
  n.is_read,
  p.email,
  p.role
FROM public.notifications n
JOIN public.profiles p ON n.user_id = p.id
WHERE p.email = 'yves.merillon@franchir.eu'
ORDER BY n.created_at DESC;
