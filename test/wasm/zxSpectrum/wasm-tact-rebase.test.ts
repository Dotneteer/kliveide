import { describe, expect, it } from "vitest";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

/*
 * The Spectrum cores across the 32-bit tact counter's wrap (issue #1374).
 *
 * The frame loop compared absolute tacts (`sp48Tacts < frameEndTact`). At 2^32 T-states - about 20
 * minutes at 3.5 MHz - `frameEndTact` wrapped to a small number while the counter did not, and the
 * machine stopped for good: run naturally, a Spectrum 48 froze at frame 61,455. The cores now move
 * every absolute point back once a frame starts past 2^30 and keep what they took off as an epoch
 * the exports add back, so the host still sees one continuous counter.
 *
 * `<core>TestAdvanceTacts` moves the machine's time forward with nothing happening, so these reach
 * the rebase - and, over five of them, the host counter's 2^31 and 2^32 edges - in a few hundred
 * frames. Between jumps the machine runs a beeper loop, and every frame must run the CPU, complete,
 * advance the host counter by one frame, and produce a full frame of audio with the tone in it.
 */

// --- 0000: ld a,$10 / out ($fe),a / ld b,20 / djnz $ / xor a / out ($fe),a / ld b,20 / djnz $ / jr 0
const BEEPER_LOOP = [
  0x3e, 0x10, 0xd3, 0xfe, 0x06, 0x14, 0x10, 0xfe, 0xaf, 0xd3, 0xfe, 0x06, 0x14, 0x10, 0xfe, 0x18,
  0xef
];

type Exports = Record<string, (...args: number[]) => number>;
type Machine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;

const cases: { name: string; prefix: string; create: () => Promise<Machine> }[] = [
  {
    name: "ZX Spectrum 48K",
    prefix: "sp48",
    create: () => createTestSp48WasmMachine(testRom(BEEPER_LOOP))
  },
  {
    name: "ZX Spectrum 128K",
    prefix: "sp128",
    create: () => createTestSp128WasmMachine(testRom(BEEPER_LOOP), testRom(BEEPER_LOOP))
  },
  {
    name: "ZX Spectrum +3E",
    prefix: "spp3e",
    create: () =>
      createTestSpp3eWasmMachine([
        testRom(BEEPER_LOOP),
        testRom(BEEPER_LOOP),
        testRom(BEEPER_LOOP),
        testRom(BEEPER_LOOP)
      ])
  }
];

describe("Spectrum cores across the 32-bit tact counter's wrap", () => {
  for (const { name, prefix, create } of cases) {
    it(`${name} keeps running, counting and sounding through five rebases`, async () => {
      const machine = await create();
      const e = machine.wasmV2Runtime!.exports as unknown as Exports;
      const w = (fn: string): ((...args: number[]) => number) => e[`${prefix}${fn}`];
      const frame = w("GetTactsInFrame")();
      const hostTacts = () => w("GetTacts")() >>> 0;
      const WRAP = 2 ** 32;

      let crossed31 = false;
      let crossed32 = false;
      for (let jump = 0; jump < 5; jump++) {
        // --- Jump to three frames short of the rebase threshold (2^30) of the internal counter
        // --- (the internal counter is the host's less the epoch)
        const internal = (hostTacts() - w("TestGetTactEpoch")()) >>> 0;
        w("TestAdvanceTacts")(2 ** 30 - internal - 3 * frame);

        for (let f = 0; f < 8; f++) {
          const before = hostTacts();
          const framesBefore = w("GetFrames")();
          const instructionsBefore = w("GetCpuInstructionsExecuted")?.() ?? 0;
          machine.executeMachineFrame();
          const after = hostTacts();
          const advanced = (after - before + WRAP) % WRAP;

          expect(w("GetFrames")(), `jump ${jump} frame ${f}: completes`).toBe(framesBefore + 1);
          expect(advanced, `jump ${jump} frame ${f}: one frame of tacts`).toBeGreaterThan(
            frame * 0.9
          );
          expect(advanced, `jump ${jump} frame ${f}: one frame of tacts`).toBeLessThan(frame * 1.1);
          if (w("GetCpuInstructionsExecuted")) {
            expect(
              w("GetCpuInstructionsExecuted")(),
              `jump ${jump} frame ${f}: runs the CPU`
            ).toBeGreaterThan(instructionsBefore);
          }
          const samples = machine.getAudioSamples();
          expect(samples.length, `jump ${jump} frame ${f}: a frame of audio`).toBeGreaterThan(800);
          expect(
            new Set(samples.map((x) => x.left.toFixed(2))).size,
            `jump ${jump} frame ${f}: the tone`
          ).toBeGreaterThan(4);

          if (before < 2 ** 31 && after >= 2 ** 31) crossed31 = true;
          if (after < before) crossed32 = true;
        }
      }
      expect(crossed31, "the host counter crossed 2^31").toBe(true);
      expect(crossed32, "the host counter wrapped at 2^32").toBe(true);
    }, 60_000);
  }
});
