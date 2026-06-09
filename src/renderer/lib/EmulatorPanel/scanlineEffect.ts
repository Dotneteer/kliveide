/**
 * GPU-composited scanline overlay for the emulator canvas.
 */

export type ScanlineIntensity = "off" | "50%" | "25%" | "12.5%";

export function getScanlineDarkening(scanlineIntensity: ScanlineIntensity): number {
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

export function applyScanlineEffectToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sourceImageData: ImageData,
  sourceWidth: number,
  sourceHeight: number,
  scanlineIntensity: ScanlineIntensity,
  tempCanvas: HTMLCanvasElement
): void {
  if (tempCanvas.width !== sourceWidth || tempCanvas.height !== sourceHeight) {
    tempCanvas.width = sourceWidth;
    tempCanvas.height = sourceHeight;
  }

  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) {
    return;
  }

  tempCtx.putImageData(sourceImageData, 0, 0);
  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

  if (getScanlineDarkening(scanlineIntensity) === 0.0) {
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(
    createZoomAwareScanlinePatternCanvas(
      canvas.width,
      canvas.height,
      sourceHeight,
      scanlineIntensity
    ),
    0,
    0
  );
  ctx.globalCompositeOperation = "source-over";
}

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
  if (!ctx) {
    return canvas;
  }

  const darkening = getScanlineDarkening(intensity);
  if (darkening === 0) {
    return canvas;
  }

  const zoomFactorY = height / sourceHeight;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let sourceLine = 0; sourceLine < sourceHeight; sourceLine++) {
    const startCanvasLine = Math.floor(sourceLine * zoomFactorY);
    const endCanvasLine = Math.floor((sourceLine + 1) * zoomFactorY);
    const canvasLineCount = endCanvasLine - startCanvasLine;

    for (let lineInSource = 0; lineInSource < canvasLineCount; lineInSource++) {
      const opacity = getLineOpacity(lineInSource, canvasLineCount, darkening);
      if (opacity <= 0) {
        continue;
      }

      const lineStart = (startCanvasLine + lineInSource) * width * 4;
      const lineEnd = lineStart + width * 4;
      for (let pixel = lineStart; pixel < lineEnd; pixel += 4) {
        data[pixel] = 0;
        data[pixel + 1] = 0;
        data[pixel + 2] = 0;
        data[pixel + 3] = Math.round(255 * opacity);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function getLineOpacity(lineInSource: number, canvasLineCount: number, darkening: number): number {
  if (canvasLineCount <= 1) {
    return 0;
  }

  if (canvasLineCount === 2) {
    return lineInSource === 0 ? 0 : darkening;
  }

  if (canvasLineCount === 3) {
    if (lineInSource === 0) {
      return 0;
    }
    return lineInSource === 1 ? darkening * 0.5 : darkening;
  }

  if (lineInSource === 0) {
    return 0;
  }

  if (lineInSource === canvasLineCount - 1) {
    return darkening;
  }

  return (darkening * (lineInSource - 1)) / (canvasLineCount - 2);
}
