import { App, AppOptions, ToolConfig, ViewConfig } from "dwv";
import { hasPixelSignal } from "@/lib/imaging/dicom-pixel-signal";

export function createDwvApp(layerGroupId: string): App {
  const app = new App();
  const viewConfig = new ViewConfig(layerGroupId);
  const options = new AppOptions({ "*": [viewConfig] });
  options.tools = {
    Scroll: new ToolConfig(),
    ZoomAndPan: new ToolConfig(),
    WindowLevel: new ToolConfig(),
  };
  app.init(options);
  return app;
}

export function hasRenderableImage(app: App): boolean {
  try {
    const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer();
    if (!viewLayer) return false;
    const image = app.getData(viewLayer.getDataId())?.image;
    if (!image) return false;
    const size = image.getGeometry().getSize();
    const width = size.get(0);
    const height = size.get(1);
    if (width <= 0 || height <= 0) return false;
    // Géométrie OK ne suffit pas : on vérifie des pixels réellement décodés pour
    // ne pas marquer « prêt » un canvas noir (worker codec manquant / échec).
    return hasPixelSignal(image.getBuffer());
  } catch {
    return false;
  }
}

/** Poll after dwv "load" — image pixels may lag behind the event (workers / layout). */
export function waitForRenderableImage(
  app: App,
  delaysMs: readonly number[],
): Promise<boolean> {
  return new Promise((resolve) => {
    let step = 0;
    const tryCheck = () => {
      if (hasRenderableImage(app)) {
        resolve(true);
        return;
      }
      if (step >= delaysMs.length) {
        resolve(false);
        return;
      }
      window.setTimeout(tryCheck, delaysMs[step]!);
      step += 1;
    };
    tryCheck();
  });
}

export function addWindowLevelPresets(app: App) {
  const controller = app.getActiveLayerGroup()?.getActiveViewLayer()?.getViewController();
  if (!controller) return;
  try {
    controller.addWindowLevelPresets({
      soft: { center: 40, width: 400 },
      bone: { center: 300, width: 1500 },
      brain: { center: 40, width: 80 },
    });
  } catch {
    /* preset may fail on non-grayscale modalities */
  }
}

export function destroyDwvApp(app: App, layerGroupId: string) {
  try {
    app.abortAllLoads();
  } catch {
    /* ignore abort races during unmount */
  }
  try {
    app.reset();
  } catch {
    /* ignore teardown races during unmount */
  }
  const node = document.getElementById(layerGroupId);
  if (node) node.replaceChildren();
}

export function readSliceCount(app: App): number {
  try {
    const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer();
    if (!viewLayer) return 1;
    const controller = viewLayer.getViewController();
    const image = app.getData(viewLayer.getDataId())?.image;
    if (!image) return 1;
    const size = image.getGeometry().getSize();
    return Math.max(1, size.get(controller.getScrollDimIndex()));
  } catch {
    return 1;
  }
}

export function readSliceIndex(app: App): number | null {
  try {
    const controller = app
      .getActiveLayerGroup()
      ?.getActiveViewLayer()
      ?.getViewController();
    if (!controller) return null;
    return controller.getCurrentIndexScrollValue();
  } catch {
    return null;
  }
}
