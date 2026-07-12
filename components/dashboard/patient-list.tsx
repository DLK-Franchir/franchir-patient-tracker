'use client'

import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CLOSED_DOSSIER_GREY,
  globalStatusFromWorkflowStatus,
  isClosedGlobalStatus,
  type UserRole,
} from '@/lib/workflow-v2'
import {
  focusFilterLabel,
  getShortPendingActionLabel,
  pendingActionLabel,
  selectedGlobalStatusFromCodes,
  GLOBAL_STATUS_LABELS,
  type DashboardFocus,
  type PriorityBannerContent,
  type DashboardSummary,
} from '@/lib/dashboard-summary'
import DashboardSummaryHeader from '@/components/dashboard/dashboard-summary'
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
  sort: SortColumn
  direction: SortDirection
  userRole?: UserRole
  dashboardSummary: DashboardSummary
  focus: DashboardFocus
  priorityBanner: PriorityBannerContent | null
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

const STICKY_ACTION_HEAD =
  'sticky right-0 z-20 bg-gray-50 px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700 shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.12)]'
const STICKY_ACTION_CELL =
  'sticky right-0 z-10 bg-white px-3 py-4 text-right text-sm font-medium shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.12)] group-hover:bg-gray-50'
const DOSSIER_LINK_CLASS =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]'
const DOSSIER_CLOSED_LINK_CLASS =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600'

function TruncatedCell({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  return (
    <span className={`block truncate ${className}`} title={text}>
      {text}
    </span>
  )
}

function PendingActionCell({
  shortLabel,
  fullLabel,
}: {
  shortLabel: string
  fullLabel: string
}) {
  return (
    <span
      className="flex min-w-[7rem] items-start gap-1.5 text-xs font-bold leading-snug text-amber-900"
      title={fullLabel}
    >
      <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
      <span className="line-clamp-2 break-words">{shortLabel}</span>
    </span>
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
  sort,
  direction,
  userRole = 'admin',
  dashboardSummary,
  focus,
  priorityBanner,
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

  const resetFilters = () => {
    setQuery('')
    startTransition(() => {
      router.push('/dashboard')
    })
  }

  const clearActiveFilters = () => {
    setQuery('')
    startTransition(() => {
      router.push(buildUrl({ page: 1, q: null, status: null, focus: null }))
    })
  }

  const selectedPipelineStatus = selectedGlobalStatusFromCodes(selectedStatuses)
  const focusLabel = focusFilterLabel(focus)
  const pipelineLabel = selectedPipelineStatus ? GLOBAL_STATUS_LABELS[selectedPipelineStatus] : null
  const hasCockpitFilter = Boolean(focusLabel || pipelineLabel)

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardSummaryHeader
        summary={dashboardSummary}
        focus={focus}
        selectedStatuses={selectedStatuses}
        userRole={userRole}
        priorityBanner={priorityBanner}
      />

      {hasCockpitFilter && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
          <span>
            {total} dossier{total > 1 ? 's' : ''} — {focusLabel || pipelineLabel}
          </span>
          <button
            type="button"
            onClick={clearActiveFilters}
            className="font-semibold text-[#2563EB] underline-offset-2 hover:underline"
          >
            Effacer le filtre
          </button>
        </p>
      )}

      <form
        onSubmit={applyFilters}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="patient-search"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Rechercher un patient
              </label>
              <input
                id="patient-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom du patient"
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <p className="text-xs text-gray-500">
              Filtrez par étape du parcours via les chips « Vue cockpit » ci-dessus (Brouillon,
              Commercial, etc.).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] rounded-lg bg-[#2563EB] px-5 py-2.5 font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              {isPending ? 'Application...' : 'Appliquer'}
            </button>
            <button
              type="button"
              onClick={resetFilters}
              disabled={isPending}
              className="min-h-[44px] rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Affichage {pageStart}-{pageEnd} sur {total} patient{total > 1 ? 's' : ''}
        </p>
        {isPending && <p className="font-medium text-[#2563EB]">Chargement des résultats...</p>}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-[18%] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 lg:px-4">
                <button
                  type="button"
                  onClick={() => sortBy('patient_name')}
                  className="inline-flex items-center gap-1 hover:text-[#2563EB]"
                >
                  Patient {sortIndicator('patient_name')}
                </button>
              </th>
              <th className="w-[15%] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 lg:px-4">
                <button
                  type="button"
                  onClick={() => sortBy('current_status_id')}
                  className="inline-flex items-center gap-1 hover:text-[#2563EB]"
                >
                  Statut {sortIndicator('current_status_id')}
                </button>
              </th>
              <th className="w-[13%] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 lg:px-4">
                Questionnaire
              </th>
              <th className="hidden min-w-[9rem] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 lg:table-cell lg:w-[24%] lg:px-4">
                Action en attente
              </th>
              <th className="hidden px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 xl:table-cell xl:w-[14%] xl:px-4">
                Chirurgien
              </th>
              <th className="hidden px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 xl:table-cell xl:w-[9%] xl:px-4">
                Budget
              </th>
              <th className="hidden px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 xl:table-cell xl:w-[10%] xl:px-4">
                Date prévue
              </th>
              <th className={`w-[7.5rem] ${STICKY_ACTION_HEAD}`}>Dossier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {initialPatients.map((patient) => {
              const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
              const isClosed = isClosedGlobalStatus(globalStatus)
              const pendingAction = isClosed ? null : pendingActionLabel(globalStatus, userRole)
              const shortPendingAction = isClosed
                ? null
                : getShortPendingActionLabel(globalStatus, userRole)
              const statusFullLabel = patient.workflow_statuses?.label || 'Sans statut'
              const statusShortLabel = GLOBAL_STATUS_LABELS[globalStatus] ?? statusFullLabel
              const questionnaireFullLabel = questionnaireStatusLabel(patient.questionnaire_status)
              const questionnaireShortLabel = questionnaireStatusShortLabel(patient.questionnaire_status)
              const creatorName = patient.profiles?.full_name || '—'
              const badgeGrey = isClosed ? CLOSED_DOSSIER_GREY : undefined
              return (
                <tr key={patient.id} className="group transition-colors hover:bg-gray-50">
                  <td className="px-3 py-4 lg:px-4">
                    <TruncatedCell
                      text={patient.patient_name}
                      className="font-semibold text-gray-900"
                    />
                    <TruncatedCell text={creatorName} className="mt-0.5 text-xs font-normal text-gray-400" />
                  </td>
                  <td className="px-3 py-4 lg:px-4">
                    <StatusBadge
                      label={statusShortLabel}
                      title={statusFullLabel}
                      color={badgeGrey ?? patient.workflow_statuses?.color ?? '#6B7280'}
                      size="sm"
                      nowrap
                    />
                  </td>
                  <td className="px-3 py-4 lg:px-4">
                    <StatusBadge
                      label={questionnaireShortLabel}
                      title={questionnaireFullLabel}
                      variant={isClosed ? 'neutral' : questionnaireStatusVariant(patient.questionnaire_status)}
                      color={badgeGrey}
                      size="sm"
                      nowrap
                    />
                  </td>
                  <td className="hidden px-3 py-4 lg:table-cell lg:px-4">
                    {pendingAction && shortPendingAction ? (
                      <PendingActionCell shortLabel={shortPendingAction} fullLabel={pendingAction} />
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-4 xl:table-cell xl:px-4">
                    {patient.assigned_surgeon_name ? (
                      <TruncatedCell
                        text={patient.assigned_surgeon_name}
                        className={`inline-block max-w-full rounded-full border px-2.5 py-1 text-xs font-bold ${
                          isClosed
                            ? 'border-slate-300 bg-slate-100 text-slate-600'
                            : 'border-purple-300 bg-purple-100 text-purple-900'
                        }`}
                      />
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-4 text-sm text-gray-700 xl:table-cell xl:px-4">
                    {formatQuoteAmount(patient.quote_amount)}
                  </td>
                  <td className="hidden px-3 py-4 text-sm text-gray-700 xl:table-cell xl:px-4">
                    {patient.proposed_date ? (
                      <span className={isClosed ? 'font-semibold text-slate-500' : 'font-semibold text-blue-700'}>
                        {formatDateShort(patient.proposed_date)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className={STICKY_ACTION_CELL}>
                    <Link
                      href={`/dashboard/patient/${patient.id}`}
                      className={isClosed ? DOSSIER_CLOSED_LINK_CLASS : DOSSIER_LINK_CLASS}
                    >
                      {isClosed ? 'Dossier fermé' : 'Ouvrir dossier'}
                    </Link>
                  </td>
                </tr>
              )
            })}
            {initialPatients.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <p className="font-medium text-gray-700">
                    {hasCockpitFilter
                      ? 'Aucun dossier ne correspond à ce filtre cockpit.'
                      : searchQuery
                        ? 'Aucun patient ne correspond à votre recherche.'
                        : 'Aucun dossier patient pour le moment.'}
                  </p>
                  <p className="mt-2 text-sm italic">
                    {hasCockpitFilter
                      ? 'Essayez un autre chip pipeline ou retirez le filtre « Mes actions ».'
                      : 'Créez un nouveau dossier ou modifiez vos critères de recherche.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {initialPatients.map((patient) => {
          const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
          const isClosed = isClosedGlobalStatus(globalStatus)
          const pendingAction = isClosed ? null : pendingActionLabel(globalStatus, userRole)
          const shortPendingAction = isClosed
            ? null
            : getShortPendingActionLabel(globalStatus, userRole)
          const statusFullLabel = patient.workflow_statuses?.label || 'Sans statut'
          const statusShortLabel = GLOBAL_STATUS_LABELS[globalStatus] ?? statusFullLabel
          const questionnaireFullLabel = questionnaireStatusLabel(patient.questionnaire_status)
          const questionnaireShortLabel = questionnaireStatusShortLabel(patient.questionnaire_status)
          const badgeGrey = isClosed ? CLOSED_DOSSIER_GREY : undefined
          return (
            <article
              key={patient.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-gray-900">{patient.patient_name}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {patient.profiles?.full_name || '—'} •{' '}
                    {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge
                      label={questionnaireShortLabel}
                      title={questionnaireFullLabel}
                      variant={isClosed ? 'neutral' : questionnaireStatusVariant(patient.questionnaire_status)}
                      color={badgeGrey}
                      size="sm"
                      nowrap
                    />
                  </div>
                  {pendingAction && (
                    <p
                      className="mt-2 text-xs font-bold leading-snug text-amber-900"
                      title={shortPendingAction && shortPendingAction !== pendingAction ? pendingAction : undefined}
                    >
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {pendingAction}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                    {patient.assigned_surgeon_name ? (
                      <span
                        className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 font-semibold ${
                          isClosed
                            ? 'border-slate-300 bg-slate-100 text-slate-600'
                            : 'border-purple-300 bg-purple-100 text-purple-900'
                        }`}
                        title={patient.assigned_surgeon_name}
                      >
                        {patient.assigned_surgeon_name}
                      </span>
                    ) : (
                      <span className="text-gray-400">Chirurgien : —</span>
                    )}
                    {patient.proposed_date ? (
                      <span className={isClosed ? 'font-semibold text-slate-500' : 'font-semibold text-blue-700'}>
                        Date : {formatDateShort(patient.proposed_date)}
                      </span>
                    ) : null}
                    {patient.quote_amount != null ? (
                      <span className="font-semibold text-emerald-800">
                        Budget : {formatQuoteAmount(patient.quote_amount)}
                      </span>
                    ) : null}
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
              <Link
                href={`/dashboard/patient/${patient.id}`}
                className={`mt-4 w-full ${isClosed ? DOSSIER_CLOSED_LINK_CLASS : DOSSIER_LINK_CLASS}`}
              >
                {isClosed ? 'Dossier fermé' : 'Ouvrir dossier'}
              </Link>
            </article>
          )
        })}
        {initialPatients.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
            <p className="font-medium text-gray-700">
              {hasCockpitFilter
                ? 'Aucun dossier ne correspond à ce filtre cockpit.'
                : searchQuery
                  ? 'Aucun patient ne correspond à votre recherche.'
                  : 'Aucun dossier patient pour le moment.'}
            </p>
            <p className="mt-2 text-sm italic">
              {hasCockpitFilter
                ? 'Essayez un autre chip pipeline ou retirez le filtre « Mes actions ».'
                : 'Créez un nouveau dossier ou modifiez vos critères de recherche.'}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav
          className="flex flex-wrap items-center justify-center gap-2 py-4"
          aria-label="Pagination"
        >
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
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${page === currentPage ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
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
