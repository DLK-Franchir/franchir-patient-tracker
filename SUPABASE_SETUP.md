# INSTRUCTIONS DE CONFIGURATION SUPABASE

## 1. Créer un projet Supabase

1. Aller sur [https://supabase.com](https://supabase.com)
2. Créer un compte ou se connecter
3. Cliquer sur "New Project"
4. Remplir les informations:
   - Name: franchir-patient-tracker
   - Database Password: (choisir un mot de passe fort)
   - Region: (choisir la région la plus proche)
5. Cliquer sur "Create new project"

## 2. Récupérer les credentials

Une fois le projet créé:

1. Aller dans **Settings** > **API**
2. Copier les valeurs suivantes:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

3. Mettre à jour le fichier `.env.local` avec ces valeurs

## 3. Exécuter le schéma SQL

1. Dans Supabase, aller dans **SQL Editor**
2. Cliquer sur "New query"
3. Copier tout le contenu du fichier `supabase-schema.sql`
4. Coller dans l'éditeur SQL
5. Cliquer sur "Run" (ou Ctrl/Cmd + Enter)
6. Vérifier qu'il n'y a pas d'erreurs

## 4. Créer un utilisateur test

### Option A: Via l'interface Supabase

1. Aller dans **Authentication** > **Users**
2. Cliquer sur "Add user" > "Create new user"
3. Entrer:
   - Email: `test@franchir.com`
   - Password: `Test123456!`
   - Auto Confirm User: ✅ (cocher)
4. Cliquer sur "Create user"
5. Copier l'ID de l'utilisateur créé (UUID)

### Option B: Via SQL

```sql
-- Créer l'utilisateur dans auth.users (remplacer les valeurs)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@franchir.com',
  crypt('Test123456!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  FALSE,
  ''
);
```

## 5. Créer le profil utilisateur

Une fois l'utilisateur créé, créer son profil:

```sql
-- Remplacer 'USER_ID_HERE' par l'ID de l'utilisateur créé
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  'USER_ID_HERE',
  'test@franchir.com',
  'Test Admin',
  'admin'
);
```

## 6. Vérification

Exécuter ces requêtes pour vérifier:

```sql
-- Vérifier les statuts de workflow
SELECT * FROM workflow_statuses ORDER BY order_position;

-- Vérifier les profils
SELECT * FROM profiles;

-- Vérifier les tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

## 7. Tester l'application

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) et se connecter avec:
- Email: `test@franchir.com`
- Password: `Test123456!`

## Troubleshooting

### Erreur "Invalid supabaseUrl"
- Vérifier que les variables d'environnement sont bien définies dans `.env.local`
- Redémarrer le serveur de développement après modification

### Erreur de connexion
- Vérifier que l'utilisateur existe dans Authentication > Users
- Vérifier que le profil existe dans la table `profiles`
- Vérifier que l'email est confirmé (email_confirmed_at non null)

### Erreur RLS (Row Level Security)
- Vérifier que les policies sont bien créées
- Vérifier que l'utilisateur est authentifié
- Consulter les logs dans Supabase Dashboard
