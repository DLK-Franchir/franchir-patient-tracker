# Scripts SQL legacy — archive historique

> **Archive historique — ne PAS exécuter en prod ; référence uniquement.**
> **Les scripts marqués DESTRUCTEUR suppriment des policies/données.**
>
> Ces fichiers datent du bootstrap du tracker (création des comptes, diagnostics de notifications, corrections ponctuelles). Ils ont été déplacés ici depuis la racine du repo et `scripts/` (septembre 2026) sans modification de contenu, hormis un bandeau d'avertissement en tête des scripts DESTRUCTEUR. Ils ne sont référencés par aucun script npm, ni par la CI, ni par `vercel.json`.
>
> Plusieurs scripts contiennent des identifiants en dur (adresses e-mail staff, UUID de profils, mots de passe temporaires dans des messages de test) : ne pas les copier-coller dans un nouvel outillage.

## Où vit désormais la vérité

| Besoin | Emplacement actuel |
|---|---|
| Schéma initial / seeds | `supabase-schema.sql` (racine), `supabase-rls-policies.sql` |
| Évolutions versionnées | `supabase/migrations/` |
| Opérations données ponctuelles documentées | `supabase/scripts/` + `docs/migrations-one-time-ops.md` |
| Comptes staff | `scripts/create-*-account.mjs`, `scripts/fix-marcel-profile.mjs`, `scripts/reset-*-password.mjs` |
| Diagnostic prod | SQL Editor Supabase (requêtes ad hoc, sans identifiants en dur dans le repo) |

## Catégories

- `diagnostic` : SELECT uniquement, sans effet de bord.
- `fix-idempotent` : modifie le schéma/les policies ; rejouable en théorie mais **inutile** (état déjà en prod) et parfois régressif.
- `one-off-données` : écrit des données (profils, notifications de test) ; rejouer créerait du bruit ou réécrirait des identités.
- `DESTRUCTEUR` : supprime des policies ou des données.
- `obsolète-remplacé-par-migration` : couvert par `supabase-schema.sql` ou une migration versionnée.

## Inventaire

### Racine du repo → `supabase/legacy/`

| Fichier | Catégorie | Ce qu'il fait | Risque si rejoué | Remplacé par |
|---|---|---|---|---|
| `supabase-check-profiles.sql` | diagnostic | Liste les profils et cherche un profil par e-mail (identifiant en dur) | Aucun | Requête ad hoc |
| `supabase-create-profiles.sql` | one-off-données | Upsert de deux profils staff par UUID en dur, passage d'un troisième en `admin`, puis `CREATE OR REPLACE` de `handle_new_user` (rôle par défaut `marcel`) + trigger `on_auth_user_created` | **Élevé** : réécrit des rôles/e-mails de profils et écrase la fonction `handle_new_user` en prod | `scripts/create-*-account.mjs` ; `handle_new_user` vit en prod (non versionné dans le repo — à consigner dans une migration si modifié) |
| `supabase-diagnostic-notifications.sql` | diagnostic | Profils, 20 dernières notifications, policies `notifications`, comptage par utilisateur (un INSERT de test est commenté) | Aucun tant que l'INSERT reste commenté | Requête ad hoc |
| `supabase-find-marcel.sql` | diagnostic | Cherche un compte coordinateur dans `auth.users` et `profiles` (e-mail en dur) | Aucun | Requête ad hoc |
| `supabase-fix-gilles-final.sql` | one-off-données | Réécrit l'e-mail d'un profil par UUID en dur, insère deux notifications de test (dont une contenant un mot de passe temporaire) | Réécriture d'identité + notifications parasites | Dashboard Supabase Auth ; `scripts/reset-gilles-password.mjs` |
| `supabase-fix-profiles-and-notifications.sql` | one-off-données | Force le rôle `admin` sur un profil par e-mail, insère une notification de test | Changement de rôle + notification parasite | `scripts/create-*-account.mjs` |
| `supabase-fix-realtime.sql` | one-off-données | `ALTER PUBLICATION supabase_realtime ADD TABLE notifications` + notification de test pour le rôle `gilles` | Échoue si la table est déjà publiée ; notification parasite | Realtime déjà actif en prod (Dashboard > Database > Replication) |
| `supabase-fix-rls-performance.sql` | fix-idempotent | Remplace les policies par rôle par des policies `TO authenticated USING (true)` (+ `(SELECT auth.uid())` sur `notifications`) | Régressif : écrase toute policy plus restrictive posée depuis | État prod actuel (audit §8 #3) ; durcissement futur → migration dédiée |
| `supabase-fix-user-creation.sql` | fix-idempotent | Policies `profiles` : SELECT `true`, INSERT `false`, UPDATE/DELETE restreints au propriétaire | Modifie les policies `profiles` ; peut casser l'outillage service-role si mal appliqué | `supabase-rls-policies.sql` ; migration dédiée si besoin |
| `supabase-reset-gilles-password.sql` | one-off-données | Listings, puis `UPDATE profiles SET email = … WHERE role = 'gilles'` (e-mail en dur) et notification de test | **Élevé** : écrase l'e-mail de tous les profils `gilles` | `scripts/reset-gilles-password.mjs` ; Dashboard Auth « Send password recovery » |
| `supabase-test-notification-admin.sql` | one-off-données | Insère une notification de test pour un profil par e-mail | Notification parasite | Tests Realtime via l'app |
| `supabase-test-notification-now.sql` | one-off-données | Idem, variante | Notification parasite | Tests Realtime via l'app |

### `scripts/` → `supabase/legacy/`

| Fichier | Catégorie | Ce qu'il fait | Risque si rejoué | Remplacé par |
|---|---|---|---|---|
| `supabase-check-enum-only.sql` | diagnostic | Labels de l'enum `user_role` | Aucun | — |
| `supabase-check-handle-new-user.sql` | diagnostic | Source de la fonction `handle_new_user` | Aucun | — |
| `supabase-check-invalid-roles.sql` | diagnostic | Profils dont le rôle n'est pas dans la liste attendue (UPDATE correctif commenté) | Aucun tant que l'UPDATE reste commenté | — |
| `supabase-check-marcel-complete.sql` | diagnostic | Jointure `auth.users` × `profiles` pour un e-mail placeholder | Aucun | — |
| `supabase-check-marcel-exists.sql` | diagnostic | Existence d'un compte par e-mail placeholder | Aucun | — |
| `supabase-check-marcel-notifications.sql` | diagnostic | 10 dernières notifications d'un utilisateur (UUID en dur) | Aucun | — |
| `supabase-check-marcel-role.sql` | diagnostic | Rôle d'un profil + profils à rôle invalide | Aucun | — |
| `supabase-check-notifications-policies.sql` | diagnostic | `pg_policies` sur `notifications` | Aucun | — |
| `supabase-check-patients-policies.sql` | diagnostic | `pg_policies` sur `patients` | Aucun | — |
| `supabase-check-patients-triggers.sql` | diagnostic | Triggers et fonctions associées sur `patients` | Aucun | — |
| `supabase-check-quotes-policies.sql` | diagnostic | `pg_policies` sur `quotes` | Aucun | — |
| `supabase-check-real-marcel.sql` | diagnostic | Profil d'un compte par e-mail réel (identifiant en dur) | Aucun | — |
| `supabase-check-statuses.sql` | diagnostic | Contenu de `workflow_statuses` | Aucun | — |
| `supabase-check-triggers.sql` | diagnostic | Triggers sur `auth.users` et `profiles` | Aucun | — |
| `supabase-create-marcel-profile.sql` | one-off-données | Upsert d'un profil `marcel` pour un e-mail placeholder | Sans effet (e-mail placeholder) ou réécriture de rôle si l'e-mail existait | `scripts/create-marcel-account.mjs`, `scripts/fix-marcel-profile.mjs` |
| `supabase-create-messages-table.sql` | obsolète-remplacé-par-migration | Crée `patient_messages` (sans colonne `topic`), index, RLS, publication Realtime | `CREATE POLICY` / `ALTER PUBLICATION` non idempotents → erreurs ; schéma en retard sur la prod | Table présente dans la baseline prod ; colonne `topic` + CHECK versionnés dans `supabase/migrations/20260914120000_patient_messages_topic_and_kind_checks.sql` |
| `supabase-delete-marcel.sql` | **DESTRUCTEUR** | `DELETE FROM auth.users` pour un e-mail placeholder, puis instructions Dashboard | Suppression d'un compte et de ses dépendances par cascade | Dashboard Supabase Auth ; jamais en SQL direct |
| `supabase-find-marcel-anywhere.sql` | diagnostic | Recherche `LIKE '%marcel%'` dans `profiles` et `auth.users` | Aucun | — |
| `supabase-find-marcel-dependencies.sql` | diagnostic | Recherche des lignes liées à un profil dans 8 tables | Aucun | — |
| `supabase-fix-doctor-trigger.sql` | fix-idempotent | Remplace `notify_doctor_on_new_patient` par `notify_gilles_on_new_patient` (notification des profils `gilles` à la création d'un patient) | Faible : recrée l'état prod actuel ; `DROP FUNCTION … CASCADE` supprimerait d'éventuels dépendants | État prod actuel (audit §8 #8) ; toute évolution → migration |
| `supabase-fix-notifications-insert-policy.sql` | fix-idempotent | Ajoute la policy INSERT `authenticated` sur `notifications` | Échoue si la policy existe déjà (pas de `IF NOT EXISTS`) | `supabase-rls-policies.sql` |
| `supabase-fix-user-role-enum.sql` | **DESTRUCTEUR** | Supprime **toutes** les policies du schéma `public`, désactive la RLS sur 10 tables, recrée l'enum `user_role` (`DROP TYPE … CASCADE`), réactive la RLS et recrée des policies simplifiées | Perte de toutes les policies posées depuis, fenêtre sans RLS, cassure des objets dépendant de l'enum | Enum déjà migré en prod ; toute évolution → migration |
| `supabase-force-marcel-token-refresh.sql` | one-off-données | `UPDATE profiles SET updated_at = NOW()` pour un e-mail placeholder | Négligeable | — |
| `supabase-full-diagnostic.sql` | diagnostic | Enum, `handle_new_user`, compte coordinateur, policies `profiles` | Aucun | — |
| `supabase-simplify-statuses.sql` | **DESTRUCTEUR** | `TRUNCATE workflow_statuses CASCADE` puis réinsertion de 10 statuts (sans `case_closed`) | **Critique** : le CASCADE vide les tables référençant les statuts, dont `patients` ; seed obsolète | Seed aligné dans `supabase-schema.sql` ; `case_closed` via `supabase/migrations/20260712170000_case_closed_status_and_cleanup.sql` |
| `supabase-verify-marcel-profile.sql` | one-off-données | Vérifie puis crée un profil `marcel` pour un e-mail placeholder s'il manque | Sans effet (e-mail placeholder) | `scripts/fix-marcel-profile.mjs` |

### `supabase/` → `supabase/legacy/`

| Fichier | Catégorie | Ce qu'il fait | Risque si rejoué | Remplacé par |
|---|---|---|---|---|
| `reset_database.sql` | **DESTRUCTEUR** | `TRUNCATE … CASCADE` de `patients`, `patient_messages`, `medical_decisions`, `quotes`, `calendar_events`, `audit_logs` | **Critique** : perte totale des données métier prod | Aucun équivalent ; réservé à un environnement local jetable |
| `setup_erik_admin.sql` | one-off-données | Upsert d'un profil `admin` à partir d'un e-mail staff en dur | Réécrit `full_name`/`role` du profil visé | `scripts/create-*-account.mjs` ; pattern `supabase/migrations/20260714193000_add_philippe_mazaltarim_staff.sql` |

## Règles

1. Ne rien exécuter d'ici en prod. Pour un diagnostic, réécrire la requête à la main dans le SQL Editor.
2. Toute évolution de schéma ou de policy passe par `supabase/migrations/`.
3. Toute opération données ponctuelle passe par `supabase/scripts/` et est consignée dans `docs/migrations-one-time-ops.md`.
4. Ne pas ajouter de nouveaux fichiers dans ce dossier.
