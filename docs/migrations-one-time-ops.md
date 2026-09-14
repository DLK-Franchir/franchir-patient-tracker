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
