import {
  describeBeam,
  tactToPixel,
  tactsInFrame,
  type BeamPosition
} from "@common/utils/beamGeometry";
import type { ScreenLabel, ScreenShape } from "./EmulatorScreenOverlay";

/*
 * What the beam position overlay draws (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.4): a pure function
 * of the machine's `BeamPosition`, so it is tested without a machine or a canvas. Shapes are in
 * displayed buffer pixels; their `className` is a role the component maps to its stylesheet.
 */

/** The roles a shape or label can have */
export type BeamRole = "beamLine" | "beamMarker" | "beamEdge" | "stale" | "staleLabel" | "copper" | "copperLabel";

/** The Copper's own position when it differs from the CPU's (D7, T7): its last breakpoint hit */
export type CopperMarker = { tact: number; label: string };

export type BeamOverlayState = {
  beam: BeamPosition;
  /** The picture is Instant Screen's whole-frame render: no fresh/stale split (T8) */
  instant: boolean;
  copper?: CopperMarker;
};

export type BeamOverlayModel = {
  shapes: (ScreenShape & { className: BeamRole })[];
  labels: (ScreenLabel & { className: BeamRole })[];
  /** The pill's text (D1) */
  pill: string;
};

/** The id of the hatch pattern the stale region is filled with */
export const BEAM_HATCH_ID = "klive-beam-hatch";

/** Half the beam marker's height, in buffer rows */
const TICK = 6;

/**
 * The frame tact of a Copper beam position (`cvc`, `hc_ula`; `.plans/COPPER_DEBUGGING_PLAN.md`) on
 * the Next. `cvc` is loaded with the `$64` offset at the first paper line, and `hc_ula` 0 is twelve
 * pixels before paper x 0, so seen from the buffer the paper corner is (cvc = offset, hc_ula = 12).
 */
export function copperHitTact(beam: BeamPosition, hit: { line: number; hc: number }, lineOffset: number): number {
  const frame = tactsInFrame(beam);
  const tact =
    beam.firstVisibleTact +
    (beam.paperTop + hit.line - lineOffset) * beam.tactsPerLine +
    Math.round(beam.paperLeft * beam.tactsPerBufferPixel) +
    (hit.hc - 12);
  return ((tact % frame) + frame) % frame;
}

/** The pill's text (D1, T8) */
export function beamOverlayPill({ beam, instant }: Pick<BeamOverlayState, "beam" | "instant">): string {
  return describeBeam(beam) + (instant ? " · instant screen" : "");
}

/** The overlay for a paused machine */
export function beamOverlayModel({ beam, instant, copper }: BeamOverlayState): BeamOverlayModel {
  const W = beam.bufferWidth;
  const H = beam.bufferHeight;
  const total = W * H;
  const shapes: BeamOverlayModel["shapes"] = [];
  const labels: BeamOverlayModel["labels"] = [];

  // --- D2: the previous frame's part of the picture, hatched - except over Instant Screen (T8)
  if (!instant) {
    const from = Math.max(0, Math.min(total, beam.renderedUpTo));
    if (from < total) {
      const y0 = Math.floor(from / W);
      const x0 = from % W;
      if (x0 > 0) {
        shapes.push({ kind: "rect", className: "stale", x: x0, y: y0, width: W - x0, height: 1 });
        if (y0 + 1 < H) shapes.push({ kind: "rect", className: "stale", x: 0, y: y0 + 1, width: W, height: H - y0 - 1 });
      } else {
        shapes.push({ kind: "rect", className: "stale", x: 0, y: y0, width: W, height: H - y0 });
      }
      const nearBottom = y0 > H - 16;
      labels.push({
        className: "staleLabel",
        x: Math.min(x0, W - 1),
        y: nearBottom ? y0 : y0 + 1,
        place: nearBottom ? "above" : "below",
        align: x0 > W / 2 ? "end" : "start",
        text: "previous frame",
        testId: "beam-stale-label"
      });
    }
  }

  // --- D1: the beam's row and pixel; D5: an edge marker in blanking
  if (beam.bufferX !== undefined && beam.bufferY !== undefined) {
    const y = beam.bufferY + 0.5;
    shapes.push({ kind: "line", className: "beamLine", x1: 0, y1: y, x2: W, y2: y, title: "Beam" });
    const x = beam.bufferX + 0.5;
    shapes.push({ kind: "line", className: "beamMarker", x1: x, y1: beam.bufferY - TICK, x2: x, y2: beam.bufferY + TICK + 1 });
  } else if (beam.region === "hblank") {
    // --- Between rows: the row just finished, marked at the right edge it left
    const row = Math.max(0, Math.min(H - 1, Math.floor((beam.frameTact - beam.firstVisibleTact) / beam.tactsPerLine)));
    shapes.push({ kind: "line", className: "beamLine", x1: 0, y1: row + 0.5, x2: W, y2: row + 0.5, title: "Beam (horizontal blanking)" });
    shapes.push({ kind: "line", className: "beamEdge", x1: W - 0.5, y1: row - TICK, x2: W - 0.5, y2: row + TICK + 1 });
  } else {
    // --- Vertical blanking: pinned to the edge the beam left (below the picture) or will enter
    const below = beam.frameTact >= beam.firstVisibleTact + H * beam.tactsPerLine;
    const y = below ? H - 0.5 : 0.5;
    shapes.push({ kind: "line", className: "beamEdge", x1: 0, y1: y, x2: W, y2: y, title: "Beam (vertical blanking)" });
  }

  // --- D7, T7: the Copper's own position, never merged with the CPU's
  if (copper && copper.tact !== beam.frameTact) {
    const at = tactToPixel(beam, copper.tact);
    if (at.x !== undefined && at.y !== undefined) {
      const x = at.x + 0.5;
      shapes.push({ kind: "line", className: "copper", x1: x, y1: at.y - TICK, x2: x, y2: at.y + TICK + 1, title: copper.label });
      shapes.push({ kind: "line", className: "copper", x1: at.x - 4, y1: at.y + 0.5, x2: at.x + 6, y2: at.y + 0.5 });
      labels.push({
        className: "copperLabel",
        x: at.x + (at.x > W / 2 ? -4 : 6),
        y: Math.max(0, at.y - TICK),
        place: "above",
        align: at.x > W / 2 ? "end" : "start",
        text: copper.label,
        testId: "beam-copper-label"
      });
    }
  }

  return { shapes, labels, pill: beamOverlayPill({ beam, instant }) };
}
