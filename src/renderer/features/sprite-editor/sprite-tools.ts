import { SpriteTools } from "./sprite-common";
import {
  SpritePoint,
  drawEllipse,
  drawLine,
  drawRectangle,
  floodFill
} from "./sprite-raster";

/**
 * Applying a drawing tool between two points.
 *
 * Extracted so the pointer and the keyboard cannot drift apart. The drag machinery in
 * `SpriteEditorGrid` used to own this `switch` outright, which meant a keyboard "draw here" had to
 * either re-implement it or reach into the grid - and a second copy of a tool table is exactly the
 * kind of thing that gets one case added to it and not the other.
 */

export type ToolResult = {
  map: Uint8Array;
  /**
   * Whether the result becomes the base for the next step of the same gesture.
   *
   * True for tools that accumulate (pencil strokes, successive fills); false for shapes, which are
   * re-drawn from the gesture's starting bitmap on every move so the rubber-band preview replaces
   * itself rather than smearing.
   */
  accumulate: boolean;
};

export function applyTool(
  map: Uint8Array,
  tool: SpriteTools,
  from: SpritePoint,
  to: SpritePoint,
  penIndex: number,
  fillIndex: number
): ToolResult | undefined {
  switch (tool) {
    case "pencil":
      /*
       * Interpolated from the previous position, not a dot at the current one. A per-move dot
       * leaves gaps the moment the pointer outruns the event rate, which it always does. For a
       * keyboard press `from` and `to` are the same point, so this draws exactly one pixel.
       */
      return { map: drawLine(map, from, to, penIndex), accumulate: true };
    case "paint":
      return { map: floodFill(map, to, penIndex), accumulate: true };
    case "line":
      return { map: drawLine(map, from, to, penIndex), accumulate: false };
    case "rectangle":
      return { map: drawRectangle(map, from, to, penIndex), accumulate: false };
    case "rectangle-filled":
      return { map: drawRectangle(map, from, to, penIndex, fillIndex), accumulate: false };
    case "circle":
      return { map: drawEllipse(map, from, to, penIndex), accumulate: false };
    case "circle-filled":
      return { map: drawEllipse(map, from, to, penIndex, fillIndex), accumulate: false };
    default:
      // "select" marks rather than draws, and so does any tool added without a case here. Returning
      // `undefined` rather than a null map is what stops a missing case reaching the sprite list.
      return undefined;
  }
}

/** Whether a tool marks the canvas at all. */
export const toolDraws = (tool: SpriteTools): boolean => tool !== "select";
