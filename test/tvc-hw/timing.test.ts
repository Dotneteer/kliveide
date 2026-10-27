import { describe, expect, it } from "vitest";

import { createTvcSession, type TvcTestSession } from "../harness/tvc";
import { bareMachine } from "./bare";

/*
 * The CPU's memory timing (`.plans/VIDEOTON_TVC_PLAN.md` §6; `_input/videoton-tvc/
 * TVC_CLOCK_STRETCH_FIGURES.md`). Every 640 ns character starts with the CPU's 320 ns slot; a CPU
 * access to video RAM is stretched by 1-4 half-T-states, depending on the phase p (half-T units from
 * the CPU slot's start) its T1 starts at:
 *
 *   p                        0  1  2  3
 *   read/write stretch       2  1  4  3
 *   opcode fetch stretch     3  2  1  4
 *
 * Characters start at half-T 0 after reset (plan Q7), so p is the half-T clock mod 4.
 */

const READ_WRITE = [2, 1, 4, 3];
const OPCODE = [3, 2, 1, 4];

/** Runs one instruction; returns the half-T clock before and the half-T units it took */
function timed(s: TvcTestSession): { before: number; halves: number } {
  const before = s.wasm.tvcGetHalfClock();
  s.step(1);
  return { before, halves: (s.wasm.tvcGetHalfClock() - before) >>> 0 };
}

describe("TVC CPU timing: the clock stretch on video RAM", () => {
  /** Runs the instruction at `pc` starting at half-T phase `p`; returns the half-T units it took */
  function at(s: TvcTestSession, pc: number, p: number): number {
    s.machine.pc = pc;
    s.wasm.tvcSetHalfClock(4000 + p);
    return timed(s).halves;
  }

  it("LD A,(8000h) from RAM: only the data read is stretched, by the read/write table", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    s.poke(0x4000, [0x3a, 0x00, 0x80]);
    // --- 13 T; the data read's T1 is 10 T (20 half-T units) in, so it starts at phase p too
    for (let p = 0; p < 4; p++) expect(at(s, 0x4000, p), `phase ${p}`).toBe(2 * 13 + READ_WRITE[p]);
  });

  it("LD (8000h),A from RAM: the write is stretched by the same table", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    s.poke(0x4000, [0x32, 0x00, 0x80]);
    for (let p = 0; p < 4; p++) expect(at(s, 0x4000, p), `phase ${p}`).toBe(2 * 13 + READ_WRITE[p]);
  });

  it("LD A,(4000h) from RAM is never stretched", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    s.poke(0x4000, [0x3a, 0x00, 0x40]);
    for (let p = 0; p < 4; p++) expect(at(s, 0x4000, p), `phase ${p}`).toBe(2 * 13);
  });

  it("an opcode fetched from video RAM is stretched by the opcode table", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    s.poke(0x8000, [0x00]);
    for (let p = 0; p < 4; p++) expect(at(s, 0x8000, p), `phase ${p}`).toBe(2 * 4 + OPCODE[p]);
  });

  it("locks code running from video RAM to the slots: a NOP sled settles at phase 3, 6 T a NOP", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    s.poke(0x8000, new Array(64).fill(0x00));
    s.machine.pc = 0x8000;
    s.step(4);
    for (let i = 0; i < 20; i++) {
      const { before, halves } = timed(s);
      expect(before & 3).toBe(3);
      expect(halves).toBe(12);
    }
  });

  it("keeps the T-state counter in whole T-states: the half-T phase carries into the next stretch", async () => {
    const s = await createTvcSession();
    bareMachine(s, { halt: false });
    s.poke(0x4000, [0x3a, 0x00, 0x80]);
    for (let p = 0; p < 4; p++) {
      s.machine.pc = 0x4000;
      s.wasm.tvcSetHalfClock(4000 + p);
      const tacts0 = s.wasm.tvcGetTacts();
      s.step(1);
      const halves = (s.wasm.tvcGetHalfClock() - (4000 + p)) >>> 0;
      // --- The CPU counts the whole T-states the half-T clock passes
      expect((s.wasm.tvcGetTacts() - tacts0) >>> 0, `phase ${p}`).toBe(((4000 + p + halves) >> 1) - ((4000 + p) >> 1));
    }
  });
});

describe("TVC CPU timing: the WAIT circuit (64K only)", () => {
  /** RST 38h (FFh) fetched from the empty cartridge in page 0: 11 T, plus the WAIT state */
  async function rstFromCartridge(model: string): Promise<number> {
    const s = await createTvcSession({ model });
    bareMachine(s, { halt: false });
    // --- Page 0 shows CART (port 02h bits 4-3 = 01), which reads FFh: RST 38h
    s.wasm.tvcWritePort(0x02, 0x08);
    s.machine.pc = 0x0000;
    s.machine.sp = 0x7ff0;
    const before = s.wasm.tvcGetTacts();
    s.step(1);
    expect(s.machine.pc).toBe(0x0038);
    return (s.wasm.tvcGetTacts() - before) >>> 0;
  }

  it("adds one wait state to an M1 from the cartridge on the 64K", async () => {
    expect(await rstFromCartridge("tvc64")).toBe(12);
  });

  it("does not on the 64K+, whose board has no WAIT circuit", async () => {
    expect(await rstFromCartridge("tvc64p")).toBe(11);
  });
});
