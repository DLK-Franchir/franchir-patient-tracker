import type { App } from "dwv";
import { LAYOUT_RETRY_DELAYS_MS } from "./dicom-viewer-types";

/** dwv rend sur canvas 0×0 si le conteneur est `display:none` pendant le chargement. */
export function setPoolContainerVisible(container: HTMLDivElement, visible: boolean) {
  container.style.display = "block";
  container.style.visibility = visible ? "visible" : "hidden";
  container.style.pointerEvents = visible ? "auto" : "none";
}

export function refreshDwvLayout(app: App) {
  try {
    const dataIds = app.getDataIds();
    if (dataIds.length > 0) {
      app.render(dataIds[0]!);
    }
    app.fitToContainer();
    app.onResize();
  } catch {
    /* layout may fail before canvas is ready */
  }
}

/** Re-render after visibility change + retries (canvas 0×0 if hidden during load). */
export function ensureDwvVisible(app: App, isActive: () => boolean): number[] {
  refreshDwvLayout(app);
  return scheduleLayoutRetries(app, isActive);
}

export function scheduleLayoutRetries(app: App, isActive: () => boolean): number[] {
  const timerIds: number[] = [];
  for (const ms of LAYOUT_RETRY_DELAYS_MS) {
    timerIds.push(
      window.setTimeout(() => {
        if (!isActive()) return;
        try {
          app.fitToContainer();
          app.onResize();
        } catch {
          /* layout may fail before canvas is ready */
        }
      }, ms),
    );
  }
  return timerIds;
}

export function clearLayoutTimers(timerIds: number[]) {
  for (const id of timerIds) window.clearTimeout(id);
}
