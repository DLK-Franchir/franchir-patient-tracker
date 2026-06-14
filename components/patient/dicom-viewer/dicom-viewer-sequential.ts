import { useEffect, type RefObject } from "react";
import type { App } from "dwv";
import type { DicomTool, NavMode, PoolEntry } from "./dicom-viewer-types";
import { refreshDwvLayout, setPoolContainerVisible } from "./dicom-viewer-layout";

type SequentialNavParams = {
  navMode: NavMode;
  fileIndex: number;
  poolRef: RefObject<Map<number, PoolEntry>>;
  appRef: RefObject<App | null>;
  toolRef: RefObject<DicomTool>;
  setSliceIndex: (value: number) => void;
  setStatus: (status: "loading" | "rendering" | "ready" | "error") => void;
  setErrorMessage: (value: string | null) => void;
};

/** Navigation instantanée en mode séquentiel (swap de conteneur, sans reload). */
export function useDicomSequentialNavigation(params: SequentialNavParams) {
  const {
    navMode,
    fileIndex,
    poolRef,
    appRef,
    toolRef,
    setSliceIndex,
    setStatus,
    setErrorMessage,
  } = params;

  useEffect(() => {
    if (navMode !== "sequential") return;
    const pool = poolRef.current;
    if (pool.size === 0) return;

    pool.forEach((entry, i) => {
      setPoolContainerVisible(entry.container, i === fileIndex);
    });
    const entry = pool.get(fileIndex);
    if (!entry) return;

    setSliceIndex(fileIndex);

    if (entry.status === "ready") {
      appRef.current = entry.app;
      try {
        entry.app.setTool(toolRef.current);
        refreshDwvLayout(entry.app);
      } catch {
        /* layout may fail before canvas is ready */
      }
      setStatus("ready");
      setErrorMessage(null);
    } else if (entry.status === "error") {
      appRef.current = entry.app;
      setErrorMessage(
        `Fichier ${fileIndex + 1} illisible — passez au suivant avec →${
          entry.errorMessage ? ` (${entry.errorMessage})` : ""
        }`,
      );
      setStatus("ready");
    } else {
      appRef.current = entry.app;
      setStatus("rendering");
      setErrorMessage(null);
    }
  }, [
    fileIndex,
    navMode,
    appRef,
    poolRef,
    setErrorMessage,
    setSliceIndex,
    setStatus,
    toolRef,
  ]);
}
