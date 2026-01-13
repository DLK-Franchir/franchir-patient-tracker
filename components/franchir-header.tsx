import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function FranchirHeader() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
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
            className="text-sm text-gray-600 hover:text-[#2563EB] transition flex items-center gap-2 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau
          </Link>
        </div>
      </div>
    </header>
  )
}
