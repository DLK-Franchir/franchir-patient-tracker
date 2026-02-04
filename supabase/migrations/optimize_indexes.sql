-- =====================================================
-- OPTIMISATION DES INDEXES SUPABASE
-- Pour améliorer les performances des requêtes
-- =====================================================

-- Index pour la table patients
-- Optimise les requêtes de tri par date de création
CREATE INDEX IF NOT EXISTS idx_patients_created_at 
ON patients(created_at DESC);

-- Optimise les requêtes par statut
CREATE INDEX IF NOT EXISTS idx_patients_status 
ON patients(current_status_id);

-- Optimise les requêtes par créateur
CREATE INDEX IF NOT EXISTS idx_patients_created_by 
ON patients(created_by);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_patients_status_created 
ON patients(current_status_id, created_at DESC);

-- =====================================================
-- Index pour la table notifications
-- =====================================================

-- Optimise les requêtes de notifications non lues par utilisateur
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, is_read, created_at DESC);

-- Index pour les notifications par patient
CREATE INDEX IF NOT EXISTS idx_notifications_patient 
ON notifications(patient_id) 
WHERE patient_id IS NOT NULL;

-- Index pour les notifications par type
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications(type, created_at DESC);

-- =====================================================
-- Index pour la table patient_messages
-- =====================================================

-- Optimise les requêtes de messages par patient
CREATE INDEX IF NOT EXISTS idx_messages_patient_created 
ON patient_messages(patient_id, created_at ASC);

-- Index pour les messages par topic
CREATE INDEX IF NOT EXISTS idx_messages_topic 
ON patient_messages(patient_id, topic, created_at ASC);

-- Index pour les messages par auteur
CREATE INDEX IF NOT EXISTS idx_messages_author 
ON patient_messages(author_id);

-- =====================================================
-- Index pour la table quotes
-- =====================================================

-- Optimise les requêtes de devis par patient
CREATE INDEX IF NOT EXISTS idx_quotes_patient_created 
ON quotes(patient_id, created_at DESC);

-- Index pour les devis par statut
CREATE INDEX IF NOT EXISTS idx_quotes_status 
ON quotes(status);

-- Index pour les devis par créateur
CREATE INDEX IF NOT EXISTS idx_quotes_created_by 
ON quotes(created_by);

-- =====================================================
-- Index pour la table profiles
-- =====================================================

-- Optimise les requêtes par rôle
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles(role);

-- Index pour les recherches par email
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON profiles(email);

-- =====================================================
-- Index pour la table workflow_statuses
-- =====================================================

-- Optimise les requêtes par code de statut
CREATE INDEX IF NOT EXISTS idx_workflow_statuses_code 
ON workflow_statuses(code);

-- Index pour les statuts actifs
CREATE INDEX IF NOT EXISTS idx_workflow_statuses_active 
ON workflow_statuses(is_active) 
WHERE is_active = true;

-- =====================================================
-- STATISTIQUES ET ANALYSE
-- =====================================================

-- Mettre à jour les statistiques pour l'optimiseur de requêtes
ANALYZE patients;
ANALYZE notifications;
ANALYZE patient_messages;
ANALYZE quotes;
ANALYZE profiles;
ANALYZE workflow_statuses;

-- =====================================================
-- VÉRIFICATION DES INDEXES
-- =====================================================

-- Pour vérifier les indexes créés, exécuter:
-- SELECT tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, indexname;

-- =====================================================
-- MONITORING DES PERFORMANCES
-- =====================================================

-- Pour identifier les requêtes lentes:
-- SELECT query, calls, total_time, mean_time
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 20;

-- Pour voir l'utilisation des indexes:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;
