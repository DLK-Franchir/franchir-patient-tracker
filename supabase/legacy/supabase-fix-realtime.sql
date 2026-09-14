-- =====================================================
-- ACTIVER REALTIME ET CORRIGER LES NOTIFICATIONS
-- =====================================================

-- 1. Activer la réplication Realtime sur la table notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2. Vérifier que Realtime est activé
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'notifications';

-- 3. Créer une notification de test pour Gilles
INSERT INTO public.notifications (user_id, title, message, type)
SELECT 
  id,
  'Test Realtime',
  'Si tu vois cette notification, le Realtime fonctionne !',
  'info'
FROM public.profiles
WHERE role = 'gilles'
LIMIT 1;

-- 4. Vérifier toutes les notifications récentes
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
ORDER BY n.created_at DESC
LIMIT 10;
