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

// --- "Too many sprites per line" moved to test/zxnext-hw/sprites/sprites.test.ts (SPR-026): the old tests
// --- assumed the engine had only the blanking interval; sprites.vhd has the whole line.
