/*
 * The beam position overlay's contract and geometry (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.1).
 *
 * A machine reports where its raster is as a `BeamPosition` (D4); everything the overlay draws or says
 * is a pure function of it, so the overlay never computes timing itself and never mixes units (T3).
 *
 * Every implementing machine has a *linear* raster in the displayed buffer: displayed pixel (0, 0) is
 * drawn at frame tact `firstVisibleTact`, a row is `tactsPerLine` tacts after the one above it, and a
 * buffer pixel takes `tactsPerBufferPixel` tacts. Tacts of a line past the buffer's right edge are
 * horizontal blanking (they run into the next row's left edge); lines above or below the buffer are
 * vertical blanking. This holds for the Next (HC units, two buffer pixels per HC, row 0 at
 * `firstVc`/`firstHc`) and for the Spectrum family, whose left border is drawn at the end of the
 * line before (`firstVisibleBorderTact`): seen from the buffer, that is the same linear map.
 *
 * Coordinates are always the *displayed* buffer's: the picture the canvas shows, after
 * `getBufferStartOffset()`.
 */

/** The frame tact's unit: Z80 T-states (3.5 MHz) on the Spectrum cores, 7 MHz HC units on the Next */
export type BeamUnit = "T" | "HC";

/** Where the beam is: drawing the paper or the border, or in blanking (outside the buffer) */
export type BeamRegion = "paper" | "border" | "hblank" | "vblank";

/** The raster timing of a machine, as the beam reports it */
export type BeamTiming = {
  unit: BeamUnit;
  tactsPerLine: number;
  linesPerFrame: number;
  /**
   * The frame tact raster line 0 starts at: 0, except on a machine whose frame starts with its
   * interrupt somewhere inside the raster (the Pentagon's starts 62 T into it)
   */
  lineStartTact?: number;
  /** The frame tact of displayed buffer pixel (0, 0) */
  firstVisibleTact: number;
  /** Tacts per buffer pixel across (0.5 on the Spectrum and the Next, 0.25 on the Timex) */
  tactsPerBufferPixel: number;
  /** The displayed buffer's size */
  bufferWidth: number;
  bufferHeight: number;
  /** The paper (the 256 x 192 display area) in displayed buffer pixels */
  paperLeft: number;
  paperTop: number;
  paperWidth: number;
  paperHeight: number;
};

/** Where the raster is now (D4); read fresh at every stop, never cached across a timing change (T4) */
export type BeamPosition = BeamTiming & {
  frameTact: number;
  /** The raster line (0 = the frame's first line) and the tact within it (the Next's VC and HC) */
  line: number;
  lineTact: number;
  region: BeamRegion;
  /** The beam's displayed buffer pixel; absent in blanking */
  bufferX?: number;
  bufferY?: number;
  /**
   * The first displayed buffer pixel (y * width + x) the picture has *not* drawn this frame: pixels
   * before it are this frame's, the rest are the previous frame's (T1, D2).
   */
  renderedUpTo: number;
};

/** The displayed buffer pixel the beam draws at `tact`, or the blanking region it is in */
export function tactToPixel(t: BeamTiming, tact: number): { region: BeamRegion; x?: number; y?: number } {
  const shifted = tact - t.firstVisibleTact;
  const y = Math.floor(shifted / t.tactsPerLine);
  if (y < 0 || y >= t.bufferHeight) return { region: "vblank" };
  const x = Math.floor((shifted - y * t.tactsPerLine) / t.tactsPerBufferPixel);
  if (x >= t.bufferWidth) return { region: "hblank" };
  return { region: regionOf(t, x, y), x, y };
}

/** The frame tact at which the beam draws displayed buffer pixel (x, y) (D6) */
export function pixelToTact(t: BeamTiming, x: number, y: number): number {
  return t.firstVisibleTact + y * t.tactsPerLine + Math.floor(x * t.tactsPerBufferPixel);
}

/** Paper or border, for a displayed buffer pixel */
export function regionOf(t: BeamTiming, x: number, y: number): "paper" | "border" {
  return x >= t.paperLeft && x < t.paperLeft + t.paperWidth && y >= t.paperTop && y < t.paperTop + t.paperHeight
    ? "paper"
    : "border";
}

/**
 * The first displayed buffer pixel not drawn by frame tact `tact` (exclusive): 0 before the picture,
 * width * height after it, and the next row's first pixel in horizontal blanking.
 */
export function drawnUpTo(t: BeamTiming, tact: number): number {
  const total = t.bufferWidth * t.bufferHeight;
  const shifted = tact - t.firstVisibleTact;
  if (shifted < 0) return 0;
  const y = Math.floor(shifted / t.tactsPerLine);
  if (y >= t.bufferHeight) return total;
  const x = Math.ceil((shifted - y * t.tactsPerLine) / t.tactsPerBufferPixel);
  return Math.min(total, y * t.bufferWidth + Math.min(x, t.bufferWidth));
}

/** The raster line and the tact within it of frame tact `tact` */
export function rasterLineOf(t: BeamTiming, tact: number): { line: number; lineTact: number } {
  const frame = tactsInFrame(t);
  const raster = (((tact - (t.lineStartTact ?? 0)) % frame) + frame) % frame;
  return { line: Math.floor(raster / t.tactsPerLine), lineTact: raster % t.tactsPerLine };
}

/** Builds the position for frame tact `frameTact` of a timing; `renderedUpTo` defaults to the beam */
export function beamAt(t: BeamTiming, frameTact: number, renderedUpTo?: number): BeamPosition {
  const where = tactToPixel(t, frameTact);
  return {
    ...t,
    frameTact,
    ...rasterLineOf(t, frameTact),
    region: where.region,
    bufferX: where.x,
    bufferY: where.y,
    renderedUpTo: renderedUpTo ?? drawnUpTo(t, frameTact)
  };
}

/** Tacts in a frame */
export function tactsInFrame(t: BeamTiming): number {
  return t.tactsPerLine * t.linesPerFrame;
}

/**
 * How far the beam is from displayed buffer pixel (x, y) (D6): the tacts until it draws it, or
 * "drawn" when it already has this frame.
 */
export function tactsUntil(beam: BeamPosition, x: number, y: number): number | "drawn" {
  const target = pixelToTact(beam, x, y);
  return target <= beam.frameTact ? "drawn" : target - beam.frameTact;
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");

/** The tact within the line, named for the unit: the Next's `hc`, the Spectrum's line tact */
const lineTactLabel = (unit: BeamUnit) => (unit === "HC" ? "hc" : "tact");

/** "paper row 75", "top border", "bottom border" for a displayed buffer row */
export function describeRow(t: BeamTiming, y: number): string {
  if (y < t.paperTop) return "top border";
  if (y >= t.paperTop + t.paperHeight) return "bottom border";
  return `paper row ${y - t.paperTop}`;
}

/**
 * The pill's text (D1, D5): `line 123 · paper row 75 · hc 210 · HC 56,088`; in blanking the region
 * is named (`HBLANK`, `VBLANK · 12 lines to the top border`).
 */
export function describeBeam(beam: BeamPosition): string {
  const parts = [`line ${beam.line}`];
  if (beam.region === "vblank") {
    const firstLine = rasterLineOf(beam, beam.firstVisibleTact).line;
    const toTop = (firstLine - beam.line + beam.linesPerFrame) % beam.linesPerFrame;
    parts.push(`VBLANK · ${toTop} line${toTop === 1 ? "" : "s"} to the top border`);
  } else if (beam.region === "hblank") {
    parts.push("HBLANK");
  } else if (beam.bufferY !== undefined) {
    parts.push(describeRow(beam, beam.bufferY));
  }
  parts.push(`${lineTactLabel(beam.unit)} ${beam.lineTact}`, `${beam.unit} ${n(beam.frameTact)}`);
  return parts.join(" · ");
}

/**
 * The hover readout (D6) for displayed buffer pixel (x, y): its line, line tact and frame tact, and
 * how far the beam is from it.
 */
export function describePixel(beam: BeamPosition, x: number, y: number): string {
  const tact = pixelToTact(beam, x, y);
  const until = tactsUntil(beam, x, y);
  const { line, lineTact } = rasterLineOf(beam, tact);
  return [
    `(${x}, ${y})`,
    `line ${line}`,
    `${lineTactLabel(beam.unit)} ${lineTact}`,
    `${beam.unit} ${n(tact)}`,
    until === "drawn" ? "drawn" : `in ${n(until)} ${beam.unit}`
  ].join(" · ");
}
