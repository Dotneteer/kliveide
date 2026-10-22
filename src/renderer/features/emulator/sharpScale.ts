/*
 * Drawing a machine's picture onto the emulator canvas at the panel's scale.
 *
 * A machine whose pixels are square, or a whole fraction or multiple of square (the Timex's and the
 * Next's 0.5), lands every source pixel on a whole number of canvas pixels at the panel's whole zoom
 * steps, so plain nearest-neighbour scaling is exact. A machine with any other pixel aspect (the
 * HT-1080Z's dots are 7 / 10.644 of their height) cannot: nearest-neighbour then makes some columns a
 * canvas pixel wider than others, which reads as uneven letters. Such a picture is scaled "sharp
 * bilinear": first up by a whole factor with nearest-neighbour (still exact), then the remaining
 * fraction with smoothing, which spreads the rounding over one soft edge per dot instead of a whole
 * extra column. An axis whose scale is already whole is not softened at all, since the smoothed step
 * maps it 1:1.
 */

/** Whether a pixel aspect is a whole number or a whole fraction (1, 2, 0.5, 0.25, ...) */
export function isSimpleRatio(ratio: number): boolean {
  if (!(ratio > 0)) return true;
  const whole = (value: number) => Math.abs(value - Math.round(value)) < 1e-9;
  return whole(ratio) || whole(1 / ratio);
}

/** Whether a picture with this pixel aspect needs the sharp-bilinear path */
export function needsSharpScaling(xRatio: number, yRatio: number): boolean {
  return !isSimpleRatio(xRatio) || !isSimpleRatio(yRatio);
}

/** The whole factors of the nearest-neighbour step: the smallest at or above the final scale */
export function prescaleFactors(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number
): [number, number] {
  return [
    Math.max(1, Math.ceil(destWidth / Math.max(1, sourceWidth) - 1e-9)),
    Math.max(1, Math.ceil(destHeight / Math.max(1, sourceHeight) - 1e-9))
  ];
}

/** The intermediate canvas of the sharp path, kept between frames */
export type SharpScaleScratch = { canvas?: HTMLCanvasElement };

/**
 * Draws `source` over the whole `width` x `height` of `ctx`, replacing what was there (the caller
 * sets the composite operation). `sharp` chooses the sharp-bilinear path; otherwise it is the plain
 * nearest-neighbour draw every machine has always had. Leaves smoothing off.
 */
export function drawPictureScaled(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  sharp: boolean,
  scratch: SharpScaleScratch
): void {
  if (!sharp) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, width, height);
    return;
  }
  const [fx, fy] = prescaleFactors(source.width, source.height, width, height);
  const w = source.width * fx;
  const h = source.height * fy;
  let canvas = scratch.canvas;
  if (!canvas) {
    canvas = document.createElement("canvas");
    scratch.canvas = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const scratchCtx = canvas.getContext("2d");
  if (!scratchCtx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, width, height);
    return;
  }
  scratchCtx.imageSmoothingEnabled = false;
  scratchCtx.globalCompositeOperation = "copy";
  scratchCtx.drawImage(source, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
}
