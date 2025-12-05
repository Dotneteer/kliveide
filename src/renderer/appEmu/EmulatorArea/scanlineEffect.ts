/**
 * Scanline effect module - GPU-accelerated scanline rendering
 * Eliminates expensive CPU readback (getImageData/putImageData)
 */

export type ScanlineIntensity = "off" | "50%" | "25%" | "12.5%";

/**
 * Calculates scanline darkening intensity from setting
 */
function getScanlineDarkening(scanlineIntensity: ScanlineIntensity): number {
  switch (scanlineIntensity) {
    case "50%":
      return 0.5;
    case "25%":
      return 0.25;
    case "12.5%":
      return 0.125;
    case "off":
    default:
      return 0.0;
  }
}

/**
 * Creates a zoom-aware scanline pattern canvas
 * For zoom factor N, renders N-1 normal lines followed by 1 scanline
 * This matches the CPU-based approach for consistent visual output
 */
function createZoomAwareScanlinePatternCanvas(
  width: number,
  height: number,
  sourceHeight: number,
  intensity: ScanlineIntensity
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const darkening = getScanlineDarkening(intensity);
  if (darkening === 0) return canvas; // No effect needed

  // Calculate zoom factor
  const zoomFactorY = height / sourceHeight;
  
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // For each source buffer row, determine which output canvas lines it maps to
  for (let bufferLineIdx = 0; bufferLineIdx < sourceHeight; bufferLineIdx++) {
    const startCanvasLine = Math.floor(bufferLineIdx * zoomFactorY);
    const endCanvasLine = Math.floor((bufferLineIdx + 1) * zoomFactorY);
    const numCanvasLines = endCanvasLine - startCanvasLine;

    // Apply opacity to each line within this buffer row
    for (
      let canvasLineInBuffer = 0;
      canvasLineInBuffer < numCanvasLines;
      canvasLineInBuffer++
    ) {
      const canvasLineIdx = startCanvasLine + canvasLineInBuffer;
      let opacity = 0; // Default: transparent (no darkening)

      // Determine opacity based on position within the buffer line
      if (numCanvasLines === 1) {
        // Single line per buffer line - no scanline effect
        opacity = 0;
      } else if (numCanvasLines === 2) {
        // Zoom 2: First normal, second with scanline darkening
        opacity = canvasLineInBuffer === 0 ? 0 : darkening;
      } else if (numCanvasLines === 3) {
        // Zoom 3: First normal, second antialiasing, third scanline
        if (canvasLineInBuffer === 0) {
          opacity = 0; // First line: normal
        } else if (canvasLineInBuffer === 1) {
          opacity = darkening * 0.5; // Second line: half scanline darkening
        } else {
          opacity = darkening; // Third line: full scanline effect
        }
      } else if (numCanvasLines >= 4) {
        // Zoom 4+: Pattern - normal, antialiasing (multiple), scanline
        // First line is always normal, last line is scanline, middle are antialiasing
        if (canvasLineInBuffer === 0) {
          opacity = 0; // First line: normal
        } else if (canvasLineInBuffer === numCanvasLines - 1) {
          opacity = darkening; // Last line: scanline effect
        } else {
          // Middle lines: gradient antialiasing from 0 to darkening
          const middleCount = numCanvasLines - 2;
          const middleIdx = canvasLineInBuffer - 1;
          opacity = (darkening * middleIdx) / middleCount;
        }
      }

      // Apply opacity to this line
      if (opacity > 0) {
        const lineStartIdx = canvasLineIdx * width * 4;
        const lineEndIdx = lineStartIdx + width * 4;
        for (let pixelIdx = lineStartIdx; pixelIdx < lineEndIdx; pixelIdx += 4) {
          // Black scanlines with opacity
          data[pixelIdx] = 0; // R
          data[pixelIdx + 1] = 0; // G
          data[pixelIdx + 2] = 0; // B
          data[pixelIdx + 3] = Math.round(255 * opacity); // A
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Applies scanline effect to canvas using GPU compositing (multiply blend mode)
 * Much faster than CPU pixel manipulation.
 * 
 * @param ctx Canvas context to draw to
 * @param canvas Target canvas element
 * @param sourceCanvas Source canvas with the image to apply scanlines to
 * @param scanlineIntensity Scanline intensity setting ("off", "50%", "25%", "12.5%")
 */
export function applyScanlineEffectToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  scanlineIntensity: ScanlineIntensity = "off"
): void {
  const darkening = getScanlineDarkening(scanlineIntensity);

  // Use 'copy' mode to completely replace canvas content without compositing
  // This prevents flickering by ensuring a complete frame replacement
  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  
  // If scanline effect is off, we're done
  if (darkening === 0.0) {
    ctx.globalCompositeOperation = "source-over"; // Reset to default
    return;
  }

  // Create zoom-aware scanline pattern and apply it
  const scanlinePattern = createZoomAwareScanlinePatternCanvas(
    canvas.width,
    canvas.height,
    sourceCanvas.height,
    scanlineIntensity
  );

  // Apply scanline overlay using multiply blend mode (darkens the image)
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(scanlinePattern, 0, 0);
  ctx.globalCompositeOperation = "source-over"; // Reset to default
}
