import sharp from "sharp";
import { createHash } from "node:crypto";

import type { Frame } from "./frame";

export { captureFrame, pixelHex, rowRuns, summarizeRows, type Frame, type RowRun } from "./frame";

export function frameHash(frame: Frame): string {
  return createHash("sha256").update(frame.rgba).digest("hex").slice(0, 16);
}

/** Native resolution, no scaling: one PNG pixel per emulator pixel, alpha forced opaque. */
export async function framePng(frame: Frame): Promise<Buffer> {
  const opaque = new Uint8Array(frame.rgba);
  for (let i = 3; i < opaque.length; i += 4) opaque[i] = 0xff;
  return sharp(Buffer.from(opaque.buffer), { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .png()
    .toBuffer();
}
