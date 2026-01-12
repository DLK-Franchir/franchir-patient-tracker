-- =====================================================
-- RÉINITIALISER LE MOT DE PASSE DE GILLES
-- =====================================================

-- 1. Voir tous les utilisateurs dans auth.users
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Vérifier les profils
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- 3. Corriger l'email de Gilles dans le profil si nécessaire
UPDATE public.profiles
SET email = 'duboisgilles31@franchir.eu'
WHERE role = 'gilles';

-- 4. Pour réinitialiser le mot de passe de Gilles, vous devez :
-- Option A : Utiliser le Dashboard Supabase > Authentication > Users > Cliquer sur l'utilisateur > "Send password recovery"
-- Option B : Créer un nouveau compte pour Gilles avec un mot de passe connu

-- Si vous voulez créer un nouveau compte Gilles avec mot de passe "Gilles123!" :
-- ATTENTION : Ceci doit être fait via l'API Supabase Admin, pas en SQL direct
-- Utilisez plutôt l'interface Supabase Dashboard pour créer l'utilisateur

-- 5. Créer une notification de test pour votre compte actuel (yves.merillon)
INSERT INTO public.notifications (user_id, title, message, type)
SELECT 
  id,
  '✅ Système de notifications opérationnel',
  'Vous pouvez maintenant recevoir des notifications en temps réel. Testez en changeant le statut d''un patient !',
  'success'
FROM public.profiles
WHERE email = 'yves.merillon@franchir.eu'
LIMIT 1;

-- 6. Voir toutes les notifications
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
LIMIT 20;
