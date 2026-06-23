# 🏥 Guide d'Utilisation - Franchir Patient Tracker

Bienvenue sur l'application de suivi des patients Franchir. Cet outil centralise tout le parcours de soin, du premier contact jusqu'à l'intervention, en remplaçant les échanges d'emails et fichiers dispersés par un flux de travail unique et partagé.

## 🎯 Fonctionnalités Clés
- **Vision globale** : Suivi en temps réel de l'état de chaque dossier (prospect, étude médicale, devis, programmé).
- **Workflow guidé** : Des boutons d'action clairs indiquent la prochaine étape nécessaire.
- **Notifications** : Soyez alerté dès qu'un dossier requiert votre attention.

---

## 👥 Usage par Rôle

### 1. Marcel (Coordinateur)
Vous êtes le chef d'orchestre du dossier.
*   **Votre rôle :** Créer les dossiers, rassembler les pièces, saisir les dates et budgets.
*   **Vos actions principales :**
    *   Créer un nouveau patient.
    *   Soumettre le dossier à validation médicale (au Dr Gilles).
    *   Saisir les données commerciales (Montant du devis, Date proposée).
    *   Marquer le devis et la date comme "Confirmés" une fois validés par le patient.

### 2. Dr Gilles Dubois (Validation Médicale)
Vous garantissez la faisabilité médicale.
*   **Votre rôle :** Consulter les dossiers en attente et donner votre avis expert.
*   **Vos actions principales :**
    *   Recevoir une notification pour une "Revue médicale".
    *   **Valider** le dossier (et recommander un chirurgien).
    *   **Refuser** le dossier (avec justification).
    *   Demander des compléments d'informations (si le dossier est incomplet).

### 3. Erik Boulard (Administration)
Vous supervisez l'ensemble de l'activité.
*   **Votre rôle :** Administrateur global et supervision.
*   **Vos actions principales :**
    *   Accès en lecture/écriture sur tous les dossiers.
    *   Possibilité de **réouvrir** un dossier clôturé ou refusé.
    *   Gestion des utilisateurs et vue d'ensemble de l'activité.

---

## 🔐 Vos Accès

| Utilisateur | Rôle | Email de connexion |
| :--- | :--- | :--- |
| **Marcel** | Coordinateur | `marcel.mazaltarim@gmail.com` |
| **Gilles** | Médecin | `duboisgilles31@gmail.com` |
| **Erik** | Admin | `erik.boulard@franchir.eu` |

> **Mot de passe** : utilisez le mot de passe personnel de votre compte Supabase Auth.
> Les anciens identifiants `@franchir.eu` (`Marcel123`, etc.) ne sont **plus valides** — ces comptes n'existent pas dans la base.

### Connexion en local (`http://localhost:3001`)

1. Vérifiez que `.env.local` pointe bien vers le projet tracker (`zdmeidekszdrzmjuasee`).
2. Sur `/login`, saisissez votre **email réel** (colonne ci-dessus) et votre mot de passe.
3. Si vous ne connaissez pas le mot de passe : **Supabase Dashboard** → projet tracker → **Authentication** → **Users** → sélectionner l'utilisateur → **Send password recovery** ou **Reset password**.
4. Tous les comptes staff existants ont l'email déjà confirmé ; aucune validation par lien n'est requise avant la connexion.
