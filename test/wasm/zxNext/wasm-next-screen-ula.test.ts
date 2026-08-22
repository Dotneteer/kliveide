import { describe, expect, it } from "vitest";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";
import { OFFS_BANK_05, OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import { zxNextBgra } from "@emu/machines/zxNext/PaletteDevice";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";

const STANDARD_SCREEN_WIDTH = 256;
const STANDARD_SCREEN_SCALE_X = 2;
const STANDARD_SCREEN_OUTPUT_WIDTH = STANDARD_SCREEN_WIDTH * STANDARD_SCREEN_SCALE_X;
const STANDARD_SCREEN_HEIGHT = 192;
const STANDARD_SCREEN_X = (ZXNEXT_WASM_V2_SCREEN_WIDTH - STANDARD_SCREEN_OUTPUT_WIDTH) / 2;
const STANDARD_SCREEN_Y = (ZXNEXT_WASM_V2_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;

describe("ZX Spectrum Next WASM standard ULA screen", () => {
  it("matches blank pixel snapshots, flash state, and sampled scanline timing", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    const oracleSnapshot = oracle.renderInstantScreen();
    const wasmSnapshot = wasm.renderInstantScreen();
    expect(Array.from(wasmSnapshot.subarray(0, 64))).toEqual(Array.from(oracleSnapshot.subarray(0, 64)));
    expect(Array.from(wasm.getPixelBufferBytes().subarray(0, 64))).toEqual(
      Array.from(new Uint8ClampedArray(oracle.getPixelBuffer().buffer).subarray(0, 64))
    );

    expect(wasm.wasmV2Runtime!.exports.zxnextGetUlaFlashCounter()).toBe((oracle.composedScreenDevice as any).flashCounter);
    expect(Boolean(wasm.wasmV2Runtime!.exports.zxnextGetUlaFlashFlag())).toBe((oracle.composedScreenDevice as any).flashFlag);

    for (let i = 0; i < 16; i++) {
      oracle.composedScreenDevice.onNewFrame();
      wasm.wasmV2Runtime!.exports.zxnextAdvanceUlaFrameState();
    }
    expect(wasm.wasmV2Runtime!.exports.zxnextGetUlaFlashCounter()).toBe((oracle.composedScreenDevice as any).flashCounter);
    expect(Boolean(wasm.wasmV2Runtime!.exports.zxnextGetUlaFlashFlag())).toBe((oracle.composedScreenDevice as any).flashFlag);

    const config = (oracle.composedScreenDevice as any).config;
    const renderingTacts = config.totalHC * config.totalVC;
    const sampledTacts = [0, 1, config.totalHC - 1, config.totalHC, config.totalHC * 2 + 3, renderingTacts - 1];
    for (const tact of sampledTacts) {
      expect(wasm.wasmV2Runtime!.exports.zxnextGetUlaScanlineForTact(tact)).toBe(
        Math.floor((tact % renderingTacts) / config.totalHC)
      );
      expect(wasm.wasmV2Runtime!.exports.zxnextGetUlaColumnForTact(tact)).toBe(tact % config.totalHC);
    }
  });

  it("matches TypeScript doubled horizontal standard-screen pixels", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    oracle.memoryDevice.memory[OFFS_BANK_05] = 0xff;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 0x1800] = 0x47;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0xff;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x1800] = 0x47;

    const oraclePixels = oracle.renderInstantScreen();
    const wasmPixels = wasm.renderInstantScreen();
    const sampleIndexes = [
      screenIndex(0, 0),
      screenIndex(1, 0),
      screenIndex(15, 0),
      screenIndex(16, 0)
    ];

    for (const index of sampleIndexes) {
      expect(wasmPixels[index]).toBe(oraclePixels[index]);
    }
  });

  it("uses the TypeScript ABGR pixel word order for asymmetric ULA colors", async () => {
    const { wasm } = await createZxNextOracleHarness();
    wasm.hardReset();

    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0xf0;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x1800] = 0x11;

    wasm.renderInstantScreen();
    const wasmPixels = wasm.getPixelBuffer();
    const blueIndex = screenIndex(0, 0);
    const redIndex = screenIndex(8, 0);

    expect(wasmPixels[blueIndex]).toBe(zxNextBgra[0x005]);
    expect(wasmPixels[redIndex]).toBe(zxNextBgra[0x140]);

    const bytes = wasm.getPixelBufferBytes();
    expect(Array.from(bytes.subarray(blueIndex * 4, blueIndex * 4 + 4))).toEqual([0x00, 0x00, 0xb6, 0xff]);
    expect(Array.from(bytes.subarray(redIndex * 4, redIndex * 4 + 4))).toEqual([0xb6, 0x00, 0x00, 0xff]);
  });

  it("matches TypeScript ULA scroll and clip register state", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;

    for (const [reg, value] of [
      [0x1a, 0x02],
      [0x1a, 0x05],
      [0x1a, 0x03],
      [0x1a, 0x04],
      [0x26, 0x81],
      [0x27, 0x12]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    expect(exports.zxnextGetUlaScrollX()).toBe(oracle.composedScreenDevice.ulaScrollX);
    expect(exports.zxnextGetUlaScrollY()).toBe(oracle.composedScreenDevice.ulaScrollY);
    expect([0, 1, 2, 3].map(i => exports.zxnextGetUlaClip(i))).toEqual([
      oracle.composedScreenDevice.ulaClipWindowX1,
      oracle.composedScreenDevice.ulaClipWindowX2,
      oracle.composedScreenDevice.ulaClipWindowY1,
      oracle.composedScreenDevice.ulaClipWindowY2
    ]);
    expect(exports.zxnextGetNextRegisterDirect(0x1a)).toBe(oracle.nextRegDevice.directGetRegValue(0x1a));
    expect(exports.zxnextGetNextRegisterDirect(0x1c)).toBe(oracle.nextRegDevice.directGetRegValue(0x1c));
    expect(exports.zxnextGetNextRegisterDirect(0x26)).toBe(oracle.nextRegDevice.directGetRegValue(0x26));
    expect(exports.zxnextGetNextRegisterDirect(0x27)).toBe(oracle.nextRegDevice.directGetRegValue(0x27));
  });

  it("applies ULA clipping after pixel-level X/Y scroll in the WASM instant renderer", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    oracle.doWritePort(0x00fe, 0x05);
    wasm.doWritePort(0x00fe, 0x05);

    oracle.nextRegDevice.directSetRegValue(0x1c, 0x04);
    exports.zxnextSetNextRegisterDirect(0x1c, 0x04);
    for (const value of [0x00, 0x00, 0x00, 0x00]) {
      oracle.nextRegDevice.directSetRegValue(0x1a, value);
      exports.zxnextSetNextRegisterDirect(0x1a, value);
    }
    oracle.nextRegDevice.directSetRegValue(0x26, 0x01);
    oracle.nextRegDevice.directSetRegValue(0x27, 0x01);
    exports.zxnextSetNextRegisterDirect(0x26, 0x01);
    exports.zxnextSetNextRegisterDirect(0x27, 0x01);

    oracle.memoryDevice.memory[OFFS_BANK_05 + 0x0100] = 0x40;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 0x1800] = 0x02;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x0100] = 0x40;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x1800] = 0x02;

    const oraclePixels = oracle.composedScreenDevice.renderFullScreen();
    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x140]);
    expect(pixels[screenIndex(2, 0)]).toBe(oraclePixels[screenIndex(2, 0)]);
    expect(pixels[screenIndex(2, 0)]).toBe(zxNextBgra[0x000]);
    expect(pixels[screenIndex(0, 1)]).toBe(oraclePixels[screenIndex(0, 1)]);
    expect(pixels[screenIndex(0, 1)]).toBe(zxNextBgra[0x000]);
    expect(pixels[(STANDARD_SCREEN_Y - 1) * ZXNEXT_WASM_V2_SCREEN_WIDTH + STANDARD_SCREEN_X]).toBe(zxNextBgra[0x02d]);
  });

  it("renders Timex ULA HiRes pixels from both screen bitmap banks", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    oracle.doWritePort(0x00ff, 0x06);
    wasm.doWritePort(0x00ff, 0x06);
    expect(oracle.composedScreenDevice.ulaHiResMode).toBe(true);
    expect(wasm.doReadPort(0x00ff)).toBe(oracle.doReadPort(0x00ff));

    oracle.memoryDevice.memory[OFFS_BANK_05] = 0xff;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 0x2000] = 0xaa;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0xff;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x2000] = 0xaa;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x000]);
    expect(pixels[screenIndex(7, 0)]).toBe(zxNextBgra[0x000]);
    expect(pixels[screenIndex(8, 0)]).toBe(zxNextBgra[0x000]);
    expect(pixels[screenIndex(9, 0)]).toBe(zxNextBgra[0x1ff]);
    expect(pixels[screenIndex(10, 0)]).toBe(zxNextBgra[0x000]);
    expect(pixels[screenIndex(11, 0)]).toBe(zxNextBgra[0x1ff]);
    expect(pixels[(STANDARD_SCREEN_Y - 1) * ZXNEXT_WASM_V2_SCREEN_WIDTH + STANDARD_SCREEN_X]).toBe(zxNextBgra[0x1ff]);
  });

  it("renders Timex ULA HiRes from screen memory when CPU MMU does not map bank 5 at $4000", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    exports.zxnextSetNextRegisterDirect(0x54, 0x00);
    exports.zxnextSetNextRegisterDirect(0x55, 0x01);
    exports.zxnextSetNextRegisterDirect(0x69, 0x06);

    wasm.wasmV2Runtime!.memory[OFFS_NEXT_RAM] = 0x00;
    wasm.wasmV2Runtime!.memory[OFFS_NEXT_RAM + 0x2000] = 0x00;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x80;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x000]);
    expect(pixels[screenIndex(1, 0)]).toBe(zxNextBgra[0x1ff]);
  });

  it("renders Timex ULA HiRes with pixel-level X scroll", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    wasm.doWritePort(0x00ff, 0x06);
    exports.zxnextSetNextRegisterDirect(0x26, 0x01);
    exports.zxnextSetNextRegisterDirect(0x27, 0x00);

    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x20;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x000]);
    expect(pixels[screenIndex(1, 0)]).toBe(zxNextBgra[0x1ff]);
    expect(pixels[screenIndex(2, 0)]).toBe(zxNextBgra[0x1ff]);
  });

  it("renders Timex ULA HiColor pixels from per-line attributes", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    oracle.doWritePort(0x00ff, 0x03);
    wasm.doWritePort(0x00ff, 0x03);
    expect(oracle.composedScreenDevice.ulaHiColorMode).toBe(true);
    expect(wasm.doReadPort(0x00ff)).toBe(oracle.doReadPort(0x00ff));

    oracle.memoryDevice.memory[OFFS_BANK_05] = 0x80;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 0x1800] = 0x47;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 0x2000] = 0x11;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x80;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x1800] = 0x47;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x2000] = 0x11;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x005]);
    expect(pixels[screenIndex(2, 0)]).toBe(zxNextBgra[0x140]);
    expect(pixels[screenIndex(0, 0)]).not.toBe(zxNextBgra[0x1ff]);
  });

  it("renders Timex ULA HiColor from screen memory when CPU MMU does not map bank 5 at $4000", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    exports.zxnextSetNextRegisterDirect(0x54, 0x00);
    exports.zxnextSetNextRegisterDirect(0x55, 0x01);
    exports.zxnextSetNextRegisterDirect(0x69, 0x03);

    wasm.wasmV2Runtime!.memory[OFFS_NEXT_RAM] = 0x00;
    wasm.wasmV2Runtime!.memory[OFFS_NEXT_RAM + 0x2000] = 0x00;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x80;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x2000] = 0x11;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x005]);
    expect(pixels[screenIndex(2, 0)]).toBe(zxNextBgra[0x140]);
  });

  it("renders Timex ULA HiColor with pixel-level X scroll", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    wasm.doWritePort(0x00ff, 0x03);
    exports.zxnextSetNextRegisterDirect(0x26, 0x01);
    exports.zxnextSetNextRegisterDirect(0x27, 0x00);

    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x60;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x2000] = 0x11;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x005]);
    expect(pixels[screenIndex(2, 0)]).toBe(zxNextBgra[0x005]);
    expect(pixels[screenIndex(4, 0)]).toBe(zxNextBgra[0x140]);
  });
});

function screenIndex(x: number, y: number): number {
  return (STANDARD_SCREEN_Y + y) * ZXNEXT_WASM_V2_SCREEN_WIDTH + STANDARD_SCREEN_X + x;
}
