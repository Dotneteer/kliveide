import type { TvcTestSession } from "../harness/tvc";

/*
 * A TVC without its ROM running: page 0 shows U0 and the CPU sits in `DI; HALT` there, so nothing but
 * the test touches the video. The CRTC gets the BASIC ROM's values (TVC_VIDEO_GENERATION.md Part 3).
 *
 * With those values the TV picture (608 x 288) shows paper line L, byte C at x = 48 + 8C, y = 24 + L:
 * the line sync starts 2 characters after HS (character 77), the window 18 characters after the
 * line sync, and the paper one character after DE (Part 8).
 */

export const ROM_CRTC = [99, 64, 75, 0x32, 77, 2, 60, 66, 0, 3, 3, 3, 0, 0, 0x0e, 0xff];

export const PAPER_LEFT = 48;
export const PAPER_TOP = 24;
export const SCREEN_WIDTH = 608;

/** Palette port values (I/G/R/B in bits 6/4/2/0) */
export const PAL = { black: 0x00, white: 0x55, red: 0x04, green: 0x10, blue: 0x01, brightGreen: 0x50 };

/** The picture colours (0xAABBGGRR): a gun is off, dark (0x92) or bright (0xff) */
export const RGB = {
  black: 0xff000000,
  darkBlue: 0xff920000,
  darkRed: 0xff000092,
  darkGreen: 0xff009200,
  darkYellow: 0xff009292,
  brightGreen: 0xff00ff00,
  brightWhite: 0xffffffff
};

export function writeCrtc(s: TvcTestSession, registers: number[]): void {
  registers.forEach((value, index) => {
    s.wasm.tvcWritePort(0x70, index);
    s.wasm.tvcWritePort(0x71, value);
  });
}

/**
 * Parks the CPU in `DI; HALT` in U0 (port 02h = 10h: U0, U1, video RAM, CART) and programs the CRTC.
 * Runs `settle` frames so the TV has locked to the syncs. With `halt: false` the CPU loops in
 * `DI; JR $` instead, so a test can move PC (a HALTed CPU stays halted when PC changes).
 */
export function bareMachine(
  s: TvcTestSession,
  { settle = 3, crtc = ROM_CRTC, halt = true }: { settle?: number; crtc?: number[]; halt?: boolean } = {}
): void {
  s.wasm.tvcWritePort(0x02, 0x10);
  s.poke(0x0000, halt ? [0xf3, 0x76] : [0xf3, 0x18, 0xfe]);
  s.machine.pc = 0x0000;
  s.machine.sp = 0x7ff0;
  writeCrtc(s, crtc);
  s.runFrames(settle);
}

/** A paper byte: line 0-239, byte 0-63, at its video RAM address (page 2 shows VID0 at 8000h) */
export function pokePaper(s: TvcTestSession, line: number, column: number, value: number): void {
  s.poke(0x8000 + line * 64 + column, value);
}

export function pixel(s: TvcTestSession, x: number, y: number): number {
  return s.machine.getPixelBuffer()[y * SCREEN_WIDTH + x] >>> 0;
}

/** The eight dots of paper byte `column` on paper line `line` */
export function paperDots(s: TvcTestSession, line: number, column: number): number[] {
  return Array.from({ length: 8 }, (_, i) => pixel(s, PAPER_LEFT + column * 8 + i, PAPER_TOP + line));
}

/** The CRTC's position: the next character it runs, as a scan line (row * 4 + raster) and character */
export function beam(s: TvcTestSession): { line: number; char: number } {
  const c = s.crtc();
  return { line: c.row * 4 + c.raster, char: c.h };
}

/** Steps (halted cycles, 4 T each) until `predicate` holds; throws after `limit` steps */
export function stepUntil(s: TvcTestSession, predicate: () => boolean, limit = 200_000): void {
  for (let i = 0; i < limit; i++) {
    if (predicate()) return;
    s.step(1);
  }
  throw new Error("stepUntil: the condition never held");
}

/**
 * Writes the picture as a PNG (2x, nearest neighbour) when `TVC_SHOTS_PNG` names a folder: how a
 * golden's picture is checked by eye before its hash is recorded
 */
export async function writeShotIfAsked(s: TvcTestSession, name: string): Promise<void> {
  const dir = process.env.TVC_SHOTS_PNG;
  if (!dir) return;
  const { default: sharp } = await import("sharp");
  const pixels = s.screenPixels();
  await sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), { raw: { width: 608, height: 288, channels: 4 } })
    .resize(1216, 1152, { kernel: "nearest", fit: "fill" })
    .png()
    .toFile(`${dir}/${name}.png`);
}

/** The SHA-1 of the picture */
export async function pictureHash(s: TvcTestSession): Promise<string> {
  const { createHash } = await import("node:crypto");
  const pixels = s.screenPixels();
  return createHash("sha1").update(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)).digest("hex");
}
