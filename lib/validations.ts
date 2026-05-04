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

const WorkflowActionIdSchema = z.enum([
  'submit_to_medical',
  'resubmit_to_medical',
  'approve_medical',
  'request_more_info',
  'reject_medical',
  'confirm_quote',
  'confirm_date',
  'reopen_case',
  'add_budget',
  'propose_dates',
])

const StatusChangeDataSchema = z
  .object({
    message: z.string().trim().min(1, 'Message invalide').optional(),
    justification: z.string().trim().min(1, 'Justification invalide').optional(),
    surgeons: z.array(z.string().trim().min(1, 'Chirurgien invalide')).optional(),
    budget: z.union([z.string().trim().min(1, 'Budget invalide'), z.number()]).optional(),
    dates: z
      .union([
        z.string().trim().min(1, 'Dates invalides'),
        z.array(z.string().trim().min(1, 'Date invalide')).min(1, 'Dates invalides'),
      ])
      .optional(),
  })
  .passthrough()

export const PatientCreateSchema = z.object({
  patient_name: z.string().trim().min(1, 'Le nom du patient est requis'),
  clinical_summary: z.string().optional().or(z.literal('')),
  sharepoint_link: z.string().trim().url('Lien SharePoint invalide'),
})

export const StatusChangeSchema = z.object({
  actionId: WorkflowActionIdSchema,
  data: StatusChangeDataSchema.optional(),
})

export const MessageSchema = z.object({
  message: z.string().trim().min(1, 'Message vide'),
  topic: z.enum(['medical', 'commercial', 'system']).optional(),
})

export const CommercialDataUpdateSchema = z
  .object({
    quoteAmount: z.number().nullable().optional(),
    proposedDate: z
      .union([
        z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Date proposée invalide'),
        z.null(),
      ])
      .optional(),
  })
  .refine(
    ({ quoteAmount, proposedDate }) => quoteAmount !== undefined || proposedDate !== undefined,
    'Aucune donnée commerciale à mettre à jour'
  )

export const PatientSummaryUpdateSchema = z
  .object({
    clinical_summary: z.string().optional().or(z.literal('')).nullable(),
    sharepoint_link: z.string().trim().url('Lien SharePoint invalide').or(z.literal('')).nullable(),
  })
  .refine(
    ({ clinical_summary, sharepoint_link }) =>
      clinical_summary !== undefined || sharepoint_link !== undefined,
    'Aucune donnée à mettre à jour'
  )

export const NotifyEmailSchema = z.object({
  to: z.string().trim().email('Destinataire invalide'),
  subject: z.string().trim().min(1, 'Sujet requis'),
  html: z.string().min(1, 'Contenu HTML requis'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type PatientInput = z.infer<typeof patientSchema>
export type QuoteInput = z.infer<typeof quoteSchema>
export type CalendarEventInput = z.infer<typeof calendarEventSchema>
export type MedicalDecisionInput = z.infer<typeof medicalDecisionSchema>
export type PatientCreateInput = z.infer<typeof PatientCreateSchema>
export type StatusChangeInput = z.infer<typeof StatusChangeSchema>
export type MessageInput = z.infer<typeof MessageSchema>
export type CommercialDataUpdateInput = z.infer<typeof CommercialDataUpdateSchema>
export type PatientSummaryUpdateInput = z.infer<typeof PatientSummaryUpdateSchema>
export type NotifyEmailInput = z.infer<typeof NotifyEmailSchema>
