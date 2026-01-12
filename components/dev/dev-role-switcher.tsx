'use client'

import { useState } from 'react'

const ROLES = [
  { label: 'Marcel (Coordinateur)', value: 'marcel' },
  { label: 'Franchir France', value: 'franchir' },
  { label: 'Dr Gilles Dubois', value: 'gilles' },
  { label: 'Admin', value: 'admin' },
]

export default function DevRoleSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const switchRole = async (role: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/dev/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      const data = await res.json()

      if (res.ok) {
        console.log('✅ Role switched to:', role, data)
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        console.error('❌ Failed to switch role:', data)
        alert(`Erreur: ${data.error}`)
        setLoading(false)
      }
    } catch (error) {
      console.error('❌ Error switching role:', error)
      alert('Erreur lors du changement de rôle')
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg shadow-lg text-sm"
      >
        🔧 DEV
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-white border-2 border-gray-800 rounded-lg shadow-xl p-3 min-w-[280px]">
          <div className="text-xs font-bold text-gray-800 mb-2 px-2">
            Switch Role (UI uniquement):
          </div>
          <div className="text-xs text-gray-600 mb-3 px-2 bg-yellow-50 p-2 rounded border border-yellow-200">
            ⚠️ Change seulement les permissions UI. Pour tester les notifications, connectez-vous avec un autre compte.
          </div>
          {ROLES.map((r) => (
            <button
              key={r.value}
              disabled={loading}
              onClick={() => switchRole(r.value)}
              className="block w-full text-left px-3 py-2 text-sm text-gray-900 font-medium rounded hover:bg-blue-500 hover:text-white transition disabled:opacity-50 mb-1"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
