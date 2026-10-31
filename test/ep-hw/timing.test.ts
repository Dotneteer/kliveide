import { describe, expect, it } from "vitest";

import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { bareMachine, timeCode } from "./bare";

/*
 * The CPU's bus timing (`.plans/ENTERPRISE_PLAN.md` Phase 2, §3.3, §6): DAVE's wait states by BFh, and
 * NICK's clock stretch on video RAM and on its ports, in half-T steps against a slot grid that is not
 * the CPU's (4.4952 T a slot).
 *
 * Code runs from segment F9h in page 1 (`timeCode`); page 2 shows the segment a test names.
 */

const SLOT_T = (16 * 4_000_000) / 14_237_536.27;
const HALT: number[] = [];
const NOP = 0x00;

/** The cost of `body` in T-states: the code with it, less the code without it */
function costOf(s: EpTestSession, body: number[]): number {
  return timeCode(s, [...body, ...HALT]) - timeCode(s, HALT);
}

/** `LD A,(8000h)` with page 2 showing `segment` */
function ldFromPage2(s: EpTestSession, segment: number): number[] {
  s.wasm.epWritePort(0xb2, segment);
  return [0x3a, 0x00, 0x80];
}

describe("DAVE's wait states (BFh bits 3-2)", () => {
  it("waits one T-state on every memory access (00), on M1 only (01), or never (10, 11)", async () => {
    const s = await createEpSession();
    for (const [bf, nop, ld] of [
      [0x00, 5, 17],
      [0x04, 5, 14],
      [0x08, 4, 13],
      [0x0c, 4, 13]
    ]) {
      bareMachine(s, { halt: false, bf });
      expect(costOf(s, Array(10).fill(NOP)), `NOP, BFh=${bf}`).toBe(10 * nop);
      expect(costOf(s, ldFromPage2(s, 0xfa)), `LD A,(nn), BFh=${bf}`).toBe(ld);
    }
  });

  it("counts both opcode fetches of a prefixed instruction as M1, but not DDCB's opcode read", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x04 });
    // --- LD IX,0 (DD 21 nn nn): 14 T, two M1s; RLC (IX+0) (DD CB 00 06): 23 T, two M1s
    expect(costOf(s, [0xdd, 0x21, 0x00, 0x80])).toBe(14 + 2);
    expect(costOf(s, [0xdd, 0xcb, 0x00, 0x06])).toBe(23 + 2);
  });

  it("puts no wait on I/O cycles", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x00 });
    // --- IN A,(B4h): 11 T; the opcode fetch and the operand read wait, the I/O cycle does not
    expect(costOf(s, [0xdb, 0xb4])).toBe(11 + 2);
  });
});

describe("NICK's clock stretch", () => {
  it("never puts a DAVE wait on video RAM, and stretches in half-T steps up to a slot", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x00 });
    const costs = new Set<number>();
    for (let phase = 0; phase < 256; phase += 8) {
      const body = ldFromPage2(s, 0xfc);
      s.wasm.epSetNickSlotPhase(phase);
      const withLd = timeCode(s, [...body, ...HALT]);
      s.wasm.epSetNickSlotPhase(phase);
      const without = timeCode(s, [0x3a, 0x00, 0x60, ...HALT]);
      costs.add(withLd - without + 17);
    }
    // --- The read from FAh costs 17 T in mode 00; from video RAM it is 16 (its own wait gone) plus the hold
    for (const cost of costs) {
      expect(Number.isInteger(cost * 2)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(16);
      expect(cost).toBeLessThanOrEqual(16 + SLOT_T);
    }
    expect(costs.size).toBeGreaterThan(4);
  });

  it("locks code that runs from video RAM to the slot grid: a NOP takes one slot", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x0c });
    const nops = 2000;
    const t = timeCode(s, [...Array(nops).fill(NOP), ...HALT], { segment: 0xfc });
    expect(Math.abs(t / nops - SLOT_T)).toBeLessThan(0.01);
  });

  it("locks a loop of video RAM reads to whole slots: LD A,(nn) (13 T) takes three (13.49 T)", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x0c });
    s.wasm.epWritePort(0xb2, 0xfc);
    const reads = 1000;
    const body = Array.from({ length: reads }, () => [0x3a, 0x00, 0x80]).flat();
    const t = costOf(s, body);
    expect(Math.abs(t / reads - 3 * SLOT_T)).toBeLessThan(0.02);
  });

  it("synchronises NICK's ports 80h-8Fh, and no other port", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x0c });
    const nickCosts = new Set<number>();
    const daveCosts = new Set<number>();
    for (let phase = 0; phase < 256; phase += 8) {
      s.wasm.epSetNickSlotPhase(phase);
      nickCosts.add(costOf(s, [0xdb, 0x80]));
      s.wasm.epSetNickSlotPhase(phase);
      daveCosts.add(costOf(s, [0xdb, 0xb4]));
    }
    expect([...daveCosts]).toEqual([11]);
    expect(Math.min(...nickCosts)).toBeGreaterThanOrEqual(11);
    expect(Math.max(...nickCosts)).toBeLessThanOrEqual(11 + SLOT_T);
    expect(nickCosts.size).toBeGreaterThan(4);
  });

  it("lands an OUT to NICK inside the Z80's window of the slot (clocks 10-15)", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x0c });
    for (let phase = 0; phase < 256; phase += 16) {
      s.wasm.epSetNickSlotPhase(phase);
      // --- OUT (81h),A: the write lands at the I/O access point, after the hold
      s.wasm.epWritePort(0xb1, 0xf9);
      s.poke(0x4000, [0xd3, 0x81, 0x18, 0xfe]);
      s.machine.pc = 0x4000;
      s.step(1);
      // --- At the end of the cycle (half a T-state after the access point) NICK is 1.78 clocks further
      const clocks = (s.wasm.epGetNickSlotPhase() * 1000) / 22_720_000;
      const atAccess = (clocks - 1.78 + 16) % 16;
      expect(atAccess).toBeGreaterThanOrEqual(10 - 0.01);
      expect(atAccess).toBeLessThan(16 + 0.01);
    }
  });

  it("keeps the half-T clock and the T-state counter together: whole T-states pass as the half-T clock crosses them", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false, bf: 0x0c });
    const halves0 = s.wasm.epGetHalfClock();
    const tacts0 = s.wasm.epGetTacts();
    timeCode(s, [...Array(333).fill(NOP), ...HALT], { segment: 0xfc });
    const halves = (s.wasm.epGetHalfClock() - halves0) >>> 0;
    const tacts = (s.wasm.epGetTacts() - tacts0) >>> 0;
    expect(Math.abs(tacts - halves / 2)).toBeLessThanOrEqual(1);
  });
});
