-- Script pour configurer le profil administrateur d'Erik Boulard
-- À exécuter DANS L'ÉDITEUR SQL SUPABASE après avoir créé l'utilisateur dans Authentication

-- 1. S'assurer que le profil existe et qu'il est admin
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  'Erik Boulard', 
  'admin'
FROM auth.users 
WHERE email = 'erik.boulard@franchir.eu'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', full_name = 'Erik Boulard';

-- 2. Vérification
SELECT * FROM public.profiles WHERE email = 'erik.boulard@franchir.eu';
