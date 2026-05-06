'use client'

import { useState, useMemo, lazy, Suspense } from 'react'
import Link from 'next/link'
import { WorkflowGuidance } from '@/components/workflow-guidance'
import { WorkflowActions } from '@/components/workflow-actions'
import MessageThread, { type Message } from '@/components/patient/message-thread'
import WorkflowTimeline from '@/components/workflow-timeline'
import PatientSummaryCard from '@/components/patient-summary-card'
import SurgeryDateBanner from '@/components/patient/surgery-date-banner'
import DraftReminderModal from '@/components/patient/draft-reminder-modal'
import {
  getAvailableActions,
  globalStatusFromWorkflowStatus,
  type GlobalStatus,
  type UserRole,
} from '@/lib/workflow-v2'
import { useRouter } from 'next/navigation'
import { useNotification } from '@/lib/contexts/notification-context'
import { canPerformAction } from '@/lib/domain/patients/workflow'

const MessageComposer = lazy(() => import('@/components/patient/message-composer'))
const CommercialData = lazy(() => import('@/components/patient/commercial-data'))
const CalendarEventForm = lazy(() => import('@/components/patient/calendar-event-form'))
const QuoteCard = lazy(() => import('@/components/patient/quote-card'))

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

interface CalendarEvent {
  id: string
  event_type: string
  event_date: string
  notes: string | null
  created_at: string
}

interface PatientData {
  id: string
  patient_name: string
  clinical_summary: string | null
  sharepoint_link: string | null
  created_at: string
  quote_amount?: number | null
  proposed_date?: string | null
  confirmed_surgery_date?: string | null
  confirmed_surgeon_name?: string | null
  quote_accepted?: boolean
  date_accepted?: boolean
  current_status: {
    id: string
    code: string
    label: string
    color: string
  }
  creator: {
    full_name: string
    role: string
  }
}

type PatientTab = 'summary' | 'messages' | 'calendar' | 'quotes' | 'history'
type MessageKindFilter = 'all' | Message['kind']
type MessageTopicFilter = 'all' | 'medical' | 'commercial' | 'system'
type MessageDateFilter = 'all' | 'today' | 'week' | 'month'

export default function PatientDetailClient({
  initialPatient,
  initialMessages,
  initialCalendarEvents,
  userRole,
}: {
  initialPatient: PatientData
  initialMessages: Message[]
  initialCalendarEvents: CalendarEvent[]
  userRole: UserRole
}) {
  const router = useRouter()
  const { addNotification } = useNotification()
  const [patient, setPatient] = useState(initialPatient)
  const [allMessages] = useState<Message[]>(initialMessages)
  const [activeTab, setActiveTab] = useState<PatientTab>('summary')
  const [messageSearch, setMessageSearch] = useState('')
  const [messageKindFilter, setMessageKindFilter] = useState<MessageKindFilter>('all')
  const [messageTopicFilter, setMessageTopicFilter] = useState<MessageTopicFilter>('all')
  const [messageAuthorFilter, setMessageAuthorFilter] = useState('all')
  const [messageDateFilter, setMessageDateFilter] = useState<MessageDateFilter>('all')
  const [composerTopic, setComposerTopic] = useState<'medical' | 'commercial'>('medical')

  const globalStatus: GlobalStatus = globalStatusFromWorkflowStatus(patient.current_status)

  const showCommercialTab = userRole !== 'gilles'

  const messagePermission = canPerformAction({
    role: userRole,
    actionId: 'post_message',
    globalStatus,
  })

  const commercialPermission = canPerformAction({
    role: userRole,
    actionId: 'edit_commercial_data',
    globalStatus,
  })

  const isReadOnly = Boolean(
    !messagePermission.allowed &&
    messagePermission.fieldsLocked?.includes('patient_summary') &&
    messagePermission.fieldsLocked?.includes('commercial_data') &&
    messagePermission.fieldsLocked?.includes('messages')
  )

  const readOnlyReason = !messagePermission.allowed ? messagePermission.reason : null

  const handleAction = async (actionId: string, data?: unknown) => {
    try {
      const response = await fetch(`/api/patients/${patient.id}/change-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, data }),
      })

      if (!response.ok) {
        throw new Error('Failed to execute action')
      }

      const result = await response.json()

      if (result.patient && Object.keys(result.patient).length > 0) {
        setPatient(currentPatient => ({
          ...currentPatient,
          ...result.patient,
        }))
      }

      router.refresh()
      addNotification({ type: 'success', message: 'Action exécutée avec succès' })
    } catch (error) {
      console.error('Action failed:', error)
      addNotification({
        type: 'error',
        message: "Une erreur est survenue lors de l'exécution de l'action",
      })
    }
  }

  const handleUpdateSummary = async (summary: string, link: string) => {
    const response = await fetch(`/api/patients/${patient.id}/update-summary`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinical_summary: summary,
        sharepoint_link: link,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update summary')
    }

    setPatient({
      ...patient,
      clinical_summary: summary,
      sharepoint_link: link,
    })
  }

  const messageAuthors = useMemo(() => {
    const authorSet = new Set<string>()

    for (const message of allMessages) {
      const author = message.author_name?.trim()
      if (author) {
        authorSet.add(author)
      }
    }

    return Array.from(authorSet).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allMessages])

  const filteredMessages = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfWeek.getDate() - 7)
    const startOfMonth = new Date(startOfToday)
    startOfMonth.setMonth(startOfMonth.getMonth() - 1)

    return allMessages.filter(message => {
      if (messageKindFilter !== 'all' && message.kind !== messageKindFilter) {
        return false
      }

      const normalizedTopic = message.topic || 'system'
      if (messageTopicFilter !== 'all' && normalizedTopic !== messageTopicFilter) {
        return false
      }

      if (messageAuthorFilter !== 'all' && message.author_name !== messageAuthorFilter) {
        return false
      }

      const createdAtDate = new Date(message.created_at)
      if (messageDateFilter === 'today' && createdAtDate < startOfToday) {
        return false
      }

      if (messageDateFilter === 'week' && createdAtDate < startOfWeek) {
        return false
      }

      if (messageDateFilter === 'month' && createdAtDate < startOfMonth) {
        return false
      }

      if (!messageSearch.trim()) {
        return true
      }

      const normalizedSearch = messageSearch.trim().toLowerCase()
      return [
        message.title || '',
        message.body,
        message.author_name || '',
        message.author_role || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [
    allMessages,
    messageDateFilter,
    messageKindFilter,
    messageAuthorFilter,
    messageTopicFilter,
    messageSearch,
  ])

  const workflowActions = useMemo(
    () =>
      getAvailableActions({
        globalStatus,
        role: userRole,
        quoteAccepted: patient.quote_accepted || false,
        dateAccepted: patient.date_accepted || false,
      }),
    [globalStatus, userRole, patient.quote_accepted, patient.date_accepted]
  )

  const historyMessages = useMemo(
    () =>
      allMessages.filter(
        message =>
          message.kind === 'status_change' || message.kind === 'action' || message.kind === 'system'
      ),
    [allMessages]
  )

  const tabButtons: Array<{ id: PatientTab; label: string; visible: boolean }> = [
    { id: 'summary', label: 'Résumé', visible: true },
    { id: 'messages', label: 'Messages', visible: true },
    { id: 'calendar', label: 'Calendrier', visible: true },
    { id: 'quotes', label: 'Devis', visible: showCommercialTab },
    { id: 'history', label: 'Historique', visible: true },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500" aria-label="Fil d'Ariane">
        <Link href="/dashboard" className="font-medium text-[#2563EB] hover:text-[#1d4ed8]">
          Tableau de bord
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-gray-700" aria-current="page">
          {patient.patient_name}
        </span>
      </nav>

      <WorkflowTimeline currentStatus={globalStatus} />

      {isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-yellow-800">
            ⚠️{' '}
            {readOnlyReason ||
              'Ce dossier est en lecture seule. Seul un administrateur peut effectuer des modifications.'}
          </p>
        </div>
      )}

      <div className="lg:hidden mb-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Actions disponibles</h2>
          <WorkflowGuidance globalStatus={globalStatus} userRole={userRole} />
          <div className="mt-3">
            <WorkflowActions
              globalStatus={globalStatus}
              userRole={userRole}
              quoteAccepted={patient.quote_accepted || false}
              dateAccepted={patient.date_accepted || false}
              onAction={handleAction}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 overflow-x-auto">
              <nav
                className="flex -mb-px min-w-max"
                role="tablist"
                aria-label="Sections du dossier patient"
              >
                {tabButtons
                  .filter(tab => tab.visible)
                  .map(tab => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-[#2563EB] text-[#2563EB]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
              </nav>
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'summary' && (
                <PatientSummaryCard
                  patientName={patient.patient_name}
                  clinicalSummary={patient.clinical_summary}
                  sharepointLink={patient.sharepoint_link}
                  globalStatus={globalStatus}
                  userRole={userRole}
                  onUpdate={handleUpdateSummary}
                />
              )}

              {activeTab === 'messages' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={messageSearch}
                      onChange={event => setMessageSearch(event.target.value)}
                      type="search"
                      placeholder="Rechercher dans les messages"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    />
                    <select
                      value={messageKindFilter}
                      onChange={event =>
                        setMessageKindFilter(event.target.value as MessageKindFilter)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="all">Tous les types</option>
                      <option value="message">Messages</option>
                      <option value="status_change">Changements de statut</option>
                      <option value="action">Actions</option>
                      <option value="system">Système</option>
                    </select>
                    <select
                      value={messageTopicFilter}
                      onChange={event =>
                        setMessageTopicFilter(event.target.value as MessageTopicFilter)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="all">Tous les thèmes</option>
                      <option value="medical">Médical</option>
                      <option value="commercial">Commercial</option>
                      <option value="system">Système</option>
                    </select>
                    <select
                      value={messageDateFilter}
                      onChange={event =>
                        setMessageDateFilter(event.target.value as MessageDateFilter)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="all">Toutes les dates</option>
                      <option value="today">Aujourd'hui</option>
                      <option value="week">7 derniers jours</option>
                      <option value="month">30 derniers jours</option>
                    </select>
                    <select
                      value={messageAuthorFilter}
                      onChange={event => setMessageAuthorFilter(event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 md:col-span-2"
                    >
                      <option value="all">Tous les auteurs</option>
                      {messageAuthors.map(author => (
                        <option key={author} value={author}>
                          {author}
                        </option>
                      ))}
                    </select>
                  </div>

                  <MessageThread patientId={patient.id} initialMessages={filteredMessages} />

                  {messagePermission.allowed && (
                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-gray-900">Ajouter un message</h3>
                        <select
                          value={composerTopic}
                          onChange={event =>
                            setComposerTopic(event.target.value as 'medical' | 'commercial')
                          }
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                        >
                          <option value="medical">Message médical</option>
                          {showCommercialTab && (
                            <option value="commercial">Message commercial</option>
                          )}
                        </select>
                      </div>
                      <Suspense fallback={<LoadingSpinner />}>
                        <MessageComposer patientId={patient.id} topic={composerTopic} />
                      </Suspense>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="space-y-4">
                  <SurgeryDateBanner
                    confirmedDate={patient.confirmed_surgery_date ?? null}
                    surgeonName={patient.confirmed_surgeon_name ?? null}
                    proposedDate={patient.proposed_date ?? null}
                    isAdmin={userRole === 'admin'}
                    patientId={patient.id}
                    onAdminUpdate={
                      userRole === 'admin'
                        ? async (date, surgeon) => {
                            const res = await fetch(`/api/patients/${patient.id}/surgery-date`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                confirmed_surgery_date: date,
                                confirmed_surgeon_name: surgeon,
                              }),
                            })
                            if (!res.ok) throw new Error('Failed')
                            setPatient(p => ({
                              ...p,
                              confirmed_surgery_date: date,
                              confirmed_surgeon_name: surgeon,
                            }))
                          }
                        : undefined
                    }
                  />

                  {messagePermission.allowed && (
                    <Suspense fallback={<LoadingSpinner />}>
                      <CalendarEventForm patientId={patient.id} />
                    </Suspense>
                  )}

                  {initialCalendarEvents.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                      Aucun évènement calendrier pour ce dossier.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {initialCalendarEvents.map(event => (
                        <li key={event.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {event.event_type === 'confirmed_date'
                                ? 'Date confirmée'
                                : event.event_type === 'proposed_date'
                                  ? 'Date proposée'
                                  : event.event_type}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {new Date(event.event_date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          {event.notes && <p className="text-sm text-gray-600">{event.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === 'quotes' && showCommercialTab && (
                <div className="space-y-4 sm:space-y-6">
                  <Suspense fallback={<LoadingSpinner />}>
                    <CommercialData
                      patientId={patient.id}
                      initialQuoteAmount={patient.quote_amount}
                      initialProposedDate={patient.proposed_date}
                      canEdit={commercialPermission.allowed}
                      userRole={userRole}
                      globalStatus={globalStatus}
                    />
                  </Suspense>
                  <Suspense fallback={<LoadingSpinner />}>
                    <QuoteCard patientId={patient.id} />
                  </Suspense>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Workflow complet</h3>
                    <div className="space-y-2 text-sm">
                      {workflowActions.futureSteps.length > 0 ? (
                        workflowActions.futureSteps.map((step, index) => (
                          <div key={`${step.label}-${index}`} className="flex items-start gap-2">
                            <span className="text-gray-500 mt-0.5">{index + 1}.</span>
                            <div>
                              <p className="font-medium text-gray-800">{step.label}</p>
                              <p className="text-xs text-gray-500">{step.reason}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-600">
                          Aucune prochaine étape disponible pour ce rôle.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Historique des changements
                    </h3>
                    {historyMessages.length === 0 ? (
                      <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        Aucun changement enregistré.
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {historyMessages.map(message => (
                          <li key={message.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-gray-900">
                                {message.title || 'Mise à jour du dossier'}
                              </p>
                              <span className="text-xs text-gray-500">
                                {new Date(message.created_at).toLocaleString('fr-FR')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                              {message.body}
                            </p>
                            {message.meta?.old_status && message.meta?.new_status && (
                              <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                                {message.meta.old_status} → {message.meta.new_status}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-20 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions disponibles</h2>
              <WorkflowGuidance globalStatus={globalStatus} userRole={userRole} />
              <div className="mt-4">
                <WorkflowActions
                  globalStatus={globalStatus}
                  userRole={userRole}
                  quoteAccepted={patient.quote_accepted || false}
                  dateAccepted={patient.date_accepted || false}
                  onAction={handleAction}
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Informations</h3>
              <div className="space-y-2 text-xs text-blue-800">
                <p>
                  <span className="font-medium">Créé par:</span> {patient.creator.full_name}
                </p>
                <p>
                  <span className="font-medium">Date:</span>{' '}
                  {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DraftReminderModal
        patientId={patient.id}
        globalStatus={globalStatus}
        onSubmit={() => handleAction('submit_to_medical')}
      />
    </div>
  )
}
