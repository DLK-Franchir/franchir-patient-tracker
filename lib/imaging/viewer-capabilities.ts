/**
 * Adapter capabilities Imaging — SoT `@franchir/imaging-viewer`.
 * MP4 staging via `NEXT_PUBLIC_ENABLE_MP4_VIEWER` (voir `lib/features/mp4-viewer`).
 */
import {
  resolveViewerCapabilities,
  type ViewerCapabilities,
} from '@franchir/imaging-viewer'
import { isMp4ViewerEnabled } from '@/lib/features/mp4-viewer'

export function getAppViewerCapabilities(): ViewerCapabilities {
  return resolveViewerCapabilities({
    mp4Native: isMp4ViewerEnabled(),
  })
}
