import { describe, expect, it } from "vitest";

import { createHtSession, type Ht1080zTestSession } from "../harness/ht1080z";
import { Ht1080zKeyCode as K } from "@emu/machines/ht1080z/Ht1080zKeyCode";
import { HT1080Z_CLOCK_64, HT1080Z_CLOCK_S12 } from "@emu/machines/ht1080z/ht1080zMachineInfo";

/*
 * The Phase 2 hardware-rule probes (`.plans/HT1080Z_PLAN.md` §12.1, §13): small machine-code programs
 * run on the real core after the real ROM has booted, pinning the memory map, unmapped reads, the
 * keyboard's OR-read, the ports without tape, NMI and the absence of INT. Each program ends in
 * `JR $` and leaves its results in RAM at RESULTS.
 */

const CODE = 0x6000;
const RESULTS = 0x6100;

/** Hand-assembled Z80, enough for the probes */
const z = {
  ldA: (n: number) => [0x3e, n],
  ldMemA: (a: number) => [0x32, a & 0xff, a >> 8],
  ldAMem: (a: number) => [0x3a, a & 0xff, a >> 8],
  inA: (port: number) => [0xdb, port],
  outA: (port: number) => [0xd3, port],
  di: () => [0xf3],
  ei: () => [0xfb],
  im1: () => [0xed, 0x56],
  halt: () => [0x76],
  loop: () => [0x18, 0xfe]
};

/** Puts the program at CODE, jumps there and runs to its closing `JR $` */
function run(s: Ht1080zTestSession, ...parts: number[][]): Ht1080zTestSession {
  const code = parts.flat();
  const end = CODE + code.length;
  s.poke(CODE, [...code, ...z.loop()]);
  s.machine.pc = CODE;
  return s.runTo(end, { maxFrames: 5 });
}

async function booted(model = "ht1080z-s2"): Promise<Ht1080zTestSession> {
  return (await createHtSession({ model })).bootToPrompt();
}

describe("HT-1080Z skeleton: memory map", () => {
  it("ignores CPU writes to the ROMs and reads the video RAM back", async () => {
    const s = await booted();
    const romByte = s.peek(0x0100);
    const extByte = s.peek(0x3100);
    run(
      s,
      z.ldA(romByte ^ 0xff), z.ldMemA(0x0100), z.ldAMem(0x0100), z.ldMemA(RESULTS),
      z.ldA(extByte ^ 0xff), z.ldMemA(0x3100), z.ldAMem(0x3100), z.ldMemA(RESULTS + 1),
      z.ldA(0xaa), z.ldMemA(0x3fff), z.ldAMem(0x3fff), z.ldMemA(RESULTS + 2)
    );
    expect(s.peek(RESULTS)).toBe(romByte);
    expect(s.peek(RESULTS + 1)).toBe(extByte);
    expect(s.peek(RESULTS + 2)).toBe(0xaa);
  });

  it("reads FFh above a 16K machine's RAM, where writes are lost", async () => {
    const s = await booted();
    run(
      s,
      z.ldA(0x5a), z.ldMemA(0x8000), z.ldAMem(0x8000), z.ldMemA(RESULTS),
      z.ldAMem(0xc123), z.ldMemA(RESULTS + 1),
      z.ldAMem(0xffff), z.ldMemA(RESULTS + 2),
      z.ldA(0x5a), z.ldMemA(0x7fff), z.ldAMem(0x7fff), z.ldMemA(RESULTS + 3)
    );
    expect([0, 1, 2, 3].map((i) => s.peek(RESULTS + i))).toEqual([0xff, 0xff, 0xff, 0x5a]);
  });

  it("has RAM up to FFFFh on the /64", async () => {
    const s = await booted("ht1080z-64");
    run(s, z.ldA(0x5a), z.ldMemA(0xffff), z.ldAMem(0xffff), z.ldMemA(RESULTS));
    expect(s.peek(RESULTS)).toBe(0x5a);
  });
});

describe("HT-1080Z skeleton: keyboard", () => {
  it("ORs the rows whose address bits are set, and ignores A8-A9", async () => {
    const s = await booted();
    // --- A is row 0 D1, S is row 2 D3, ENTER is row 6 D0, SHIFT row 7 D0
    s.keyDown(K.A, K.S, K.Enter, K.Shift);
    const reads = [0x3801, 0x3802, 0x3804, 0x3805, 0x3840, 0x3880, 0x38ff, 0x3800, 0x3901, 0x3bff];
    run(s, ...reads.flatMap((a, i) => [z.ldAMem(a), z.ldMemA(RESULTS + i)]));
    s.keyUp(K.A, K.S, K.Enter, K.Shift);
    expect(reads.map((_, i) => s.peek(RESULTS + i))).toEqual([
      0x02, // row 0: A
      0x00, // row 1: nothing
      0x08, // row 2: S
      0x0a, // rows 0 and 2
      0x01, // row 6: ENTER
      0x01, // row 7: SHIFT
      0x0b, // every row
      0x00, // no row selected
      0x02, // 3901h mirrors 3801h
      0x0b // 3BFFh mirrors 38FFh
    ]);
  });

  it("numbers every key row * 8 + column", () => {
    expect([K.At, K.G, K.H, K.W, K.X, K.Z, K.N0, K.Slash, K.Enter, K.Space, K.Shift]).toEqual([
      0, 7, 8, 23, 24, 26, 32, 47, 48, 55, 56
    ]);
  });
});

describe("HT-1080Z skeleton: ports", () => {
  it("reads the cassette latch on FFh bit 7, cleared by a write to FFh", async () => {
    const s = await booted();
    s.wasm.ht1080zSetCassetteLatch();
    run(s, z.inA(0xff), z.ldMemA(RESULTS), z.ldA(0x00), z.outA(0xff), z.inA(0xff), z.ldMemA(RESULTS + 1));
    expect(s.peek(RESULTS)).toBe(0xff);
    expect(s.peek(RESULTS + 1)).toBe(0x7f);
  });

  it("latches port FFh and the FEh recorder select", async () => {
    const s = await booted();
    run(s, z.ldA(0x05), z.outA(0xff), z.ldA(0x10), z.outA(0xfe));
    expect(s.wasm.ht1080zGetPortFf()).toBe(0x05);
    expect(s.wasm.ht1080zGetRecorder2()).toBe(1);
    run(s, z.ldA(0x00), z.outA(0xfe));
    expect(s.wasm.ht1080zGetRecorder2()).toBe(0);
  });

  it("reads 30h from the printer port and FFh from unused ports, decoding A0-A7 only", async () => {
    const s = await booted();
    run(s, z.inA(0xfd), z.ldMemA(RESULTS), z.inA(0x12), z.ldMemA(RESULTS + 1), z.inA(0x1e), z.ldMemA(RESULTS + 2));
    expect([0, 1, 2].map((i) => s.peek(RESULTS + i))).toEqual([0x30, 0xff, 0xff]);
    // --- IN A,(n) puts A on A8-A15: the port is still FDh
    run(s, z.ldA(0x12), z.inA(0xfd), z.ldMemA(RESULTS + 3));
    expect(s.peek(RESULTS + 3)).toBe(0x30);
  });
});

describe("HT-1080Z skeleton: interrupts", () => {
  it("the RESET key is an NMI to 0066h, and BASIC returns to READY with the memory kept", async () => {
    const s = await booted();
    s.poke(0x7000, [0xa5, 0x5a]);
    s.poke(CODE, z.loop());
    s.machine.pc = CODE;
    s.runFrames(2);
    expect(s.machine.pc).toBe(CODE);
    s.breakpoint(0x0066).pressResetKey();
    expect(s.debug("continue", { maxFrames: 2 })).toBe(0x0066);
    s.machine.executionContext.debugSupport = undefined;
    s.runUntil(() => s.screenText().some((line) => line === "READY"), { maxFrames: 200 }, "READY after RESET");
    expect([s.peek(0x7000), s.peek(0x7001)]).toEqual([0xa5, 0x5a]);
  });

  it("a HALT stays halted: no NMI from HALT, no INT source", async () => {
    const s = await booted();
    run(s, z.im1(), z.ei());
    expect(s.machine.iff1).toBe(true);
    s.runFrames(5);
    // --- Still in the closing JR $: an INT would have reached 0038h
    expect(s.machine.pc).toBe(CODE + 3);
    s.poke(CODE, [...z.di(), ...z.halt()]);
    s.machine.pc = CODE;
    s.runFrames(5);
    expect(s.wasm.ht1080zGetCpuHalted()).toBe(1);
    expect(s.machine.pc).toBe(CODE + 1);
  });
});

describe("HT-1080Z skeleton: timing", () => {
  it("runs 34,944-T frames at the model's clock", async () => {
    for (const [model, clock] of [
      ["ht1080z-s2", HT1080Z_CLOCK_S12],
      ["ht1080z-64", HT1080Z_CLOCK_64]
    ] as const) {
      const s = await createHtSession({ model });
      expect(s.machine.baseClockFrequency, model).toBe(clock);
      const tacts = s.wasm.ht1080zGetTacts();
      const frames = s.wasm.ht1080zGetFrames();
      s.runFrames(10);
      expect(s.wasm.ht1080zGetFrames() - frames, model).toBe(10);
      // --- A frame ends after the instruction that passes its last T-state: within one instruction
      expect(Math.abs(s.wasm.ht1080zGetTacts() - tacts - 10 * 34_944), model).toBeLessThan(24);
    }
  });
});
