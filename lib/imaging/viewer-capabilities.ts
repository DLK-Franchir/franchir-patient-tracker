/**
 * Adapter capabilities Imaging — SoT `@franchir/imaging-viewer`.
 * `mp4Native` via `isMp4ViewerEnabled` (`NEXT_PUBLIC_ENABLE_MP4_VIEWER` ou
 * alias `NEXT_PUBLIC_MP4_VIEWER=1` ; preview / dev). Parité clinicien Q.
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
