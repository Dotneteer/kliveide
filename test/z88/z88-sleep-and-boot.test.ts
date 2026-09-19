import { describe, expect, it } from "vitest";

import { machineRegistry } from "@common/machines/machine-registry";
import { createZ88Session, Z88_HARNESS_BACKENDS, Z88_LCD } from "../harness/z88";

/*
 * Sleep-mode detection and booting the real OZ ROMs.
 *
 * OZ enters its "coma" with I = $3F and HALT; the machine reports sleep mode then, and pressing both
 * shift keys (after releasing them) is the Z88's way out, which the machine's sleep flag follows.
 * The boot tests are the smoke test of the whole machine: every model's ROM runs, draws its Index
 * screen and waits for a key.
 *
 * Step 0.3 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */
describe.each(Z88_HARNESS_BACKENDS)("Z88 sleep mode (%s)", (backend) => {
  async function haltWithI(i: number) {
    const s = await createZ88Session({ backend });
    await s.loadCode(`
      .org $8000
      ld a,${i}
      ld i,a
      halt
    `);
    return s;
  }

  it("HALT with I = $3F is reported as sleep mode from the next frame", async () => {
    const s = await haltWithI(0x3f);
    expect(s.sleeping).toBe(false);
    s.runFrames(2);
    expect(s.registers().halted).toBe(true);
    expect(s.sleeping).toBe(true);
  });

  it("HALT with any other I is not sleep mode", async () => {
    const s = await haltWithI(0x3e);
    s.runFrames(3);
    expect(s.registers().halted).toBe(true);
    expect(s.sleeping).toBe(false);
  });

  it("pressing both shifts (after they were released) clears sleep mode for that frame", async () => {
    const s = await haltWithI(0x3f);
    s.runFrames(3);
    expect(s.sleeping).toBe(true);
    s.keyDown("ShiftL", "ShiftR");
    s.runFrames(1);
    expect(s.sleeping).toBe(false);
  });

  it("one shift is not enough", async () => {
    const s = await haltWithI(0x3f);
    s.runFrames(3);
    s.keyDown("ShiftL");
    s.runFrames(2);
    expect(s.sleeping).toBe(true);
  });
});

describe.each(Z88_HARNESS_BACKENDS)("Z88 OZ boot (%s)", (backend) => {
  it.each(z88Models())(
    "%s boots to its Index screen and waits for a key (snoozing on the keyboard)",
    async (model) => {
      const s = await createZ88Session({ backend, model, rom: "model" });
      // --- Measured on the TypeScript core (2026-09-19): OZ 3.x/4.0 settle in 600-800 frames,
      // --- OZ 5.0 in about 1600 (8 seconds of Z88 time)
      s.runUntil((t) => t.snoozed && litPixels(t.screen()) > 4000, "the Index screen, waiting for a key", {
        maxFrames: 3000
      });
      expect(s.blinkState().COM & 0x01).toBe(0x01);
      expect(s.screen().some((p) => p === Z88_LCD.SCREEN_OFF)).toBe(false);

      // --- A key wakes it
      s.keyDown("Down");
      s.runFrames(2);
      expect(s.snoozed).toBe(false);
    },
    30_000
  );
});

function z88Models(): string[] {
  return machineRegistry.find((m) => m.machineId === "z88").models.map((m) => m.modelId);
}

function litPixels(screen: Uint32Array): number {
  let lit = 0;
  for (const p of screen) if (p === Z88_LCD.ON || p === Z88_LCD.GREY) lit++;
  return lit;
}
