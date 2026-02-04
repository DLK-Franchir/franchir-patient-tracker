'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function AnalyticsContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')

      if (window.gtag) {
        window.gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
          page_path: url,
        })
      }

      if (window.plausible) {
        window.plausible('pageview', { props: { path: url } })
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Page view:', url)
      }
    }
  }, [pathname, searchParams])

  return null
}

export function Analytics() {
  return (
    <Suspense fallback={null}>
      <AnalyticsContent />
    </Suspense>
  )
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    plausible?: (event: string, options?: any) => void
  }
}
