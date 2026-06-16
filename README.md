# FRANCHIR Patient Tracker

Application web sécurisée de gestion de parcours patients pour le réseau FRANCHIR.

## Stack Technique

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS + **dwv 0.36.3**
- **Backend & DB**: Supabase (Postgres + Auth + Realtime + RLS)
- **Emails**: Resend
- **Déploiement**: Vercel
- **URL de production**: https://patients.franchir.eu

> ⚠️ L'ancienne adresse `app.franchir.eu` ne sert plus le tracker (migration du site Franchir). L'URL de production officielle est désormais **`https://patients.franchir.eu`**.

## Intégration & fonctionnalités récentes (juin 2026)

Le tracker est l'**outil unique de pilotage multi-rôle** du parcours patient.
**Gilles/Erik valident ici** — ils n'utilisent pas le portail clinicien
questionnaires (`questionnaire.franchir.eu/clinician`).

- **Email patient** à la création : déclenche l'envoi automatique du questionnaire (revue médicale d'abord, chirurgien assigné plus tard). Rattrapage sync + renvoi de lien corrigés.
- **Upload DICOM + documents** (PDF, comptes rendus) à la création et depuis la fiche patient — stockage privé Supabase (`patient-documents`), visionneuse DICOM et PDF intégrées. **Guidance délais/limites** affichée près de la zone d'upload (`lib/documents/upload-guidance.ts`).
- **Pont vers l'app questionnaires** (`questionnaire.franchir.eu`) : à la création/MAJ d'un patient avec email, le dossier est synchronisé (Edge Function `sync-patient-to-questionnaires` + Database Webhook). Le chirurgien (optionnel) enrichit le dossier lors de l'assignation.
- **Statut du questionnaire** remonté en retour (`questionnaire_status`/`_completed_at`/`_summary`) : Marcel voit quand le questionnaire est complété.
- **Synthèse PDF questionnaire (P1)** : panneau sur la fiche patient — Gilles
  (validation médicale), Marcel/admin (lecture seule). Proxy
  `GET /api/patients/[id]/questionnaire-synthesis-pdf` → pont questionnaires
  `patient-synthesis-pdf` (scores, drapeaux, imagerie).
- **Mode validation Gilles (P0)** : `PatientDetailViewConfig` — fiche épurée
  (masque SharePoint, assignation chir, upload docs, onglet commercial,
  gestion questionnaire) ; conserve workflow + synthèse PDF.
- **Carte Chirurgien responsable** (`surgeon-assignment-card`) : assignation
  `assigned_surgeon_id` — visible/gérable par **Marcel** uniquement (pas Gilles).

## Imagerie & visionneuse DICOM

### Stockage & upload

| Bucket | Projet | Contenu |
|--------|--------|---------|
| `patient-documents` | Tracker (`zdmeidekszdrzmjuasee`) | DICOM + PDF/images uploadés par Marcel |
| `patient-images` | Questionnaires (`vsnjahkrsqxbvspwhaka`) | Imagerie patient + forward depuis Marcel |

- Upload depuis la fiche patient (`components/patient/document-upload.tsx`) :
  fichiers isolés ou **import dossier CD DICOM** (`lib/imaging/dicom-folder-import.ts`).
- Détection magic bytes, regroupement par dossier série (`SE00000x`), ignore
  `DICOMDIR` / compagnons CD. Déduplication basename + taille à l'affichage
  clinicien (fusion avec le forward).
- Signed upload direct Storage (DICOM volumineux — pas de transit via Vercel).
- **Guidance utilisateur** : délais import CD (1–3 min), limites taille/lot,
  note forward >50 Mo non transmis au portail chir, délais visionneuse
  (`lib/documents/upload-guidance.ts`).

### Visionneuse DICOM (dwv 0.36.3)

Orchestrateur : `components/patient/dicom-viewer.tsx` (~528 lignes).
Modules sous `components/patient/dicom-viewer/` (**parité fonctionnelle** avec
le portail clinicien questionnaires — pas de package partagé) :

| Module | Rôle |
|--------|------|
| `dicom-viewer-types.ts` | Types, presets fenêtrage, erreurs codec (FR) |
| `dicom-viewer-app.ts` | App dwv, outils WindowLevel / Zoom / Scroll |
| `dicom-viewer-layout.ts` | Layout canvas (retries) |
| `dicom-viewer-info.tsx` | Bulle d'état utilisateur |
| `dicom-viewer-stack.ts` | Mode **stack** (volume homogène) |
| `dicom-viewer-pool.ts` | Préchargement parallèle (concurrence max **4**) |
| `dicom-viewer-sequential.ts` | Mode **séquentiel** (séries hétérogènes) |

Intégration : `components/patient/documents-section.tsx` (grille + visionneuse
plein écran, lazy-load SSR-off). UI française, états chargement/rendu, messages
explicites transfer syntax non supportée.

**Dev** : workers codec dans `public/dwv-workers/` ; rewrites `next.config.ts` +
chemins publics `proxy.ts` (`/dwv-workers`, `/assets/workers`). Pool précharge
avec `visibility:hidden` (pas `display:none`).

### Pont imagerie Marcel ↔ cockpit chir

```
Marcel upload → patient-documents
              → forward signed → patient-images (questionnaires)
Clinicien     → patient-images + GET patient-documents (complément)
Marcel fiche  → patient-documents + GET patient-images (questionnaire patient)
```

| Direction | Endpoint | Auth |
|-----------|----------|------|
| Tracker → questionnaires (forward) | `POST …/imaging-sign-upload` | `TRACKER_SYNC_SERVICE_TOKEN` |
| Tracker → questionnaires (lecture) | `GET …/patient-images` | idem |
| Tracker → questionnaires (synthèse PDF) | `GET …/patient-synthesis-pdf` | idem |
| Questionnaires → tracker (complément clinicien) | `GET …/patient-documents` | `TRACKER_RETURN_TOKEN` |

Corrélation : `patients.id` = `neuro_patients.external_tracker_id` (questionnaires).

## Variables d'environnement

Créer un fichier `.env.local` à la racine du projet :

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_APP_URL=https://patients.franchir.eu
```

### Pont questionnaires (si activé)

```env
# Sortant tracker → questionnaires
TRACKER_SYNC_SERVICE_TOKEN=          # même valeur côté questionnaires (entrant)
QUESTIONNAIRES_API_BASE=https://questionnaire.franchir.eu/api/integrations/tracker
QUESTIONNAIRES_IMAGING_SIGN_URL=     # optionnel — défaut {API_BASE}/imaging-sign-upload
QUESTIONNAIRES_IMAGING_URL=          # legacy multipart (~4 Mo)
QUESTIONNAIRES_PORTAL_URL=https://questionnaire.franchir.eu

# Entrant questionnaires → tracker (callback + pont imagerie retour)
TRACKER_RETURN_TOKEN=                # même valeur côté questionnaires (sortant)
```

Edge Function `sync-patient-to-questionnaires` : `QUESTIONNAIRES_BRIDGE_URL`,
`TRACKER_SYNC_SERVICE_TOKEN`.

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
│   │   ├── integrations/
│   │   │   └── questionnaires/        # callback session-status, patient-documents
│   │   ├── notify/route.ts
│   │   ├── patients/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── change-status/
│   │   │       ├── commercial-data/
│   │   │       ├── documents/           # liste + signed upload DICOM/docs
│   │   │       ├── messages/
│   │   │       ├── questionnaire-synthesis-pdf/  # proxy synthèse PDF (Gilles)
│   │   │       ├── assign-surgeon/      # assignation chirurgien (Marcel)
│   │   │       ├── questionnaires-imaging/  # lecture imagerie questionnaires
│   │   │       └── update-summary/
│   │   └── vitals/route.ts
│   ├── auth/signout/
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── new/page.tsx                 # création + upload DICOM initial
│   │   └── patient/[id]/page.tsx        # fiche + documents + visionneuse
│   ├── login/page.tsx
│   └── layout.tsx
├── components/
│   ├── patient/
│   │   ├── dicom-viewer.tsx             # orchestrateur visionneuse DICOM
│   │   ├── dicom-viewer/                # modules dwv (stack, pool, sequential…)
│   │   ├── documents-section.tsx        # grille + viewer plein écran
│   │   ├── document-upload.tsx          # upload + import dossier CD
│   │   ├── questionnaire-synthesis-panel.tsx  # synthèse PDF (Gilles P1)
│   │   └── surgeon-assignment-card.tsx  # assignation chir (Marcel)
│   ├── ui/
│   └── workflow-actions.tsx
├── lib/
│   ├── documents/                       # règles patient-documents, upload, guidance
│   ├── imaging/                         # import CD, détection DICOM, séries
│   ├── integrations/                    # forward-imaging, fetch questionnaires, synthèse PDF
│   ├── patient-detail-view-config.ts    # fiche épurée Gilles (P0)
│   ├── email-config.ts
│   ├── email-templates.ts
│   ├── logger.ts
│   ├── notifications.ts
│   ├── permissions.ts
│   ├── validations.ts
│   ├── workflow-v2.ts
│   └── supabase/
│       ├── client.ts
│       └── server.ts
├── proxy.ts                             # auth + workers dwv publics
├── public/dwv-workers/                  # codecs JPEG-LS, J2K, etc.
└── supabase-schema.sql
```

## Utilisateurs et Rôles

| Rôle | Utilisateur | Email |
|------|-------------|-------|
| `marcel` | Marcel Mazaltarim | marcel.mazaltarim@gmail.com |
| `gilles` | Dr Gilles Dubois | duboisgilles31@gmail.com |
| `admin` / `franchir` | Erik Boulard | erik.boulard@franchir.eu |

**Gilles (P0)** : fiche patient épurée via `getPatientDetailViewConfig('gilles')`
— masque SharePoint, assignation chir, upload docs, onglet commercial ;
conserve workflow médical + **synthèse PDF questionnaire (P1)**. Gilles
**n'utilise pas** le portail clinicien questionnaires.

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

**DICOM en production** : vérifier que `/dwv-workers/*` reste accessible sans
session (`proxy.ts` — requis pour décoder JPEG Lossless / JPEG-LS).

## Développement

```bash
npm run dev      # Serveur de développement
npm run build    # Build de production
npm run lint     # Linting ESLint
```
