'use client'

/**
 * Calque SVG des mesures (longueur, angle, Cobb) — non persisté.
 * Les coordonnées sont déjà projetées en pixels du viewport.
 */

import { useState } from 'react'
import type { MeasureKind } from '../engine-cs/geometry'

export type ProjectedPoint = { x: number; y: number }

export type ProjectedAnnotation = {
  id: string
  kind: MeasureKind
  points: ProjectedPoint[]
  label: string | null
}

const STROKE = '#7EE0DB'

function polyline(points: ProjectedPoint[], close = false) {
  const d = points.map(p => `${p.x},${p.y}`).join(' ')
  return close ? `${d} ${points[0]?.x ?? 0},${points[0]?.y ?? 0}` : d
}

export function ViewerMeasureLayer({
  active,
  annotations,
  draft,
  onPlace,
}: {
  active: boolean
  annotations: ProjectedAnnotation[]
  draft: ProjectedPoint[]
  onPlace: (clientX: number, clientY: number) => void
}) {
  const [cursor, setCursor] = useState<ProjectedPoint | null>(null)
  const rubber = cursor && draft.length > 0 ? [...draft, cursor] : draft

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: active ? 'auto' : 'none' }}
      data-testid="dicom-measure-layer"
      onPointerMove={event => {
        if (!active) return
        const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
        setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      }}
      onPointerLeave={() => setCursor(null)}
      onPointerDown={event => {
        if (!active || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        onPlace(event.clientX, event.clientY)
      }}
    >
      {annotations.map(annotation => (
        <g key={annotation.id} data-testid={`dicom-measure-${annotation.kind}`}>
          {annotation.kind === 'cobb' && annotation.points.length >= 4 ? (
            <>
              <line
                x1={annotation.points[0]!.x}
                y1={annotation.points[0]!.y}
                x2={annotation.points[1]!.x}
                y2={annotation.points[1]!.y}
                stroke={STROKE}
                strokeWidth={2}
              />
              <line
                x1={annotation.points[2]!.x}
                y1={annotation.points[2]!.y}
                x2={annotation.points[3]!.x}
                y2={annotation.points[3]!.y}
                stroke={STROKE}
                strokeWidth={2}
              />
            </>
          ) : (
            <polyline
              points={polyline(annotation.points)}
              fill="none"
              stroke={STROKE}
              strokeWidth={2}
            />
          )}
          {annotation.points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={3.5} fill={STROKE} />
          ))}
          {annotation.label && annotation.points.length > 0 ? (
            <text
              x={annotation.points[annotation.points.length - 1]!.x + 8}
              y={annotation.points[annotation.points.length - 1]!.y - 8}
              fill="#FFFFFF"
              fontSize={12}
              fontWeight={600}
            >
              {annotation.label}
            </text>
          ) : null}
        </g>
      ))}
      {draft.map((point, index) => (
        <circle key={`draft-${index}`} cx={point.x} cy={point.y} r={3.5} fill={STROKE} />
      ))}
      {rubber.length > 1 ? (
        <polyline
          points={polyline(rubber)}
          fill="none"
          stroke={STROKE}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}
    </svg>
  )
}
