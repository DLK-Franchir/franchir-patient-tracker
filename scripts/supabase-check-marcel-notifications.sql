-- Vérifier les notifications de Marcel
SELECT 
  n.id,
  n.title,
  n.message,
  n.type,
  n.is_read,
  n.created_at,
  p.patient_name
FROM notifications n
LEFT JOIN patients p ON n.patient_id = p.id
WHERE n.user_id = '432425d8-ef14-4c28-9113-0dda12c72395'
ORDER BY n.created_at DESC
LIMIT 10;
