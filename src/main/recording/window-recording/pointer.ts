/**
 * Pixel drawing for the IDE + Emulator recording: the mouse pointer sprite and the click rings.
 *
 * Every buffer here is **BGRA** (the byte order of Electron's `NativeImage.toBitmap()`), row-major,
 * `width * 4` bytes per row.
 *
 * The arrow's black outline and white fill are the *picture of a pointer*, drawn into a video frame -
 * not UI chrome - so the theming rule against colour literals does not apply to them. The click
 * rings take their colours from the theme's accent tokens, read when a recording starts.
 */

export type Rgb = { r: number; g: number; b: number };

export type Canvas = { pixels: Uint8Array; width: number; height: number };

/*
 * The classic arrow, 12 x 19. "X" = outline, "." = fill, " " = transparent.
 * The hot spot is the top-left pixel.
 */
const ARROW = [
  "X",
  "XX",
  "X.X",
  "X..X",
  "X...X",
  "X....X",
  "X.....X",
  "X......X",
  "X.......X",
  "X........X",
  "X.........X",
  "X......XXXXX",
  "X...X..X",
  "X..XX..X",
  "X.X  X..X",
  "XX   X..X",
  "X     X..X",
  "      X..X",
  "       XX"
];

const OUTLINE: Rgb = { r: 0, g: 0, b: 0 };
const FILL: Rgb = { r: 255, g: 255, b: 255 };

/** The arrow's size in pixels at scale 1 */
export const ARROW_SIZE = { width: 12, height: ARROW.length };

/** Blends a colour over one pixel; `alpha` is 0..1 */
export function blendPixel(canvas: Canvas, x: number, y: number, color: Rgb, alpha: number): void {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height || alpha <= 0) return;
  const a = alpha >= 1 ? 1 : alpha;
  const i = (y * canvas.width + x) * 4;
  const p = canvas.pixels;
  p[i] = Math.round(p[i] + (color.b - p[i]) * a);
  p[i + 1] = Math.round(p[i + 1] + (color.g - p[i + 1]) * a);
  p[i + 2] = Math.round(p[i + 2] + (color.r - p[i + 2]) * a);
  p[i + 3] = 255;
}

/**
 * Draws the arrow with its hot spot at (x, y), scaled by an integer factor (nearest neighbour), and
 * clipped to `clip` when given (the slot of the window the pointer is over).
 */
export function drawPointer(
  canvas: Canvas,
  x: number,
  y: number,
  scale: number,
  clip?: { x: number; y: number; width: number; height: number }
): void {
  const s = Math.max(1, Math.round(scale));
  const left = clip ? clip.x : 0;
  const top = clip ? clip.y : 0;
  const right = clip ? clip.x + clip.width : canvas.width;
  const bottom = clip ? clip.y + clip.height : canvas.height;
  for (let row = 0; row < ARROW.length; row++) {
    const line = ARROW[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === " ") continue;
      const color = ch === "X" ? OUTLINE : FILL;
      for (let dy = 0; dy < s; dy++) {
        const py = y + row * s + dy;
        if (py < top || py >= bottom) continue;
        for (let dx = 0; dx < s; dx++) {
          const px = x + col * s + dx;
          if (px < left || px >= right) continue;
          blendPixel(canvas, px, py, color, 1);
        }
      }
    }
  }
}

/**
 * Draws an anti-aliased ring (or a disc, when `thickness` >= `radius`) centred on (cx, cy).
 * `alpha` is the opacity of the ring's body, 0..1.
 */
export function drawRing(
  canvas: Canvas,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  color: Rgb,
  alpha: number,
  clip?: { x: number; y: number; width: number; height: number }
): void {
  if (radius <= 0 || alpha <= 0) return;
  const outer = radius;
  const inner = Math.max(0, radius - thickness);
  const x0 = Math.max(clip ? clip.x : 0, Math.floor(cx - outer - 1));
  const y0 = Math.max(clip ? clip.y : 0, Math.floor(cy - outer - 1));
  const x1 = Math.min(clip ? clip.x + clip.width : canvas.width, Math.ceil(cx + outer + 1));
  const y1 = Math.min(clip ? clip.y + clip.height : canvas.height, Math.ceil(cy + outer + 1));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      // --- Coverage: 1 inside the band, fading over one pixel at each edge
      const outerCoverage = Math.min(1, Math.max(0, outer - d + 0.5));
      const innerCoverage = inner > 0 ? Math.min(1, Math.max(0, d - inner + 0.5)) : 1;
      const coverage = Math.min(outerCoverage, innerCoverage);
      if (coverage > 0) blendPixel(canvas, x, y, color, coverage * alpha);
    }
  }
}
