import React, { useEffect, useRef } from "react";
import { applyGpuScanlineEffect } from "./GpuScanlineEffect";

type ScanlineOverlayProps = {
  screenCanvas: HTMLCanvasElement | null;
  shadowCanvas: HTMLCanvasElement | null;
  scanlineIntensity: string;
};

/**
 * Calculates scanline darkening intensity from setting
 */
function calculateScanlineDarkening(scanlineIntensity: string): number {
  switch (scanlineIntensity) {
    case "50%":
      return 0.75;
    case "25%":
      return 0.8;
    case "12.5%":
      return 1.0;
    case "off":
    default:
      return 0.0;
  }
}

/**
 * GPU-accelerated scanline effect using canvas pattern compositing
 * Much faster than CPU-based pixel manipulation
 */
export function applyScanlineEffectToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  scanlineIntensity: string = "off"
): void {
  const darkening = calculateScanlineDarkening(scanlineIntensity);

  // If scanline effect is off, just draw the image
  if (darkening === 0.0) {
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    return;
  }

  // Use GPU-accelerated approach with pattern compositing
  ctx.imageSmoothingEnabled = false;
  applyGpuScanlineEffect(ctx, canvas, sourceCanvas, scanlineIntensity as any);
}

/**
 * ScanlineOverlay component - applies scanline effect to screen canvas
 * Memoized to only re-render when scanline intensity changes
 */
const ScanlineOverlay = React.memo(
  ({ screenCanvas, shadowCanvas, scanlineIntensity }: ScanlineOverlayProps) => {
    const screenContextRef = useRef<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
      if (!screenCanvas || !shadowCanvas) {
        return;
      }

      // Get or initialize cached context
      let ctx = screenContextRef.current;
      if (!ctx) {
        ctx = screenCanvas.getContext("2d");
        if (!ctx) {
          return;
        }
        screenContextRef.current = ctx;
      }

      ctx.imageSmoothingEnabled = false;
      applyScanlineEffectToCanvas(ctx, screenCanvas, shadowCanvas, scanlineIntensity);
    }, [screenCanvas, shadowCanvas, scanlineIntensity]);

    // This component doesn't render anything - it only applies effects via canvas
    return null;
  },
  (prevProps, nextProps) => {
    // Only re-render if scanline intensity changes
    // Canvas references are stable, so we ignore them in comparison
    return prevProps.scanlineIntensity === nextProps.scanlineIntensity;
  }
);

ScanlineOverlay.displayName = "ScanlineOverlay";

export { ScanlineOverlay };
