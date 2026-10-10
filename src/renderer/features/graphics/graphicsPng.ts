import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import {
  decodeGraphics,
  frameGeometry,
  GRAPHIC_INK,
  GRAPHIC_PAPER,
  normalizeLook,
  type GraphicsLook
} from "@common/reverse/graphicsDecode";

/*
 * *Save as PNG* (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.5, Q5): a span of bytes, or a named
 * graphic, drawn with the look and scaled 1:1 or at the view's zoom.
 */

/** The RGBA pixels of the frames covering a span, in a sheet `columns` wide. */
export function graphicsRgba(
  bytes: ArrayLike<number>,
  look: GraphicsLook,
  span: { start: number; end: number },
  columns: number,
  scale: number
): { width: number; height: number; rgba: Uint8ClampedArray } {
  const l = normalizeLook({ ...look, frameGap: false });
  const frameBytes = frameGeometry(l).frameBytes;
  const frames = Math.max(1, Math.ceil((span.end - span.start + 1) / frameBytes));
  const decoded = decodeGraphics(bytes, l, span.start, frames, Math.max(1, Math.min(columns, frames)));
  const width = decoded.width * scale;
  const height = decoded.height * scale;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const colour = (abgr: number) => [abgr & 0xff, (abgr >> 8) & 0xff, (abgr >> 16) & 0xff];
  const ink = colour(SPECTRUM_48_COLORS[l.ink]);
  const paper = colour(SPECTRUM_48_COLORS[l.paper]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = decoded.pixels[Math.floor(y / scale) * decoded.width + Math.floor(x / scale)];
      const i = (y * width + x) * 4;
      if (p === GRAPHIC_INK || p === GRAPHIC_PAPER) {
        const c = p === GRAPHIC_INK ? ink : paper;
        rgba[i] = c[0];
        rgba[i + 1] = c[1];
        rgba[i + 2] = c[2];
        rgba[i + 3] = 255;
      }
    }
  }
  return { width, height, rgba };
}

/** Encode RGBA pixels as a PNG file, through a canvas. */
export async function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A canvas is not available to draw the PNG.");
  const image = context.createImageData(width, height);
  image.data.set(rgba);
  context.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The PNG could not be encoded.");
  return new Uint8Array(await blob.arrayBuffer());
}
