import { beforeEach, describe, expect, it } from "vitest";

import { createTestNextMachine, type TestZxNextMachine } from "./TestNextMachine";
import { defineSpriteCollisionTests } from "./sprite-collision-scenarios";

/*
 * The TypeScript engine's sprite collisions: the same scenarios as the WASM engine. Its renderer runs
 * the sprite engine tact by tact, so a whole rendered frame is a whole frame of sprite work.
 */
defineSpriteCollisionTests({
  name: "TypeScript",
  createMachine: () => createTestNextMachine(),
  setNextReg: (machine, reg, value) =>
    (machine as TestZxNextMachine).nextRegDevice.directSetRegValue(reg, value),
  completeFrame: (machine) => {
    (machine as TestZxNextMachine).renderInstantScreen();
  }
});

/*
 * Port $303B bit 1, "too many sprites per line" — FPGA `status_reg_s(1) <= ... or sprites_overtime`.
 *
 * TypeScript-only: it depends on how much sprite work fits in a scanline, which the TypeScript renderer
 * models (the horizontal blanking interval, 4 CLK_28 cycles per tact) and the whole-frame WASM engine
 * does not.
 */
describe("TypeScript: too many sprites per line", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.hardReset();
    machine.nextRegDevice.directSetRegValue(0x15, 0x03);
    const memory = new Uint8Array(0x4000).fill(0xe0);
    machine.doWritePort(0x303b, 0x00);
    for (const value of memory) machine.doWritePort(0x005b, value);
  });

  const setSprite = (index: number, attrs: number[]) => {
    machine.doWritePort(0x303b, index);
    for (const value of attrs) machine.doWritePort(0x0057, value);
  };

  it("is not raised when a line's sprites fit in its blanking interval", () => {
    for (let i = 0; i < 4; i++) setSprite(i, [i * 64, 60, 0x00, 0xc0, 0x10]); // --- 256 pixels
    machine.renderInstantScreen();
    expect(machine.doReadPort(0x303b) & 0x02).toBe(0);
  });

  it("is raised when they do not, and cleared by reading the port", () => {
    // --- Eight 128-pixel-wide sprites on one line: 1024 pixels, far beyond one blanking interval.
    for (let i = 0; i < 8; i++) setSprite(i, [0, 60, 0x00, 0xc0, 0x18]);
    machine.renderInstantScreen();
    expect(machine.doReadPort(0x303b) & 0x02).toBe(2);
    expect(machine.doReadPort(0x303b) & 0x02).toBe(0);
  });
});
