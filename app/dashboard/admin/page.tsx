import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile } from '@/lib/access-control'
import { type Role } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/app-header'
import NotificationBell from '@/components/notifications/notification-bell'
import {
  queryWorkflowStatuses,
  queryAdminPatients,
  SORT_COLUMNS,
  SORT_DIRECTIONS,
  type SortColumn,
  type SortDirection,
  type WorkflowStatusOption,
  type AdminPatientRow,
} from '@/lib/queries/patients'
import Link from 'next/link'

const ITEMS_PER_PAGE = 20

type AdminSearchParams = {
  page?: string
  q?: string
  status?: string | string[]
  sort?: string
  dir?: string
}

function normalizePage(page: string | undefined): number {
  const v = Number.parseInt(page || '1', 10)
  return Number.isFinite(v) && v > 0 ? v : 1
}

function normalizeStatuses(status: string | string[] | undefined): string[] {
  const values = Array.isArray(status) ? status : status ? [status] : []
  return values
    .flatMap(v => v.split(','))
    .map(v => v.trim())
    .filter(Boolean)
}

function normalizeSort(sort: string | undefined): SortColumn {
  return SORT_COLUMNS.includes(sort as SortColumn)
    ? (sort as SortColumn)
    : ('updated_at' as SortColumn)
}

function normalizeDirection(dir: string | undefined): SortDirection {
  return SORT_DIRECTIONS.includes(dir as SortDirection) ? (dir as SortDirection) : 'desc'
}

function StatusBadge({ status }: { status: WorkflowStatusOption | null }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${status.color}22`, color: status.color }}
    >
      {status.label}
    </span>
  )
}

function AdminPatientTable({ patients }: { patients: AdminPatientRow[] }) {
  if (patients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-sm text-gray-500">
        Aucun dossier trouvé.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Patient</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Statut</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Créé par</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Dernière activité</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {patients.map(patient => (
            <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{patient.patient_name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={patient.workflow_statuses} />
              </td>
              <td className="px-4 py-3 text-gray-600">
                {patient.profiles?.full_name ?? '—'}
                {patient.profiles?.role && (
                  <span className="ml-1 text-xs text-gray-400">({patient.profiles.role})</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(patient.updated_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/patient/${patient.id}`}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Ouvrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number
  totalPages: number
  searchParams: AdminSearchParams
}) {
  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (searchParams.q) params.set('q', searchParams.q)
    if (searchParams.status) {
      const s = Array.isArray(searchParams.status)
        ? searchParams.status.join(',')
        : searchParams.status
      params.set('status', s)
    }
    if (searchParams.sort) params.set('sort', searchParams.sort)
    if (searchParams.dir) params.set('dir', searchParams.dir)
    params.set('page', String(p))
    return `/dashboard/admin?${params.toString()}`
  }

  if (totalPages <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
      <span>
        Page {currentPage} / {totalPages}
      </span>
      <div className="flex gap-2">
        {currentPage > 1 && (
          <Link
            href={pageUrl(currentPage - 1)}
            className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-50"
          >
            Précédent
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={pageUrl(currentPage + 1)}
            className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-50"
          >
            Suivant
          </Link>
        )}
      </div>
    </div>
  )
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>
}) {
  const supabase = await createServerClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!isStaffProfile(profile) || profile?.role !== 'admin') {
    redirect('/dashboard?error=unauthorized')
  }

  const userRole = profile?.role as Role

  const currentPage = normalizePage(params.page)
  const searchQuery = (params.q || '').trim()
  const selectedStatuses = normalizeStatuses(params.status)
  const sort = normalizeSort(params.sort)
  const direction = normalizeDirection(params.dir)

  const statusOptions = await queryWorkflowStatuses()
  const { patients, total } = await queryAdminPatients({
    page: currentPage,
    query: searchQuery,
    statuses: selectedStatuses,
    sort,
    direction,
    statusOptions,
  })

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))

  return (
    <>
      <AppHeader userRole={userRole} userName={profile?.full_name} showActions={true} />
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <nav className="mb-2 text-sm text-gray-500" aria-label="Fil d'Ariane">
                <Link href="/dashboard" className="hover:text-gray-700">
                  Tableau de bord
                </Link>
                <span className="mx-2">/</span>
                <span className="font-medium text-gray-700">Administration</span>
              </nav>
              <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
                Vue Admin — Tous les dossiers
              </h1>
              <p className="mt-1 text-xs text-gray-600 sm:text-sm">
                Connecté : {profile?.full_name} -{' '}
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {userRole}
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {total} dossier{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
            </div>
          </div>

          <form method="GET" action="/dashboard/admin" className="mb-6 flex flex-wrap gap-3">
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Rechercher un patient…"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              name="status"
              defaultValue={selectedStatuses[0] ?? ''}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Tous les statuts</option>
              {statusOptions.map(s => (
                <option key={s.id} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="updated_at">Dernière activité</option>
              <option value="created_at">Date de création</option>
              <option value="patient_name">Nom</option>
              <option value="current_status_id">Statut</option>
            </select>
            <select
              name="dir"
              defaultValue={direction}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="desc">Décroissant</option>
              <option value="asc">Croissant</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Filtrer
            </button>
          </form>

          <AdminPatientTable patients={patients} />
          <Pagination currentPage={currentPage} totalPages={totalPages} searchParams={params} />
        </div>
      </div>
    </>
  )
}
