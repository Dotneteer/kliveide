import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM advanced video tilemap", () => {
  it("matches TypeScript tilemap control, clip, scroll, and base registers", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const screen = oracle.composedScreenDevice;

    for (const [reg, value] of [
      [0x1b, 0x01],
      [0x1b, 0x9f],
      [0x1b, 0x02],
      [0x1b, 0xfe],
      [0x2f, 0x02],
      [0x30, 0x55],
      [0x31, 0x44],
      [0x4c, 0x07],
      [0x6b, 0xf3],
      [0x6c, 0x9b],
      [0x6e, 0xa0],
      [0x6f, 0x9f]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    expect(exports.zxnextGetTilemapEnabled()).toBe(screen.tilemapEnabled ? 1 : 0);
    expect(exports.zxnextGetTilemapNextReg(0x6b)).toBe(
      (screen.tilemapEnabled ? 0x80 : 0) |
        (screen.tilemap80x32Resolution ? 0x40 : 0) |
        (screen.tilemapEliminateAttributes ? 0x20 : 0) |
        (oracle.paletteDevice.secondTilemapPalette ? 0x10 : 0) |
        (screen.tilemapTextMode ? 0x08 : 0) |
        (screen.tilemap512TileMode ? 0x02 : 0) |
        (screen.tilemapForceOnTopOfUla ? 0x01 : 0)
    );
    expect([0, 1, 2, 3].map(i => exports.zxnextGetTilemapClip(i))).toEqual([
      screen.tilemapClipWindowX1,
      screen.tilemapClipWindowX2,
      screen.tilemapClipWindowY1,
      screen.tilemapClipWindowY2
    ]);
    expect(exports.zxnextGetTilemapScrollX()).toBe(screen.tilemapScrollX);
    expect(exports.zxnextGetTilemapScrollY()).toBe(screen.tilemapScrollY);
    expect(exports.zxnextGetTilemapPaletteOffset()).toBe(screen.tilemapPaletteOffset);
    expect(exports.zxnextGetTilemapBaseAddressUseBank7()).toBe(screen.tilemapUseBank7 ? 1 : 0);
    expect(exports.zxnextGetTilemapBaseAddressMsb()).toBe(screen.tilemapBank5Msb);
    expect(exports.zxnextGetTilemapDefinitionAddressUseBank7()).toBe(screen.tilemapTileDefUseBank7 ? 1 : 0);
    expect(exports.zxnextGetTilemapDefinitionAddressMsb()).toBe(screen.tilemapTileDefBank5Msb);
  });
});
