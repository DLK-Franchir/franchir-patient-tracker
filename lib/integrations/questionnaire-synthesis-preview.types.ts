import type { FunctionalScoreRow, OrientationSummaryField } from '@franchir/synthesis-contract'

export type { FunctionalScoreRow, OrientationSummaryField }

export type ClinicalFlagSeverity = 'critical' | 'warning' | 'info'

export type ClinicalFlag = {
  id: string
  label: string
  severity: ClinicalFlagSeverity
  icon?: 'allergy' | 'medication' | 'heart' | 'alert'
}

export type AntecedentGroup = {
  title: string
  items: string[]
}

export type TreatmentItem = {
  name: string
  detail?: string
  status?: 'actif' | 'historique'
}

export type TimelineEvent = {
  id: string
  label: string
  detail?: string
  sortKey: number
}

export type ImagingExamRow = {
  id: string
  name: string
  date?: string
  result: string
  status: 'pathologique' | 'normal' | 'surveillance' | 'disponible' | 'manquant'
}

export type QuestionnaireSynthesisPreview = {
  sessionId: string
  generatedAt: string
  spineRegionLabel?: string
  orientation?: OrientationSummaryField[]
  profile: {
    reason?: string
    patientGoal?: string
    primaryQuestion?: string
    phone?: string
    gender?: string
    birthDate?: string
    birthDateDisplay?: string
    age?: string
  }
  flags: ClinicalFlag[]
  antecedents: AntecedentGroup[]
  treatments: TreatmentItem[]
  timeline: TimelineEvent[]
  imagingRows: ImagingExamRow[]
  scores: {
    rows: FunctionalScoreRow[]
  }
  completion: {
    overall: number
    status: string
    sections: Array<{ title: string; pct: number }>
  }
}
