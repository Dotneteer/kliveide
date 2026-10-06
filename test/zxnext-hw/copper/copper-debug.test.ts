import { describe, expect, it } from "vitest";

import type { NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * The IDE's view of the Copper and the Copper-instruction watch (`.plans/COPPER_DEBUGGING_PLAN.md`
 * Phases 4 and 7).
 *
 * - `copperState()` reads what the Copper side-bar panel and the Copper List document show: the list
 *   RAM, mode, PC, write pointer, `$64`, the beam (in `cvc` / `hc_ula`) and the live timing (T4).
 * - The watch latches the *first* watched instruction the Copper completes (T2): a MOVE or NOP when it
 *   is issued, a WAIT when it is satisfied (D4) - never when the Copper merely arrives at it.
 *
 * The list is the `test/visual/copper/C03` shape: palette entry 16 black, then green from line 96.
 */

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;

const C03 = [MOVE(0x40, 16), MOVE(0x41, 0x00), WAIT(96, 8), MOVE(0x40, 16), MOVE(0x41, 0x1c), HALT];

/** Stops the Copper and writes `list` from address 0 with $60. */
function upload(s: NextTestSession, list: number[]): NextTestSession {
  s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
  for (const w of list) s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
  return s;
}

/** A session running `list` in mode 11 (restart at raster (0,0) every frame). */
async function running(list: number[]): Promise<NextTestSession> {
  const s = await parkedSession();
  upload(s, list).setNextReg(0x62, 0xc0);
  return s.runFrames(2);
}

const wordAt = (ram: Uint8Array, index: number) => (ram[index * 2] << 8) | ram[index * 2 + 1];

describe("Copper state for the IDE", () => {
  it("reads the list RAM, mode, PC and write pointer", async () => {
    const s = await running(C03);
    const state = s.copperState();
    expect(state.ram).toHaveLength(0x800);
    expect(C03.map((_, i) => wordAt(state.ram, i))).toEqual(C03);
    expect(wordAt(state.ram, 6)).toBe(0);
    expect(state.startMode).toBe(3);
    // --- At the frame's end the Copper is parked on the HALT (index 5) until the next restart
    expect(state.pc).toBe(5);
    expect(state.beam.waiting).toBe(true);
    // --- 6 words, 12 bytes written through $60
    expect(state.writeAddress).toBe(12);
    expect(state.lineOffset).toBe(0);
  });

  it("is a copy: changing it does not touch the Copper", async () => {
    const s = await running(C03);
    s.copperState().ram.fill(0xaa);
    expect(wordAt(s.copperState().ram, 0)).toBe(C03[0]);
  });

  it("reports the live timing (T4): 50 Hz vs 60 Hz", async () => {
    const s = await running(C03);
    const at50 = s.copperState().timing;
    expect(at50.lines).toBeGreaterThan(300);
    expect([448, 456]).toContain(at50.hcs);
    // --- $05 bit 2: 60 Hz, applied from the next frame
    s.setNextReg(0x05, s.nextRegValue(0x05) | 0x04).runFrames(2);
    expect(s.copperState().timing.lines).toBe(264);
  });

  it("reports the beam in cvc / hc_ula, at the CPU's tact", async () => {
    const s = await running(C03);
    // --- Run to the middle of a frame by watching the WAIT at line 96
    s.watchCopper([2]).runFrames(1);
    const beam = s.copperState().beam;
    expect(beam.line).toBeGreaterThanOrEqual(0);
    expect(beam.line).toBeLessThan(s.copperState().timing.lines);
    expect(beam.hc).toBeLessThan(s.copperState().timing.hcs);
  });

  it("follows $64: the line offset", async () => {
    const s = await running(C03);
    s.setNextReg(0x64, 0x20).runFrames(2);
    expect(s.copperState().lineOffset).toBe(0x20);
  });

  it("keeps the list RAM over a soft reset (T9), stopped", async () => {
    const s = await running(C03);
    s.reset();
    const state = s.copperState();
    expect(C03.map((_, i) => wordAt(state.ram, i))).toEqual(C03);
    expect(state.startMode).toBe(0);
    expect(state.pc).toBe(0);
    expect(state.beam.waiting).toBe(false);
  });

  it("clears the list RAM on a hard reset", async () => {
    const s = await running(C03);
    s.hardReset();
    expect(wordAt(s.copperState().ram, 0)).toBe(0);
  });
});

describe("Copper watch and hit latch", () => {
  it("a WAIT fires when it is satisfied, not when the Copper arrives at it (D4)", async () => {
    const s = await running(C03);
    s.watchCopper([2]).runFrames(1);
    const hit = s.takeCopperHit();
    // --- The Copper arrives at index 2 on line 0; it is satisfied at line 96, hc_ula 8*8+12
    expect(hit).toEqual({ index: 2, kind: "wait", line: 96, hc: 76 });
  });

  it("a MOVE fires when it is issued", async () => {
    const s = await running(C03);
    s.watchCopper([3]).runFrames(1);
    const hit = s.takeCopperHit();
    expect(hit).toMatchObject({ index: 3, kind: "move", line: 96 });
    // --- The tick after the WAIT completes
    expect(hit!.hc).toBeGreaterThanOrEqual(76);
    expect(hit!.hc).toBeLessThanOrEqual(77);
  });

  it("a MOVE to register 0 is reported as a NOP", async () => {
    const s = await running([MOVE(0x00, 0x12), MOVE(0x40, 1), HALT]);
    s.watchCopper([0]).runFrames(1);
    expect(s.takeCopperHit()).toMatchObject({ index: 0, kind: "nop", line: 0 });
  });

  it("latches the first hit of a burst, not the last (T2)", async () => {
    const s = await running(C03);
    // --- Indexes 0, 1, 3 and 4 all complete within a few hc of each other
    s.watchCopper([0, 1, 3, 4]).runFrames(1);
    expect(s.takeCopperHit()).toMatchObject({ index: 0, kind: "move" });
    // --- Taking clears it; nothing ran since
    expect(s.takeCopperHit()).toBeUndefined();
    // --- The next frame latches its own first hit
    s.runFrames(1);
    expect(s.takeCopperHit()).toMatchObject({ index: 0 });
  });

  it("never fires on the HALT: it never completes", async () => {
    const s = await running(C03);
    s.watchCopper([5]).runFrames(3);
    expect(s.takeCopperHit()).toBeUndefined();
  });

  it("Step Copper: 'any' catches the next instruction the Copper completes", async () => {
    const s = await running(C03);
    s.watchCopper([], { any: true }).runFrames(1);
    expect(s.takeCopperHit()).toMatchObject({ index: 0, kind: "move", line: 0 });
  });

  it("a disarmed watch latches nothing", async () => {
    const s = await running(C03);
    s.watchCopper([0, 1, 2, 3, 4]).clearCopperWatch().runFrames(2);
    expect(s.takeCopperHit()).toBeUndefined();
  });

  it("an armed watch does not slow the Copper down measurably (T3)", async () => {
    // --- Mode 01 loops the whole 1024-entry list for ever: the Copper never idles
    const list = Array.from({ length: 1024 }, (_, i) => MOVE(0x7f, i & 0xff));
    const s = await parkedSession();
    upload(s, list).setNextReg(0x62, 0x40).runFrames(5);

    const time = (frames: number) => {
      const start = performance.now();
      s.runFrames(frames);
      return performance.now() - start;
    };
    // --- Warm up, then compare unarmed with armed on an index that matches every lap
    time(10);
    const unarmed = Math.min(time(20), time(20));
    s.watchCopper([1023]);
    const armed = Math.min(time(20), time(20));
    s.clearCopperWatch();
    // --- Lenient: the armed path adds one bit test per instruction; a 2x bound catches a real
    // --- regression (a test on every tick) without being flaky on a loaded machine.
    expect(armed).toBeLessThan(unarmed * 2 + 20);
  });
});
