import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM advanced video LoRes", () => {
  it("reports LoRes state and address helpers from existing regression formulas", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    for (const [reg, value] of [
      [0x15, 0x80],
      [0x6a, 0x2d],
      [0x32, 0x12],
      [0x33, 0x34]
    ]) {
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
