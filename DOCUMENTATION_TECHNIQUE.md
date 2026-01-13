# DOCUMENTATION TECHNIQUE COMPLÈTE
# FRANCHIR Patient Tracker

**Version:** 0.1.0  
**Date:** Janvier 2025  
**Statut:** Phase 2 Complétée

---

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture technique](#architecture-technique)
3. [Base de données](#base-de-données)
4. [Sécurité et authentification](#sécurité-et-authentification)
5. [Parcours utilisateur](#parcours-utilisateur)
6. [API et routes](#api-et-routes)
7. [Configuration et déploiement](#configuration-et-déploiement)
8. [Problèmes identifiés UX/UI](#problèmes-identifiés-uxui)
9. [Recommandations pour la V2](#recommandations-pour-la-v2)

---

## 🎯 VUE D'ENSEMBLE

### Objectif
Application web de gestion du parcours patient pour le réseau FRANCHIR, permettant le suivi collaboratif des dossiers médicaux depuis la création du prospect jusqu'à la confirmation de la chirurgie.

### Utilisateurs cibles
- **Marcel** : Crée les prospects patients
- **Franchir** : Équipe administrative et coordination
- **Gilles** : Validation médicale et décisions cliniques
- **Admin** : Administration système

### Fonctionnalités principales
- Création et suivi de dossiers patients
- Workflow de validation en 14 étapes
- Tableau de bord partagé temps réel
- Système de notifications
- Messagerie interne par patient
- Gestion des événements calendrier
- Audit trail complet

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Stack technologique

#### Frontend
- **Framework** : Next.js 16.1.1 (App Router)
- **Langage** : TypeScript 5
- **UI** : React 19.2.3
- **Styling** : Tailwind CSS 4
- **Formulaires** : React Hook Form 7.70.0 + Zod 3.25.76
- **Icônes** : Lucide React 0.562.0
- **Utilitaires** : 
  - clsx 2.1.1
  - tailwind-merge 2.6.0
  - class-variance-authority 0.7.1
  - date-fns 3.6.0

#### Backend
- **BaaS** : Supabase
  - @supabase/supabase-js 2.90.1
  - @supabase/ssr 0.8.0
  - @supabase/auth-helpers-nextjs 0.8.7
- **Base de données** : PostgreSQL (via Supabase)
- **Authentification** : Supabase Auth
- **Temps réel** : Supabase Realtime

#### Outils de développement
- **Linter** : ESLint 9
- **Package Manager** : npm
- **Environnement** : Node.js 20+

### Structure des dossiers

```
franchir-patient-tracker/
├── app/                                    # Next.js App Router
│   ├── api/                               # Routes API
│   │   ├── notify/route.ts               # Notifications manuelles
│   │   ├── dev/switch-role/route.ts      # Switch de rôle (dev)
│   │   └── patients/[id]/
│   │       ├── messages/route.ts         # Messages patient
│   │       └── change-status/route.ts    # Changement de statut
│   ├── auth/
│   │   └── signout/route.ts              # Déconnexion
│   ├── dashboard/
│   │   ├── page.tsx                      # Tableau de bord principal
│   │   ├── new/page.tsx                  # Création patient
│   │   └── patient/[id]/page.tsx         # Détail patient
│   ├── login/page.tsx                     # Page de connexion
│   ├── layout.tsx                         # Layout racine
│   └── globals.css                        # Styles globaux
│
├── components/                            # Composants React
│   ├── auth/
│   │   └── login-form.tsx                # Formulaire de connexion
│   ├── calendar/
│   │   └── calendar-view.tsx             # Vue calendrier
│   ├── dev/
│   │   └── role-switcher.tsx             # Changement de rôle (dev)
│   ├── notifications/
│   │   └── notification-bell.tsx         # Cloche de notifications
│   ├── patient/
│   │   ├── calendar-event-form.tsx       # Formulaire événement
│   │   ├── message-composer.tsx          # Composer de message
│   │   ├── message-thread.tsx            # Fil de messages
│   │   └── quote-card.tsx                # Carte devis
│   └── ui/                                # Composants UI réutilisables
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       └── textarea.tsx
│
├── lib/                                   # Bibliothèques et utilitaires
│   ├── permissions.ts                     # Système de permissions
│   └── supabase/
│       ├── client.ts                     # Client Supabase (browser)
│       └── server.ts                     # Client Supabase (server)
│
├── scripts/                               # Scripts utilitaires
│   └── create-gilles-account.mjs         # Création compte Gilles
│
├── public/                                # Assets statiques
│
├── middleware.ts                          # Middleware Next.js (auth)
├── .env.example                          # Variables d'environnement exemple
├── package.json                          # Dépendances npm
├── tsconfig.json                         # Configuration TypeScript
├── tailwind.config.ts                    # Configuration Tailwind
├── next.config.ts                        # Configuration Next.js
│
└── *.sql                                 # Scripts SQL Supabase
    ├── supabase-schema.sql               # Schéma principal
    ├── supabase-rls-policies.sql         # Politiques RLS
    ├── supabase-fix-realtime.sql         # Fix realtime
    └── ...                               # Autres scripts de maintenance
```

---

## 🗄️ BASE DE DONNÉES

### Schéma PostgreSQL (Supabase)

#### Tables principales

##### 1. **profiles** - Profils utilisateurs
```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'franchir',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rôles disponibles** : `marcel`, `franchir`, `gilles`, `admin`

##### 2. **patients** - Dossiers patients
```sql
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_name TEXT NOT NULL,
  clinical_summary TEXT,
  sharepoint_link TEXT,
  current_status_id UUID REFERENCES workflow_statuses(id),
  assigned_surgeon_id UUID REFERENCES surgeons(id),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### 3. **workflow_statuses** - Statuts du workflow
```sql
CREATE TABLE public.workflow_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_terminal BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**14 statuts prédéfinis** :
1. `prospect_created` - Prospect créé (#3B82F6)
2. `medical_review` - En revue médicale (#F59E0B)
3. `need_info` - À compléter (#EF4444)
4. `rejected_medical` - Refusé médicalement [TERMINAL] (#DC2626)
5. `validated_medical` - Validé médicalement (#10B981)
6. `sent_to_surgeon` - Envoyé au chirurgien (#8B5CF6)
7. `surgeon_rejected` - Refus chirurgien [TERMINAL] (#DC2626)
8. `surgeon_accepted` - Accord chirurgien (#10B981)
9. `quote_issued` - Devis émis (#F59E0B)
10. `quote_rejected` - Devis refusé [TERMINAL] (#DC2626)
11. `quote_accepted` - Devis accepté (#10B981)
12. `surgery_scheduled` - Date chirurgie confirmée (#8B5CF6)
13. `deposit_received` - Acompte 30% reçu (#10B981)
14. `confirmed` - Dossier confirmé (#059669)

##### 4. **patient_messages** - Messages par patient
```sql
CREATE TABLE public.patient_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  author_name TEXT NOT NULL,
  author_role user_role NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('message', 'status_change', 'system')),
  title TEXT,
  body TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### 5. **notifications** - Notifications utilisateurs
```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### 6. **surgeons** - Neurochirurgiens
```sql
CREATE TABLE public.surgeons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT,
  specialization TEXT,
  hospital TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### 7. **medical_decisions** - Décisions médicales (Gilles)
```sql
CREATE TABLE public.medical_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  decided_by UUID REFERENCES profiles(id) NOT NULL,
  decision_type TEXT NOT NULL,
  justification TEXT NOT NULL,
  assigned_surgeon_id UUID REFERENCES surgeons(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### 8. **quotes** - Devis
```sql
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  conditions TEXT,
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### 9. **calendar_events** - Événements calendrier
```sql
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  surgeon_id UUID REFERENCES surgeons(id),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### 10. **audit_logs** - Logs d'audit (append-only)
```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Triggers et fonctions

#### Trigger `updated_at`
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at 
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Indexes recommandés (à ajouter)
```sql
CREATE INDEX idx_patients_status ON patients(current_status_id);
CREATE INDEX idx_patients_created_by ON patients(created_by);
CREATE INDEX idx_messages_patient ON patient_messages(patient_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

---

## 🔒 SÉCURITÉ ET AUTHENTIFICATION

### Row Level Security (RLS)

**Principe** : Tous les utilisateurs authentifiés voient toutes les données (pas de cloisonnement).

#### Politiques RLS actives

```sql
-- Lecture (SELECT)
CREATE POLICY "Authenticated users can view all profiles" 
  ON profiles FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all patients" 
  ON patients FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all messages" 
  ON patient_messages FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all notifications" 
  ON notifications FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Écriture (INSERT/UPDATE)
CREATE POLICY "Users can insert patients" 
  ON patients FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update patients" 
  ON patients FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert messages" 
  ON patient_messages FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update notifications" 
  ON notifications FOR UPDATE 
  USING (user_id = auth.uid());
```

### Système de permissions (lib/permissions.ts)

```typescript
export type UserRole = 'marcel' | 'franchir' | 'gilles' | 'admin'

export const PERMISSIONS = {
  CREATE_PATIENT: ['marcel', 'franchir', 'admin'],
  EDIT_PATIENT: ['franchir', 'gilles', 'admin'],
  DELETE_PATIENT: ['admin'],
  CHANGE_STATUS: ['franchir', 'gilles', 'admin'],
  MEDICAL_DECISION: ['gilles', 'admin'],
  MANAGE_QUOTES: ['franchir', 'admin'],
  MANAGE_CALENDAR: ['franchir', 'admin'],
  VIEW_AUDIT: ['admin'],
}

export function hasPermission(userRole: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission].includes(userRole)
}
```

### Middleware de protection (middleware.ts)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirection si non authentifié
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirection si authentifié sur /login
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Authentification Supabase

#### Client-side (lib/supabase/client.ts)
```typescript
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### Server-side (lib/supabase/server.ts)
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

---

## 👥 PARCOURS UTILISATEUR

### 1. Connexion

**Route** : `/login`  
**Composant** : `app/login/page.tsx`

**Flux** :
1. Utilisateur entre email + mot de passe
2. Validation via Supabase Auth
3. Création de session sécurisée
4. Redirection vers `/dashboard`

**Gestion d'erreurs** :
- Email invalide
- Mot de passe incorrect
- Compte non confirmé
- Profil manquant dans la table `profiles`

### 2. Dashboard principal

**Route** : `/dashboard`  
**Composant** : `app/dashboard/page.tsx`

**Affichage** :
- Header avec nom d'utilisateur, rôle, cloche de notifications
- Bouton "+ Nouveau Patient" (si permission)
- Tableau des patients avec colonnes :
  - Nom du patient
  - Statut (badge coloré)
  - Créé par
  - Date de création
  - Actions (Voir dossier)

**Fonctionnalités** :
- Tri par date de création (DESC)
- Filtrage par statut (à implémenter)
- Recherche par nom (à implémenter)
- Actualisation temps réel via Supabase Realtime

### 3. Création de patient

**Route** : `/dashboard/new`  
**Composant** : `app/dashboard/new/page.tsx`

**Permissions** : `marcel`, `franchir`, `admin`

**Formulaire** :
- Nom du patient (requis)
- Résumé clinique (optionnel, textarea)
- Lien SharePoint (optionnel, URL validée)

**Validation** :
- Nom : minimum 2 caractères
- SharePoint : format URL valide si renseigné

**Comportement** :
1. Soumission du formulaire
2. Insertion dans `patients` avec :
   - `current_status_id` = "Prospect créé"
   - `created_by` = ID utilisateur connecté
3. Création message système dans `patient_messages`
4. Redirection vers `/dashboard/patient/[id]`

### 4. Détail patient

**Route** : `/dashboard/patient/[id]`  
**Composant** : `app/dashboard/patient/[id]/page.tsx`

**Sections** :

#### A. En-tête
- Nom du patient
- Badge de statut actuel
- Lien SharePoint (si renseigné)
- Créé par + date

#### B. Résumé clinique
- Affichage du texte
- Bouton "Modifier" (si permission)

#### C. Actions de workflow
- Panel latéral avec boutons d'action selon le statut actuel
- Transitions possibles affichées dynamiquement
- Formulaires contextuels (justification, sélection chirurgien, etc.)

#### D. Fil de messages
- Affichage chronologique des messages
- Types : `message`, `status_change`, `system`
- Auteur, rôle, date
- Composer de message en bas

#### E. Événements calendrier (Phase 3)
- Liste des événements liés au patient
- Formulaire d'ajout d'événement

#### F. Devis (Phase 3)
- Carte de devis avec montant, conditions, statut
- Actions : accepter, refuser, modifier

### 5. Notifications

**Composant** : `components/notifications/notification-bell.tsx`

**Fonctionnalités** :
- Badge avec nombre de notifications non lues
- Dropdown avec liste des notifications
- Types : `urgent`, `info`, `success`
- Clic sur notification → navigation vers patient concerné
- Marquage comme lu automatique
- Abonnement temps réel via Supabase Realtime

**Déclencheurs** :
- Nouveau message sur un patient
- Changement de statut
- Devis émis
- Événement calendrier ajouté

### 6. Workflow de statuts

**Transitions autorisées** :

```
prospect_created → medical_review (Franchir)
medical_review → validated_medical (Gilles)
medical_review → need_info (Gilles)
medical_review → rejected_medical (Gilles) [TERMINAL]
need_info → medical_review (Franchir)
validated_medical → sent_to_surgeon (Franchir)
sent_to_surgeon → surgeon_accepted (Franchir)
sent_to_surgeon → surgeon_rejected (Franchir) [TERMINAL]
surgeon_accepted → quote_issued (Franchir)
quote_issued → quote_accepted (Patient/Franchir)
quote_issued → quote_rejected (Patient/Franchir) [TERMINAL]
quote_accepted → surgery_scheduled (Franchir)
surgery_scheduled → deposit_received (Franchir)
deposit_received → confirmed (Franchir)
```

**Logique de changement** :
1. Vérification des permissions
2. Validation de la transition
3. Mise à jour `patients.current_status_id`
4. Création message `status_change` dans `patient_messages`
5. Création notifications pour tous les autres utilisateurs
6. Trigger `updated_at`

---

## 🔌 API ET ROUTES

### Routes API Next.js

#### 1. POST `/api/patients/[id]/messages`

**Fichier** : `app/api/patients/[id]/messages/route.ts`

**Fonction** : Ajouter un message à un patient

**Body** :
```json
{
  "message": "Texte du message"
}
```

**Logique** :
1. Vérification authentification
2. Récupération profil utilisateur
3. Insertion dans `patient_messages` :
   - `kind` = "message"
   - `author_id`, `author_name`, `author_role`
   - `body` = message
4. Création notifications pour tous les autres utilisateurs
5. Retour `{ success: true }`

**Erreurs** :
- 400 : Message vide
- 401 : Non authentifié
- 404 : Profil non trouvé
- 500 : Erreur insertion

#### 2. POST `/api/patients/[id]/change-status`

**Fichier** : `app/api/patients/[id]/change-status/route.ts`

**Fonction** : Changer le statut d'un patient

**Body** :
```json
{
  "newStatusId": "uuid-du-nouveau-statut",
  "justification": "Raison du changement (optionnel)"
}
```

**Logique** :
1. Vérification authentification et permissions
2. Validation de la transition (statut actuel → nouveau statut)
3. Mise à jour `patients.current_status_id`
4. Création message `status_change` dans `patient_messages`
5. Création notifications
6. Retour `{ success: true }`

**Erreurs** :
- 400 : Données invalides
- 401 : Non authentifié
- 403 : Permission refusée
- 404 : Patient ou statut non trouvé
- 422 : Transition non autorisée
- 500 : Erreur serveur

#### 3. POST `/api/notify`

**Fichier** : `app/api/notify/route.ts`

**Fonction** : Créer une notification manuelle (test/admin)

**Body** :
```json
{
  "userId": "uuid-utilisateur",
  "type": "info",
  "title": "Titre",
  "message": "Message",
  "link": "/dashboard/patient/xxx",
  "patientId": "uuid-patient (optionnel)"
}
```

#### 4. POST `/api/dev/switch-role`

**Fichier** : `app/api/dev/switch-role/route.ts`

**Fonction** : Changer le rôle d'un utilisateur (développement uniquement)

**Body** :
```json
{
  "role": "gilles"
}
```

**⚠️ À DÉSACTIVER EN PRODUCTION**

#### 5. POST `/auth/signout/route`

**Fichier** : `app/auth/signout/route.ts`

**Fonction** : Déconnexion utilisateur

**Logique** :
1. Appel `supabase.auth.signOut()`
2. Suppression des cookies de session
3. Redirection vers `/login`

### Requêtes Supabase côté client

#### Récupération des patients
```typescript
const { data: patients } = await supabase
  .from('patients')
  .select(`
    *,
    current_status:workflow_statuses(*),
    creator:profiles!created_by(full_name, role)
  `)
  .order('created_at', { ascending: false })
```

#### Récupération d'un patient avec détails
```typescript
const { data: patient } = await supabase
  .from('patients')
  .select(`
    *,
    current_status:workflow_statuses(*),
    creator:profiles!created_by(*),
    assigned_surgeon:surgeons(*),
    messages:patient_messages(*, author:profiles(*)),
    events:calendar_events(*, surgeon:surgeons(*)),
    quotes(*)
  `)
  .eq('id', patientId)
  .single()
```

#### Abonnement temps réel aux notifications
```typescript
const channel = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      console.log('Nouvelle notification:', payload)
      loadNotifications()
    }
  )
  .subscribe()
```

---

## ⚙️ CONFIGURATION ET DÉPLOIEMENT

### Variables d'environnement

**Fichier** : `.env.local` (à créer)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optionnel : Email (Resend)
RESEND_API_KEY=re_xxxxx
```

### Configuration Supabase

#### 1. Créer un projet Supabase
1. Aller sur https://supabase.com
2. Créer un compte
3. "New Project"
4. Nom : `franchir-patient-tracker`
5. Région : Europe (Paris ou proche)
6. Mot de passe DB : générer un mot de passe fort

#### 2. Récupérer les credentials
1. Settings > API
2. Copier :
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

#### 3. Exécuter le schéma SQL
1. SQL Editor > New query
2. Copier le contenu de `supabase-schema.sql`
3. Run (Ctrl/Cmd + Enter)
4. Vérifier qu'il n'y a pas d'erreurs

#### 4. Activer Realtime
1. Database > Replication
2. Activer la réplication pour la table `notifications`
3. Ou exécuter `supabase-fix-realtime.sql`

#### 5. Créer les utilisateurs
**Via l'interface** :
1. Authentication > Users > Add user
2. Email : `marcel@franchir.com`
3. Password : `Test123456!`
4. Auto Confirm User : ✅
5. Créer l'utilisateur
6. Copier l'UUID généré

**Créer le profil** :
```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  'UUID_COPIÉ',
  'marcel@franchir.com',
  'Marcel Dupont',
  'marcel'
);
```

Répéter pour :
- `gilles@franchir.com` (rôle: `gilles`)
- `admin@franchir.com` (rôle: `admin`)
- `franchir@franchir.com` (rôle: `franchir`)

### Installation locale

```bash
# Cloner le repo
git clone <repo-url>
cd franchir-patient-tracker

# Installer les dépendances
npm install

# Créer .env.local avec les credentials Supabase

# Lancer le serveur de développement
npm run dev

# Ouvrir http://localhost:3000
```

### Déploiement Vercel

#### 1. Connecter le repo GitHub
1. Aller sur https://vercel.com
2. Import Project
3. Sélectionner le repo GitHub

#### 2. Configurer les variables d'environnement
1. Settings > Environment Variables
2. Ajouter :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

#### 3. Déployer
1. Deploy
2. Attendre la fin du build
3. Tester l'URL de production

#### 4. Configuration du domaine (optionnel)
1. Settings > Domains
2. Ajouter un domaine personnalisé
3. Configurer les DNS

### Scripts npm

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

---

## ⚠️ PROBLÈMES IDENTIFIÉS UX/UI

### 1. Navigation et orientation

**Problèmes** :
- ❌ Pas de fil d'Ariane (breadcrumb)
- ❌ Bouton retour absent sur les pages de détail
- ❌ Pas d'indication visuelle de la page active
- ❌ Logo/nom de l'app non cliquable pour retour dashboard

**Impact** : Utilisateur perdu, navigation difficile

### 2. Feedback utilisateur

**Problèmes** :
- ❌ Pas de toast/notification après actions (création, modification)
- ❌ Pas de loader pendant les requêtes API
- ❌ Pas de confirmation avant actions critiques (suppression, refus)
- ❌ Messages d'erreur génériques peu explicites

**Impact** : Utilisateur ne sait pas si son action a réussi

### 3. Tableau de bord

**Problèmes** :
- ❌ Pas de pagination (problème si 100+ patients)
- ❌ Pas de filtres par statut
- ❌ Pas de recherche par nom
- ❌ Pas de tri sur les colonnes
- ❌ Pas d'export CSV/Excel
- ❌ Colonnes non redimensionnables
- ❌ Pas de vue "mes patients" vs "tous les patients"

**Impact** : Difficile de trouver un patient spécifique

### 4. Formulaires

**Problèmes** :
- ❌ Validation uniquement à la soumission (pas en temps réel)
- ❌ Messages d'erreur sous les champs peu visibles
- ❌ Pas d'auto-save (perte de données si refresh)
- ❌ Pas de compteur de caractères sur les textareas
- ❌ Pas d'aide contextuelle (tooltips)

**Impact** : Frustration, perte de données

### 5. Détail patient

**Problèmes** :
- ❌ Toutes les sections affichées en même temps (scroll infini)
- ❌ Pas d'onglets pour organiser l'information
- ❌ Fil de messages mélangé avec les changements de statut
- ❌ Pas de filtre sur les messages (par type, par auteur)
- ❌ Pas de recherche dans les messages
- ❌ Pas d'édition inline du résumé clinique

**Impact** : Information difficile à trouver

### 6. Workflow

**Problèmes** :
- ❌ Actions de workflow dans un panel latéral peu visible
- ❌ Pas de visualisation graphique du workflow complet
- ❌ Pas d'indication des étapes suivantes possibles
- ❌ Pas d'historique visuel des changements de statut
- ❌ Justifications obligatoires mais pas de templates

**Impact** : Utilisateur ne comprend pas le processus

### 7. Notifications

**Problèmes** :
- ❌ Cloche de notification peu visible
- ❌ Pas de son/vibration sur nouvelle notification
- ❌ Pas de regroupement par patient
- ❌ Pas de filtres (lues/non lues, par type)
- ❌ Pas de "tout marquer comme lu"
- ❌ Pas de préférences de notification

**Impact** : Notifications manquées

### 8. Responsive design

**Problèmes** :
- ❌ Tableau non responsive (scroll horizontal sur mobile)
- ❌ Formulaires difficiles à remplir sur mobile
- ❌ Dropdown notifications trop large sur mobile
- ❌ Pas de menu burger sur mobile

**Impact** : Inutilisable sur mobile/tablette

### 9. Performance

**Problèmes** :
- ❌ Chargement complet de tous les patients à chaque fois
- ❌ Pas de cache côté client
- ❌ Images non optimisées (si ajoutées)
- ❌ Pas de lazy loading des composants lourds

**Impact** : Application lente

### 10. Accessibilité

**Problèmes** :
- ❌ Pas de support clavier complet
- ❌ Pas de labels ARIA
- ❌ Contrastes de couleurs insuffisants
- ❌ Pas de mode sombre
- ❌ Tailles de police fixes (pas de zoom)

**Impact** : Inaccessible pour certains utilisateurs

### 11. Sécurité affichée

**Problèmes** :
- ❌ Bouton "Switch Role" visible en production (dev only)
- ❌ Pas d'indication du niveau de sécurité (HTTPS, etc.)
- ❌ Pas de timeout de session visible
- ❌ Pas de log des connexions

**Impact** : Confiance utilisateur faible

### 12. Données et contenu

**Problèmes** :
- ❌ Pas de gestion des pièces jointes
- ❌ Pas d'aperçu des liens SharePoint
- ❌ Pas de versioning du résumé clinique
- ❌ Pas de tags/catégories sur les patients
- ❌ Dates affichées en format technique (ISO)

**Impact** : Fonctionnalités limitées

---

## 🚀 RECOMMANDATIONS POUR LA V2

### Priorité 1 : UX Critique (Sprint 1 - 2 semaines)

#### 1.1 Navigation
- ✅ Ajouter fil d'Ariane sur toutes les pages
- ✅ Bouton "Retour" sur page détail patient
- ✅ Logo cliquable → dashboard
- ✅ Menu de navigation avec page active surlignée

#### 1.2 Feedback utilisateur
- ✅ Système de toast notifications (react-hot-toast)
- ✅ Loaders sur toutes les actions async
- ✅ Modales de confirmation pour actions critiques
- ✅ Messages d'erreur contextuels et explicites

#### 1.3 Tableau de bord
- ✅ Pagination (20 patients par page)
- ✅ Filtres par statut (multi-select)
- ✅ Barre de recherche par nom patient
- ✅ Tri sur colonnes (nom, date, statut)

#### 1.4 Responsive
- ✅ Tableau responsive avec cartes sur mobile
- ✅ Menu burger sur mobile
- ✅ Formulaires optimisés mobile
- ✅ Dropdown notifications adaptatif

### Priorité 2 : Fonctionnalités essentielles (Sprint 2 - 3 semaines)

#### 2.1 Détail patient amélioré
- ✅ Onglets : Résumé / Messages / Calendrier / Devis / Historique
- ✅ Édition inline du résumé clinique
- ✅ Filtres sur les messages (type, auteur, date)
- ✅ Recherche dans les messages
- ✅ Timeline visuelle du workflow

#### 2.2 Workflow amélioré
- ✅ Visualisation graphique du workflow complet
- ✅ Indicateurs des étapes suivantes possibles
- ✅ Templates de justifications prédéfinis
- ✅ Historique des changements avec diff

#### 2.3 Notifications améliorées
- ✅ Regroupement par patient
- ✅ Filtres (lues/non lues, par type)
- ✅ "Tout marquer comme lu"
- ✅ Préférences de notification par utilisateur
- ✅ Notifications email (via Resend)

#### 2.4 Gestion des fichiers
- ✅ Upload de pièces jointes (Supabase Storage)
- ✅ Galerie de documents par patient
- ✅ Prévisualisation PDF/images
- ✅ Versioning des documents

### Priorité 3 : Optimisations (Sprint 3 - 2 semaines)

#### 3.1 Performance
- ✅ Pagination côté serveur
- ✅ Cache React Query
- ✅ Lazy loading des composants
- ✅ Optimisation des images (next/image)
- ✅ Debounce sur les recherches

#### 3.2 Accessibilité
- ✅ Support clavier complet (Tab, Enter, Esc)
- ✅ Labels ARIA sur tous les éléments interactifs
- ✅ Contrastes WCAG AA minimum
- ✅ Mode sombre
- ✅ Tailles de police ajustables

#### 3.3 Sécurité
- ✅ Retirer le switch role en production
- ✅ Timeout de session (30 min)
- ✅ Log des connexions et actions sensibles
- ✅ Rate limiting sur les API
- ✅ Validation stricte côté serveur

### Priorité 4 : Fonctionnalités avancées (Sprint 4+ - 4 semaines)

#### 4.1 Calendrier
- ✅ Vue calendrier mensuel/hebdomadaire
- ✅ Drag & drop pour planifier
- ✅ Synchronisation Google Calendar
- ✅ Rappels automatiques

#### 4.2 Devis
- ✅ Générateur de devis PDF
- ✅ Templates personnalisables
- ✅ Signature électronique
- ✅ Suivi des paiements

#### 4.3 Reporting
- ✅ Dashboard analytics (KPIs)
- ✅ Graphiques de conversion par étape
- ✅ Export Excel/CSV
- ✅ Rapports automatiques par email

#### 4.4 Collaboration
- ✅ Mentions (@user) dans les messages
- ✅ Assignation de tâches
- ✅ Commentaires sur les documents
- ✅ Historique des modifications

### Architecture technique V2

#### Frontend
- ✅ Migrer vers React Query pour le cache
- ✅ Ajouter Zustand pour le state management global
- ✅ Implémenter react-hook-form + zod partout
- ✅ Ajouter Storybook pour les composants
- ✅ Tests E2E avec Playwright

#### Backend
- ✅ Ajouter des Edge Functions Supabase pour la logique métier
- ✅ Implémenter un système de queues (pour emails, etc.)
- ✅ Ajouter des webhooks pour intégrations externes
- ✅ Mettre en place un système de backup automatique

#### DevOps
- ✅ CI/CD avec GitHub Actions
- ✅ Tests automatisés (unit + E2E)
- ✅ Monitoring avec Sentry
- ✅ Analytics avec Plausible/Posthog
- ✅ Environnements staging + production

### Design System

#### Créer un design system complet
- ✅ Palette de couleurs cohérente
- ✅ Typographie (échelle, poids)
- ✅ Espacements (système 4px/8px)
- ✅ Composants UI réutilisables
- ✅ Animations et transitions
- ✅ Iconographie cohérente

#### Outils recommandés
- Figma pour les maquettes
- Tailwind CSS + CVA pour les styles
- Radix UI pour les composants accessibles
- Framer Motion pour les animations

---

## 📊 MÉTRIQUES DE SUCCÈS V2

### Performance
- ✅ Time to Interactive < 2s
- ✅ First Contentful Paint < 1s
- ✅ Lighthouse Score > 90

### UX
- ✅ Taux de complétion des formulaires > 95%
- ✅ Temps moyen de création patient < 2 min
- ✅ Taux de rebond < 10%

### Adoption
- ✅ 100% des utilisateurs actifs quotidiennement
- ✅ Taux de satisfaction > 4/5
- ✅ Nombre de tickets support < 5/mois

---

## 📝 NOTES FINALES

### Points forts actuels
- ✅ Architecture solide (Next.js + Supabase)
- ✅ Sécurité de base en place (RLS, middleware)
- ✅ Workflow complet et fonctionnel
- ✅ Base de données bien structurée
- ✅ Temps réel opérationnel

### Points à améliorer en priorité
- ❌ UX/UI globale (navigation, feedback)
- ❌ Responsive design
- ❌ Performance (pagination, cache)
- ❌ Accessibilité
- ❌ Tests automatisés

### Prochaines étapes immédiates
1. Créer les maquettes Figma de la V2
2. Prioriser les user stories avec les utilisateurs
3. Mettre en place l'environnement de staging
4. Commencer le Sprint 1 (UX Critique)

---

## 📞 CONTACTS ET RESSOURCES

### Documentation
- Next.js : https://nextjs.org/docs
- Supabase : https://supabase.com/docs
- Tailwind CSS : https://tailwindcss.com/docs

### Support
- Email : support@franchir.com
- Slack : #franchir-patient-tracker

### Accès
- **Production** : https://franchir-patient-tracker.vercel.app
- **Staging** : https://franchir-patient-tracker-staging.vercel.app
- **Supabase Dashboard** : https://supabase.com/dashboard/project/[PROJECT_ID]
- **GitHub** : https://github.com/[ORG]/franchir-patient-tracker

---

**Document créé le** : Janvier 2025  
**Dernière mise à jour** : Janvier 2025  
**Version** : 1.0  
**Auteur** : Équipe Technique FRANCHIR
