"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { App } from "dwv";
import { ArrowLeft, ArrowRight, AlertTriangle, X } from 'lucide-react';
import { ViewerInfoBubble } from "./dicom-viewer/dicom-viewer-info";
import { useDicomSequentialPool } from "./dicom-viewer/dicom-viewer-pool";
import { useDicomSequentialNavigation } from "./dicom-viewer/dicom-viewer-sequential";
import { useDicomStackMode } from "./dicom-viewer/dicom-viewer-stack";
import {
  type DicomTool,
  type DicomViewerProps,
  type NavMode,
  type PoolEntry,
  type ViewerSeries,
  type WlPresetId,
  WL_PRESETS,
  nextLayerGroupId,
  resolveViewerInfoKind,
} from "./dicom-viewer/dicom-viewer-types";

export type { DicomViewerProps, ViewerSeries };
export { formatDicomLoadError } from "./dicom-viewer/dicom-viewer-types";

export default function DicomViewer({
  urls,
  name,
  embedded = false,
  fullscreen = false,
  series,
  activeSeriesIndex = 0,
  onNextSeries,
  onPrevSeries,
  onClose,
  onSliceCountResolved,
}: DicomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const poolHostRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  const poolRef = useRef<Map<number, PoolEntry>>(new Map());
  const fileIndexRef = useRef(0);
  const toolRef = useRef<DicomTool>("WindowLevel");
  const onSliceCountResolvedRef = useRef(onSliceCountResolved);
  const [layerGroupId] = useState(nextLayerGroupId);

  useEffect(() => {
    onSliceCountResolvedRef.current = onSliceCountResolved;
  }, [onSliceCountResolved]);

  const [status, setStatus] = useState<"loading" | "rendering" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [preloadLoaded, setPreloadLoaded] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tool, setTool] = useState<DicomTool>("WindowLevel");
  const [activePreset, setActivePreset] = useState<WlPresetId | null>(null);
  const [sliceIndex, setSliceIndex] = useState(0);
  const [sliceCount, setSliceCount] = useState(1);
  const [navMode, setNavMode] = useState<NavMode>("stack");
  const [fileIndex, setFileIndex] = useState(0);
  const [poolWarning, setPoolWarning] = useState<string | null>(null);

  useEffect(() => {
    fileIndexRef.current = fileIndex;
  }, [fileIndex]);

  const fileCount = urls.length;
  const isBusy = status === "loading" || status === "rendering";
  const isReady = status === "ready";

  const seriesCount = series?.length ?? 0;
  const hasSeriesNav = seriesCount > 1 && onNextSeries && onPrevSeries;
  const showHeader = Boolean(fullscreen || onClose || hasSeriesNav);
  const atFirstSeries = activeSeriesIndex <= 0;
  const atLastSeries = seriesCount > 0 ? activeSeriesIndex >= seriesCount - 1 : true;

  const infoKind = resolveViewerInfoKind({
    isBusy,
    status,
    navMode,
    fileCount,
    sliceCount,
  });

  const urlsKey = urls.join("\n");

  const [prevUrlsKey, setPrevUrlsKey] = useState(urlsKey);
  if (prevUrlsKey !== urlsKey) {
    setPrevUrlsKey(urlsKey);
    setStatus("loading");
    setProgress(0);
    setPreloadLoaded(0);
    setSliceIndex(0);
    setSliceCount(1);
    setNavMode("stack");
    setFileIndex(0);
    setActivePreset(null);
    setErrorMessage(null);
    setPoolWarning(null);
  }

  useDicomStackMode({
    navMode,
    urlsKey,
    layerGroupId,
    containerRef,
    appRef,
    toolRef,
    onSliceCountResolvedRef,
    setNavMode,
    setFileIndex,
    setStatus,
    setProgress,
    setPreloadLoaded,
    setErrorMessage,
    setPoolWarning,
    setSliceIndex,
    setSliceCount,
    setTool,
    setActivePreset,
  });

  useDicomSequentialPool({
    navMode,
    urlsKey,
    layerGroupId,
    poolHostRef,
    poolRef,
    appRef,
    fileIndexRef,
    toolRef,
    onSliceCountResolvedRef,
    setStatus,
    setProgress,
    setPreloadLoaded,
    setErrorMessage,
    setPoolWarning,
    setSliceIndex,
    setSliceCount,
  });

  useDicomSequentialNavigation({
    navMode,
    fileIndex,
    poolRef,
    appRef,
    toolRef,
    setSliceIndex,
    setStatus,
    setErrorMessage,
  });

  const activateTool = useCallback((next: DicomTool) => {
    const app = appRef.current;
    if (!app) return;
    app.setTool(next);
    toolRef.current = next;
    setTool(next);
  }, []);

  const handleReset = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.resetZoomPan();
    app.resetViews();
    app.fitToContainer();
  }, []);

  const getViewController = useCallback(() => {
    const app = appRef.current;
    if (!app) return undefined;
    return app.getActiveLayerGroup()?.getActiveViewLayer()?.getViewController();
  }, []);

  const applyWindowPreset = useCallback(
    (preset: (typeof WL_PRESETS)[number]) => {
      const app = appRef.current;
      const controller = getViewController();
      if (!app || !controller) return;
      try {
        controller.setWindowLevelPreset(preset.id);
        app.setTool("WindowLevel");
        toolRef.current = "WindowLevel";
        setTool("WindowLevel");
        setActivePreset(preset.id);
      } catch {
        /* preset may fail on non-grayscale modalities */
      }
    },
    [getViewController],
  );

  const navigateSlice = useCallback(
    (delta: 1 | -1) => {
      if (navMode === "sequential" && fileCount > 1) {
        setFileIndex((prev) => Math.max(0, Math.min(fileCount - 1, prev + delta)));
        return;
      }
      const controller = getViewController();
      if (!controller) return;
      try {
        const helper = controller.getPositionHelper();
        if (delta > 0) helper.incrementPositionAlongScroll();
        else helper.decrementPositionAlongScroll();
      } catch {
        /* single-frame data has no scroll dimension */
      }
    },
    [navMode, fileCount, getViewController],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (status !== "ready") return;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        navigateSlice(-1);
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        navigateSlice(1);
      }
    },
    [status, navigateSlice],
  );

  const handleSurfacePointerEnter = useCallback(() => {
    const surface = surfaceRef.current;
    if (surface && !surface.contains(document.activeElement)) {
      surface.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (status === "ready") {
      surfaceRef.current?.focus({ preventScroll: true });
    }
  }, [status]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const blockWheelUnlessScroll = (event: WheelEvent) => {
      if (status !== "ready" || toolRef.current !== "Scroll") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    surface.addEventListener("wheel", blockWheelUnlessScroll, { passive: false, capture: true });
    return () => {
      surface.removeEventListener("wheel", blockWheelUnlessScroll, { capture: true });
    };
  }, [status]);

  const tools: { id: DicomTool; label: string; available: boolean }[] = [
    { id: "WindowLevel", label: "Fenêtrage", available: true },
    { id: "ZoomAndPan", label: "Zoom / Déplacement", available: true },
    { id: "Scroll", label: "Coupes", available: isReady && sliceCount > 1 && navMode === "stack" },
  ];

  const viewportMessage =
    status === "rendering" && navMode === "sequential" && fileCount > 1
      ? preloadLoaded < fileCount
        ? `Préchargement des images (${preloadLoaded}/${fileCount})…`
        : `Chargement du fichier ${fileIndex + 1}/${fileCount}…`
      : status === "rendering"
        ? "Rendu de l'image…"
        : navMode === "sequential" && fileCount > 1 && preloadLoaded > 0
          ? `Préchargement des images (${preloadLoaded}/${fileCount})…`
          : fileCount > 1 && preloadLoaded > 0 && navMode === "stack"
            ? `Préchargement des images (${preloadLoaded}/${fileCount})…`
            : fileCount > 1
              ? `Chargement de la série (${fileCount} fichiers)…`
              : "Chargement de l'image…";

  const displaySliceIndex = navMode === "sequential" ? fileIndex : sliceIndex;
  const canNavigateSlices = isReady && sliceCount > 1;
  const preloadMode =
    (navMode === "sequential" && fileCount > 1) ||
    (navMode === "stack" && fileCount > 1 && preloadLoaded > 0);

  const hint =
    navMode === "sequential" && sliceCount > 1
      ? "← → : fichier précédent / suivant"
      : tool === "Scroll" && sliceCount > 1
        ? "Molette ou ← → : changer de coupe"
        : tool === "ZoomAndPan"
          ? "Glisser : déplacer · molette : zoom"
          : "Glisser : ajuster le fenêtrage (activez Coupes pour naviguer)";

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ backgroundColor: embedded && !fullscreen ? "transparent" : "#0B1020" }}
      onKeyDown={handleKeyDown}
      data-testid="dicom-viewer-root"
    >
      {showHeader ? (
        <div
          className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3"
          data-testid="dicom-series-header"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{name}</p>
              {seriesCount > 1 ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/60">
                  Série {activeSeriesIndex + 1} / {seriesCount}
                </span>
              ) : null}
            </div>
            <ViewerInfoBubble
              kind={infoKind}
              sliceCount={sliceCount}
              fileCount={fileCount}
              errorMessage={errorMessage}
              preloadLoaded={preloadLoaded}
              preloadTotal={fileCount}
              preloadMode={preloadMode}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasSeriesNav ? (
              <>
                <button
                  type="button"
                  onClick={onPrevSeries}
                  disabled={atFirstSeries}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  data-testid="dicom-prev-series"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Série préc.
                </button>
                <button
                  type="button"
                  onClick={onNextSeries}
                  disabled={atLastSeries}
                  className="inline-flex items-center gap-2 rounded-xl bg-dash-teal px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-dash-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid="dicom-next-series"
                >
                  Série suivante
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer la visionneuse"
                className="inline-flex items-center justify-center rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        {tools
          .filter((t) => t.available)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => activateTool(t.id)}
              disabled={!isReady}
              aria-pressed={tool === t.id}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-30"
              style={{
                backgroundColor: tool === t.id ? "#38B2AC" : "rgba(255,255,255,0.08)",
                color: "#FFFFFF",
              }}
            >
              {t.label}
            </button>
          ))}

        <span className="mx-1 hidden h-4 w-px bg-white/15 sm:block" aria-hidden="true" />

        {WL_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyWindowPreset(preset)}
            disabled={!isReady}
            aria-pressed={activePreset === preset.id}
            aria-label={`Preset fenêtrage ${preset.label}`}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-30"
            style={{
              backgroundColor:
                activePreset === preset.id ? "rgba(56,178,172,0.35)" : "rgba(255,255,255,0.06)",
              color: "#FFFFFF",
            }}
          >
            {preset.label}
          </button>
        ))}

        <button
          type="button"
          onClick={handleReset}
          disabled={!isReady}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          Réinitialiser
        </button>

        {canNavigateSlices ? (
          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigateSlice(-1)}
              disabled={displaySliceIndex <= 0}
              aria-label={navMode === "sequential" ? "Fichier précédent" : "Coupe précédente"}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Préc.
            </button>
            <span
              className="px-1 text-xs tabular-nums text-white/60"
              aria-live="polite"
              data-testid="dicom-slice-indicator"
            >
              {displaySliceIndex + 1} / {sliceCount}
            </span>
            <button
              type="button"
              onClick={() => navigateSlice(1)}
              disabled={displaySliceIndex >= sliceCount - 1}
              aria-label={navMode === "sequential" ? "Fichier suivant" : "Coupe suivante"}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              Suiv.
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {!showHeader ? (
          <ViewerInfoBubble
            kind={infoKind}
            sliceCount={sliceCount}
            fileCount={fileCount}
            errorMessage={errorMessage}
            preloadLoaded={preloadLoaded}
            preloadTotal={fileCount}
            preloadMode={preloadMode}
          />
        ) : null}

        <span className="ml-auto hidden text-[11px] text-white/40 sm:block">{hint}</span>
      </div>

      <div
        ref={surfaceRef}
        className="relative min-h-[360px] flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
        role="application"
        tabIndex={0}
        aria-label={`Visionneuse DICOM : ${name}. Flèches gauche/droite : changer de coupe.`}
        onPointerEnter={handleSurfacePointerEnter}
      >
        <div
          ref={containerRef}
          id={layerGroupId}
          className="absolute inset-0"
          style={{ display: navMode === "sequential" ? "none" : "block" }}
        />
        <div
          ref={poolHostRef}
          className="absolute inset-0"
          style={{ display: navMode === "sequential" ? "block" : "none" }}
          data-testid="dicom-pool-host"
        />

        {isBusy ? (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B1020]/85"
            data-testid="dicom-viewport-overlay"
          >
            <div
              className="size-8 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-100"
              aria-hidden
            />
            <p className="max-w-xs px-4 text-center text-sm font-medium text-white/90">{viewportMessage}</p>
            {status === "loading" && progress > 0 ? (
              <p className="text-xs tabular-nums text-white/50">{progress} %</p>
            ) : null}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle className="size-8 text-white/80" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm font-medium text-white">Impossible d&apos;afficher ce DICOM</p>
            <p className="text-xs text-white/50">
              {errorMessage ??
                "Le fichier est peut-être corrompu, dans un format compressé non pris en charge, ou le lien sécurisé a expiré."}
            </p>
            {poolWarning ? (
              <p className="text-xs text-amber-200/80">{poolWarning}</p>
            ) : null}
            <a
              href={urls[0]}
              download={name}
              className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              Télécharger le fichier
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
