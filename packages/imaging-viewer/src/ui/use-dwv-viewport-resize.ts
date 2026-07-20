'use client'

import { useEffect, type RefObject } from 'react'
import type { App } from 'dwv'
import { refreshDwvLayout } from '../layout'

/**
 * Maintient le canvas dwv dimensionné quand le viewport / surface change.
 * Partagé tracker ↔ questionnaires (host React).
 */
export function useDwvViewportResize(
  surfaceRef: RefObject<HTMLDivElement | null>,
  appRef: RefObject<App | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return
    const surface = surfaceRef.current
    if (!surface) return

    const onResize = () => {
      const app = appRef.current
      if (!app) return
      refreshDwvLayout(app)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    ro?.observe(surface)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      ro?.disconnect()
    }
  }, [active, surfaceRef, appRef])
}
