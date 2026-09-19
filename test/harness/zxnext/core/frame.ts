import type { NextMachine } from "./machines";

/*
 * Browser-safe frame helpers (no Node imports): used by the headless runner and by the browser page.
 */

export type Frame = {
  width: number;
  height: number;
  /** RGBA, row-major, exactly what the emulator panel hands to `ImageData`. */
  rgba: Uint8Array;
};

/**
 * Copies the visible part of the machine's pixel buffer.
 *
 * Mirrors `useEmulatorScreen.displayScreenData`: the buffer is little-endian `0xAABBGGRR` words, so
 * its bytes are already RGBA, and the visible frame starts at `getBufferStartOffset()`. Copied, not
 * viewed: the next frame overwrites the machine's buffer in place.
 */
export function captureFrame(machine: NextMachine): Frame {
  const width = machine.screenWidthInPixels;
  const height = machine.screenHeightInPixels;
  const words = machine.getPixelBuffer();
  const start = machine.getBufferStartOffset();
  const bytes = new Uint8Array(words.buffer, words.byteOffset + start * 4, width * height * 4);
  return { width, height, rgba: new Uint8Array(bytes) };
}

/**
 * Runs one frame the way the emulator panel does, and calls `onDisplayed` with the buffer at the
 * moment the panel would paint it.
 *
 * `EmulatorPanel.machineFrameCompleted` displays the pixel buffer after `executeMachineFrame()`. Both
 * cores draw the frame while it executes (the TypeScript core tact by tact, the WASM core with its
 * beam-racing raster). The panel used to call `renderInstantScreen()` after every frame as well - only
 * to keep a copy of the displayed picture - which the harness mirrored; it no longer does (B11).
 */
export function runDisplayedFrame(machine: NextMachine, onDisplayed?: () => void): void {
  machine.executeMachineFrame();
  onDisplayed?.();
}

export function pixelHex(frame: Frame, x: number, y: number): string {
  const i = (y * frame.width + x) * 4;
  const r = frame.rgba[i], g = frame.rgba[i + 1], b = frame.rgba[i + 2];
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export type RowRun = { from: number; to: number; rgb: string };

/** Run-length colour spans of one row. `to` is inclusive. */
export function rowRuns(frame: Frame, y: number): RowRun[] {
  const runs: RowRun[] = [];
  for (let x = 0; x < frame.width; x++) {
    const rgb = pixelHex(frame, x, y);
    const last = runs[runs.length - 1];
    if (last && last.rgb === rgb) last.to = x;
    else runs.push({ from: x, to: x, rgb });
  }
  return runs;
}

/**
 * The whole frame as rows of runs, with identical consecutive rows collapsed into one entry.
 *
 * Built for reading: a static Copper band screen collapses to a handful of lines, which both a
 * human and an AI reviewer can check against the expectation without counting pixels in a PNG.
 */
export function summarizeRows(frame: Frame): Array<{ fromRow: number; toRow: number; runs: string }> {
  const out: Array<{ fromRow: number; toRow: number; runs: string }> = [];
  for (let y = 0; y < frame.height; y++) {
    const runs = rowRuns(frame, y)
      .map((r) => `${r.from}-${r.to}:${r.rgb}`)
      .join(" ");
    const last = out[out.length - 1];
    if (last && last.runs === runs) last.toRow = y;
    else out.push({ fromRow: y, toRow: y, runs });
  }
  return out;
}
