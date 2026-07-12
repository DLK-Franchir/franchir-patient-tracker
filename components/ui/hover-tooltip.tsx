'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type HoverTooltipProps = {
  content: string
  children: ReactNode
  /** Désactive le tooltip (ex. libellé identique au texte visible). */
  disabled?: boolean
}

export function HoverTooltip({ content, children, disabled = false }: HoverTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const show = useCallback((target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
    setVisible(true)
  }, [])

  if (disabled || !content.trim()) {
    return <>{children}</>
  }

  return (
    <>
      <span
        className="inline-flex max-w-full min-w-0"
        onMouseEnter={(event) => show(event.currentTarget)}
        onMouseLeave={() => setVisible(false)}
        onFocus={(event) => show(event.currentTarget)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {visible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y - 6,
              transform: 'translate(-50%, -100%)',
            }}
            className="pointer-events-none z-[9999] max-w-xs rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
