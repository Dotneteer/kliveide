import { createTestNextMachine, type TestZxNextMachine } from "./TestNextMachine";
import { defineSpriteFpgaTests } from "./sprite-fpga-scenarios";

/*
 * The TypeScript sprite engine (`SpriteDevice` + `NextComposedScreenDevice`) against the FPGA — the same
 * scenarios the WASM engine runs, rendered through the cycle-based renderer.
 */
defineSpriteFpgaTests({
  name: "TypeScript",
  createMachine: () => createTestNextMachine(),
  setNextReg: (machine, reg, value) =>
    (machine as TestZxNextMachine).nextRegDevice.directSetRegValue(reg, value),
  patternByte4: (machine, variant, cell) =>
    (machine as TestZxNextMachine).spriteDevice.patternMemory4bit[variant][cell],
  patternByte8: (machine, variant, cell) =>
    (machine as TestZxNextMachine).spriteDevice.patternMemory8bit[variant][cell]
});
