import { createServerClient } from '@/lib/supabase/server'
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
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const userRole = profile.role as UserRole

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

  return (
    <>
      <AppHeader userRole={userRole} userName={profile.full_name} showActions={true} />
      <PatientDetailClient
        initialPatient={patient}
        initialMessages={allMessages || []}
        userRole={userRole}
      />
    </>
  )
}
