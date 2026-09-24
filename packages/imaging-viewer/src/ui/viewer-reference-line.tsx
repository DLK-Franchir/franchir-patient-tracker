'use client'

/**
 * Ligne de référence : intersection du plan de coupe courant avec celui
 * de l'autre viewport (comparaison). Rien si les plans sont parallèles
 * ou si l'orientation patient manque (radio, JPEG sans géométrie).
 */

import { useEffect, useState } from 'react'
import { Enums as csEnums } from '@cornerstonejs/core'
import type { RefObject } from 'react'
import type { CsStackHandle } from '../engine-cs/stack'
import { planeIntersectionSegment } from '../engine-cs/geometry'
import { planeFromImageId } from '../engine-cs/reference'

const EXTENT_MM = 400

export function ViewerReferenceLine({
  elementRef,
  handleRef,
  otherHandleRef,
}: {
  elementRef: RefObject<HTMLDivElement | null>
  handleRef: RefObject<CsStackHandle | null>
  otherHandleRef: RefObject<CsStackHandle | null>
}) {
  const [segment, setSegment] = useState<
    [{ x: number; y: number }, { x: number; y: number }] | null
  >(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const update = () => {
      const self = handleRef.current
      const other = otherHandleRef.current
      if (!self || !other) {
        setSegment(null)
        return
      }
      let selfId: string | undefined
      let otherId: string | undefined
      try {
        selfId = self.viewport.getCurrentImageId()
        otherId = other.viewport.getCurrentImageId()
      } catch {
        setSegment(null)
        return
      }
      const planeA = planeFromImageId(selfId)
      const planeB = planeFromImageId(otherId)
      if (!planeA || !planeB) {
        setSegment(null)
        return
      }
      const world = planeIntersectionSegment(planeA, planeB, EXTENT_MM)
      if (!world) {
        setSegment(null)
        return
      }
      try {
        const p = self.viewport.worldToCanvas([world[0][0], world[0][1], world[0][2]])
        const q = self.viewport.worldToCanvas([world[1][0], world[1][1], world[1][2]])
        setSegment([
          { x: p[0], y: p[1] },
          { x: q[0], y: q[1] },
        ])
      } catch {
        setSegment(null)
      }
    }
    element.addEventListener(csEnums.Events.IMAGE_RENDERED, update)
    update()
    return () => element.removeEventListener(csEnums.Events.IMAGE_RENDERED, update)
  }, [elementRef, handleRef, otherHandleRef])

  if (!segment) return null
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      data-testid="dicom-reference-line"
    >
      <line
        x1={segment[0].x}
        y1={segment[0].y}
        x2={segment[1].x}
        y2={segment[1].y}
        stroke="#F6C453"
        strokeWidth={1.5}
      />
    </svg>
  )
}
