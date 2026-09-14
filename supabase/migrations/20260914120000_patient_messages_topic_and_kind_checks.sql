-- ============================================================
-- FRANCHIR PATIENT TRACKER — patient_messages : topic versionné + CHECK kind/topic
-- Date: 2026-09-14
-- Projet cible: zdmeidekszdrzmjuasee (Tracker)
-- ============================================================
-- ⚠️ GATE DB : NE PAS appliquer automatiquement en prod. À appliquer par
-- l'utilisateur via le Dashboard Supabase (SQL Editor) ou la CLI :
--   supabase db push --project-ref zdmeidekszdrzmjuasee
--
-- Migration ADDITIVE et IDEMPOTENTE.
--
-- Contexte (audit 2026-09-14, reports/00_architecture_inventory.md §2.2 / §8) :
--   - la colonne `topic` et son CHECK existent en prod mais n'étaient versionnés
--     dans aucune migration du repo → trace de rejeu ici ;
--   - `kind` n'a aucun CHECK en prod ; valeurs observées : exactement
--     'message', 'status_change', 'system', 'action'.
--
-- Aucune policy RLS ni fonction `is_active_staff()` modifiée.
-- ============================================================

-- ── topic ───────────────────────────────────────────────────
ALTER TABLE public.patient_messages
  ADD COLUMN IF NOT EXISTS topic text DEFAULT 'medical';

ALTER TABLE public.patient_messages
  DROP CONSTRAINT IF EXISTS patient_messages_topic_check;

ALTER TABLE public.patient_messages
  ADD CONSTRAINT patient_messages_topic_check
  CHECK (topic IN ('medical', 'commercial', 'system', 'audit'));

-- ── kind ────────────────────────────────────────────────────
-- Ajouté en NOT VALID : les nouvelles lignes sont contrôlées immédiatement, les
-- lignes existantes ne sont pas rescannées (pas de verrou long, pas d'échec si
-- une valeur inattendue existait). Après vérification en prod :
--   SELECT kind, count(*) FROM public.patient_messages GROUP BY kind;
-- puis, si seules les 4 valeurs attendues ressortent :
--   ALTER TABLE public.patient_messages VALIDATE CONSTRAINT patient_messages_kind_check;
ALTER TABLE public.patient_messages
  DROP CONSTRAINT IF EXISTS patient_messages_kind_check;

ALTER TABLE public.patient_messages
  ADD CONSTRAINT patient_messages_kind_check
  CHECK (kind IN ('message', 'status_change', 'system', 'action'))
  NOT VALID;

-- ── index ───────────────────────────────────────────────────
-- Lecture du journal par dossier filtrée par topic (cloisonnement médical /
-- commercial côté application), tri chronologique.
CREATE INDEX IF NOT EXISTS idx_messages_topic
  ON public.patient_messages (patient_id, topic, created_at);

-- ── documentation ───────────────────────────────────────────
COMMENT ON COLUMN public.patient_messages.topic IS
  'Canal du message : medical (revue / échanges cliniques), commercial (devis, dates, budget), system (événements automatiques), audit (traces techniques : questionnaire, exports). Défaut medical.';

COMMENT ON COLUMN public.patient_messages.kind IS
  'Nature de la ligne : message (saisie libre), status_change (changement de code workflow), action (action workflow sans changement de code), system (événement applicatif). CHECK ajouté NOT VALID le 2026-09-14 : à valider (VALIDATE CONSTRAINT) après contrôle des valeurs.';

COMMENT ON COLUMN public.patient_messages.meta IS
  'Métadonnées structurées de l''événement (jsonb). meta.action_id identifie l''action workflow (ActionId) ; autres clés : old_status, new_status, source, form_types, questionnaire_language, email_sent, dispatch_mode, file_count, part_count. Ne doit contenir aucune donnée de santé ni identifiant patient (pas de PHI).';
