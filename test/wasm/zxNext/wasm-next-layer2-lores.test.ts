import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM advanced video Layer 2 and LoRes", () => {
  it("matches Layer 2 register state, scroll, clip, and enable bit", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const screen = oracle.composedScreenDevice;

    for (const [reg, value] of [
      [0x70, 0x21],
      [0x16, 0xe0],
      [0x71, 0x01],
      [0x17, 0x55],
      [0x18, 0x02],
      [0x18, 0x9f],
      [0x18, 0x04],
      [0x18, 0xbf]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }
    screen.layer2Enabled = true;
    exports.zxnextSetLayer2Enabled(1);

    expect(exports.zxnextGetLayer2Enabled()).toBe(1);
    expect(exports.zxnextGetLayer2Resolution()).toBe(screen.layer2Resolution);
    expect(exports.zxnextGetLayer2PaletteOffset()).toBe(screen.layer2PaletteOffset);
    expect(exports.zxnextGetLayer2ScrollX()).toBe(screen.layer2ScrollX);
    expect(exports.zxnextGetLayer2ScrollY()).toBe(screen.layer2ScrollY);
    expect([0, 1, 2, 3].map(i => exports.zxnextGetLayer2Clip(i))).toEqual([
      screen.layer2ClipWindowX1,
      screen.layer2ClipWindowX2,
      screen.layer2ClipWindowY1,
      screen.layer2ClipWindowY2
    ]);
  });

  it("matches LoRes state and address helpers from existing regression formulas", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    for (const [reg, value] of [
      [0x15, 0x80],
      [0x6a, 0x2d],
      [0x32, 0x12],
      [0x33, 0x34]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    expect(exports.zxnextGetLoResEnabled()).toBe(1);
    expect(exports.zxnextGetLoResRadastanMode()).toBe(1);
    expect(exports.zxnextGetLoResPaletteOffset()).toBe(0x0d);
    expect(exports.zxnextGetLoResScrollX()).toBe(0x12);
    expect(exports.zxnextGetLoResScrollY()).toBe(0x34);
    expect(exports.zxnextGetLoResStandardAddress(5, 47)).toBe((47 << 7) | 5);
    expect(exports.zxnextGetLoResStandardAddress(5, 48)).toBe(((48 << 7) | 5) + 0x0800);
    expect(exports.zxnextGetLoResRadastanAddress(3, 9, 1)).toBe(0x2000 | (9 << 6) | 3);
  });
});
