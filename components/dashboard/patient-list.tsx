'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Patient = {
  id: string
  patient_name: string
  created_at: string
  workflow_statuses: { label: string; color: string } | null
  profiles: { full_name: string } | null
}

export default function PatientList({
  initialPatients,
  hasMore,
  currentPage,
}: {
  initialPatients: Patient[]
  hasMore: boolean
  currentPage: number
}) {
  const [patients, setPatients] = useState<Patient[]>(initialPatients)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(currentPage)
  const observerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading])

  const loadMore = async () => {
    if (loading) return
    setLoading(true)

    const nextPage = page + 1
    router.push(`/dashboard?page=${nextPage}`, { scroll: false })
    setPage(nextPage)
    setLoading(false)
  }

  return (
    <>
      <div className="hidden md:block bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Patient</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Statut</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Créé par</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {patients.map((patient) => (
              <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{patient.patient_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span 
                    className="px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: patient.workflow_statuses?.color || '#6B7280' }}
                  >
                    {patient.workflow_statuses?.label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.profiles?.full_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link 
                    href={`/dashboard/patient/${patient.id}`} 
                    className="text-[#2563EB] hover:text-[#1d4ed8] bg-blue-50 px-3 py-2 rounded-md font-medium transition"
                  >
                    Voir dossier →
                  </Link>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                  Aucun dossier patient pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {patients.map((patient) => (
          <Link
            key={patient.id}
            href={`/dashboard/patient/${patient.id}`}
            className="block bg-white shadow-sm border border-gray-200 rounded-xl p-4 hover:shadow-md transition active:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{patient.patient_name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {patient.profiles?.full_name} • {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <span 
                className="px-2.5 py-1 rounded-full text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: patient.workflow_statuses?.color || '#6B7280' }}
              >
                {patient.workflow_statuses?.label}
              </span>
            </div>
          </Link>
        ))}
        {patients.length === 0 && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 text-center text-gray-500 italic">
            Aucun dossier patient pour le moment.
          </div>
        )}
      </div>

      {hasMore && (
        <div ref={observerRef} className="flex justify-center py-8">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : (
            <button
              onClick={loadMore}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Charger plus
            </button>
          )}
        </div>
      )}
    </>
  )
}
