import type { ActionId, GlobalStatus, PatientRole } from '@/lib/domain/patients/types'

export type PatientEventKind = 'status_change' | 'action'

export type PatientEvent = {
  kind: PatientEventKind
  patientId: string
  actionId: ActionId
  actorId: string
  actorRole: PatientRole
  previousStatus?: GlobalStatus
  nextStatus?: GlobalStatus
  createdAt: string
}

export function createPatientEvent(event: PatientEvent): PatientEvent {
  return event
}
