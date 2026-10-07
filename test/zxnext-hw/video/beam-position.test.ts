import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";
import type { Frame } from "../../harness/zxnext/core/frame";
import { pixelToTact, tactToPixel } from "@common/utils/beamGeometry";
import { apply, makeScene, sceneSession } from "../layers/_scene";

/*
 * The beam position overlay on the ZX Spectrum Next core (`.plans/BEAM_POSITION_OVERLAY_PLAN.md`
 * Phase 1).
 *
 * - The reported beam agrees with the raster's own counters and with each timing's size
 *   (zxula_timing.vhd: 48K 448 x 312, 128K / +3 456 x 311, Pentagon 448 x 320, 60 Hz 264 lines),
 *   and it is read fresh after a timing change (T4).
 * - The paused picture rendered to the beam (D3) is this frame's picture up to the beam: it equals
 *   the machine's own picture of the same frame once the run reaches the frame end, and the machine's
 *   stale picture past the beam (T1).
 * - Rendering it changes nothing (T2): the memory image right after it, and after more frames with
 *   screen writes mid-row, is byte for byte the image of the same run without it.
 */

const W = 720;
const H = 288;

type Timing = { name: string; nr03: number; hz60: boolean; tactsPerLine: number; lines: number };
const TIMINGS: Timing[] = [
  { name: "48K 50 Hz", nr03: 0x90, hz60: false, tactsPerLine: 224, lines: 312 },
  { name: "48K 60 Hz", nr03: 0x90, hz60: true, tactsPerLine: 224, lines: 264 },
  { name: "128K 50 Hz", nr03: 0xa0, hz60: false, tactsPerLine: 228, lines: 311 },
  { name: "+3 50 Hz", nr03: 0xb0, hz60: false, tactsPerLine: 228, lines: 311 },
  { name: "+3 60 Hz", nr03: 0xb0, hz60: true, tactsPerLine: 228, lines: 264 },
  { name: "Pentagon", nr03: 0xc0, hz60: false, tactsPerLine: 224, lines: 320 }
];

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;

/** Steps until the beam is past frame tact `tact` (7 MHz HC) of the current frame */
function stepToTact(s: NextTestSession, tact: number): void {
  const ex = s.machine.wasmV2Runtime!.exports;
  for (let i = 0; i < 400000; i++) {
    s.step(1);
    if (ex.zxnextGetCurrentFrameTact() > tact) return;
  }
  throw new Error(`The beam never reached ${tact}`);
}

/** The differing pixel indexes of two frames in [from, to), at most `max` */
function diff(a: Frame, b: Frame, from = 0, to = W * H, max = 4): number[] {
  const out: number[] = [];
  for (let p = from; p < to && out.length < max; p++) {
    const i = p * 4;
    if (a.rgba[i] !== b.rgba[i] || a.rgba[i + 1] !== b.rgba[i + 1] || a.rgba[i + 2] !== b.rgba[i + 2]) out.push(p);
  }
  return out;
}

/** The layer scene with a Copper list that changes the mixer's inputs mid-frame */
async function copperScene(): Promise<NextTestSession> {
  const s = await sceneSession(makeScene(600));
  apply(s, { order: 0, blend: 0, stencil: false, ulaEn: true, tmEn: true, tmOnTop: false, spritesEn: true, lores: false });
  s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
  for (const w of [MOVE(0x15, 0x03), MOVE(0x4a, 0x1c), WAIT(60, 20), MOVE(0x15, 0x03 | (3 << 2)), MOVE(0x4a, 0xe0),
    WAIT(120, 30), MOVE(0x15, 0x03 | (5 << 2)), WAIT(180, 12), MOVE(0x15, 0x03 | (6 << 2)), HALT]) {
    s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
  }
  s.setNextReg(0x62, 0xc0);
  return s;
}

/**
 * A program that changes the picture from the CPU: the border every pass, and a screen byte in the
 * middle of the current row's paper - a write the raster only catches up to the row start for (T2).
 */
const WRITER = `
        .org $8000
Start:  di
        ld hl,$4000
Loop:   inc a
        out ($fe),a
        ld b,40
Wait:   djnz Wait
        ld (hl),a
        inc hl
        ld a,h
        and $57
        ld h,a
        jr Loop
`;

describe("beam position (Next)", () => {
  for (const t of TIMINGS) {
    it(`agrees with the raster counters: ${t.name}`, async () => {
      const s = await createSession();
      await s.loadCode(" .org $8000\n di\n jr $");
      s.setNextReg(0x03, t.nr03).setNextReg(0x05, t.hz60 ? 0x04 : 0x00).runFrames(2);
      const ex = s.machine.wasmV2Runtime!.exports;
      for (const at of [100, 20000, 60000, 2 * t.tactsPerLine * t.lines - 300]) {
        stepToTact(s, at);
        const b = s.beamPosition();
        const fct = ex.zxnextGetCurrentFrameTact();
        // --- 7 MHz HC: two per 3.5 MHz tact
        expect(b.unit).toBe("HC");
        expect(b.tactsPerLine).toBe(t.tactsPerLine * 2);
        expect(b.linesPerFrame).toBe(t.lines);
        expect(b.frameTact).toBe(fct);
        expect(b.line).toBe(Math.floor(fct / (t.tactsPerLine * 2)));
        expect(b.lineTact).toBe(fct % (t.tactsPerLine * 2));
        // --- the ULA panel's RAS and POS (T6) are the same line and HC
        const ula = s.ideState().ula;
        expect([ula.ras, ula.pos]).toEqual([b.line, b.lineTact]);
        // --- the paper is at buffer x 96 on every timing, y 48 at 50 Hz and 24 at 60 Hz (displayYStart 40)
        expect([b.paperLeft, b.paperTop, b.bufferWidth, b.bufferHeight]).toEqual([96, t.hz60 ? 24 : 48, W, H]);
        // --- the core's tact -> pixel and the overlay's linear map are one
        const info = new Uint32Array(s.machine.wasmV2Runtime!.memoryBuffer, ex.zxnextGetBeamInfo(), 12);
        const where = tactToPixel(b, fct);
        if (where.x !== undefined) {
          expect(where.y! * W + where.x).toBe(info[9]);
          expect(pixelToTact(b, where.x - (where.x & 1), where.y!)).toBe(fct);
        } else if (where.region === "hblank") {
          expect(info[9] % W).toBe(0);
        }
      }
    });
  }

  it("T4: a timing change is reported from the next frame", async () => {
    const s = await createSession();
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0x03, 0x90).runFrames(2);
    expect(s.beamPosition().tactsPerLine).toBe(448);
    s.setNextReg(0x03, 0xc0).runFrames(2);
    expect([s.beamPosition().tactsPerLine, s.beamPosition().linesPerFrame]).toEqual([448, 320]);
    s.setNextReg(0x03, 0xb0).runFrames(2);
    expect([s.beamPosition().tactsPerLine, s.beamPosition().linesPerFrame]).toEqual([456, 311]);
  });

  it("D3/T1: the picture rendered to the beam is this frame's up to the beam and last frame's after it", async () => {
    const s = await copperScene();
    s.runFrames(3);
    // --- This frame differs from the last: a new border from its first line (the raster catches up
    // --- to here, and to the Copper's changes at lines 60 and 120 - then it is behind the beam)
    s.out(0xfe, 0x05);
    stepToTact(s, 150 * 456 + 200);
    const before = s.beamPosition();
    const stale = s.machinePicture();
    const beam = before.bufferY! * W + before.bufferX!;
    expect(before.renderedUpTo).toBeLessThan(beam - W);
    const preview = s.renderToBeam();
    const after = s.beamPosition();
    // --- the machine's picture and its raster did not move; the preview is rendered to the beam
    expect(diff(s.machinePicture(), stale)).toEqual([]);
    expect(s.beamPosition().renderedUpTo).toBe(before.renderedUpTo);
    expect(diff(preview, stale, 0, before.renderedUpTo)).toEqual([]);
    expect(diff(preview, stale, beam)).toEqual([]);
    expect(diff(preview, stale, before.renderedUpTo, beam).length).toBeGreaterThan(0);
    expect(after.renderedUpTo).toBe(before.renderedUpTo);
    // --- the run reaches the frame end: the same frame's pixels before the beam are what was previewed
    s.runFrames(1);
    expect(diff(preview, s.machinePicture(), 0, beam)).toEqual([]);
  });

  it("D3: rendered to the beam over a layer debug recompose, a hidden layer stays hidden", async () => {
    const s = await copperScene();
    s.setLayerCapture(true).runFrames(3);
    stepToTact(s, 150 * 456 + 200);
    s.setLayerDebug({ hide: ["spr", "tm"] });
    s.machine.recomposeForDebug();
    const frame = s.renderToBeam();
    s.runFrames(2);
    const b = s.beamPosition();
    // --- the next whole frames are drawn with the layers hidden: the preview predicted them
    expect(b.frameTact).toBeLessThan(456 * 311);
    expect(diff(frame, s.screen())).toEqual([]);
  });

  it("T2: rendering to the beam changes nothing in the machine, now or frames later", async () => {
    const a = await createSession();
    const b = await createSession();
    for (const s of [a, b]) {
      await s.loadCode(WRITER, { entry: "Start" });
      s.runFrames(3);
      stepToTact(s, 140 * 456 + 300);
    }
    a.renderToBeam();
    a.beamPosition();
    const ia = a.machine.saveMachineState().image;
    const ib = b.machine.saveMachineState().image;
    expect(Buffer.compare(Buffer.from(ia), Buffer.from(ib))).toBe(0);
    // --- the program keeps writing screen memory mid-row; the frames drawn after it are equal too
    for (const s of [a, b]) s.step(500).runFrames(3).step(321);
    a.renderToBeam();
    for (const s of [a, b]) s.runFrames(2);
    expect(diff(a.screen(), b.screen())).toEqual([]);
    expect(Buffer.compare(Buffer.from(a.machine.saveMachineState().image), Buffer.from(b.machine.saveMachineState().image))).toBe(0);
  });
});
