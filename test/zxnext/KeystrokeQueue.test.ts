import { describe, expect, it } from "vitest";

import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

/*
 * The code-injection flow enqueues keystrokes on the *host's* wall clock (`queueKeystroke`, then
 * `await delay(50)`), while `emulateKeystroke()` plays them back on the *machine's* clock, one
 * action per frame. When the emulated machine is not advancing at real time — mid-boot, or while
 * NextZXOS grinds through SD sector reads that exit the frame loop for a host round trip — the keys
 * arrive far faster than they can be played.
 *
 * Anchoring each keystroke's window to `this.tacts` made them all land in nearly the same few
 * frames, and `emulateKeystroke()` drops an entry whose window has passed *without ever pressing
 * it* — silently eating a prefix of the typed string. Typing `.nexload ScrollNutter.nex` produced
 * only `,utter.nex`.
 *
 * See .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md §15.12.
 */

const KEYS = [
  SpectrumKeyCode.N1,
  SpectrumKeyCode.N2,
  SpectrumKeyCode.N3,
  SpectrumKeyCode.N4,
  SpectrumKeyCode.N5,
  SpectrumKeyCode.N6,
  SpectrumKeyCode.N7,
  SpectrumKeyCode.N8
];

/** Frames-worth of T-states, in the domain `emulateKeystroke` compares against. */
function tactsPerFrame(machine: TestZxNextMachine): number {
  return (machine.tactsInFrame / machine.frameTactMultiplier) | 0;
}

/**
 * Play the queue back the way the frame runner does — one `emulateKeystroke()` per frame — and
 * record every key that is actually pressed, in order.
 */
function playBack(machine: TestZxNextMachine, frames: number): number[] {
  const pressed: number[] = [];
  const device = machine.keyboardDevice;
  const original = device.setKeyStatus.bind(device);
  device.setKeyStatus = (key: number, down: boolean) => {
    if (down && pressed[pressed.length - 1] !== key) pressed.push(key);
    original(key, down);
  };
  try {
    for (let i = 0; i < frames; i++) {
      machine.emulateKeystroke();
      machine.tacts += tactsPerFrame(machine);
    }
  } finally {
    device.setKeyStatus = original;
  }
  return pressed;
}

describe("ZX Next emulated keystroke queue", () => {
  it("gives each keystroke its own window when queued faster than the machine advances", async () => {
    const machine = await createTestNextMachine();
    const perFrame = tactsPerFrame(machine);

    // --- Queue them all at the same machine time, as a stalled machine would see them.
    for (const key of KEYS) machine.queueKeystroke(0, 5, key);

    const queue = (machine as unknown as { emulatedKeyStrokes: { startTact: number; endTact: number }[] })
      .emulatedKeyStrokes;
    expect(queue).toHaveLength(KEYS.length);

    // --- Sequential and non-overlapping: each starts where the previous ended.
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i].startTact).toBe(queue[i - 1].endTact);
      expect(queue[i].endTact - queue[i].startTact).toBe(5 * perFrame);
    }
  });

  it("delivers every keystroke, in order, when queued faster than the machine advances", async () => {
    const machine = await createTestNextMachine();

    for (const key of KEYS) machine.queueKeystroke(0, 5, key);

    // --- 6 frames per key (5 held + 1 to retire) with headroom.
    const pressed = playBack(machine, KEYS.length * 8);

    expect(pressed).toEqual(KEYS);
  });

  it("still plays a single keystroke immediately when the queue is empty", async () => {
    const machine = await createTestNextMachine();

    // --- The on-screen keyboards only enqueue when the queue has drained, so chaining must reduce
    // --- to the old behaviour for them: the key starts now, not at some future time.
    machine.queueKeystroke(0, 3, SpectrumKeyCode.Space);
    const queue = (machine as unknown as { emulatedKeyStrokes: { startTact: number }[] })
      .emulatedKeyStrokes;
    expect(queue[0].startTact).toBe(machine.tacts);

    expect(playBack(machine, 8)).toEqual([SpectrumKeyCode.Space]);
  });
});
