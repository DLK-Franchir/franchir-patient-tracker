-- Vérifier les statuts actuels dans la base
SELECT id, code, label, order_position, color
FROM workflow_statuses
ORDER BY order_position;
