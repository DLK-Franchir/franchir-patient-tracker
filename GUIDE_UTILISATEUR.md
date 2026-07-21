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
    *   **Passer en mode refusé** un dossier (retrait du circuit — reste visible sous l’onglet Refusé).
    *   **Réouvrir** un dossier refusé ou fermé pour le remettre en circuit.
    *   Saisir les données commerciales (Montant du devis, Date proposée).
    *   Marquer le devis et la date comme "Confirmés" une fois validés par le patient.

### 2. Dr Gilles Dubois (Validation Médicale)
Vous garantissez la faisabilité médicale.
*   **Votre rôle :** Consulter les dossiers en attente et donner votre avis expert.
*   **Ce que vous ne voyez pas :** les brouillons Marcel, les prospects et les dossiers fermés — uniquement le périmètre médical et le suivi post-validation.
*   **À l'ouverture du tableau de bord :** vue **« Tous les dossiers »** (ensemble de votre périmètre, ~15 dossiers) ; un **bandeau bleu** indique clairement combien de revues médicales vous attendent (ex. *« Dr Gilles, vous avez 3 revues médicales à traiter »*).
*   **Vos actions principales :**
    *   Cliquer **« Voir les X dossiers à valider »** (bandeau) ou la puce **Revue méd.** pour n'afficher que les dossiers en attente de décision.
    *   **Valider** le dossier (et recommander un chirurgien).
    *   **Refuser** le dossier (avec justification).
    *   Demander des compléments d'informations (si le dossier est incomplet).
    *   Revenir à **« Tous les dossiers »** à tout moment via la puce dédiée (première puce du filtre).
    *   Après validation : le dossier passe en suivi commercial (Marcel / Franchir pilotent devis et dates).

### 3. Erik Boulard (Administration)
Vous supervisez l'ensemble de l'activité.
*   **Votre rôle :** Administrateur global et supervision.
*   **Vos actions principales :**
    *   Accès en lecture/écriture sur tous les dossiers.
    *   **Réouvrir** un dossier clôturé ou refusé (également possible pour Marcel / Franchir).
    *   En revue médicale : valider, refuser ou demander un complément (comme Gilles).
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

---

## 📊 Cockpit tableau de bord (interface V3)

Le tableau de suivi (`https://patients.franchir.eu/dashboard`) propose une **vue cockpit** pour prioriser votre travail.

### Synthèse KPI (grille en haut de page)

La section **« Synthèse des dossiers »** affiche votre nom connecté (ex. *Synthèse des dossiers · Marcel Mazaltarim*) puis une **grille de cartes KPI** cliquables :

| KPI | Marcel / Erik | Dr Gilles |
| :--- | :--- | :--- |
| Dossiers actifs | ✅ Total en cours | ❌ masqué |
| Revue médicale | ✅ Att. Dr. Gilles | ✅ Action requise de votre part |
| À confirmer (devis/date) | ✅ | ❌ masqué |
| Suivi commercial | — | ✅ Chirurgien et date proposée |
| Programmés | ✅ | ✅ |
| À compléter | ✅ | ✅ |

Cliquer une carte filtre la liste ; un second clic ou **« Tous les dossiers »** (Gilles) réinitialise le filtre.

### Filtres et navigation

*   **Dr Gilles — parcours recommandé :**
    1. Arrivée sur **Tous les dossiers** (puce active, compteur total).
    2. Bandeau : *« Dr Gilles, vous avez N revue(s) médicale(s) à traiter »* → bouton **Voir les N dossiers à valider**.
    3. Puce **Revue méd.** → liste filtrée (uniquement dossiers `medical_review`, bouton **Valider**).
    4. Puce **Tous les dossiers** → retour à la vue complète.
*   **Mes actions** (Marcel / Erik) : filtre les dossiers où **votre rôle** doit agir maintenant (soumission médicale, complément, confirmation devis/date…). Pour Gilles, le bandeau + puce Revue méd. remplacent ce parcours.
*   **Puces pipeline** : filtrent par étape globale (Brouillon, Revue médicale, Commercial, Programmé, etc.). Le compteur de chaque puce correspond au nombre de dossiers à cette étape.
*   **Bandeau priorité** : résume le total de dossiers actifs et ventile vos actions en attente (ex. « 3 à soumettre · 2 devis à confirmer »).
*   **Infobulles** : survolez les libellés tronqués (statut, action en attente) pour lire le texte complet.
*   **Onglet Devis** : après une action commerciale (budget, dates proposées, confirmation devis/date), la fiche patient se rafraîchit automatiquement — vérifiez l'onglet Devis pour les montants et dates à jour.
*   **Cloche notifications** : alertes secondaires ; le cockpit « Mes actions » reste la source principale pour savoir quoi traiter.

### Vue limitée Dr Gilles (tableau de bord)

Gilles ne voit **pas** les dossiers en **brouillon** (création Marcel), **prospect** ni **fermés**. Seuls apparaissent dans **Tous les dossiers** :

*   Revue médicale (à valider / refuser / demander complément)
*   À compléter (complément demandé — en attente de Marcel, pas une action Gilles)
*   Suivi commercial (post-validation : chirurgien et date proposée)
*   Programmés et refusés (historique médical)

Les onglets pipeline « Actifs », « Tous » et le KPI « À confirmer » sont **inaccessibles** pour ce rôle.

**Paramètres URL (technique / support)** : `?all=1` = tous les dossiers ; `?tab=revue` ou `?kpi=revue` = revue médicale seule ; `?focus=mine` = vos actions en cours (équivalent revues en attente).

### Fiche patient — retour et fil d'Ariane

*   **Fil d'Ariane** (barre navy) : `FRANCHIR > Tableau de suivi > [Nom patient]` — lien cliquable vers le dashboard.
*   **Bandeau retour** sous le header : lien **« Retour au tableau de suivi »** (visible aussi sur mobile).
*   **Vue Gilles (fiche épurée)** : pas d'upload documents, pas d'onglet Devis/commercial, pas de gestion questionnaire ; accès à la **synthèse questionnaire** (cartes Anamneze + PDF) et aux actions médicales (valider, refuser, demander complément, proposer budget/dates).

### Cloche notifications (historique secondaire)

*   **Badge rouge** : nombre réel de notifications non lues (pas plafonné à 10).
*   **Cliquer une notification** : la marque comme lue et ouvre le dossier patient si disponible.
*   **« Tout marquer lu »** : efface toutes les notifications non lues d'un coup.
*   **Messages internes** : n'apparaissent plus dans la cloche (déjà visibles via « Mes actions ») ; les changements de statut et actions commerciales restent notifiés.
*   **Anciennes alertes** : les notifications de plus de 30 jours sont automatiquement marquées lues à l'ouverture.
