'use client'

import { Brain, FileImage } from 'lucide-react'

export type ImagingGridEmptyStateProps = {
  /** Titre principal (non-PHI). */
  title?: string
  /** Sous-texte d'aide. */
  description?: string
  /** Variante visuelle : séries DICOM vs documents génériques. */
  variant?: 'imaging' | 'documents'
  className?: string
}

/**
 * Empty state grille Imagerie — icône lisible mobile + copy claire.
 */
export function ImagingGridEmptyState({
  title = 'Aucune imagerie pour le moment',
  description = 'Les séries DICOM, PDF encapsulés et images apparaîtront ici une fois déposés.',
  variant = 'imaging',
  className = '',
}: ImagingGridEmptyStateProps) {
  const Icon = variant === 'documents' ? FileImage : Brain
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-10 text-center sm:py-12 ${className}`}
      data-testid="imaging-grid-empty"
      role="status"
    >
      <div className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-slate-100 sm:size-[4.5rem]">
        <Icon className="size-8 text-slate-400 sm:size-9" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-600 sm:text-base">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400 sm:text-sm">
        {description}
      </p>
    </div>
  )
}

export type ImagingGridLoadingStateProps = {
  /** Nombre de cartes squelette (défaut 4 — grille 2×2 mobile). */
  count?: number
  className?: string
  gridClassName?: string
}

/**
 * Squelette de chargement grille — remplace un spinner isolé peu lisible.
 */
export function ImagingGridLoadingState({
  count = 4,
  className = '',
  gridClassName = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4',
}: ImagingGridLoadingStateProps) {
  const cards = Array.from({ length: Math.max(1, count) }, (_, i) => i)
  return (
    <div
      className={className}
      data-testid="imaging-grid-loading"
      role="status"
      aria-busy="true"
      aria-label="Chargement de l'imagerie"
    >
      <div className={gridClassName}>
        {cards.map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            aria-hidden
          >
            <div className="h-28 animate-pulse bg-slate-200 sm:h-32" />
            <div className="space-y-2 px-2 py-2.5">
              <div className="mx-auto h-2.5 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="mx-auto h-2 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs font-medium text-slate-400">
        Chargement de la grille…
      </p>
    </div>
  )
}
