# Configuration Supabase RLS - Application Franchir Patient Tracker

## Vue d'ensemble de l'architecture

L'application **Franchir Patient Tracker** est un système de gestion de patients médicaux avec un workflow spécifique basé sur des rôles distincts. Voici la structure complète pour configurer Supabase correctement.

---

## 1. TABLES ET LEUR FONCTION

### `profiles` - Gestion des utilisateurs
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Clé primaire, référence `auth.users(id)` |
| `role` | TEXT | Rôle de l'utilisateur (`marcel`, `franchir`, `gilles`, `admin`) |
| `full_name` | TEXT | Nom complet |
| `created_at` | TIMESTAMPTZ | Date de création |

**Rôles définis :**
- `marcel` : Secrétaire/Assistant - Crée les dossiers patients, gère les devis et le calendrier
- `franchir` : Gestionnaire principal - Mêmes droits que marcel
- `gilles` : Médecin/Docteur - Prend les décisions médicales, reçoit les notifications de nouveaux patients
- `admin` : Administrateur - Tous les droits

### `patients` - Dossiers patients
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Clé primaire |
| `patient_name` | TEXT | Nom du patient |
| `status` | TEXT | Statut du workflow |
| `created_at` | TIMESTAMPTZ | Date de création |
| ... | ... | Autres champs métier |

**Ownership :** Pas de colonne `user_id` - les patients sont partagés entre tous les utilisateurs authentifiés.

### `medical_decisions` - Décisions médicales
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Clé primaire |
| `patient_id` | UUID | Référence au patient |
| `decision` | TEXT | Décision prise |
| `created_at` | TIMESTAMPTZ | Date de création |

**Ownership :** Pas de colonne `user_id` - seul le rôle `gilles` peut créer des décisions.

### `quotes` - Devis
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Clé primaire |
| `patient_id` | UUID | Référence au patient |
| `amount` | NUMERIC | Montant |
| `status` | TEXT | Statut du devis |

### `calendar_events` - Événements calendrier
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Clé primaire |
| `patient_id` | UUID | Référence au patient (optionnel) |
| `title` | TEXT | Titre de l'événement |
| `start_date` | TIMESTAMPTZ | Date de début |
| `end_date` | TIMESTAMPTZ | Date de fin |

### `notifications` - Notifications utilisateurs
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Clé primaire |
| `user_id` | UUID | **Propriétaire** - Référence `auth.users(id)` |
| `patient_id` | UUID | Référence au patient (optionnel) |
| `title` | TEXT | Titre |
| `message` | TEXT | Message |
| `type` | TEXT | Type (`info`, `warning`, `success`) |
| `is_read` | BOOLEAN | Lu ou non |

**Ownership :** Colonne `user_id` = chaque utilisateur ne voit que SES notifications.

### `workflow_statuses` - Statuts de workflow (lecture seule)
### `surgeons` - Liste des chirurgiens (lecture seule)
### `audit_logs` - Logs d'audit (lecture seule)

---

## 2. MATRICE DES PERMISSIONS PAR RÔLE

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| **profiles** | Tous auth | - | Soi-même | - |
| **patients** | Tous auth | marcel, franchir, admin | marcel, franchir, admin | - |
| **medical_decisions** | Tous auth | gilles uniquement | gilles uniquement | - |
| **quotes** | Tous auth | marcel, franchir, admin | marcel, franchir, admin | - |
| **calendar_events** | Tous auth | marcel, franchir, admin | marcel, franchir, admin | - |
| **notifications** | Propriétaire (user_id) | Tous auth (via trigger) | Propriétaire | - |
| **workflow_statuses** | Tous auth | - | - | - |
| **surgeons** | Tous auth | - | - | - |
| **audit_logs** | Tous auth | - | - | - |

---

## 3. POLICIES RLS RECOMMANDÉES

### Option A : Policies avec vérification de rôle (SÉCURISÉ)

```sql
-- =====================================================
-- PROFILES
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
CREATE POLICY "Authenticated users can view all profiles" ON profiles 
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- PATIENTS - Contrôle par rôle
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all patients" ON patients;
DROP POLICY IF EXISTS "Marcel Franchir Admin can insert patients" ON patients;
DROP POLICY IF EXISTS "Marcel Franchir Admin can update patients" ON patients;

CREATE POLICY "Authenticated users can view all patients" ON patients 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Marcel Franchir Admin can insert patients" ON patients 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('marcel', 'franchir', 'admin')
    )
  );

CREATE POLICY "Marcel Franchir Admin can update patients" ON patients 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('marcel', 'franchir', 'admin')
    )
  );

-- =====================================================
-- MEDICAL_DECISIONS - Seul Gilles peut créer
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all decisions" ON medical_decisions;
DROP POLICY IF EXISTS "Gilles can insert medical decisions" ON medical_decisions;
DROP POLICY IF EXISTS "Gilles can update medical decisions" ON medical_decisions;

CREATE POLICY "Authenticated users can view all decisions" ON medical_decisions 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gilles can insert medical decisions" ON medical_decisions 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'gilles'
    )
  );

CREATE POLICY "Gilles can update medical decisions" ON medical_decisions 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'gilles'
    )
  );

-- =====================================================
-- QUOTES - Contrôle par rôle
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Marcel Franchir Admin can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Marcel Franchir Admin can update quotes" ON quotes;

CREATE POLICY "Authenticated users can view all quotes" ON quotes 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Marcel Franchir Admin can insert quotes" ON quotes 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('marcel', 'franchir', 'admin')
    )
  );

CREATE POLICY "Marcel Franchir Admin can update quotes" ON quotes 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('marcel', 'franchir', 'admin')
    )
  );

-- =====================================================
-- CALENDAR_EVENTS - Contrôle par rôle
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all events" ON calendar_events;
DROP POLICY IF EXISTS "Marcel Franchir Admin can insert events" ON calendar_events;
DROP POLICY IF EXISTS "Marcel Franchir Admin can update events" ON calendar_events;

CREATE POLICY "Authenticated users can view all events" ON calendar_events 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Marcel Franchir Admin can insert events" ON calendar_events 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('marcel', 'franchir', 'admin')
    )
  );

CREATE POLICY "Marcel Franchir Admin can update events" ON calendar_events 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('marcel', 'franchir', 'admin')
    )
  );

-- =====================================================
-- NOTIFICATIONS - Ownership par user_id
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can view their own notifications" ON notifications 
  FOR SELECT TO authenticated 
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications 
  FOR UPDATE TO authenticated 
  USING ((SELECT auth.uid()) = user_id);

-- Permet aux triggers SECURITY DEFINER de créer des notifications
CREATE POLICY "System can insert notifications" ON notifications 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- =====================================================
-- TABLES EN LECTURE SEULE
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view all statuses" ON workflow_statuses;
CREATE POLICY "Authenticated users can view all statuses" ON workflow_statuses 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view all surgeons" ON surgeons;
CREATE POLICY "Authenticated users can view all surgeons" ON surgeons 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view all logs" ON audit_logs;
CREATE POLICY "Authenticated users can view all logs" ON audit_logs 
  FOR SELECT TO authenticated USING (true);
```

### Option B : Policies permissives (SIMPLE mais moins sécurisé)

Si vous voulez simplifier et gérer les permissions côté application :

```sql
-- Toutes les tables : lecture/écriture pour tous les authentifiés
CREATE POLICY "Full access for authenticated" ON [table_name]
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 4. FONCTIONS SECURITY DEFINER

Ces fonctions s'exécutent avec les privilèges du propriétaire (bypass RLS) :

```sql
-- Fonction pour créer des notifications (utilisée par les triggers)
CREATE OR REPLACE FUNCTION notify_doctor_on_new_patient()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, patient_id, title, message, type)
  SELECT
    profiles.id,
    NEW.id,
    'Nouveau patient à examiner',
    'Un nouveau dossier patient (' || NEW.patient_name || ') a été créé et attend votre revue médicale.',
    'info'
  FROM public.profiles
  WHERE profiles.role = 'gilles';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Trigger associé
DROP TRIGGER IF EXISTS trigger_notify_doctor_on_new_patient ON public.patients;
CREATE TRIGGER trigger_notify_doctor_on_new_patient
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION notify_doctor_on_new_patient();
```

---

## 5. WORKFLOWS ET CAS D'USAGE

### Workflow 1 : Création d'un patient
1. **Marcel/Franchir** se connecte
2. Crée un nouveau patient → Policy `Marcel Franchir Admin can insert patients` autorise
3. Trigger `notify_doctor_on_new_patient` s'exécute (SECURITY DEFINER)
4. Notification créée pour **Gilles**

### Workflow 2 : Décision médicale
1. **Gilles** reçoit notification, se connecte
2. Consulte le patient → Policy SELECT autorise (tous auth)
3. Crée une décision médicale → Policy `Gilles can insert medical decisions` autorise
4. Marcel/Franchir peuvent voir la décision mais pas la modifier

### Workflow 3 : Admin crée pour un autre utilisateur
Si un admin doit créer des enregistrements pour un autre compte :

```sql
-- Option 1 : Ajouter 'admin' aux policies (déjà fait)
-- Option 2 : Fonction SECURITY DEFINER pour actions admin
CREATE OR REPLACE FUNCTION admin_create_patient(
  p_patient_name TEXT,
  p_status TEXT DEFAULT 'nouveau'
)
RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  -- Vérifier que l'appelant est admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé : rôle admin requis';
  END IF;
  
  INSERT INTO patients (patient_name, status)
  VALUES (p_patient_name, p_status)
  RETURNING id INTO v_patient_id;
  
  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```

---

## 6. OPTIMISATIONS DE PERFORMANCE

### Utiliser `(SELECT auth.uid())` au lieu de `auth.uid()`

```sql
-- MAUVAIS (réévalué à chaque ligne)
USING (auth.uid() = user_id)

-- BON (évalué une seule fois)
USING ((SELECT auth.uid()) = user_id)
```

### Index recommandés

```sql
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
```

---

## 7. FONCTION DE TEST (DÉVELOPPEMENT UNIQUEMENT)

```sql
-- Pour tester les policies avec différents utilisateurs
CREATE OR REPLACE FUNCTION test_set_auth_uid(uid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('search_path', 'public', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ATTENTION : Supprimer en production !
```

---

## 8. CHECKLIST DE CONFIGURATION

- [ ] Activer RLS sur toutes les tables : `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;`
- [ ] Créer les policies selon la matrice des permissions
- [ ] Créer les index de performance
- [ ] Créer les fonctions SECURITY DEFINER pour les triggers
- [ ] Vérifier que chaque utilisateur a un profil avec le bon rôle
- [ ] Tester chaque workflow avec chaque rôle

---

## 9. VÉRIFICATION DES POLICIES

```sql
-- Lister toutes les policies actives
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Vérifier RLS activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

---

## 10. RÉSUMÉ DES RÔLES

| Rôle | Peut créer patients | Peut créer décisions | Peut créer devis | Peut créer événements |
|------|---------------------|----------------------|------------------|----------------------|
| `marcel` | ✅ | ❌ | ✅ | ✅ |
| `franchir` | ✅ | ❌ | ✅ | ✅ |
| `gilles` | ❌ | ✅ | ❌ | ❌ |
| `admin` | ✅ | ❌* | ✅ | ✅ |

*L'admin peut être ajouté aux policies de décisions médicales si nécessaire.
