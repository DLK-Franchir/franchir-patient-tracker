'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, LogOut, Plus, Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { B, brandTypography } from '@/lib/brand-tokens'
import { FranchirMarkNav } from '@/components/franchir-mark-nav'
import NotificationBell from '@/components/notifications/notification-bell'

interface AppHeaderProps {
  userRole?: string
  userName?: string
  patientName?: string
  showActions?: boolean
}

export default function AppHeader({
  userRole,
  patientName,
  showActions = false,
}: AppHeaderProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isPatientPage = pathname?.includes('/dashboard/patient/')
  const canCreatePatient = userRole === 'marcel' || userRole === 'admin' || userRole === 'franchir'

  const handleLogout = async () => {
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/login'
  }

  const headerControlClass =
    'flex items-center justify-center rounded-xl transition-colors min-w-[36px] min-h-[36px]'
  const headerControlStyle = { background: 'rgba(255,255,255,0.1)' }

  return (
    <header
      className="sticky top-0 z-50 shadow-lg"
      style={{ background: B.navy }}
    >
      <div className="mx-auto flex h-[58px] max-w-[1400px] items-center justify-between gap-4 px-5">
        {/* Brand mark + breadcrumb */}
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="flex flex-shrink-0 items-center gap-2.5 hover:opacity-90">
            <FranchirMarkNav size={30} />
            <span
              className="hidden text-[18px] font-extrabold tracking-[0.04em] text-white sm:inline"
              style={{ fontFamily: brandTypography.display }}
            >
              FRANCHIR
            </span>
          </Link>

          <div className="hidden items-center gap-2 sm:flex">
            <ChevronRight size={13} className="text-white/30" />
            {isPatientPage && patientName ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-[14px] text-white/55 transition-colors hover:text-white"
                >
                  Tableau de suivi
                </Link>
                <ChevronRight size={13} className="text-white/30" />
                <span className="max-w-[200px] truncate text-[14px] font-semibold text-white/90">
                  {patientName}
                </span>
              </>
            ) : (
              <span className="text-[14px] text-white/55">Tableau de suivi</span>
            )}
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2.5 sm:flex">
          {showActions && <NotificationBell onDark />}

          {showActions && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Déconnexion"
              className={headerControlClass}
              style={headerControlStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              }}
            >
              <LogOut size={16} className="text-white" />
            </button>
          )}

          {showActions && canCreatePatient && (
            <Link
              href="/dashboard/new"
              className="hidden items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-bold text-white shadow-md transition-colors sm:flex"
              style={{ background: B.coral }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = B.coralDark
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = B.coral
              }}
            >
              <Plus size={15} />
              Nouveau patient
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`${headerControlClass} sm:hidden`}
          style={headerControlStyle}
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5 text-white" />
          ) : (
            <Menu className="h-5 w-5 text-white" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          className="border-t px-5 py-3 sm:hidden"
          style={{ borderColor: 'rgba(255,255,255,0.12)', background: B.navyDark }}
        >
          <div className="space-y-2">
            {isPatientPage && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-white/80 transition hover:bg-white/10"
              >
                Tableau de suivi
              </Link>
            )}

            {isPatientPage && patientName && (
              <p className="truncate px-3 text-sm font-semibold text-white">{patientName}</p>
            )}

            {showActions && (
              <div className="flex items-center gap-3 px-3 py-2">
                <NotificationBell onDark />
                <span className="text-sm text-white/70">Notifications</span>
              </div>
            )}

            {showActions && canCreatePatient && (
              <Link
                href="/dashboard/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 font-medium text-white transition"
                style={{ background: B.coral }}
              >
                <Plus className="h-5 w-5" />
                Nouveau patient
              </Link>
            )}

            {showActions && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-white/90 transition hover:bg-white/10"
              >
                <LogOut className="h-5 w-5" />
                Déconnexion
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
