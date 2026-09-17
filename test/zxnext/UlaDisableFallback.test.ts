import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "./TestNextMachine";
import { createTestZxNextWasmMachine } from "../wasm/zxNext/wasm-next-test-helpers";

/*
 * NextReg $68 bit 7 and the $4A fallback colour (Findings F5).
 *
 * zxnext.vhd: `ula_transparent <= ... or ula_en_2 = '0'`, and the fallback colour's extra blue bit is
 * `fallback_rgb_2(1) or fallback_rgb_2(0)`. The screen-level behaviour (per-pixel, border included,
 * re-enabled mid-frame) is covered by visual case C11 in both cores.
 */
describe("$4A fallback colour expansion", () => {
  // 8-bit RRRGGGBB -> 9-bit RRRGGGBBB with the low blue bit = B1 | B0
  const cases: Array<[number, number]> = [
    [0x00, 0b000000000],
    [0x01, 0b000000011],
    [0x02, 0b000000101], // blue 10 -> 101 (was 110)
    [0x03, 0b000000111],
    [0xe3, 0b111000111]
  ];

  it("TypeScript core", async () => {
    const m = await createTestNextMachine();
    for (const [value, rgb333] of cases) {
      m.composedScreenDevice.fallbackColor = value;
      expect((m.composedScreenDevice as unknown as { fallbackRgb333Cache: number }).fallbackRgb333Cache).toBe(rgb333);
    }
  });

  it("WASM core: $68 bit 7 fills the whole screen with the fallback colour", async () => {
    const m = await createTestZxNextWasmMachine();
    const e = m.wasmV2Runtime!.exports;
    const levels = [0x00, 0x24, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff];
    e.zxnextSetNextRegisterDirect(0x68, 0x80);
    for (const [value, rgb333] of cases) {
      e.zxnextSetNextRegisterDirect(0x4a, value);
      e.zxnextRenderInstantScreen();
      const expected = (0xff000000 | (levels[rgb333 & 7] << 16) | (levels[(rgb333 >> 3) & 7] << 8) | levels[(rgb333 >> 6) & 7]) >>> 0;
      const buffer = m.getPixelBuffer();
      // --- border corner, paper centre, bottom-right corner
      for (const i of [0, 150 * 720 + 360, 288 * 720 - 1]) expect(buffer[i] >>> 0).toBe(expected);
    }
  });
});

describe("$14 global transparency applies to the ULA border (Findings F4)", () => {
  // zxnext.vhd: ula_rgb_2 (which includes border pixels) is transparent when its upper 8 bits equal $14.
  // Border 2 is ULA palette entry 18, reset value 9-bit 101000000 -> upper 8 bits $A0.
  const GREEN = 0xff00ff00; // fallback $1C, as ABGR

  it("TypeScript core: a border matching $14 shows the fallback colour", async () => {
    const m = await createTestNextMachine();
    const screen = m.composedScreenDevice;
    screen.borderColor = 2;
    m.nextRegDevice.directSetRegValue(0x4a, 0x1c);
    const tact = 20 * screen.config.totalHC + 120; // a visible top-border position
    const offset = (20 - screen.config.firstBitmapVC) * 720 + (120 - screen.config.firstVisibleHC) * 2;

    screen.renderTact(tact);
    expect(screen.getPixelBuffer()[offset] >>> 0).not.toBe(GREEN);
    m.nextRegDevice.directSetRegValue(0x14, 0xa0);
    screen.renderTact(tact);
    expect(screen.getPixelBuffer()[offset] >>> 0).toBe(GREEN);
  });

  it("WASM core: a border matching $14 shows the fallback colour", async () => {
    const m = await createTestZxNextWasmMachine();
    const e = m.wasmV2Runtime!.exports;
    e.zxnextWritePort(0xfe, 0x02);
    e.zxnextSetNextRegisterDirect(0x4a, 0x1c);
    e.zxnextRenderInstantScreen();
    expect(m.getPixelBuffer()[0] >>> 0).not.toBe(GREEN);
    e.zxnextSetNextRegisterDirect(0x14, 0xa0);
    e.zxnextRenderInstantScreen();
    expect(m.getPixelBuffer()[0] >>> 0).toBe(GREEN);
  });
});
