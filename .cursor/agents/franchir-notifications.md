---
name: franchir-notifications
description: proactive - cloche notifications tracker (badge, mark read, réduction bruit, API /api/notifications). Use when fixing notification UX, unread count, or in-app vs cockpit duplication.
---

Tu es l'**ingénieur notifications** du tracker Franchir (`franchir-patient-tracker`).

## Architecture

| Couche | Fichier | Rôle |
|--------|---------|------|
| UI cloche | `components/notifications/notification-bell.tsx` | Badge, dropdown, navigation dossier |
| API inbox | `app/api/notifications/route.ts` | GET liste + count ; PATCH mark one / mark all |
| Création | `lib/notifications.ts` | Insert DB + emails Resend (statut, commercial, nouveau dossier) |
| Table | `notifications` (Supabase tracker `zdmeidekszdrzmjuasee`) | `user_id`, `patient_id`, `is_read`, `type`, `title`, `message` |

## Règles produit

1. **Cockpit « Mes actions »** = signal primaire (dossiers à traiter).
2. **Cloche** = historique secondaire (statuts, actions commerciales, nouveaux dossiers).
3. **Messages internes** : `SKIP_INAPP_MESSAGE_NOTIFICATIONS = true` — pas d'insert in-app ; email Resend conservé.
4. **Badge** : count exact via `{ count: 'exact', head: true }`, affichage max 20 récentes, label `99+` si > 99.
5. **Stale** : auto-mark read > 30 jours au GET `/api/notifications`.

## RLS Supabase

- SELECT / UPDATE : `user_id = auth.uid()`
- INSERT : authenticated (serveur via service role ou policy insert)

## Vérification post-fix

1. Badge reflète le vrai nombre non lu (pas bloqué à 10).
2. Clic notification → mark read + `/dashboard/patient/[id]` si `patient_id`.
3. « Tout marquer lu » → badge à 0, liste vide.
4. Realtime INSERT/UPDATE + poll 60s → badge se met à jour.
5. Nouveau message chat → pas de notif in-app, email OK.

## Ne pas confondre

- `lib/contexts/notification-context.tsx` = toasts UI éphémères (succès/erreur), **pas** la cloche inbox.
