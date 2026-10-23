import { describe, expect, it } from "vitest";

import { drawnUpTo, tactToPixel } from "@common/utils/beamGeometry";
import { expectSameBytes } from "../expectBytes";
import { createHtSession, type Ht1080zTestSession } from "../harness/ht1080z";

/*
 * The beam position overlay on the HT-1080Z (`.plans/BEAM_POSITION_OVERLAY_PLAN.md`; `ht1080z-video.c`):
 * one T-state per 6-dot character slot, slot s of a line showing the byte read at s - 2, the picture
 * 72 dots and 48 lines into the 528 x 288 buffer.
 */

const LINE = 112;
const WHITE = 0xffffffff;

/** Fills the video RAM with one code, through the memory map (the CPU's view) */
function fillVideo(s: Ht1080zTestSession, code: number): void {
  s.poke(0x3c00, new Array(1024).fill(code));
}

/** Steps until the frame tact is at least `tact` */
function stepTo(s: Ht1080zTestSession, tact: number): void {
  for (let i = 0; i < 100000 && s.machine.getBeamPosition().frameTact < tact; i++) s.step(1);
}

describe("HT-1080Z beam position", () => {
  it("maps line and slot to the buffer pixel the renderer draws there", async () => {
    const s = (await createHtSession()).bootToPrompt();
    const t = s.machine.getBeamPosition();
    expect(t).toMatchObject({ unit: "T", tactsPerLine: LINE, linesPerFrame: 312, bufferWidth: 528, bufferHeight: 288 });
    // --- Slot 2 of line 0 is the first dot of the picture; slot 65 of line 191 its last character
    expect(tactToPixel(t, 2)).toEqual({ region: "paper", x: 72, y: 48 });
    expect(tactToPixel(t, 191 * LINE + 65)).toEqual({ region: "paper", x: 72 + 63 * 6, y: 48 + 191 });
    // --- Before slot 2 and after slot 65 the beam is in the side borders, then in blanking
    expect(tactToPixel(t, 100 * LINE + 1)).toMatchObject({ region: "border", y: 148 });
    expect(tactToPixel(t, 100 * LINE + 66)).toMatchObject({ region: "border", y: 148 });
    expect(tactToPixel(t, 100 * LINE + 100)).toEqual({ region: "hblank" });
    // --- Lines 240 on are below the buffer
    expect(tactToPixel(t, 250 * LINE)).toEqual({ region: "vblank" });
  });

  it("draws the paused picture up to the beam, and the previous frame's below it", async () => {
    const s = (await createHtSession()).bootToPrompt();
    fillVideo(s, 0xbf);
    s.runFrames(2);
    // --- New content at the frame boundary; stop with the beam inside line 100's picture
    fillVideo(s, 0x80);
    stepTo(s, 100 * LINE + 30);
    const before = s.machine.getBeamPosition();
    s.machine.renderToBeamPreview();
    const after = s.machine.getBeamPosition();
    expect(after.frameTact).toBe(before.frameTact);
    expect(after.line).toBe(100);
    expect(after.region).toBe("paper");
    // --- Drawn exactly up to the reads before the beam: two slots past the dots coming out now
    expect(after.renderedUpTo).toBe(drawnUpTo(after, after.frameTact + 2));
    expect(after.renderedUpTo).toBeGreaterThanOrEqual(before.renderedUpTo);
    const pixels = s.machine.getPixelBuffer();
    const at = (x: number, y: number) => pixels[y * 528 + x];
    // --- Line 50 is this frame's (the empty blocks), line 150 still the last frame's (full blocks)
    expect(at(72 + 10 * 6, 48 + 50)).not.toBe(WHITE);
    expect(at(72 + 10 * 6, 48 + 150)).toBe(WHITE);
  });

  it("changes nothing the machine draws later", async () => {
    const run = async (preview: boolean) => {
      const s = (await createHtSession()).bootToPrompt();
      fillVideo(s, 0xbf);
      s.runFrames(1);
      stepTo(s, 80 * LINE + 20);
      if (preview) s.machine.renderToBeamPreview();
      fillVideo(s, 0x83);
      s.runFrames(3);
      return { pixels: new Uint8Array(s.machine.getPixelBuffer().buffer.slice(0)), memory: s.machine.saveMachineState().image };
    };
    const plain = await run(false);
    const previewed = await run(true);
    expectSameBytes(previewed.pixels, plain.pixels, "the pictures");
    expectSameBytes(previewed.memory, plain.memory, "the images");
  });
});
