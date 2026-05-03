'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, LogOut, Plus, Menu, X, LayoutDashboard } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface AppHeaderProps {
  userRole?: string
  userName?: string
  showActions?: boolean
}

export default function AppHeader({ userRole, userName, showActions = false }: AppHeaderProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isPatientPage = pathname?.includes('/dashboard/patient/')
  const isDashboardPage = pathname === '/dashboard'
  const isNewPatientPage = pathname === '/dashboard/new'
  const canCreatePatient = userRole === 'marcel' || userRole === 'admin' || userRole === 'franchir'

  const handleLogout = async () => {
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 hover:opacity-80 transition"
              aria-label="Retour au tableau de bord"
            >
              <Image
                src="https://franchir.eu/wp-content/uploads/2025/06/Franchir_Logo_3@4x-scaled.png"
                alt="FRANCHIR"
                width={140}
                height={45}
                className="h-8 sm:h-11 w-auto"
                priority
              />
            </Link>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            {showActions && userName && (
              <span className="hidden text-sm font-medium text-gray-600 lg:inline">{userName}</span>
            )}

            {showActions && (
              <Link
                href="/dashboard"
                aria-current={isDashboardPage ? 'page' : undefined}
                className={`text-sm transition flex items-center gap-2 font-medium px-3 py-2 rounded-lg ${
                  isDashboardPage
                    ? 'bg-blue-50 text-[#2563EB]'
                    : 'text-gray-700 hover:text-[#2563EB] hover:bg-gray-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Tableau
              </Link>
            )}

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
                aria-current={isNewPatientPage ? 'page' : undefined}
                className={`bg-[#2563EB] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#1d4ed8] shadow-sm transition-all flex items-center gap-2 ${
                  isNewPatientPage ? 'ring-2 ring-blue-200' : ''
                }`}
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

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition"
            aria-expanded={mobileMenuOpen}
            aria-label="Ouvrir le menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200 py-3 space-y-2">
            {showActions && userName && (
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {userName}
              </p>
            )}

            {showActions && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isDashboardPage ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${
                  isDashboardPage ? 'bg-blue-50 text-[#2563EB]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Tableau
              </Link>
            )}

            {isPatientPage && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Retour au tableau
              </Link>
            )}

            {showActions && canCreatePatient && (
              <Link
                href="/dashboard/new"
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isNewPatientPage ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg font-medium ${
                  isNewPatientPage ? 'bg-[#1d4ed8] text-white' : 'bg-[#2563EB] text-white'
                }`}
              >
                <Plus className="w-5 h-5" />
                Nouveau Patient
              </Link>
            )}

            {showActions && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                Déconnexion
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
