import { createServerClient } from '@/lib/supabase/server'
import {
  canManagePatientDocuments,
  canViewGillesErikRestrictedPatient,
  IMAGING_SANDBOX_PATIENT_ID,
  isStaffProfile,
  requireStaffProfile,
} from '@/lib/access-control'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import AppHeader from '@/components/app-header'
import DocumentsSection from '@/components/patient/documents-section'

export default async function ImageriePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/imagerie')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!isStaffProfile(profile) || !canViewGillesErikRestrictedPatient(profile)) {
    redirect('/dashboard')
  }

  const staffProfile = requireStaffProfile(profile)
  const { data: patient } = await supabase
    .from('patients')
    .select('id, visibility_scope')
    .eq('id', IMAGING_SANDBOX_PATIENT_ID)
    .maybeSingle()

  if (!patient) {
    redirect('/dashboard')
  }

  const canManage = canManagePatientDocuments(staffProfile, patient)

  return (
    <>
      <AppHeader userRole={staffProfile.role} showActions showImagingLink />
      <div className="min-h-screen bg-franchir-cream p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1400px] space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1E2B70]">Scanners et IRM</h1>
            <p className="mt-1 text-sm text-[#2E3450]">
              Déposez les fichiers, puis cliquez sur une série pour l’afficher.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                Chargement de la visionneuse…
              </div>
            }
          >
            <DocumentsSection patientId={IMAGING_SANDBOX_PATIENT_ID} canManage={canManage} />
          </Suspense>
        </div>
      </div>
    </>
  )
}
