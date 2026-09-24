import { App, AppOptions, Index, ToolConfig, ViewConfig, WindowLevel } from 'dwv'
import { hasPixelSignal } from './pixel-signal'
import { WL_PRESETS } from './policy'

function getViewController(app: App) {
  return app.getActiveLayerGroup()?.getActiveViewLayer()?.getViewController()
}

export function createDwvApp(layerGroupId: string): App {
  const app = new App()
  const viewConfig = new ViewConfig(layerGroupId)
  const options = new AppOptions({ '*': [viewConfig] })
  options.tools = {
    Scroll: new ToolConfig(),
    ZoomAndPan: new ToolConfig(),
    WindowLevel: new ToolConfig(),
  }
  app.init(options)
  return app
}

export function hasRenderableImage(app: App): boolean {
  try {
    const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer()
    if (!viewLayer) return false
    const image = app.getData(viewLayer.getDataId())?.image
    if (!image) return false
    const size = image.getGeometry().getSize()
    const width = size.get(0)
    const height = size.get(1)
    if (width <= 0 || height <= 0) return false
    // Géométrie OK ne suffit pas : on vérifie des pixels réellement décodés pour
    // ne pas marquer « prêt » un canvas noir (worker codec manquant / échec).
    return hasPixelSignal(image.getBuffer())
  } catch {
    return false
  }
}

/** Poll after dwv "load" — image pixels may lag behind the event (workers / layout). */
export function waitForRenderableImage(app: App, delaysMs: readonly number[]): Promise<boolean> {
  return new Promise(resolve => {
    let step = 0
    const tryCheck = () => {
      if (hasRenderableImage(app)) {
        resolve(true)
        return
      }
      if (step >= delaysMs.length) {
        resolve(false)
        return
      }
      window.setTimeout(tryCheck, delaysMs[step]!)
      step += 1
    }
    tryCheck()
  })
}

/**
 * Enregistre les presets HU (`WL_PRESETS`) au format attendu par dwv :
 * `{ id: { wl: [WindowLevel], name } }` — un objet `{ center, width }` nu est
 * ignoré silencieusement par `setWindowLevelPreset`.
 */
export function addWindowLevelPresets(app: App) {
  const controller = getViewController(app)
  if (!controller) return
  try {
    const presets: Record<string, { wl: WindowLevel[]; name: string }> = {}
    for (const preset of WL_PRESETS) {
      presets[preset.id] = { wl: [new WindowLevel(preset.center, preset.width)], name: preset.id }
    }
    controller.addWindowLevelPresets(presets)
  } catch {
    /* preset may fail on non-grayscale modalities */
  }
}

export function destroyDwvApp(app: App, layerGroupId: string) {
  try {
    app.abortAllLoads()
  } catch {
    /* ignore abort races during unmount */
  }
  try {
    app.reset()
  } catch {
    /* ignore teardown races during unmount */
  }
  const node = document.getElementById(layerGroupId)
  if (node) node.replaceChildren()
}

export function readSliceCount(app: App): number {
  try {
    const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer()
    if (!viewLayer) return 1
    const controller = viewLayer.getViewController()
    const image = app.getData(viewLayer.getDataId())?.image
    if (!image) return 1
    const size = image.getGeometry().getSize()
    return Math.max(1, size.get(controller.getScrollDimIndex()))
  } catch {
    return 1
  }
}

export function readSliceIndex(app: App): number | null {
  try {
    const controller = getViewController(app)
    if (!controller) return null
    return controller.getCurrentIndexScrollValue()
  } catch {
    return null
  }
}

/** Saut direct à une coupe (slider / Home / End) — mode stack. */
export function setSliceIndex(app: App, target: number): boolean {
  try {
    const controller = getViewController(app)
    if (!controller) return false
    const current = controller.getCurrentIndex()
    const values = current.getValues().slice()
    const scrollDim = controller.getScrollDimIndex()
    const max = Math.max(0, readSliceCount(app) - 1)
    values[scrollDim] = Math.max(0, Math.min(max, Math.round(target)))
    return controller.setCurrentIndex(new Index(values))
  } catch {
    return false
  }
}

/** W/L courant de la vue active (`null` si pas d'image). */
export function readWindowLevel(app: App): { center: number; width: number } | null {
  try {
    const controller = getViewController(app)
    if (!controller) return null
    const wl = controller.getWindowLevel()
    if (!wl) return null
    return { center: wl.center, width: wl.width }
  } catch {
    return null
  }
}

/** Modality DICOM de l'image active (`null` si indisponible). */
export function readModality(app: App): string | null {
  try {
    const controller = getViewController(app)
    const modality = controller?.getModality()
    return modality && modality.trim().length > 0 ? modality.trim().toUpperCase() : null
  } catch {
    return null
  }
}

/** Retour au fenêtrage DICOM initial (WindowCenter/Width du fichier). */
export function resetWindowLevel(app: App): void {
  try {
    getViewController(app)?.resetWindowLevel()
  } catch {
    /* pas de vue */
  }
}

/**
 * Inverse la LUT (plain ↔ invPlain). dwv gère déjà MONOCHROME1 via la colour
 * map initiale : on bascule depuis la valeur courante plutôt que d'imposer.
 */
export function toggleInvert(app: App): boolean | null {
  try {
    const controller = getViewController(app)
    if (!controller) return null
    const current = controller.getColourMap()
    const inverted = current !== 'invPlain'
    controller.setColourMap(inverted ? 'invPlain' : 'plain')
    return inverted
  } catch {
    return null
  }
}

/** Miroir horizontal / vertical de la couche active. */
export function flipViewLayer(app: App, axis: 'x' | 'y'): void {
  try {
    const layerGroup = app.getActiveLayerGroup()
    const viewLayer = layerGroup?.getActiveViewLayer()
    if (!layerGroup || !viewLayer) return
    if (axis === 'x') viewLayer.flipScaleX()
    else viewLayer.flipScaleY()
    layerGroup.draw()
  } catch {
    /* couche pas prête */
  }
}
