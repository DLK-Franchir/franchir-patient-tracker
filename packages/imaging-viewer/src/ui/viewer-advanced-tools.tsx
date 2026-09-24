'use client'

/**
 * Boutons communs (mesures, ciné, comparaison, MPR).
 * Un outil inutilisable reste visible, grisé, avec un titre qui dit pourquoi.
 */

import type { ReactNode } from 'react'
import type { MeasureKind } from '../engine-cs/geometry'

const BTN =
  'rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white transition disabled:opacity-30'

function ToolButton({
  label,
  testId,
  pressed = false,
  enabled,
  title,
  onClick,
}: {
  label: string
  testId: string
  pressed?: boolean
  enabled: boolean
  title: string
  onClick?: () => void
}) {
  const button = (
    <button
      type="button"
      disabled={!enabled}
      aria-pressed={pressed}
      title={enabled ? title : undefined}
      onClick={onClick}
      className={BTN}
      style={{
        backgroundColor: pressed && enabled ? 'rgba(56,178,172,0.35)' : 'rgba(255,255,255,0.06)',
      }}
      data-testid={testId}
    >
      {label}
    </button>
  )
  // Un bouton disabled ne reçoit pas le survol : le titre (la raison) est sur
  // le contour, sinon l’outil grisé n’explique pas pourquoi.
  if (enabled) return button
  return (
    <span title={title} className="inline-flex">
      {button}
    </span>
  )
}

export function ViewerAdvancedTools({
  measureEnabled,
  measureKind,
  onMeasure,
  measureTitle,
  afterMeasures,
  cineEnabled,
  cineOn = false,
  onCine,
  cineTitle,
  compareEnabled,
  compareOn = false,
  onCompare,
  compareTitle,
  compareExtra,
  mprEnabled,
  mprOn = false,
  onMpr,
  mprTitle,
}: {
  measureEnabled: boolean
  measureKind: MeasureKind | null
  onMeasure?: (kind: MeasureKind) => void
  measureTitle: (kind: MeasureKind) => string
  afterMeasures?: ReactNode
  cineEnabled: boolean
  cineOn?: boolean
  onCine?: () => void
  cineTitle: string
  compareEnabled: boolean
  compareOn?: boolean
  onCompare?: () => void
  compareTitle: string
  compareExtra?: ReactNode
  mprEnabled: boolean
  mprOn?: boolean
  onMpr?: () => void
  mprTitle: string
}) {
  const measure = (kind: MeasureKind, label: string, testId: string) => (
    <ToolButton
      key={kind}
      label={label}
      testId={testId}
      pressed={measureKind === kind}
      enabled={measureEnabled}
      title={measureTitle(kind)}
      onClick={() => onMeasure?.(kind)}
    />
  )

  return (
    <>
      {measure('length', 'Distance', 'dicom-tool-length')}
      {measure('angle', 'Angle', 'dicom-tool-angle')}
      {measure('cobb', 'Cobb', 'dicom-tool-cobb')}
      {afterMeasures}
      <ToolButton
        label="Ciné"
        testId="dicom-cine"
        pressed={cineOn}
        enabled={cineEnabled}
        title={cineTitle}
        onClick={onCine}
      />
      <ToolButton
        label="Comparer"
        testId="dicom-compare"
        pressed={compareOn}
        enabled={compareEnabled}
        title={compareTitle}
        onClick={onCompare}
      />
      {compareExtra}
      <ToolButton
        label="MPR"
        testId="dicom-mpr-toggle"
        pressed={mprOn}
        enabled={mprEnabled}
        title={mprTitle}
        onClick={onMpr}
      />
    </>
  )
}
