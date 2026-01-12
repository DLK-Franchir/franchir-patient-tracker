-- =====================================================
-- CORRIGER LE COMPTE GILLES
-- =====================================================

-- 1. Voir l'utilisateur Gilles actuel
SELECT 
  id,
  email,
  full_name,
  role
FROM public.profiles
WHERE role = 'gilles' OR email LIKE '%gilles%';

-- 2. Mettre à jour l'email dans le profil pour correspondre à auth.users
UPDATE public.profiles
SET email = 'duboisgilles31@gmail.com'
WHERE id = '50cb15a1-664b-4f44-8862-ee30bebe5169';

-- 3. Créer une notification de test pour Gilles
INSERT INTO public.notifications (user_id, title, message, type)
VALUES (
  '50cb15a1-664b-4f44-8862-ee30bebe5169',
  '🎯 Bienvenue Dr Gilles',
  'Votre compte est maintenant configuré. Mot de passe temporaire : Gilles123!',
  'info'
);

-- 4. Créer une notification de test pour votre compte admin
INSERT INTO public.notifications (user_id, title, message, type)
SELECT 
  id,
  '✅ Système de notifications actif',
  'Les notifications en temps réel sont maintenant opérationnelles !',
  'success'
FROM public.profiles
WHERE email = 'yves.merillon@franchir.eu'
LIMIT 1;

-- 5. Vérifier toutes les notifications
SELECT 
  n.id,
  n.created_at,
  n.title,
  n.is_read,
  p.email,
  p.role
FROM public.notifications n
JOIN public.profiles p ON n.user_id = p.id
ORDER BY n.created_at DESC
LIMIT 10;
