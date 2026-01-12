-- Simplifier les statuts workflow (garder seulement les essentiels)
-- Supprimer tous les statuts existants
TRUNCATE TABLE workflow_statuses CASCADE;

-- Réinsérer les statuts simplifiés avec position
INSERT INTO workflow_statuses (code, label, order_position, is_terminal, color) VALUES
  ('prospect_created', 'Dossier créé', 1, FALSE, '#9CA3AF'),
  ('medical_review', 'En revue médicale', 2, FALSE, '#3B82F6'),
  ('need_info', 'À compléter', 3, FALSE, '#F59E0B'),
  ('validated_medical', 'Validé médicalement', 4, FALSE, '#10B981'),
  ('rejected_medical', 'Refusé médicalement', 99, TRUE, '#EF4444'),
  ('quote_issued', 'Devis envoyé', 5, FALSE, '#8B5CF6'),
  ('quote_accepted', 'Devis accepté', 6, FALSE, '#10B981'),
  ('surgery_scheduled', 'Chirurgie programmée', 7, FALSE, '#6366F1'),
  ('surgery_done', 'Chirurgie effectuée', 8, FALSE, '#059669'),
  ('completed', 'Dossier terminé', 9, TRUE, '#14B8A6');
