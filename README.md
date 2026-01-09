# FRANCHIR Patient Tracker - Phase 2 Complétée ✅

Application web sécurisée de gestion de parcours patients pour le réseau FRANCHIR.

## Stack Technique

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend & DB**: Supabase (Postgres + Auth + RLS)
- **Déploiement**: Vercel

## Installation

1. Cloner le repository

2. Installer les dépendances:
```bash
cd franchir-patient-tracker
npm install
```

3. Configurer les variables d'environnement dans `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

4. Exécuter le schéma SQL dans Supabase:
   - Ouvrir l'éditeur SQL dans votre projet Supabase
   - Copier et exécuter le contenu de `supabase-schema.sql`

5. Créer un utilisateur test dans Supabase Auth (voir `SUPABASE_SETUP.md`)

6. Lancer le serveur de développement:
```bash
npm run dev
```

7. Ouvrir [http://localhost:3000](http://localhost:3000)

## Structure du Projet

```
franchir-patient-tracker/
├── app/
│   ├── auth/signout/              # Route API de déconnexion
│   ├── dashboard/
│   │   ├── page.tsx               # Tableau partagé des patients
│   │   ├── new/page.tsx           # Formulaire nouveau patient
│   │   └── patient/[id]/
│   │       ├── page.tsx           # Détail patient
│   │       └── workflow-actions.tsx  # Actions de workflow
│   ├── login/                     # Page de connexion
│   └── layout.tsx                 # Layout racine
├── components/
│   └── ui/
│       └── badge-status.tsx       # Badge de statut coloré
├── lib/
│   └── supabase/
│       ├── client.ts              # Client Supabase (côté client)
│       └── server.ts              # Client Supabase (côté serveur)
├── middleware.ts                  # Protection des routes
└── supabase-schema.sql            # Schéma de base de données
```

## Fonctionnalités Implémentées

### Phase 1 - Fondations & Sécurité ✅

- [x] Setup projet Next.js + Supabase
- [x] Schéma de base de données complet avec:
  - Tables: profiles, patients, workflow_statuses, surgeons, medical_decisions, quotes, calendar_events, audit_logs
  - Row Level Security (RLS) activé
  - 14 statuts de workflow prédéfinis
  - Triggers pour updated_at
- [x] Authentification sécurisée avec middleware
- [x] Gestion des rôles (marcel, franchir, gilles, admin)
- [x] Page de login fonctionnelle
- [x] Dashboard avec affichage du profil

### Phase 2 - Workflow & Tableau ✅

- [x] Tableau partagé des patients avec:
  - Liste complète des patients
  - Affichage du statut avec badge coloré
  - Créateur et date de création
  - Navigation vers le détail
- [x] Formulaire de création de patient (Marcel):
  - Nom du patient
  - Résumé clinique minimal
  - Lien SharePoint sécurisé
  - Création automatique avec statut "Prospect créé"
- [x] Page de détail patient avec:
  - Informations complètes
  - Lien vers SharePoint
  - Historique des actions
  - Panel d'actions de workflow
- [x] Moteur de workflow complet avec transitions:
  - Prospect créé → Revue médicale
  - Revue médicale → Validé / Refusé / À compléter
  - Validé → Envoyé au chirurgien
  - Chirurgien → Accepté / Refusé
  - Accepté → Devis émis
  - Devis → Accepté / Refusé
  - Accepté → Chirurgie planifiée
  - Planifiée → Acompte reçu
  - Acompte → Confirmé

## Workflow des Statuts

```
1. Prospect créé (Marcel)
   ↓
2. En revue médicale (Franchir)
   ↓
3a. Validé médicalement (Gilles) → 5. Envoyé au chirurgien
3b. À compléter → retour à 2
3c. Refusé médicalement [TERMINAL]
   ↓
6a. Accord chirurgien → 9. Devis émis
6b. Refus chirurgien [TERMINAL]
   ↓
10a. Devis accepté → 12. Date chirurgie confirmée
10b. Devis refusé [TERMINAL]
   ↓
13. Acompte 30% reçu
   ↓
14. Dossier confirmé
```

## Prochaines Étapes

### Phase 3: Calendrier, Devis & Notifications
- [ ] Calendrier de chirurgie avec dates proposées/confirmées
- [ ] Gestion des devis (montant, conditions, acceptation)
- [ ] Système de notifications email automatiques
- [ ] Templates d'emails personnalisables par statut
- [ ] Historique complet avec audit trail

## Notes Importantes

- Les variables d'environnement dans `.env.local` sont des placeholders
- Remplacer par vos vraies credentials Supabase avant de tester
- Le schéma SQL doit être exécuté dans Supabase avant la première utilisation
- Tous les utilisateurs voient tous les patients (pas de cloisonnement)
- Les données minimales sont stockées dans l'outil
- Le dossier médical complet reste sur SharePoint

## Tests Manuels

Pour tester le workflow complet:

1. Se connecter avec un utilisateur test
2. Créer un nouveau patient via "+ Nouveau Patient"
3. Vérifier qu'il apparaît dans le tableau avec le statut "Prospect créé"
4. Cliquer sur "Voir dossier"
5. Utiliser les boutons d'action pour faire progresser le statut
6. Vérifier que le badge de statut se met à jour
7. Retourner au tableau et vérifier que le statut est à jour
