'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type SortColumn = 'created_at' | 'patient_name' | 'current_status_id'
type SortDirection = 'asc' | 'desc'

type Patient = {
  id: string
  patient_name: string
  created_at: string
  workflow_statuses: { id: string; code: string; label: string; color: string } | null
  profiles: { full_name: string } | null
}

type StatusOption = {
  id: string
  code: string
  label: string
  color: string
}

type PatientListProps = {
  initialPatients: Patient[]
  total: number
  totalPages: number
  currentPage: number
  itemsPerPage: number
  searchQuery: string
  selectedStatuses: string[]
  statusOptions: StatusOption[]
  sort: SortColumn
  direction: SortDirection
}

export default function PatientList({
  initialPatients,
  total,
  totalPages,
  currentPage,
  itemsPerPage,
  searchQuery,
  selectedStatuses,
  statusOptions,
  sort,
  direction,
}: PatientListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchQuery)
  const [statusCodes, setStatusCodes] = useState<string[]>(selectedStatuses)
  const [isPending, startTransition] = useTransition()

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
      updates.status?.forEach(status => params.append('status', status))
    }
    if (updates.sort) params.set('sort', updates.sort)
    if (updates.dir) params.set('dir', updates.dir)

    return `/dashboard?${params.toString()}`
  }

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => {
      router.push(buildUrl({ page: 1, q: query.trim(), status: statusCodes }))
    })
  }

  const resetFilters = () => {
    setQuery('')
    setStatusCodes([])
    startTransition(() => {
      router.push('/dashboard')
    })
  }

  const toggleStatus = (code: string) => {
    setStatusCodes(current =>
      current.includes(code) ? current.filter(value => value !== code) : [...current, code]
    )
  }

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
                onChange={event => setQuery(event.target.value)}
                placeholder="Nom du patient"
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-gray-700">
                Filtrer par statut
              </legend>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(status => {
                  const checked = statusCodes.includes(status.code)
                  return (
                    <label
                      key={status.id}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                        checked
                          ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStatus(status.code)}
                        className="sr-only"
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.label}
                    </label>
                  )
                })}
              </div>
            </fieldset>
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

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                <button
                  type="button"
                  onClick={() => sortBy('patient_name')}
                  className="inline-flex items-center gap-1 hover:text-[#2563EB]"
                >
                  Patient {sortIndicator('patient_name')}
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                <button
                  type="button"
                  onClick={() => sortBy('current_status_id')}
                  className="inline-flex items-center gap-1 hover:text-[#2563EB]"
                >
                  Statut {sortIndicator('current_status_id')}
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                Créé par
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                <button
                  type="button"
                  onClick={() => sortBy('created_at')}
                  className="inline-flex items-center gap-1 hover:text-[#2563EB]"
                >
                  Date {sortIndicator('created_at')}
                </button>
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {initialPatients.map(patient => (
              <tr key={patient.id} className="transition-colors hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                  {patient.patient_name}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: patient.workflow_statuses?.color || '#6B7280' }}
                  >
                    {patient.workflow_statuses?.label || 'Sans statut'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                  {patient.profiles?.full_name || 'Non renseigné'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <Link
                    href={`/dashboard/patient/${patient.id}`}
                    className="rounded-md bg-blue-50 px-3 py-2 font-medium text-[#2563EB] transition hover:text-[#1d4ed8]"
                  >
                    Voir dossier →
                  </Link>
                </td>
              </tr>
            ))}
            {initialPatients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                  Aucun dossier patient ne correspond aux critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {initialPatients.map(patient => (
          <Link
            key={patient.id}
            href={`/dashboard/patient/${patient.id}`}
            className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md active:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-gray-900">{patient.patient_name}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {patient.profiles?.full_name || 'Non renseigné'} •{' '}
                  {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: patient.workflow_statuses?.color || '#6B7280' }}
              >
                {patient.workflow_statuses?.label || 'Sans statut'}
              </span>
            </div>
          </Link>
        ))}
        {initialPatients.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 italic shadow-sm">
            Aucun dossier patient ne correspond aux critères.
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
          {pages.map(page => (
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
