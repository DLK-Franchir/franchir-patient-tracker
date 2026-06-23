'use client'

import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { AntecedentsCard } from '@/components/patient/synthesis/antecedents-card'
import { ClinicalFlagsCard } from '@/components/patient/synthesis/clinical-flags-card'
import { CompletionDonutsCard } from '@/components/patient/synthesis/completion-donuts-card'
import { FunctionalScoresCard } from '@/components/patient/synthesis/functional-scores-card'
import { ImagingDossierCard } from '@/components/patient/synthesis/imaging-dossier-card'
import { PatientProfileCard } from '@/components/patient/synthesis/patient-profile-card'
import { TimelineCard } from '@/components/patient/synthesis/timeline-card'
import { TreatmentsCard } from '@/components/patient/synthesis/treatments-card'

type AnamnezeDashboardProps = {
  patientName: string
  preview: QuestionnaireSynthesisPreview
}

export function AnamnezeDashboard({ patientName, preview }: AnamnezeDashboardProps) {
  return (
    <div className="anamneze-dashboard grid grid-cols-12 gap-4 rounded-[var(--dash-radius-card)] p-4 sm:p-6 lg:gap-6">
      <div className="col-span-12 xl:col-span-8">
        <PatientProfileCard patientName={patientName} preview={preview} staggerIndex={0} />
      </div>
      <div className="col-span-12 xl:col-span-4">
        <CompletionDonutsCard completion={preview.completion} staggerIndex={1} />
      </div>
      <div className="col-span-12">
        <ClinicalFlagsCard flags={preview.flags} staggerIndex={2} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <AntecedentsCard groups={preview.antecedents} staggerIndex={3} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <TreatmentsCard items={preview.treatments} staggerIndex={4} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <FunctionalScoresCard scores={preview.scores} staggerIndex={5} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <TimelineCard events={preview.timeline} staggerIndex={6} />
      </div>
      <div className="col-span-12">
        <ImagingDossierCard
          rows={preview.imagingRows}
          generatedAt={preview.generatedAt}
          staggerIndex={7}
        />
      </div>
    </div>
  )
}
