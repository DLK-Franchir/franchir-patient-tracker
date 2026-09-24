/**
 * Moteur visionneuse DICOM (U1) — Marcel + clinicien (parité via
 * `getAppViewerCapabilities`).
 *
 * `NEXT_PUBLIC_IMAGING_ENGINE=cornerstone` (alias `cs`) active Cornerstone3D ;
 * toute autre valeur / absence → `dwv` (défaut package). Pas d'auto-enable en
 * preview : le flip est explicite par environnement Vercel, comme `mp4Native`
 * en prod. Voir `docs/ops/IMAGING_ADAPTERS.md`.
 */

import { parseViewerEngine, type ViewerEngine } from '@franchir/imaging-viewer'

export function getImagingEngine(): ViewerEngine {
  return parseViewerEngine(process.env.NEXT_PUBLIC_IMAGING_ENGINE) ?? 'dwv'
}
