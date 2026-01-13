'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, LogOut, Plus } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface AppHeaderProps {
  userRole?: string
  userName?: string
  showActions?: boolean
}

export default function AppHeader({ userRole, userName, showActions = false }: AppHeaderProps) {
  const pathname = usePathname()
  const isPatientPage = pathname?.includes('/dashboard/patient/')
  const canCreatePatient = userRole === 'marcel' || userRole === 'admin' || userRole === 'franchir'

  const handleLogout = async () => {
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <Image
                src="https://franchir.eu/wp-content/uploads/2025/06/Franchir_Logo_3@4x-scaled.png"
                alt="FRANCHIR"
                width={140}
                height={45}
                className="h-11 w-auto"
                priority
              />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {isPatientPage && (
              <Link
                href="/dashboard"
                className="text-sm text-gray-700 hover:text-[#2563EB] transition flex items-center gap-2 font-medium px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour au tableau
              </Link>
            )}

            {showActions && canCreatePatient && (
              <Link
                href="/dashboard/new"
                className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#1d4ed8] shadow-sm transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouveau Patient
              </Link>
            )}

            {showActions && (
              <button
                onClick={handleLogout}
                className="text-sm text-gray-700 hover:text-red-600 transition flex items-center gap-2 font-medium px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
