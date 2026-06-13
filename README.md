# FRANCHIR Patient Tracker

Application web sécurisée de gestion de parcours patients pour le réseau FRANCHIR.

## Stack Technique

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS
- **Backend & DB**: Supabase (Postgres + Auth + Realtime + RLS)
- **Emails**: Resend
- **Déploiement**: Vercel
- **URL de production**: https://patients.franchir.eu

> ⚠️ L'ancienne adresse `app.franchir.eu` ne sert plus le tracker (migration du site Franchir). L'URL de production officielle est désormais **`https://patients.franchir.eu`**.

## Intégration & fonctionnalités récentes (juin 2026)

Le tracker est l'**outil unique de pilotage multi-rôle** du parcours patient.

- **Email patient** à la création : déclenche l'envoi automatique du questionnaire (revue médicale d'abord, chirurgien assigné plus tard).
- **Upload DICOM + documents** (PDF, comptes rendus) à la création et depuis la fiche patient — stockage privé Supabase (`patient-documents`), visionneuse DICOM (dwv) et PDF intégrées. Remplace le lien SharePoint.
- **Pont vers l'app questionnaires** (`vsnjahkrsqxbvspwhaka`) : à la création/MAJ d'un patient avec email, le dossier est synchronisé (Edge Function `sync-patient-to-questionnaires` + Database Webhook). Le chirurgien (optionnel) enrichit le dossier lors de l'assignation.
- **Statut du questionnaire** remonté en retour (`questionnaire_status`/`_completed_at`/`_summary`) : Marcel voit quand le questionnaire est complété.

## Variables d'environnement

Créer un fichier `.env.local` à la racine du projet :

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_APP_URL=https://patients.franchir.eu
```

## Installation

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Structure du Projet

```
franchir-patient-tracker/
├── app/
│   ├── api/
│   │   ├── notify/route.ts              # Route email générique
│   │   ├── patients/
│   │   │   ├── route.ts                 # Création de patient + notifications
│   │   │   └── [id]/
│   │   │       ├── change-status/       # Actions workflow + notifications
│   │   │       ├── commercial-data/     # Mise à jour données commerciales
│   │   │       ├── messages/            # Envoi de messages + notifications
│   │   │       └── update-summary/      # Mise à jour résumé clinique
│   │   └── vitals/route.ts              # Web vitals logging
│   ├── auth/signout/                    # Déconnexion
│   ├── dashboard/
│   │   ├── page.tsx                     # Tableau des patients
│   │   ├── new/page.tsx                 # Formulaire nouveau patient
│   │   └── patient/[id]/page.tsx        # Détail patient
│   ├── login/page.tsx                   # Connexion
│   └── layout.tsx                       # Layout racine + Analytics
├── components/
│   ├── ui/                              # Composants UI réutilisables
│   └── workflow-actions.tsx             # Panel d'actions workflow
├── lib/
│   ├── email-config.ts                  # Mapping rôles → emails réels
│   ├── email-templates.ts               # Templates HTML des emails
│   ├── logger.ts                        # Logger structuré
│   ├── notifications.ts                 # Utilitaires notifications + emails
│   ├── permissions.ts                   # Règles d'autorisation par rôle
│   ├── validations.ts                   # Schémas Zod
│   ├── workflow-v2.ts                   # Moteur de workflow
│   └── supabase/
│       ├── client.ts                    # Client Supabase (navigateur)
│       └── server.ts                    # Client Supabase (serveur)
├── middleware.ts                        # Protection des routes
└── supabase-schema.sql                  # Schéma de base de données
```

## Utilisateurs et Rôles

| Rôle | Utilisateur | Email |
|------|-------------|-------|
| `marcel` | Marcel Mazaltarim | marcel.mazaltarim@gmail.com |
| `gilles` | Dr Gilles Dubois | duboisgilles31@gmail.com |
| `admin` / `franchir` | Erik Boulard | erik.boulard@franchir.eu |

L'expéditeur des emails est `yves.merillon@franchir.eu` (domaine vérifié sur Resend).

## Système de Notifications

Chaque action déclenche automatiquement :
1. Une **notification in-app** (temps réel via Supabase Realtime)
2. Un **email Resend** aux utilisateurs concernés

### Événements notifiés

| Événement | Destinataires |
|-----------|---------------|
| Nouveau dossier créé | Tous les autres utilisateurs |
| Nouveau message | Tous les autres utilisateurs |
| Soumis à revue médicale | `gilles` |
| Validé médicalement | `marcel`, `franchir`, `admin` |
| Refusé médicalement | `marcel`, `franchir`, `admin` |
| Informations demandées | `marcel`, `franchir`, `admin` |
| Chirurgie programmée | Tous |
| Dossier réouvert | `marcel`, `franchir`, `admin` |

### Architecture des notifications (`lib/notifications.ts`)

```
sendNewPatientNotifications()    → création de dossier
sendNewMessageNotifications()    → nouveau message
sendStatusChangeNotifications()  → changement de statut workflow
```

## Workflow des Statuts

```
prospect_created      Prospect créé (Marcel)
       ↓
medical_review        En revue médicale
       ↓
validated_medical     Validé médicalement  →  need_info (À compléter)
rejected_medical      Refusé médicalement [TERMINAL]
       ↓
surgery_scheduled     Chirurgie programmée (devis + date confirmés)
```

### Actions disponibles par rôle

| Action | Rôle requis |
|--------|-------------|
| Soumettre à validation médicale | `marcel`, `franchir`, `admin` |
| Valider / Refuser médicalement | `gilles` |
| Demander des infos complémentaires | `gilles` |
| Confirmer le devis | `marcel`, `franchir`, `admin` |
| Confirmer la date | `marcel`, `franchir`, `admin` |
| Proposer des dates / budget | `gilles` |
| Réouvrir le dossier | `admin`, `franchir` |

## Déploiement

Le projet est déployé sur Vercel avec déploiement automatique depuis la branche `main`.

```bash
git push origin main
```

Les variables d'environnement sont configurées dans le dashboard Vercel.

## Développement

```bash
npm run dev      # Serveur de développement
npm run build    # Build de production
npm run lint     # Linting ESLint
```
