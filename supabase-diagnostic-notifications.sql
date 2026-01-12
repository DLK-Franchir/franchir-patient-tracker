-- =====================================================
-- DIAGNOSTIC COMPLET DES NOTIFICATIONS
-- =====================================================

-- 1. Vérifier les profils existants
SELECT 
  id, 
  email, 
  full_name, 
  role,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- 2. Vérifier les notifications existantes
SELECT 
  n.id,
  n.created_at,
  n.title,
  n.message,
  n.type,
  n.is_read,
  p.email as user_email,
  p.role as user_role,
  pat.patient_name
FROM public.notifications n
LEFT JOIN public.profiles p ON n.user_id = p.id
LEFT JOIN public.patients pat ON n.patient_id = pat.id
ORDER BY n.created_at DESC
LIMIT 20;

-- 3. Vérifier les RLS policies sur notifications
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'notifications';

-- 4. Tester l'insertion manuelle d'une notification
-- Remplace USER_ID par un vrai ID de profil
-- INSERT INTO public.notifications (user_id, title, message, type)
-- VALUES (
--   '4c5ec3d7-9e29-4936-a504-dd46a326bb3f',
--   'Test manuel',
--   'Test d''insertion manuelle de notification',
--   'info'
-- );

-- 5. Compter les notifications par utilisateur
SELECT 
  p.email,
  p.role,
  COUNT(n.id) as notification_count,
  COUNT(CASE WHEN n.is_read = false THEN 1 END) as unread_count
FROM public.profiles p
LEFT JOIN public.notifications n ON p.id = n.user_id
GROUP BY p.id, p.email, p.role
ORDER BY notification_count DESC;
