import { describe, expect, it } from "vitest";

import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";

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
 * The emulated keystroke queue across the wrap of the core's 32-bit tact counter (issue #1374).
 *
 * The Spectrum cores keep the counter as `uint32_t`, and the export hands it to JS as a *signed*
 * i32. So the host's `tacts` runs on smoothly through 2^32 (-1, 0, 1) but jumps from +2^31 - 1 to
 * -2^31 at 2^31 T-states, about 10 minutes at 3.5 MHz. `queueKeystroke` computed a keystroke's
 * start and end in JS numbers and `emulateKeystroke` compared them by value, so across that jump:
 *
 * - a keystroke pressed just before it was never released - its end stayed "ahead" for good;
 * - one starting after it never began, and blocked every key queued behind it.
 *
 * These drive the host's queue directly, with `tacts` set to what the core reports, so each edge is
 * reached exactly. The cores themselves running across 2^32 is `wasm-tact-rebase.test.ts`.
 */

type Machine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;

const cases: { name: string; create: () => Promise<Machine> }[] = [
  { name: "ZX Spectrum 48K", create: () => createTestSp48WasmMachine(testRom([])) },
  { name: "ZX Spectrum 128K", create: () => createTestSp128WasmMachine(testRom([]), testRom([])) },
  {
    name: "ZX Spectrum +3E",
    create: () => createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])])
  }
];

/** What the core's export reports for a 32-bit counter value: a signed i32 */
const reported = (counter: number): number => counter | 0;

/** Moves the host's clock to `counter` (as the core would report it) and plays the queue */
function at(machine: Machine, counter: number): boolean {
  machine.tacts = reported(counter);
  machine.emulateKeystroke();
  return machine.keyboardDevice.getKeyStatus(SpectrumKeyCode.N6);
}

describe("Spectrum keystroke queue across the tact counter's wrap", () => {
  for (const { name, create } of cases) {
    for (const [boundary, edge] of [["2^32 wrap", 2 ** 32], ["signed 2^31 turn", 2 ** 31]] as const) {
      it(`${name}: a keystroke pressed before the ${boundary} is released after it`, async () => {
        const machine = await create();
        const frame = machine.tactsInFrame;
        const now = edge - Math.floor(frame / 2);
        machine.tacts = reported(now);
        machine.queueKeystroke(0, 3, SpectrumKeyCode.N6);

        expect(at(machine, now), "down").toBe(true);
        expect(at(machine, now + 2 * frame), "held across the edge").toBe(true);
        expect(at(machine, now + 3 * frame + 1), "released").toBe(false);
        expect(machine.getKeyQueueLength()).toBe(0);
      });

      it(`${name}: a keystroke starting after the ${boundary} is played, not stuck`, async () => {
        const machine = await create();
        const frame = machine.tactsInFrame;
        const now = edge - Math.floor(frame / 2);
        machine.tacts = reported(now);
        machine.queueKeystroke(1, 2, SpectrumKeyCode.N6); // --- starts one frame on: past the edge

        expect(at(machine, now), "not yet").toBe(false);
        expect(at(machine, now + frame), "down once its start has come").toBe(true);
        expect(at(machine, now + 3 * frame + 1), "released").toBe(false);
        expect(machine.getKeyQueueLength()).toBe(0);
      });
    }

    it(`${name}: a key queued after the signed turn chains onto "now", not onto an earlier end`, async () => {
      // --- The queue anchors each key to the later of "now" and the previous key's end. With the
      // --- previous end just before 2^31 and "now" past it (reported negative), Math.max chose
      // --- the earlier end, and the new key waited for a time the counter would not reach again
      // --- for about 20 minutes.
      const machine = await create();
      const frame = machine.tactsInFrame;
      const turn = 2 ** 31;
      machine.tacts = reported(turn - 4 * frame);
      machine.queueKeystroke(0, 1, SpectrumKeyCode.N5); // --- ends 3 frames before the turn
      machine.tacts = reported(turn + frame); // --- the host fell behind: the counter has turned since
      machine.queueKeystroke(0, 2, SpectrumKeyCode.N6);

      expect(at(machine, turn + frame + 1)).toBe(false); // --- the stale N5 entry expires first
      expect(at(machine, turn + frame + 2), "the new key plays now").toBe(true);
      expect(at(machine, turn + 3 * frame + 3), "and ends two frames on").toBe(false);
      expect(machine.getKeyQueueLength()).toBe(0);
    });
  }
});
