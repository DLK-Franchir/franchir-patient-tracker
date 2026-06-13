import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile, requireStaffProfile } from '@/lib/access-control'
import { redirect } from 'next/navigation'
import PatientDetailClient from './client-page'
import AppHeader from '@/components/app-header'
import { type UserRole } from '@/lib/workflow-v2'

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!isStaffProfile(profile)) {
    redirect('/login?error=unauthorized')
  }

  const staffProfile = requireStaffProfile(profile)
  const userRole = staffProfile.role as UserRole

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      *,
      current_status:workflow_statuses!current_status_id (
        id,
        code,
        label,
        color
      ),
      creator:profiles!created_by (
        full_name,
        role
      )
    `)
    .eq('id', id)
    .single()

  if (!patient) {
    redirect('/dashboard')
  }

  const { data: allMessages } = await supabase
    .from('patient_messages')
    .select('*')
    .eq('patient_id', id)
    .order('created_at', { ascending: true })

  // Annuaire chirurgiens actifs (id annuaire) pour l'assignation réelle — D6.
  const { data: surgeons } = await supabase
    .from('surgeons')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  return (
    <>
      <AppHeader userRole={userRole} userName={staffProfile.full_name ?? undefined} showActions={true} />
      <PatientDetailClient
        initialPatient={patient}
        initialMessages={allMessages || []}
        userRole={userRole}
        surgeons={surgeons || []}
      />
    </>
  )
}
