import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";

import { ALL_CORES, createSession, type NextMachine } from "../../harness/zxnext";

/*
 * Sound while debugging. With the debugger attached the IDE runs the WASM machine through its
 * per-instruction loop (`executeWasmV2DebugLoop`) instead of `zxnextExecuteFrame`. Only the latter began
 * a new beeper / PSG / mixer frame, so in debug mode the sample buffers filled in the first frame and
 * stayed full: every later frame handed the audio renderer the same stale buffer, and nothing was
 * heard. Each frame must bring its own samples - as many as a frame lasts - whichever loop ran it.
 *
 * The program toggles the beeper (port $FE bit 4) as fast as it can, so every frame's samples swing.
 * The machine API is under test here (the IDE's debug loop), so the test drives `s.machine` directly.
 * The TypeScript core runs its debug frames through MachineFrameRunner; it is checked the same way.
 */
const BEEPER = `
        .org $8000
Start:  di
        xor a
Loop:   xor $10
        out ($fe),a
        jr Loop`;

const RATE = 48000;

function runFrame(m: NextMachine) {
  expect(m.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
  expect(m.frameCompleted, "a whole frame ran").toBe(true);
  const samples = m.getAudioSamples().map((x) => x.left);
  return { count: samples.length, min: Math.min(...samples), max: Math.max(...samples) };
}

describe.each(ALL_CORES)("ZX Next audio while debugging - %s core", (core) => {
  for (const debug of [false, true]) {
    it(`every frame brings fresh samples ${debug ? "in the debug loop" : "in the frame loop"}`, async () => {
      const s = await createSession(core, { audioSampleRate: RATE });
      await s.loadCode(BEEPER, { entry: "Start" });
      const m = s.machine;
      if (debug) {
        m.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
        m.executionContext.debugSupport = new DebugSupport(undefined, []);
      }
      // --- One frame's worth of samples: its 28 MHz length over 28 MHz, times the rate
      const perFrame = (m.tactsInFrame / 28_000_000) * RATE;
      for (let frame = 0; frame < 4; frame++) {
        const f = runFrame(m);
        expect(Math.abs(f.count - perFrame), `frame ${frame}: ${f.count} samples`).toBeLessThan(3);
        expect(f.max - f.min, `frame ${frame}: the beeper is heard`).toBeGreaterThan(0.1);
      }
    });
  }
});
