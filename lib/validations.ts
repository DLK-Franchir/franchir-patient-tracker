import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
})

export const patientSchema = z.object({
  patient_name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  clinical_summary: z.string().optional(),
  sharepoint_link: z.string().url('Lien SharePoint invalide').optional().or(z.literal('')),
})

export const quoteSchema = z.object({
  amount: z.number().positive('Le montant doit être positif').optional(),
  currency: z.string().default('EUR'),
  conditions: z.string().optional(),
  status: z.enum(['pending', 'accepted', 'rejected']).default('pending'),
})

export const calendarEventSchema = z.object({
  event_type: z.string().min(1, 'Le type d\'événement est requis'),
  event_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Date invalide',
  }),
  surgeon_id: z.string().uuid().optional(),
  notes: z.string().optional(),
})

export const medicalDecisionSchema = z.object({
  decision_type: z.enum(['validated', 'rejected', 'to_complete']),
  justification: z.string().min(10, 'La justification doit contenir au moins 10 caractères'),
  assigned_surgeon_id: z.string().uuid().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type PatientInput = z.infer<typeof patientSchema>
export type QuoteInput = z.infer<typeof quoteSchema>
export type CalendarEventInput = z.infer<typeof calendarEventSchema>
export type MedicalDecisionInput = z.infer<typeof medicalDecisionSchema>
