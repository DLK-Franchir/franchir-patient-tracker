-- Créer une notification de test pour votre compte actuel
INSERT INTO public.notifications (user_id, title, message, type)
SELECT 
  id,
  '✅ Test Notifications',
  'Le système de notifications fonctionne ! Vous recevrez des alertes en temps réel.',
  'success'
FROM public.profiles
WHERE email = 'yves.merillon@franchir.eu'
LIMIT 1;

-- Vérifier
SELECT 
  n.id,
  n.created_at,
  n.title,
  n.is_read,
  p.email
FROM public.notifications n
JOIN public.profiles p ON n.user_id = p.id
WHERE p.email = 'yves.merillon@franchir.eu'
ORDER BY n.created_at DESC;
