# Opérations données ponctuelles (hors migrations)

Certaines corrections prod ne doivent **pas** être rejouées automatiquement via `supabase db push` ou les migrations versionnées.

## Dossier fermé + nettoyage prod (2026-07-12)

| Fichier | Rôle |
|---------|------|
| `supabase/migrations/20260712170000_case_closed_status_and_cleanup.sql` | Schéma uniquement : INSERT statut `case_closed` |
| `supabase/scripts/one-time-prod-ops-case-closed.sql` | Données prod : archivage Linda G Maslechko, suppression dossiers test |

**Staging / preview** : appliquer uniquement la migration schema-only.

**Prod** : appliquer la migration, puis exécuter le script manuellement dans le SQL Editor Supabase si les opérations n'ont pas déjà été faites.

## Réaffectation chirurgien Brauge → Teyssedou (2026-07-29)

| Fichier | Rôle |
|---------|------|
| `supabase/scripts/one-time-prod-ops-reassign-teyssedou-53d4951e.sql` | Données prod : patient `53d4951e-…` → Simon Teyssedou + audit `patient_messages` |

**Prod** : exécuter le script une fois dans le SQL Editor Supabase tracker (`zdmeidekszdrzmjuasee`). Idempotent.

## Scripts legacy archivés (2026-09-14)

Les scripts SQL ponctuels du bootstrap (diagnostics, fixes RLS/enum, tests de notifications, création de comptes, `reset_database.sql`) ont été déplacés de la racine et de `scripts/` vers `supabase/legacy/`. Ils sont conservés pour référence uniquement et ne doivent **pas** être rejoués : plusieurs sont destructeurs (suppression de toutes les policies RLS, TRUNCATE de tables métier).

Classification et équivalents actuels : [`supabase/legacy/README.md`](../supabase/legacy/README.md).

Règle : une opération données ponctuelle vit dans `supabase/scripts/` et est consignée ici ; une évolution de schéma vit dans `supabase/migrations/`.

## Verrou « staff actif » RLS (2026-09-14) — appliqué en prod

**Fichier** : `supabase/migrations/20260914140000_staff_gate_rls.sql` (idempotent, rejouable).

**Ce qui a changé en base** :
- Colonne `profiles.is_active` (défaut `false`), posée à `true` pour les 6 e-mails de `ACTIVE_STAFF_EMAILS` (`lib/access-control.ts`). Les 2 profils hors whitelist (compte de test, compte externe, jamais reconnectés depuis leur création) sont restés `false`.
- `is_active_staff()` exige désormais `is_active` en plus du rôle staff.
- Toutes les policies `USING (true)` de `patients`, `patient_messages`, `profiles`, `workflow_statuses`, `surgeons`, `medical_decisions`, `quotes`, `calendar_events`, `audit_logs` et l'INSERT de `notifications` sont passées à `is_active_staff()`. La policy « filtre topic Gilles » (inopérante) est supprimée : **tout le staff actif lit tous les messages**, quel que soit le topic.
- Fonctions `SECURITY DEFINER` (`handle_new_user`, `notify_gilles_on_new_patient`, `rls_auto_enable`) plus exécutables via RPC par `anon`/`authenticated`.

**Effet utilisateur** : aucun pour le staff actif (vérifié par simulation JWT : 33 dossiers, 272 messages visibles pour Marcel et Gilles) ; un compte non activé ne voit plus que son propre profil ; `anon` ne voit rien.

**Procédure nouveau compte** : créer l'utilisateur Auth, puis poser `is_active = true` sur son profil via service-role (les scripts `scripts/create-*-account.mjs` le font) **et** ajouter l'e-mail à `ACTIVE_STAFF_EMAILS`. Désactiver un compte = `UPDATE profiles SET is_active = false` (service-role), effet immédiat sur PostgREST et Realtime.

**Non couvert (volontaire)** : le cloisonnement par rôle (périmètre Gilles, droits de création) reste appliqué côté API uniquement.
