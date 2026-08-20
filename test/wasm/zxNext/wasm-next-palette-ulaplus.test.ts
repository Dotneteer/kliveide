import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM advanced video palette", () => {
  it("matches TypeScript palette register state and 8-bit/9-bit writes", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    for (const [reg, value] of [
      [0x43, 0x10],
      [0x40, 0x20],
      [0x41, 0x24],
      [0x41, 0x25],
      [0x40, 0x1c],
      [0x44, 0x20],
      [0x44, 0x81]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    expect(exports.zxnextGetPaletteNextReg(0x40)).toBe(oracle.paletteDevice.nextReg40Value);
    expect(exports.zxnextGetPaletteNextReg(0x43)).toBe(oracle.paletteDevice.nextReg43Value);
    expect(exports.zxnextGetPaletteNextReg(0x44)).toBe(oracle.paletteDevice.nextReg44Value);
    expect(exports.zxnextGetPaletteEntry(1, 0x20)).toBe(oracle.paletteDevice.layer2First[0x20]);
    expect(exports.zxnextGetPaletteEntry(1, 0x21)).toBe(oracle.paletteDevice.layer2First[0x21]);
    expect(exports.zxnextGetPaletteEntry(1, 0x1c)).toBe(oracle.paletteDevice.layer2First[0x1c]);
    expect(exports.zxnextGetPaletteSecondWrite()).toBe(oracle.paletteDevice.secondWrite ? 1 : 0);
    expect(exports.zxnextGetPaletteStoredValue()).toBe(oracle.paletteDevice.storedPaletteValue);
  });

  it("keeps the default ULA bright magenta FPGA workaround", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();

    expect(wasm.wasmV2Runtime!.exports.zxnextGetPaletteEntry(0, 0x0b)).toBe(oracle.paletteDevice.ulaFirst[0x0b]);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetPaletteEntry(4, 0x1b)).toBe(oracle.paletteDevice.ulaSecond[0x1b]);
  });
});
