"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PinchZoomImageProps = {
  src: string;
  alt: string;
  className?: string;
};

/** Mobile-friendly image viewer with pinch-to-zoom, pan, and explicit +/- controls. */
export function PinchZoomImage({ src, alt, className }: PinchZoomImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const adjustScale = (delta: number) => {
    setScale((current) => {
      const next = Math.min(4, Math.max(1, current + delta));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2) {
      const dx = event.touches[0]!.clientX - event.touches[1]!.clientX;
      const dy = event.touches[0]!.clientY - event.touches[1]!.clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), scale: scaleRef.current };
      panRef.current = null;
    } else if (event.touches.length === 1 && scaleRef.current > 1) {
      panRef.current = {
        startX: event.touches[0]!.clientX,
        startY: event.touches[0]!.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault();
      const dx = event.touches[0]!.clientX - event.touches[1]!.clientX;
      const dy = event.touches[0]!.clientY - event.touches[1]!.clientY;
      const dist = Math.hypot(dx, dy);
      const next = Math.min(4, Math.max(1, pinchRef.current.scale * (dist / pinchRef.current.dist)));
      setScale(next);
    } else if (event.touches.length === 1 && panRef.current && scaleRef.current > 1) {
      event.preventDefault();
      const dx = event.touches[0]!.clientX - panRef.current.startX;
      const dy = event.touches[0]!.clientY - panRef.current.startY;
      setOffset({
        x: panRef.current.ox + dx,
        y: panRef.current.oy + dy,
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 w-full flex-1 touch-none flex-col items-center justify-center overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          type="button"
          aria-label="Zoom avant"
          onClick={() => adjustScale(0.25)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white transition hover:bg-white/20"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom arrière"
          onClick={() => adjustScale(-0.25)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white transition hover:bg-white/20"
        >
          −
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
        draggable={false}
      />
    </div>
  );
}
