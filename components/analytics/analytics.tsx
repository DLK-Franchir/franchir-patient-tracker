'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function Analytics() {
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

      console.log('[Analytics] Page view:', url)
    }
  }, [pathname, searchParams])

  return null
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    plausible?: (event: string, options?: any) => void
  }
}
