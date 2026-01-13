import Image from 'next/image'
import Link from 'next/link'

export default function FranchirHeader() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <Image
                src="https://franchir.eu/wp-content/uploads/2025/06/Franchir_Logo_3@4x-scaled.png"
                alt="FRANCHIR"
                width={120}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </Link>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-[#0066CC] transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour au tableau
          </Link>
        </div>
      </div>
    </header>
  )
}
