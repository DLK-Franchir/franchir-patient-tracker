/**
 * Plan image courant lu dans les métadonnées Cornerstone (imagePlaneModule).
 */

import { metaData, utilities as csUtils } from '@cornerstonejs/core'
import { planeFromOrientation, type Plane, type Vec3 } from './geometry'

type ImagePlaneModule = {
  imagePositionPatient?: number[]
  imageOrientationPatient?: number[]
  usingDefaultValues?: boolean
}

export function planeFromImageId(imageId: string | undefined): Plane | null {
  if (!imageId) return null
  let plane: ImagePlaneModule | undefined
  try {
    plane = metaData.get('imagePlaneModule', imageId) as ImagePlaneModule | undefined
  } catch {
    return null
  }
  if (!plane || plane.usingDefaultValues) return null
  const position = plane.imagePositionPatient
  const orientation = plane.imageOrientationPatient
  if (!position || position.length < 3 || !orientation) return null
  const point: Vec3 = [position[0]!, position[1]!, position[2]!]
  return planeFromOrientation(point, orientation)
}

/** MPR possible seulement si Cornerstone juge la série un volume homogène. */
export function seriesSupportsMpr(imageIds: readonly string[]): boolean {
  if (imageIds.length < 3) return false
  try {
    return csUtils.isValidVolume([...imageIds])
  } catch {
    return false
  }
}
