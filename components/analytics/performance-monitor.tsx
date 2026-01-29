'use client'

import { useEffect } from 'react'

export function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    const vitalsUrl = '/api/vitals'

    const reportMetric = (metric: any) => {
      const body = JSON.stringify(metric)
      
      if (navigator.sendBeacon) {
        navigator.sendBeacon(vitalsUrl, body)
      } else {
        fetch(vitalsUrl, {
          body,
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        }).catch(console.error)
      }
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            reportMetric({
              name: 'TTFB',
              value: navEntry.responseStart - navEntry.requestStart,
              rating: navEntry.responseStart - navEntry.requestStart < 600 ? 'good' : 'poor',
            })
          }

          if (entry.entryType === 'largest-contentful-paint') {
            const lcpEntry = entry as PerformanceEntry
            reportMetric({
              name: 'LCP',
              value: lcpEntry.startTime,
              rating: lcpEntry.startTime < 2500 ? 'good' : lcpEntry.startTime < 4000 ? 'needs-improvement' : 'poor',
            })
          }

          if (entry.entryType === 'first-input') {
            const fidEntry = entry as PerformanceEventTiming
            reportMetric({
              name: 'FID',
              value: fidEntry.processingStart - fidEntry.startTime,
              rating: (fidEntry.processingStart - fidEntry.startTime) < 100 ? 'good' : 'poor',
            })
          }

          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            const clsEntry = entry as LayoutShift
            reportMetric({
              name: 'CLS',
              value: clsEntry.value,
              rating: clsEntry.value < 0.1 ? 'good' : clsEntry.value < 0.25 ? 'needs-improvement' : 'poor',
            })
          }
        }
      })

      observer.observe({ 
        entryTypes: ['navigation', 'largest-contentful-paint', 'first-input', 'layout-shift'] 
      })

      return () => observer.disconnect()
    } catch (error) {
      console.error('[PerformanceMonitor] Error:', error)
    }
  }, [])

  return null
}

interface LayoutShift extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}
