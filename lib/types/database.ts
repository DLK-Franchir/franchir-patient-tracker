export type UserRole = 'marcel' | 'franchir' | 'gilles' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
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
  clinical_summary: string | null
  sharepoint_link: string | null
  current_status_id: string | null
  assigned_surgeon_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  workflow_statuses?: WorkflowStatus
  profiles?: Profile
  surgeons?: Surgeon
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
    }
  }
}
