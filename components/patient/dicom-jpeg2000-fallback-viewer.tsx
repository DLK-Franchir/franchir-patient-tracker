"use client";

/**
 * Viewer de repli pour les DICOM JPEG 2000 que dwv ne sait pas décoder
 * (option COD « selective arithmetic coding bypass »). On décode via OpenJPEG
 * (WASM), on applique un fenêtrage VOI visible par défaut, et on rend sur un
 * canvas avec navigation par coupe, fenêtrage à la souris et zoom.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, AlertTriangle, X } from "lucide-react";
import { decodeJpeg2000, type DecodedFrame } from "@/lib/imaging/jpeg2000-decode";
import { parseDicomForFallback } from "@/lib/imaging/dicom-j2k-extract";
import {
  grayPixelsToRgba,
  pixelRange,
  resolveInitialWindowLevel,
  type WindowLevel,
} from "@/lib/imaging/dicom-windowing";

type FrameData = {
  frame: DecodedFrame;
  range: { min: number; max: number };
  defaultWl: WindowLevel;
  isMonochrome1: boolean;
};

export type DicomJpeg2000FallbackViewerProps = {
  urls: string[];
  name: string;
  fullscreen?: boolean;
  onClose?: () => void;
};

export default function DicomJpeg2000FallbackViewer({
  urls,
  name,
  fullscreen = false,
  onClose,
}: DicomJpeg2000FallbackViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<number, FrameData>>(new Map());
  const rgbaRef = useRef<ImageData | null>(null);

  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wl, setWl] = useState<WindowLevel | null>(null);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });

  const fileCount = urls.length;

  useEffect(() => {
    setIndex(0);
    cacheRef.current.clear();
  }, [urls]);

  // Charge + décode le fichier courant.
  useEffect(() => {
    let cancelled = false;
    const url = urls[index];
    if (!url) return;

    const cached = cacheRef.current.get(index);
    if (cached) {
      setStatus("ready");
      setErrorMessage(null);
      setWl(cached.defaultWl);
      setView({ zoom: 1, panX: 0, panY: 0 });
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const parsed = parseDicomForFallback(buffer);
        if (!parsed) throw new Error("PixelData absent");

        const frame = await decodeJpeg2000(parsed.codestream);
        if (cancelled) return;

        const range = pixelRange(frame.pixels);
        const defaultWl = resolveInitialWindowLevel({
          windowCenter: parsed.windowCenter,
          windowWidth: parsed.windowWidth,
          pixelMin: range.min,
          pixelMax: range.max,
        });

        cacheRef.current.set(index, {
          frame,
          range,
          defaultWl,
          isMonochrome1: parsed.isMonochrome1,
        });

        setWl(defaultWl);
        setView({ zoom: 1, panX: 0, panY: 0 });
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("[FallbackViewer] décodage échoué", err);
        setErrorMessage(
          err instanceof Error ? err.message : "décodage impossible",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [index, urls]);

  // Régénère le buffer RGBA quand le fenêtrage change.
  useEffect(() => {
    if (status !== "ready" || !wl) return;
    const data = cacheRef.current.get(index);
    if (!data) return;
    const rgba = grayPixelsToRgba(data.frame.pixels, wl, data.isMonochrome1);
    const imageData = new ImageData(data.frame.width, data.frame.height);
    imageData.data.set(rgba);
    rgbaRef.current = imageData;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, wl, index]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    const imageData = rgbaRef.current;
    if (!canvas || !surface || !imageData) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = surface.clientWidth;
    const cssH = surface.clientHeight;
    if (cssW < 1 || cssH < 1) return;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // canvas hors écran à la résolution native de l'image
    const off = document.createElement("canvas");
    off.width = imageData.width;
    off.height = imageData.height;
    off.getContext("2d")?.putImageData(imageData, 0, 0);

    const fitScale = Math.min(cssW / imageData.width, cssH / imageData.height);
    const scale = fitScale * view.zoom * dpr;
    const drawW = imageData.width * scale;
    const drawH = imageData.height * scale;
    const dx = (canvas.width - drawW) / 2 + view.panX * dpr;
    const dy = (canvas.height - drawH) / 2 + view.panY * dpr;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, dx, dy, drawW, drawH);
    ctx.restore();
  }, [view]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(surface);
    return () => ro.disconnect();
  }, [paint]);

  // Fenêtrage à la souris (glisser) ou pan avec Shift.
  const dragRef = useRef<{
    x: number;
    y: number;
    wl: WindowLevel;
    pan: { x: number; y: number };
    mode: "wl" | "pan";
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (status !== "ready" || !wl) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      wl,
      pan: { x: view.panX, y: view.panY },
      mode: e.shiftKey ? "pan" : "wl",
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (drag.mode === "pan") {
      setView((v) => ({ ...v, panX: drag.pan.x + dx, panY: drag.pan.y + dy }));
    } else {
      const data = cacheRef.current.get(index);
      const span = data ? Math.max(1, data.range.max - data.range.min) : 4096;
      const sensitivity = span / 512;
      setWl({
        center: drag.wl.center + dx * sensitivity,
        width: Math.max(1, drag.wl.width + dy * sensitivity),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (status !== "ready") return;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => ({ ...v, zoom: Math.min(8, Math.max(0.5, v.zoom * factor)) }));
  };

  const resetView = () => {
    const data = cacheRef.current.get(index);
    if (data) setWl(data.defaultWl);
    setView({ zoom: 1, panX: 0, panY: 0 });
  };

  const navigate = (delta: 1 | -1) => {
    setIndex((prev) => Math.max(0, Math.min(fileCount - 1, prev + delta)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      navigate(-1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      navigate(1);
    }
  };

  const showHeader = Boolean(fullscreen || onClose);

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={{ backgroundColor: "#0B1020" }}
      data-testid="dicom-fallback-root"
    >
      {showHeader ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {name}
          </p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la visionneuse"
              className="inline-flex items-center justify-center rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex max-w-full flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
          JPEG 2000 — rendu OpenJPEG
        </span>
        <button
          type="button"
          onClick={resetView}
          disabled={status !== "ready"}
          className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          Réinit.
        </button>
        {fileCount > 1 ? (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={index <= 0}
              aria-label="Image précédente"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-30"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Préc.
            </button>
            <span
              className="px-1 text-xs tabular-nums text-white/60"
              data-testid="dicom-fallback-indicator"
            >
              {index + 1} / {fileCount}
            </span>
            <button
              type="button"
              onClick={() => navigate(1)}
              disabled={index >= fileCount - 1}
              aria-label="Image suivante"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-30"
            >
              Suiv.
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <span className="ml-auto hidden text-[11px] text-white/40 sm:block">
          Glisser : fenêtrage · Maj+glisser : déplacer · molette : zoom
        </span>
      </div>

      <div
        ref={surfaceRef}
        className="relative min-h-[240px] flex-1 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 sm:min-h-[360px]"
        role="application"
        tabIndex={0}
        aria-label={`Visionneuse DICOM JPEG 2000 : ${name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B1020]/85">
            <div
              className="size-8 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-100"
              aria-hidden
            />
            <p className="text-sm font-medium text-white/90">
              Décodage de l&apos;image…
            </p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle
              className="size-8 text-white/80"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-white">
              Impossible d&apos;afficher ce DICOM
            </p>
            <p className="text-xs text-white/50">
              {errorMessage ?? "Le fichier est peut-être corrompu ou illisible."}
            </p>
            <a
              href={urls[index]}
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
