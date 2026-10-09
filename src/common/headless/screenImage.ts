import type { ScreenImage } from "@common/messaging/EmuApi";

/*
 * The emulated picture as RGBA bytes (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D16): the visible part
 * of a machine's pixel buffer, exactly what the emulator panel draws (before its scan-line effect).
 * The emulator's `getScreenImage` (the automation server's `screen.capture`) and `klive run
 * --screenshot` both take it from here, so the live and the headless picture are the same bytes.
 */

/** The part of a machine the picture needs */
export type PictureMachine = {
  readonly screenWidthInPixels: number;
  readonly screenHeightInPixels: number;
  getPixelBuffer(): Uint32Array;
  getBufferStartOffset?(): number;
};

/** The picture as it was last rendered; a copy, since a running machine keeps drawing */
export function screenImageOf(machine: PictureMachine): ScreenImage {
  const width = machine.screenWidthInPixels;
  const height = machine.screenHeightInPixels;
  const start = machine.getBufferStartOffset?.() ?? 0;
  const words = machine.getPixelBuffer().subarray(start, start + width * height);
  const pixels = new Uint8Array(width * height * 4);
  pixels.set(new Uint8Array(words.buffer, words.byteOffset, words.byteLength));
  return { width, height, pixels };
}
