'use client'

import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Clock } from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import {
  CLOSED_DOSSIER_GREY,
  globalStatusFromWorkflowStatus,
  isClosedGlobalStatus,
  type UserRole,
} from '@/lib/workflow-v2'
import {
  focusFilterLabel,
  getCurrentStepLabel,
  selectedGlobalStatusFromCodes,
  GLOBAL_STATUS_LABELS,
  type DashboardFocus,
  type DashboardSummary,
  type DashboardTabId,
} from '@/lib/dashboard-summary'
import DashboardSummaryHeader from '@/components/dashboard/dashboard-summary'
import PatientRowAction from '@/components/dashboard/patient-row-action'
import {
  StatusBadge,
  questionnaireStatusLabel,
  questionnaireStatusShortLabel,
  questionnaireStatusVariant,
} from '@/components/ui/status-badge'
type SortColumn = 'created_at' | 'patient_name' | 'current_status_id'
type SortDirection = 'asc' | 'desc'

type Patient = {
  id: string
  patient_name: string
  created_at: string
  questionnaire_status: string | null
  proposed_date?: string | null
  quote_amount?: number | null
  quote_accepted?: boolean
  date_accepted?: boolean
  assigned_surgeon_name?: string | null
  workflow_statuses: { id: string; code: string; label: string; color: string } | null
  profiles: { full_name: string } | null
}

type PatientListProps = {
  initialPatients: Patient[]
  total: number
  totalPages: number
  currentPage: number
  itemsPerPage: number
  searchQuery: string
  selectedStatuses: string[]
  activeTab: DashboardTabId | null
  activeKpi: string | null
  sort: SortColumn
  direction: SortDirection
  userRole?: UserRole
  dashboardSummary: DashboardSummary
  focus: DashboardFocus
  totalPatients: number
}

function formatQuoteAmount(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  return `${amount.toLocaleString('fr-FR')} €`
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function PatientAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const parts = name.trim().split(' ')
  const initials = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  const dim = size === 'lg' ? 'h-11 w-11 text-[14px]' : 'h-10 w-10 text-[13px]'

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dim}`}
      style={{ background: `${BRAND.navy}14`, color: BRAND.navy }}
    >
      {initials}
    </div>
  )
}


export default function PatientList({
  initialPatients,
  total,
  totalPages,
  currentPage,
  itemsPerPage,
  searchQuery,
  selectedStatuses,
  activeTab,
  activeKpi,
  sort,
  direction,
  userRole = 'admin',
  dashboardSummary,
  focus,
  totalPatients,
}: PatientListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchQuery)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setQuery(searchQuery)
  }, [searchQuery])

  const pageStart = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const pageEnd = Math.min(currentPage * itemsPerPage, total)

  const pages = useMemo(() => {
    const first = Math.max(1, currentPage - 2)
    const last = Math.min(totalPages, currentPage + 2)
    return Array.from({ length: last - first + 1 }, (_, index) => first + index)
  }, [currentPage, totalPages])

  const buildUrl = (updates: {
    page?: number
    q?: string | null
    status?: string[] | null
    focus?: DashboardFocus | null
    sort?: SortColumn
    dir?: SortDirection
  }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.page !== undefined) params.set('page', String(updates.page))
    if (updates.q !== undefined) {
      if (updates.q) params.set('q', updates.q)
      else params.delete('q')
    }
    if (updates.status !== undefined) {
      params.delete('status')
      updates.status?.forEach((status) => params.append('status', status))
    }
    if (updates.focus !== undefined) {
      if (updates.focus && updates.focus !== 'all') params.set('focus', updates.focus)
      else params.delete('focus')
    }
    if (updates.sort) params.set('sort', updates.sort)
    if (updates.dir) params.set('dir', updates.dir)

    return `/dashboard?${params.toString()}`
  }

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => {
      router.push(buildUrl({ page: 1, q: query.trim() }))
    })
  }

  const clearActiveFilters = () => {
    setQuery('')
    startTransition(() => {
      router.push('/dashboard')
    })
  }

  const selectedPipelineStatus = selectedGlobalStatusFromCodes(selectedStatuses)
  const focusLabel = focusFilterLabel(focus)
  const pipelineLabel = selectedPipelineStatus ? GLOBAL_STATUS_LABELS[selectedPipelineStatus] : null
  const hasCockpitFilter = Boolean(focusLabel || pipelineLabel || activeKpi || activeTab)

  const sortBy = (column: SortColumn) => {
    const nextDirection = sort === column && direction === 'asc' ? 'desc' : 'asc'
    startTransition(() => {
      router.push(buildUrl({ page: 1, sort: column, dir: nextDirection }))
    })
  }

  const sortIndicator = (column: SortColumn) => {
    if (sort !== column) return '↕'
    return direction === 'asc' ? '↑' : '↓'
  }

  const tableHeaders = [
    'Patient',
    'Statut',
    'Étape courante',
    'Chirurgien',
    'Budget',
    'Date',
    'Action',
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardSummaryHeader
        summary={dashboardSummary}
        focus={focus}
        selectedStatuses={selectedStatuses}
        activeTab={activeTab}
        activeKpi={activeKpi}
        userRole={userRole}
        searchQuery={query}
        totalPatients={totalPatients}
        onSearchChange={setQuery}
        onSearchSubmit={applyFilters}
      />

      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between" style={{ color: BRAND.slate }}>
        <p>
          <span className="font-bold" style={{ color: BRAND.dark }}>
            {total}
          </span>{' '}
          dossier{total !== 1 ? 's' : ''}
          {searchQuery && (
            <>
              {' '}
              · <em>&quot;{searchQuery}&quot;</em>
            </>
          )}
          {hasCockpitFilter && (focusLabel || pipelineLabel) && (
            <>
              {' '}
              — {focusLabel || pipelineLabel}
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          {hasCockpitFilter && (
            <button
              type="button"
              onClick={clearActiveFilters}
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: BRAND.coral }}
            >
              Effacer le filtre
            </button>
          )}
          <p>
            Affichage {pageStart}-{pageEnd} sur {total}
          </p>
          {isPending && (
            <p className="font-medium" style={{ color: BRAND.navy }}>
              Chargement…
            </p>
          )}
        </div>
      </div>

      <div
        className="hidden overflow-x-auto rounded-2xl shadow-sm lg:block"
        style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
      >
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr style={{ background: BRAND.navy, borderBottom: `2px solid ${BRAND.navyDark}` }}>
              {tableHeaders.map((header) => (
                <th
                  key={header}
                  className="px-5 py-4 text-left text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    color: 'rgba(255,255,255,0.65)',
                    minWidth: header === 'Patient' ? '220px' : undefined,
                  }}
                >
                  {header === 'Patient' || header === 'Statut' ? (
                    <button
                      type="button"
                      onClick={() =>
                        sortBy(header === 'Patient' ? 'patient_name' : 'current_status_id')
                      }
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      {header} {sortIndicator(header === 'Patient' ? 'patient_name' : 'current_status_id')}
                    </button>
                  ) : (
                    header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initialPatients.map((patient, index) => {
              const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
              const isClosed = isClosedGlobalStatus(globalStatus)
              const statusFullLabel = patient.workflow_statuses?.label || 'Sans statut'
              const statusShortLabel = GLOBAL_STATUS_LABELS[globalStatus] ?? statusFullLabel
              const questionnaireFullLabel = questionnaireStatusLabel(patient.questionnaire_status)
              const questionnaireShortLabel = questionnaireStatusShortLabel(patient.questionnaire_status)
              const creatorName = patient.profiles?.full_name || '—'
              const badgeGrey = isClosed ? CLOSED_DOSSIER_GREY : undefined
              const stepLabel = getCurrentStepLabel(globalStatus, userRole)
              const rowBg = index % 2 !== 0 ? BRAND.creamDark : 'white'

              return (
                <tr
                  key={patient.id}
                  className="group cursor-pointer transition-colors"
                  style={{ borderBottom: `1px solid ${BRAND.creamMid}`, background: rowBg }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = '#D8EAF5'
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = rowBg
                  }}
                  onClick={() => router.push(`/dashboard/patient/${patient.id}`)}
                >
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-3.5">
                      <PatientAvatar name={patient.patient_name} />
                      <div className="min-w-[160px]">
                        <p
                          className="text-[15px] font-bold leading-snug break-words"
                          style={{ color: BRAND.dark }}
                        >
                          {patient.patient_name}
                        </p>
                        <p className="mt-1 text-[13px]" style={{ color: BRAND.slate }}>
                          {creatorName} · {formatDateShort(patient.created_at)}
                        </p>
                        {patient.questionnaire_status && (
                          <div className="mt-2">
                            <StatusBadge
                              label={questionnaireShortLabel}
                              title={questionnaireFullLabel}
                              variant={
                                isClosed
                                  ? 'neutral'
                                  : questionnaireStatusVariant(patient.questionnaire_status)
                              }
                              color={badgeGrey}
                              size="sm"
                              nowrap
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <StatusBadge
                      label={statusShortLabel}
                      title={statusFullLabel}
                      color={badgeGrey ?? patient.workflow_statuses?.color ?? '#6B7280'}
                      size="sm"
                      nowrap
                    />
                  </td>
                  <td className="max-w-[240px] px-4 py-5">
                    <span className="line-clamp-2 text-[14px] leading-snug" style={{ color: BRAND.ink }}>
                      {stepLabel}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <span
                      className="text-[14px] font-medium"
                      style={{ color: patient.assigned_surgeon_name ? BRAND.navy : BRAND.slateLight }}
                    >
                      {patient.assigned_surgeon_name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    {patient.quote_amount != null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-bold" style={{ color: BRAND.dark }}>
                          {formatQuoteAmount(patient.quote_amount)}
                        </span>
                        {patient.quote_accepted ? (
                          <CheckCircle size={14} color={BRAND.green} />
                        ) : (
                          <Clock size={14} color={BRAND.orange} />
                        )}
                      </div>
                    ) : (
                      <span style={{ color: BRAND.slateLight }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-5">
                    {patient.proposed_date ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-medium" style={{ color: BRAND.navy }}>
                          {formatDateShort(patient.proposed_date)}
                        </span>
                        {patient.date_accepted ? (
                          <CheckCircle size={13} color={BRAND.green} />
                        ) : (
                          <Clock size={13} color={BRAND.orange} />
                        )}
                      </div>
                    ) : (
                      <span style={{ color: BRAND.slateLight }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-5" onClick={(event) => event.stopPropagation()}>
                    <PatientRowAction
                      patientId={patient.id}
                      globalStatus={globalStatus}
                      userRole={userRole}
                      quoteAccepted={patient.quote_accepted}
                      dateAccepted={patient.date_accepted}
                    />
                  </td>
                </tr>
              )
            })}
            {initialPatients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-[15px]" style={{ color: BRAND.slate }}>
                  <p className="font-medium" style={{ color: BRAND.dark }}>
                    {hasCockpitFilter
                      ? 'Aucun dossier ne correspond à ce filtre.'
                      : searchQuery
                        ? 'Aucun patient ne correspond à votre recherche.'
                        : 'Aucun dossier patient pour le moment.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {initialPatients.map((patient) => {
          const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
          const isClosed = isClosedGlobalStatus(globalStatus)
          const statusFullLabel = patient.workflow_statuses?.label || 'Sans statut'
          const statusShortLabel = GLOBAL_STATUS_LABELS[globalStatus] ?? statusFullLabel
          const questionnaireFullLabel = questionnaireStatusLabel(patient.questionnaire_status)
          const questionnaireShortLabel = questionnaireStatusShortLabel(patient.questionnaire_status)
          const badgeGrey = isClosed ? CLOSED_DOSSIER_GREY : undefined
          const stepLabel = getCurrentStepLabel(globalStatus, userRole)

          return (
            <article
              key={patient.id}
              className="cursor-pointer rounded-2xl p-4 shadow-sm transition active:scale-[0.99]"
              style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
              onClick={() => router.push(`/dashboard/patient/${patient.id}`)}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <PatientAvatar name={patient.patient_name} size="lg" />
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-bold leading-snug break-words" style={{ color: BRAND.dark }}>
                      {patient.patient_name}
                    </h3>
                    <p className="mt-1 text-[13px]" style={{ color: BRAND.slate }}>
                      {patient.profiles?.full_name || '—'} · {formatDateShort(patient.created_at)}
                    </p>
                    {patient.questionnaire_status && (
                      <div className="mt-2">
                        <StatusBadge
                          label={questionnaireShortLabel}
                          title={questionnaireFullLabel}
                          variant={
                            isClosed
                              ? 'neutral'
                              : questionnaireStatusVariant(patient.questionnaire_status)
                          }
                          color={badgeGrey}
                          size="sm"
                          nowrap
                        />
                      </div>
                    )}
                  </div>
                </div>
                <StatusBadge
                  label={statusShortLabel}
                  title={statusFullLabel}
                  color={badgeGrey ?? patient.workflow_statuses?.color ?? '#6B7280'}
                  size="sm"
                  nowrap
                />
              </div>
              <p className="mb-3 text-[13px] leading-snug" style={{ color: BRAND.ink }}>
                {stepLabel}
              </p>
              <div className="mb-3 flex flex-wrap gap-3 text-[12px]" style={{ color: BRAND.slate }}>
                {patient.assigned_surgeon_name && <span>{patient.assigned_surgeon_name}</span>}
                {patient.quote_amount != null && (
                  <span className="inline-flex items-center gap-1 font-bold" style={{ color: BRAND.dark }}>
                    {formatQuoteAmount(patient.quote_amount)}
                    {patient.quote_accepted ? (
                      <CheckCircle size={11} color={BRAND.green} />
                    ) : (
                      <Clock size={11} color={BRAND.orange} />
                    )}
                  </span>
                )}
                {patient.proposed_date && (
                  <span className="inline-flex items-center gap-1">
                    {formatDateShort(patient.proposed_date)}
                    {patient.date_accepted ? (
                      <CheckCircle size={11} color={BRAND.green} />
                    ) : (
                      <Clock size={11} color={BRAND.orange} />
                    )}
                  </span>
                )}
              </div>
              <div onClick={(event) => event.stopPropagation()}>
                <PatientRowAction
                  patientId={patient.id}
                  globalStatus={globalStatus}
                  userRole={userRole}
                  quoteAccepted={patient.quote_accepted}
                  dateAccepted={patient.date_accepted}
                />
              </div>
            </article>
          )
        })}
        {initialPatients.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center shadow-sm"
            style={{ background: 'white', border: `1px solid ${BRAND.creamMid}`, color: BRAND.slate }}
          >
            <p className="font-medium" style={{ color: BRAND.dark }}>
              {hasCockpitFilter
                ? 'Aucun dossier ne correspond à ce filtre.'
                : searchQuery
                  ? 'Aucun patient ne correspond à votre recherche.'
                  : 'Aucun dossier patient pour le moment.'}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2 py-4" aria-label="Pagination">
          <Link
            href={buildUrl({ page: Math.max(1, currentPage - 1) })}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${currentPage === 1 ? 'pointer-events-none border-gray-200 text-gray-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Précédent
          </Link>
          {pages.map((page) => (
            <Link
              key={page}
              href={buildUrl({ page })}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${page === currentPage ? 'text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              style={
                page === currentPage
                  ? { borderColor: BRAND.navy, background: BRAND.navy }
                  : undefined
              }
            >
              {page}
            </Link>
          ))}
          <Link
            href={buildUrl({ page: Math.min(totalPages, currentPage + 1) })}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${currentPage === totalPages ? 'pointer-events-none border-gray-200 text-gray-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Suivant
          </Link>
        </nav>
      )}
    </div>
  )
}
