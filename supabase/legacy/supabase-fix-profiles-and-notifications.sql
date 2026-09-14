-- =====================================================
-- CORRIGER LES PROFILS ET COMPRENDRE LA SITUATION
-- =====================================================

-- 1. Voir tous les profils existants
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- 2. Vérifier le profil de yves.merillon
SELECT 
  id,
  email,
  full_name,
  role
FROM public.profiles
WHERE email = 'yves.merillon@franchir.eu';

-- 3. S'assurer que yves.merillon a bien le rôle admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'yves.merillon@franchir.eu';

-- 4. Créer une notification de test pour yves.merillon (admin)
INSERT INTO public.notifications (user_id, title, message, type)
SELECT 
  id,
  '🎯 Test Admin',
  'Cette notification est pour votre compte admin (yves.merillon@franchir.eu)',
  'info'
FROM public.profiles
WHERE email = 'yves.merillon@franchir.eu'
LIMIT 1;

-- 5. Voir toutes les notifications par utilisateur
SELECT 
  p.email,
  p.role,
  COUNT(n.id) as total_notifications,
  COUNT(CASE WHEN n.is_read = false THEN 1 END) as unread_notifications
FROM public.profiles p
LEFT JOIN public.notifications n ON p.id = n.user_id
GROUP BY p.email, p.role
ORDER BY p.email;
