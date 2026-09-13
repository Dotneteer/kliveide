/**
 * Pure raster operations on a 16x16, 8-bit-per-pixel Next sprite.
 *
 * Everything here is `(map, ...) => new Uint8Array`: no React, no refs, no DOM. That is the whole
 * point of the module. The predecessors of these functions lived inside `SpriteEditorGrid.tsx`,
 * interleaved with pointer capture and SVG rendering, and two of them were wrong in ways nothing
 * could see:
 *
 * - The filled-ellipse span fill was `while (!pixels[row][col]) { plot(); col--; }`. Out of bounds
 *   `pixels[row][col]` is `undefined`, so the loop condition never went false while `plotPixel`
 *   silently no-opped on its own bounds check - **an infinite loop that hung the renderer**. If
 *   `row` itself was out of range, `pixels[row]` was `undefined` and it threw instead.
 * - The drag handler derived row/col from raw `clientX`/`clientY` and never clamped them, and the
 *   pencil wrote `map[row * 16 + col]` with no bounds check at all, so `col === -1` wrapped into
 *   the previous row's last pixel.
 *
 * Two rules follow, and both are load-bearing:
 *
 * 1. **Every write goes through `plot`**, which is the only place that tests bounds. No function
 *    here indexes `map` directly.
 * 2. **Shapes clip; they do not clamp.** A rectangle dragged half off the sprite draws the half
 *    that is on it, rather than shrinking to fit - that is what every pixel editor does, and it is
 *    also why callers may pass coordinates outside 0..15 freely. `MAX_SPAN` bounds the work such a
 *    call can cost; see its note.
 */

/** A Next sprite pattern is always 16x16. */
export const SPRITE_DIM = 16;
export const SPRITE_SIZE = SPRITE_DIM * SPRITE_DIM;

/** Row/column rather than a bare pair, so the two cannot be swapped silently at a call site. */
export type SpritePoint = { row: number; col: number };

export const isInside = ({ row, col }: SpritePoint): boolean =>
  row >= 0 && row < SPRITE_DIM && col >= 0 && col < SPRITE_DIM;

/** Clamp a point onto the sprite. Used by the *input* path (a drag), never by the shape maths. */
export const clampToSprite = ({ row, col }: SpritePoint): SpritePoint => ({
  row: Math.min(SPRITE_DIM - 1, Math.max(0, Math.round(row))),
  col: Math.min(SPRITE_DIM - 1, Math.max(0, Math.round(col)))
});

/**
 * The furthest a coordinate is allowed to sit outside the sprite before it is pulled in.
 *
 * Shapes clip rather than clamp, so a caller may legitimately pass a point off the sprite - but the
 * ellipse's midpoint loops iterate once per unit of radius, so an unbounded coordinate is unbounded
 * work. At 16x the sprite, any arc still crossing the sprite is visually a straight line, so
 * nothing is lost by pinning the geometry there and a stray `clientX` cannot cost more than a few
 * hundred iterations.
 */
const MAX_SPAN = SPRITE_DIM * 16;
const bound = (v: number): number =>
  Number.isFinite(v) ? Math.min(MAX_SPAN, Math.max(-MAX_SPAN, Math.round(v))) : 0;
const boundPoint = (p: SpritePoint): SpritePoint => ({ row: bound(p.row), col: bound(p.col) });

/** The only place in this module that writes to a map. Out-of-range writes are dropped. */
function plot(map: Uint8Array, row: number, col: number, colorIndex: number): void {
  row = Math.round(row);
  col = Math.round(col);
  if (row < 0 || row >= SPRITE_DIM || col < 0 || col >= SPRITE_DIM) return;
  map[row * SPRITE_DIM + col] = colorIndex;
}

/** Read a pixel, or `undefined` outside the sprite. */
export function getPixel(map: Uint8Array, { row, col }: SpritePoint): number | undefined {
  return isInside({ row, col }) ? map[row * SPRITE_DIM + col] : undefined;
}

const copy = (map: Uint8Array): Uint8Array => new Uint8Array(map);

/** Order a pair of corners so `from` is the top-left. */
function normalize(from: SpritePoint, to: SpritePoint): [SpritePoint, SpritePoint] {
  const rows = [from.row, to.row].sort((a, b) => a - b);
  const cols = [from.col, to.col].sort((a, b) => a - b);
  return [
    { row: rows[0], col: cols[0] },
    { row: rows[1], col: cols[1] }
  ];
}

/** Paint a single pixel. A point outside the sprite is a no-op, never a wrap. */
export function setPixel(map: Uint8Array, at: SpritePoint, colorIndex: number): Uint8Array {
  const next = copy(map);
  plot(next, at.row, at.col, colorIndex);
  return next;
}

/** Bresenham. Endpoints may sit off the sprite; the visible part is drawn. */
export function drawLine(
  map: Uint8Array,
  from: SpritePoint,
  to: SpritePoint,
  colorIndex: number
): Uint8Array {
  const next = copy(map);
  const a = boundPoint(from);
  const b = boundPoint(to);

  const dx = Math.abs(b.col - a.col);
  const dy = Math.abs(b.row - a.row);
  const sx = a.col < b.col ? 1 : -1;
  const sy = a.row < b.row ? 1 : -1;
  let err = dx - dy;
  let x = a.col;
  let y = a.row;

  for (;;) {
    plot(next, y, x, colorIndex);
    if (x === b.col && y === b.row) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return next;
}

/** An outlined rectangle, optionally filled. */
export function drawRectangle(
  map: Uint8Array,
  from: SpritePoint,
  to: SpritePoint,
  colorIndex: number,
  fillColorIndex?: number
): Uint8Array {
  const next = copy(map);
  drawRectangleInto(next, from, to, colorIndex, fillColorIndex);
  return next;
}

function drawRectangleInto(
  map: Uint8Array,
  from: SpritePoint,
  to: SpritePoint,
  colorIndex: number,
  fillColorIndex?: number
): void {
  const [a, b] = normalize(boundPoint(from), boundPoint(to));
  // Iterate only over the part that can land on the sprite: the rectangle may be far larger.
  const rowStart = Math.max(a.row, 0);
  const rowEnd = Math.min(b.row, SPRITE_DIM - 1);
  const colStart = Math.max(a.col, 0);
  const colEnd = Math.min(b.col, SPRITE_DIM - 1);

  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      const onEdge = row === a.row || row === b.row || col === a.col || col === b.col;
      if (onEdge) {
        plot(map, row, col, colorIndex);
      } else if (fillColorIndex !== undefined) {
        plot(map, row, col, fillColorIndex);
      }
    }
  }
}

/**
 * An outlined ellipse, optionally filled.
 *
 * The midpoint-ellipse / Bresenham-circle split and the quarter-pixel `up`/`down` nudges are ported
 * unchanged from the original, because they are what gives small ellipses their hand-tuned look and
 * changing them would silently redraw everyone's sprites. What changed is only safety: the span
 * fill is bounded, and the coverage map is consulted through a helper that answers `true` for
 * anything off the sprite so a scan can never walk past the edge.
 */
export function drawEllipse(
  map: Uint8Array,
  from: SpritePoint,
  to: SpritePoint,
  colorIndex: number,
  fillColorIndex?: number
): Uint8Array {
  const next = copy(map);
  const [a, b] = normalize(boundPoint(from), boundPoint(to));

  // Anything thinner than 3 pixels in either axis has no ellipse worth drawing.
  if (b.row - a.row < 2 || b.col - a.col < 2) {
    drawRectangleInto(next, a, b, colorIndex, fillColorIndex);
    return next;
  }

  // Which sprite pixels the outline covers. Only the on-sprite part is tracked; `covered()`
  // reports everything else as covered, which is what terminates the fill scan at the edge.
  const covered: boolean[] = new Array(SPRITE_SIZE).fill(false);
  const isCovered = (row: number, col: number): boolean =>
    !isInside({ row, col }) || covered[row * SPRITE_DIM + col];

  const mark = (col: number, row: number, ci: number): void => {
    const r = Math.round(row);
    const c = Math.round(col);
    if (isInside({ row: r, col: c })) covered[r * SPRITE_DIM + c] = true;
    plot(next, r, c, ci);
  };

  const rx = Math.abs(b.col - a.col) / 2;
  const ry = Math.abs(b.row - a.row) / 2;
  const xc = a.col + rx;
  const yc = a.row + ry;

  const down = (v: number): number => (Number.isInteger(v) ? v : v - 0.25);
  const up = (v: number): number => (Number.isInteger(v) ? v : v + 0.25);

  const quad = (x: number, y: number): void => {
    mark(Math.min(x + up(xc), b.col), Math.min(y + up(yc), b.row), colorIndex);
    mark(Math.max(-x + down(xc), a.col), Math.min(y + down(yc), b.row), colorIndex);
    mark(Math.min(x + up(xc), b.col), Math.max(-y + down(yc), a.row), colorIndex);
    mark(Math.max(-x + down(xc), a.col), Math.max(-y + down(yc), a.row), colorIndex);
  };

  if (rx !== ry) {
    let x = 0;
    let y = ry;
    let dx = 2 * ry * ry * x;
    let dy = 2 * rx * rx * y;
    let d1 = ry * ry - rx * rx * ry + 0.25 * rx * rx;

    while (dx < dy) {
      quad(x, y);
      if (d1 < 0) {
        x++;
        dx += 2 * ry * ry;
        d1 += dx + ry * ry;
      } else {
        x++;
        y--;
        dx += 2 * ry * ry;
        dy -= 2 * rx * rx;
        d1 += dx - dy + ry * ry;
      }
    }

    let d2 =
      ry * ry * ((x + 0.5) * (x + 0.5)) + rx * rx * ((y - 1) * (y - 1)) - rx * rx * ry * ry;
    while (y >= 0) {
      quad(x, y);
      if (d2 > 0) {
        y--;
        dy -= 2 * rx * rx;
        d2 += rx * rx - dy;
      } else {
        y--;
        x++;
        dx += 2 * ry * ry;
        dy -= 2 * rx * rx;
        d2 += dx - dy + rx * rx;
      }
    }
  } else {
    // A true circle: Bresenham, eight-way symmetry.
    const octants = (x: number, y: number): void => {
      quad(x, y);
      mark(Math.min(y + up(xc), b.col), Math.min(x + up(yc), b.row), colorIndex);
      mark(Math.max(-y + down(xc), a.col), Math.min(x + up(yc), b.row), colorIndex);
      mark(Math.min(y + up(xc), b.col), Math.max(-x + down(yc), a.row), colorIndex);
      mark(Math.max(-y + down(xc), a.col), Math.max(-x + down(yc), a.row), colorIndex);
    };
    let x = 0;
    let y = rx;
    let d = 3 - 2 * rx;
    octants(x, y);
    while (y >= x) {
      x++;
      if (d > 0) {
        y--;
        d += 4 * (x - y) + 10;
      } else {
        d += 4 * x + 6;
      }
      octants(x, y);
    }
  }

  if (fillColorIndex !== undefined) {
    const mid = Math.floor((a.col + b.col) / 2);
    const rowStart = Math.max(a.row + 1, 0);
    const rowEnd = Math.min(b.row - 1, SPRITE_DIM - 1);
    for (let row = rowStart; row <= rowEnd; row++) {
      // Both scans are bounded by the sprite edge as well as by the outline: `isCovered` answers
      // `true` off-sprite, so neither loop can run away even if the outline missed this row.
      for (let col = mid; !isCovered(row, col); col--) plot(next, row, col, fillColorIndex);
      for (let col = mid + 1; !isCovered(row, col); col++) plot(next, row, col, fillColorIndex);
    }
  }

  return next;
}

/**
 * Four-way flood fill from a seed.
 *
 * Iterative rather than recursive - 256 pixels never threatened the stack, but the original read
 * `map[row * 16 + col]` *before* validating the coordinates, so a seed at `col === -1` sampled the
 * previous row's last pixel and compared against it.
 */
export function floodFill(map: Uint8Array, at: SpritePoint, colorIndex: number): Uint8Array {
  if (!isInside(at)) return copy(map);

  const next = copy(map);
  const startColor = next[at.row * SPRITE_DIM + at.col];
  if (startColor === colorIndex) return next;

  const stack: SpritePoint[] = [at];
  while (stack.length) {
    const { row, col } = stack.pop()!;
    if (!isInside({ row, col })) continue;
    if (next[row * SPRITE_DIM + col] !== startColor) continue;
    next[row * SPRITE_DIM + col] = colorIndex;
    stack.push({ row: row + 1, col }, { row: row - 1, col }, { row, col: col + 1 }, { row, col: col - 1 });
  }
  return next;
}

/* ------------------------------------------------------------------------------------------- */
/* Whole-sprite transforms                                                                      */
/* ------------------------------------------------------------------------------------------- */

const transform = (map: Uint8Array, pick: (row: number, col: number) => number): Uint8Array => {
  const next = new Uint8Array(SPRITE_SIZE);
  for (let row = 0; row < SPRITE_DIM; row++) {
    for (let col = 0; col < SPRITE_DIM; col++) {
      next[row * SPRITE_DIM + col] = map[pick(row, col)] ?? 0;
    }
  }
  return next;
};

const LAST = SPRITE_DIM - 1;

export const rotateCounterClockwise = (map: Uint8Array): Uint8Array =>
  transform(map, (row, col) => col * SPRITE_DIM + (LAST - row));

export const rotateClockwise = (map: Uint8Array): Uint8Array =>
  transform(map, (row, col) => (LAST - col) * SPRITE_DIM + row);

/** Mirror left-to-right. */
export const flipHorizontal = (map: Uint8Array): Uint8Array =>
  transform(map, (row, col) => row * SPRITE_DIM + (LAST - col));

/** Mirror top-to-bottom. */
export const flipVertical = (map: Uint8Array): Uint8Array =>
  transform(map, (row, col) => (LAST - row) * SPRITE_DIM + col);
