import React, { useEffect, useRef } from "react";

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
      return 0.5;
    case "12.5%":
      return 0.25;
    case "off":
    default:
      return 0.0;
  }
}

/**
 * Applies scanline effect based on zoom factor and intensity setting
 */
export function applyScanlineEffectToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  scanlineIntensity: string = "off"
): void {
  const sourceHeight = sourceCanvas.height;
  const targetWidth = canvas.width;
  const targetHeight = canvas.height;

  // Calculate scanline darkening intensity from setting
  let scanlineDarkening = calculateScanlineDarkening(scanlineIntensity);

  // If scanline effect is off, just draw the image
  if (scanlineDarkening === 0.0) {
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return;
  }

  // Calculate zoom factor (approximate)
  const zoomFactorY = targetHeight / sourceHeight;

  // Draw source image normally first
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  // Get image data to apply scanline effect
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;

  // Apply scanline effect based on zoom factor
  for (let bufferLineIdx = 0; bufferLineIdx < sourceHeight; bufferLineIdx++) {
    const startCanvasLine = Math.floor(bufferLineIdx * zoomFactorY);
    const endCanvasLine = Math.floor((bufferLineIdx + 1) * zoomFactorY);
    const numCanvasLines = endCanvasLine - startCanvasLine;

    for (
      let canvasLineInBuffer = 0;
      canvasLineInBuffer < numCanvasLines;
      canvasLineInBuffer++
    ) {
      const canvasLineIdx = startCanvasLine + canvasLineInBuffer;
      let opacity = 1.0; // Default: no scanline effect

      // Determine opacity based on position within the buffer line
      if (numCanvasLines === 1) {
        // Single line per buffer line - no effect
        opacity = 1.0;
      } else if (numCanvasLines === 2) {
        // Zoom 2: First normal, second with scanline darkening
        opacity = canvasLineInBuffer === 0 ? 1.0 : 1.0 - scanlineDarkening;
      } else if (numCanvasLines === 3) {
        // Zoom 3: First normal, second antialiasing, third scanline
        if (canvasLineInBuffer === 0) {
          opacity = 1.0; // First line: normal
        } else if (canvasLineInBuffer === 1) {
          opacity = 1.0 - scanlineDarkening * 0.5; // Second line: half scanline darkening
        } else {
          opacity = 1.0 - scanlineDarkening; // Third line: full scanline effect
        }
      } else if (numCanvasLines >= 4) {
        // Zoom 4+: Pattern - normal, antialiasing (multiple), scanline
        // First line is always normal, last line is scanline, middle are antialiasing
        if (canvasLineInBuffer === 0) {
          opacity = 1.0; // First line: normal
        } else if (canvasLineInBuffer === numCanvasLines - 1) {
          opacity = 1.0 - scanlineDarkening; // Last line: scanline effect
        } else {
          // Middle lines: gradient antialiasing from 1.0 to (1.0 - scanlineDarkening)
          const middleCount = numCanvasLines - 2;
          const middleIdx = canvasLineInBuffer - 1;
          opacity = 1.0 - (scanlineDarkening * middleIdx) / middleCount;
        }
      }

      // Apply opacity to this line
      if (opacity < 1.0) {
        const lineStartIdx = canvasLineIdx * targetWidth * 4;
        const lineEndIdx = lineStartIdx + targetWidth * 4;
        for (let pixelIdx = lineStartIdx; pixelIdx < lineEndIdx; pixelIdx += 4) {
          // Apply opacity by reducing alpha channel
          data[pixelIdx + 3] = Math.round(data[pixelIdx + 3] * opacity);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
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
