-- Ajouter la policy INSERT manquante pour les notifications
CREATE POLICY "Authenticated users can insert notifications" 
ON notifications 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
