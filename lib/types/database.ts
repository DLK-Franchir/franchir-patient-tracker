export type UserRole = 'marcel' | 'franchir' | 'gilles' | 'admin'

/** Valeur JSON Postgres (`jsonb`). */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  /** Verrou RLS (`is_active_staff()`) — false par défaut pour tout nouveau compte. */
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowStatus {
  id: string
  code: string
  label: string
  order_position: number
  is_terminal: boolean
  color: string
  created_at: string
}

export interface Surgeon {
  id: string
  full_name: string
  email: string | null
  specialization: string | null
  hospital: string | null
  is_active: boolean
  created_at: string
}

export interface Patient {
  id: string
  patient_name: string
  patient_email: string | null
  patient_phone: string | null
  questionnaire_language: 'fr' | 'en'
  clinical_summary: string | null
  sharepoint_link: string | null
  form_types: ('cervical' | 'lombaire')[]
  current_status_id: string | null
  assigned_surgeon_id: string | null
  /** Budget indicatif (€) — une seule valeur, écrasable (migration 20240113). */
  quote_amount: number | null
  /** Date de chirurgie proposée (timestamptz ISO) — une seule valeur (migration 20240113). */
  proposed_date: string | null
  /** Confirmation Marcel du devis (migration 20240126, défaut false). */
  quote_accepted: boolean | null
  /** Confirmation Marcel de la date (migration 20240126, défaut false). */
  date_accepted: boolean | null
  questionnaire_status: string | null
  /** Posé au passage `questionnaire_status = 'sent'` ; horloge stuck-sent (migration 20260717091050). */
  questionnaire_sent_at: string | null
  questionnaire_completed_at: string | null
  questionnaire_summary: string | null
  /**
   * Dernière URL magique du questionnaire émise (secret patient en clair).
   * Migration prod 20260909 ; trace repo 20260914120200. Non lue par le tracker.
   */
  last_questionnaire_url: string | null
  last_questionnaire_url_expires_at: string | null
  /** Legacy — non utilisé par l'application */
  status: string | null
  /** Legacy — non utilisé par l'application */
  recommended_surgeons: Json | null
  created_by: string
  created_at: string
  /** Non maintenu automatiquement en prod tant que le trigger 20260914120100 n'est pas appliqué. */
  updated_at: string
  workflow_statuses?: WorkflowStatus
  profiles?: Profile
  surgeons?: Surgeon
}

/** `patient_messages.kind` — valeurs observées en prod (CHECK NOT VALID : migration 20260914120000). */
export type PatientMessageKind = 'message' | 'status_change' | 'system' | 'action'

/** `patient_messages.topic` — CHECK en prod (migration 20260914120000). */
export type PatientMessageTopic = 'medical' | 'commercial' | 'system' | 'audit'

/** Journal d'activité + messagerie dossier (append-only de facto). */
export interface PatientMessage {
  id: string
  patient_id: string
  /** Null pour les écritures ops (scripts SQL) sans profil auteur. */
  author_id: string | null
  author_name: string | null
  /** Texte libre en base (pas d'enum) ; en pratique un `UserRole`. */
  author_role: string | null
  kind: PatientMessageKind
  title: string | null
  body: string
  topic: PatientMessageTopic
  /** `meta.action_id` identifie l'action workflow ; ne doit pas contenir de PHI. */
  meta: Record<string, Json>
  created_at: string
}

/** `patient_documents.kind` (migration 20260613190000). */
export type PatientDocumentKind = 'dicom' | 'document'

/** Métadonnées des fichiers du bucket privé `patient-documents` (migrations 20260613190000 + 20260624120000). */
export interface PatientDocument {
  id: string
  patient_id: string
  kind: PatientDocumentKind
  /** Clé Storage : `patients/{patientId}/{timestamp}_{nom}` (unique). */
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
  /** DICOM SOPInstanceUID (0008,0018) — anti-doublon par patient. */
  sop_instance_uid: string | null
  /** DICOM SeriesInstanceUID (0020,000E). */
  series_instance_uid: string | null
  series_description: string | null
  body_part: string | null
  instance_number: number | null
  /** Horodatage d'acquisition normalisé YYYYMMDDHHMMSS. */
  acquisition_datetime: string | null
}

export interface MedicalDecision {
  id: string
  patient_id: string
  decided_by: string
  decision_type: string
  justification: string
  assigned_surgeon_id: string | null
  created_at: string
}

export interface Quote {
  id: string
  patient_id: string
  amount: number | null
  currency: string
  conditions: string | null
  status: string
  created_by: string | null
  created_at: string
}

export interface CalendarEvent {
  id: string
  patient_id: string
  event_type: string
  event_date: string
  surgeon_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  patient_id: string | null
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      workflow_statuses: {
        Row: WorkflowStatus
        Insert: Omit<WorkflowStatus, 'id' | 'created_at'>
        Update: Partial<Omit<WorkflowStatus, 'id'>>
      }
      surgeons: {
        Row: Surgeon
        Insert: Omit<Surgeon, 'id' | 'created_at'>
        Update: Partial<Omit<Surgeon, 'id'>>
      }
      patients: {
        Row: Patient
        Insert: Omit<Patient, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Patient, 'id'>>
      }
      medical_decisions: {
        Row: MedicalDecision
        Insert: Omit<MedicalDecision, 'id' | 'created_at'>
        Update: Partial<Omit<MedicalDecision, 'id'>>
      }
      quotes: {
        Row: Quote
        Insert: Omit<Quote, 'id' | 'created_at'>
        Update: Partial<Omit<Quote, 'id'>>
      }
      calendar_events: {
        Row: CalendarEvent
        Insert: Omit<CalendarEvent, 'id' | 'created_at'>
        Update: Partial<Omit<CalendarEvent, 'id'>>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Omit<Notification, 'id'>>
      }
      patient_messages: {
        Row: PatientMessage
        Insert: Omit<PatientMessage, 'id' | 'created_at' | 'kind' | 'topic' | 'meta'> &
          Partial<Pick<PatientMessage, 'kind' | 'topic' | 'meta'>>
        Update: Partial<Omit<PatientMessage, 'id'>>
      }
      patient_documents: {
        Row: PatientDocument
        Insert: Omit<PatientDocument, 'id' | 'created_at'>
        Update: Partial<Omit<PatientDocument, 'id'>>
      }
    }
  }
}
