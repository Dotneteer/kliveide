import sharp from "sharp";

import type { Frame } from "./capture";

/** Mismatching pixels in magenta over a dimmed copy of `a`. */
export async function diffPng(a: Frame, b: Frame): Promise<Buffer> {
  const out = new Uint8Array(a.width * a.height * 4);
  for (let i = 0; i < out.length; i += 4) {
    const same = a.rgba[i] === b.rgba[i] && a.rgba[i + 1] === b.rgba[i + 1] && a.rgba[i + 2] === b.rgba[i + 2];
    if (same) {
      out[i] = a.rgba[i] >> 2; out[i + 1] = a.rgba[i + 1] >> 2; out[i + 2] = a.rgba[i + 2] >> 2;
    } else {
      out[i] = 0xff; out[i + 1] = 0x00; out[i + 2] = 0xff;
    }
    out[i + 3] = 0xff;
  }
  return sharp(Buffer.from(out.buffer), { raw: { width: a.width, height: a.height, channels: 4 } }).png().toBuffer();
}

/**
 * Tiles frames into one labelled image.
 *
 * The contact sheet is what makes motion reviewable from a single picture: a bar that should step
 * down one line per frame shows as a staircase, and a missed or doubled step is visible at a glance.
 * Frames keep full resolution (a 1-line step must stay a 1-pixel step); only the label strip is added.
 */
export async function contactSheet(frames: Array<{ frame: number; image: Frame }>, columns = 4): Promise<Buffer> {
  const { width, height } = frames[0].image;
  const label = 20;
  const gap = 6;
  const rows = Math.ceil(frames.length / columns);
  const sheetW = columns * width + (columns - 1) * gap;
  const sheetH = rows * (height + label) + (rows - 1) * gap;
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < frames.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const left = col * (width + gap);
    const top = row * (height + label + gap);
    const opaque = new Uint8Array(frames[i].image.rgba);
    for (let j = 3; j < opaque.length; j += 4) opaque[j] = 0xff;
    composites.push({ input: Buffer.from(opaque.buffer), raw: { width, height, channels: 4 }, left, top: top + label });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${label}"><rect width="100%" height="100%" fill="#202020"/><text x="4" y="15" font-family="monospace" font-size="14" fill="#ffffff">frame ${frames[i].frame}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left, top });
  }
  return sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: "#808080" } })
    .composite(composites)
    .png()
    .toBuffer();
}
