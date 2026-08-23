import { describe, expect, it } from "vitest";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";
import { OFFS_BANK_05, OFFS_BANK_07, OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import { zxNextBgra } from "@emu/machines/zxNext/PaletteDevice";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";

const STANDARD_SCREEN_WIDTH = 256;
const STANDARD_SCREEN_SCALE_X = 2;
const STANDARD_SCREEN_OUTPUT_WIDTH = STANDARD_SCREEN_WIDTH * STANDARD_SCREEN_SCALE_X;
const STANDARD_SCREEN_HEIGHT = 192;
const STANDARD_SCREEN_X = 96;
const STANDARD_SCREEN_Y = (ZXNEXT_WASM_V2_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;
const LAYER2_320_SCREEN_WIDTH = 320;
const LAYER2_320_SCREEN_OUTPUT_WIDTH = LAYER2_320_SCREEN_WIDTH * STANDARD_SCREEN_SCALE_X;
const LAYER2_WIDE_SCREEN_HEIGHT = 256;
const LAYER2_WIDE_SCREEN_X = 32;
const LAYER2_WIDE_SCREEN_Y = STANDARD_SCREEN_Y - (LAYER2_WIDE_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;

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

    oracle.renderInstantScreen();
    wasm.renderInstantScreen();
    const oraclePixels = oracle.getPixelBuffer();
    const wasmPixels = wasm.getPixelBuffer();
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

  it("applies ULA half-pixel scroll from NextReg $68", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    oracle.memoryDevice.memory[OFFS_BANK_05] = 0x0f;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 1] = 0xf0;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 0x1800] = 0x47;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x0f;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 1] = 0xf0;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 0x1800] = 0x47;
    oracle.nextRegDevice.directSetRegValue(0x68, 0x04);
    exports.zxnextSetNextRegisterDirect(0x68, 0x04);

    oracle.renderInstantScreen();
    wasm.renderInstantScreen();
    const oraclePixels = oracle.getPixelBuffer();
    const wasmPixels = wasm.getPixelBuffer();

    expect(exports.zxnextGetNextRegisterDirect(0x68)).toBe(oracle.nextRegDevice.directGetRegValue(0x68));
    for (let x = 0; x < 32; x++) {
      expect(wasmPixels[screenIndex(x, 0)], `x=${x}`).toBe(oraclePixels[screenIndex(x, 0)]);
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

  it("renders standard LoRes as 128x96 bank-5 pixels expanded into the ULA area", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    oracle.nextRegDevice.directSetRegValue(0x15, 0x80);
    oracle.nextRegDevice.directSetRegValue(0x6a, 0x00);
    exports.zxnextSetNextRegisterDirect(0x15, 0x80);
    exports.zxnextSetNextRegisterDirect(0x6a, 0x00);
    expect(exports.zxnextGetLoResEnabled()).toBe(1);

    oracle.memoryDevice.memory[OFFS_BANK_05] = 0x25;
    oracle.memoryDevice.memory[OFFS_BANK_05 + 1] = 0x12;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x25;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + 1] = 0x12;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x02d]);
    expect(pixels[screenIndex(3, 1)]).toBe(zxNextBgra[0x02d]);
    expect(pixels[screenIndex(4, 0)]).toBe(zxNextBgra[0x140]);
  });

  it("renders standard LoRes with X/Y scroll registers", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    exports.zxnextSetNextRegisterDirect(0x15, 0x80);
    exports.zxnextSetNextRegisterDirect(0x6a, 0x00);
    exports.zxnextSetNextRegisterDirect(0x32, 0x02);
    exports.zxnextSetNextRegisterDirect(0x33, 0x02);

    wasm.wasmV2Runtime!.memory[OFFS_BANK_05 + ((1 << 7) | 1)] = 0x43;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x145]);
  });

  it("renders LoRes from bank 5 even when the shadow screen is active", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    exports.zxnextSetNextRegisterDirect(0x15, 0x80);
    exports.zxnextSetNextRegisterDirect(0x6a, 0x00);
    exports.zxnextSetNextRegisterDirect(0x69, 0x40);

    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x42;
    wasm.wasmV2Runtime!.memory[OFFS_BANK_07] = 0x99;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x140]);
  });

  it("renders Radastan LoRes nibbles from bank 5", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    exports.zxnextSetNextRegisterDirect(0x15, 0x80);
    exports.zxnextSetNextRegisterDirect(0x6a, 0x20);

    wasm.wasmV2Runtime!.memory[OFFS_BANK_05] = 0x5a;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(zxNextBgra[0x02d]);
    expect(pixels[screenIndex(3, 0)]).toBe(zxNextBgra[0x02d]);
    expect(pixels[screenIndex(4, 0)]).toBe(zxNextBgra[0x1c0]);
  });

  it("renders 256x192 Layer 2 pixels from the active RAM bank over ULA", async () => {
    const { wasm } = await createZxNextOracleHarness();
    wasm.hardReset();

    wasm.doWritePort(0x123b, 0x02);
    expect(wasm.doReadPort(0x123b)).toBe(0x02);
    wasm.wasmV2Runtime!.memory[layer2Bank16Offset(8)] = 0x11;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(layer2Bgra(0x11));
    expect(pixels[screenIndex(1, 0)]).toBe(layer2Bgra(0x11));
  });

  it("renders 256x192 Layer 2 with clip and scroll registers", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    wasm.doWritePort(0x123b, 0x02);
    exports.zxnextSetNextRegisterDirect(0x1c, 0x01);
    for (const value of [0x08, 0x7f, 0x08, 0x7f]) {
      exports.zxnextSetNextRegisterDirect(0x18, value);
    }
    exports.zxnextSetNextRegisterDirect(0x16, 0x01);
    exports.zxnextSetNextRegisterDirect(0x71, 0x00);
    exports.zxnextSetNextRegisterDirect(0x17, 0x00);
    wasm.wasmV2Runtime!.memory[layer2Bank16Offset(8) + 0x08 * 0x100 + 0x09] = 0x22;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(14, 8)]).not.toBe(layer2Bgra(0x22));
    expect(pixels[screenIndex(16, 8)]).toBe(layer2Bgra(0x22));
  });

  it("keeps the ULA pixel when the Layer 2 palette index is transparent", async () => {
    const { wasm } = await createZxNextOracleHarness();
    wasm.hardReset();

    wasm.doWritePort(0x123b, 0x00);
    wasm.renderInstantScreen();
    const basePixel = wasm.getPixelBuffer()[screenIndex(0, 0)];

    wasm.doWritePort(0x123b, 0x02);
    wasm.wasmV2Runtime!.memory[layer2Bank16Offset(8)] = 0xe3;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[screenIndex(0, 0)]).toBe(basePixel);
  });

  it("renders 320x256 Layer 2 from five consecutive active RAM banks", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    for (const [reg, value] of [
      [0x1c, 0x01],
      [0x18, 0x00],
      [0x18, 0x9f],
      [0x18, 0x00],
      [0x18, 0xff],
      [0x12, 0x09],
      [0x70, 0x10],
      [0x69, 0x80]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    for (const [x, value] of [
      [0x00, 0x0b],
      [0x40, 0x55],
      [0x80, 0x17],
      [0xc0, 0x22],
      [0x100, 0x2d]
    ]) {
      oracle.memoryDevice.memory[layer2PhysicalOffset(9, x << 8)] = value;
      wasm.wasmV2Runtime!.memory[layer2PhysicalOffset(9, x << 8)] = value;
    }

    const oraclePixels = oracle.composedScreenDevice.renderFullScreen();
    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[layer2WideScreenIndex(0x00 * 2, 0)]).toBe(layer2Bgra(0x0b));
    expect(pixels[layer2WideScreenIndex(0x40 * 2, 0)]).toBe(layer2Bgra(0x55));
    expect(pixels[layer2WideScreenIndex(0x80 * 2, 0)]).toBe(layer2Bgra(0x17));
    expect(pixels[layer2WideScreenIndex(0xc0 * 2, 0)]).toBe(layer2Bgra(0x22));
    expect(pixels[layer2WideScreenIndex(0x100 * 2, 0)]).toBe(layer2Bgra(0x2d));
    expect(pixels[layer2WideScreenIndex(1, 0)]).toBe(layer2Bgra(0x0b));
    for (const index of [
      layer2WideScreenIndex(0x00 * 2, 0),
      layer2WideScreenIndex(0x40 * 2, 0),
      layer2WideScreenIndex(0x80 * 2, 0),
      layer2WideScreenIndex(0xc0 * 2, 0),
      layer2WideScreenIndex(0x100 * 2, 0)
    ]) {
      expect(pixels[index]).toBe(oraclePixels[index]);
    }
  });

  it("renders 320x256 Layer 2 with wide clip and 9-bit X scroll wrapping", async () => {
    const { wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    wasm.hardReset();

    exports.zxnextSetNextRegisterDirect(0x1c, 0x01);
    for (const value of [0x08, 0x7f, 0x00, 0xff]) {
      exports.zxnextSetNextRegisterDirect(0x18, value);
    }
    exports.zxnextSetNextRegisterDirect(0x12, 0x09);
    exports.zxnextSetNextRegisterDirect(0x70, 0x10);
    exports.zxnextSetNextRegisterDirect(0x69, 0x80);
    exports.zxnextSetNextRegisterDirect(0x16, 0xe0);
    exports.zxnextSetNextRegisterDirect(0x71, 0x01);
    exports.zxnextSetNextRegisterDirect(0x17, 0x01);

    const sourceX = layer2WideWrappedX(0x20 + 0x1e0);
    wasm.wasmV2Runtime!.memory[layer2PhysicalOffset(9, (sourceX << 8) | 0x01)] = 0x33;

    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    expect(pixels[layer2WideScreenIndex(0x1e, 0)]).not.toBe(layer2Bgra(0x33));
    expect(pixels[layer2WideScreenIndex(0x20 * 2, 0)]).toBe(layer2Bgra(0x33));
    expect(pixels[layer2WideScreenIndex(0x20 * 2 + 1, 0)]).toBe(layer2Bgra(0x33));
  });

  it("renders 640x256 Layer 2 nibbles from five consecutive active RAM banks", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const exports = wasm.wasmV2Runtime!.exports;
    oracle.hardReset();
    wasm.hardReset();

    for (const [reg, value] of [
      [0x1c, 0x01],
      [0x18, 0x00],
      [0x18, 0x9f],
      [0x18, 0x00],
      [0x18, 0xff],
      [0x12, 0x09],
      [0x70, 0x20],
      [0x69, 0x80]
    ]) {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    }

    for (const [x, value] of [
      [0x00, 0x0b],
      [0x40, 0x55],
      [0x80, 0x17],
      [0xc0, 0x22],
      [0x100, 0xff]
    ]) {
      oracle.memoryDevice.memory[layer2PhysicalOffset(9, x << 8)] = value;
      wasm.wasmV2Runtime!.memory[layer2PhysicalOffset(9, x << 8)] = value;
    }

    const oraclePixels = oracle.composedScreenDevice.renderFullScreen();
    wasm.renderInstantScreen();
    const pixels = wasm.getPixelBuffer();

    for (const [x, byteValue] of [
      [0x00, 0x0b],
      [0x40, 0x55],
      [0x80, 0x17],
      [0xc0, 0x22],
      [0x100, 0xff]
    ]) {
      const leftIndex = layer2WideScreenIndex(x * 2, 0);
      const rightIndex = layer2WideScreenIndex(x * 2 + 1, 0);
      expect(pixels[leftIndex], `left x=${x.toString(16)}`).toBe(layer2Bgra((byteValue >> 4) & 0x0f));
      expect(pixels[rightIndex], `right x=${x.toString(16)}`).toBe(layer2Bgra(byteValue & 0x0f));
      expect(pixels[leftIndex], `oracle left x=${x.toString(16)}`).toBe(oraclePixels[leftIndex]);
      expect(pixels[rightIndex], `oracle right x=${x.toString(16)}`).toBe(oraclePixels[rightIndex]);
    }
  });

  it("maps CPU writes through port $123B into Layer 2 RAM", async () => {
    const { wasm } = await createZxNextOracleHarness();
    wasm.hardReset();

    wasm.doWritePort(0x123b, 0x07);
    wasm.doWriteMemory(0x0000, 0x33);

    expect(wasm.wasmV2Runtime!.memory[layer2MappedOffset(8, 0x0000)]).toBe(0x33);
    expect(wasm.doReadMemory(0x0000)).toBe(0x33);
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

function layer2WideScreenIndex(x: number, y: number): number {
  return (LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_WASM_V2_SCREEN_WIDTH + LAYER2_WIDE_SCREEN_X + x;
}

function layer2Bank16Offset(bank16: number): number {
  return OFFS_NEXT_RAM + bank16 * 0x4000;
}

function layer2Bgra(index: number): number {
  return zxNextBgra[((index << 1) | (index & 0x02 ? 0x01 : 0x00)) & 0x1ff];
}

function layer2PhysicalOffset(bank16: number, offset: number): number {
  const segment16K = (offset >> 14) & 0x07;
  const half8K = (offset >> 13) & 0x01;
  const bank8K = ((bank16 + segment16K) << 1) | half8K;
  return OFFS_NEXT_RAM + bank8K * 0x2000 + (offset & 0x1fff);
}

function layer2WideWrappedX(x: number): number {
  x &= 0x3ff;
  if (x >= 320) {
    const upper = ((x >> 6) & 0x07) + 3;
    x = (upper << 6) | (x & 0x3f);
  }
  return x & 0x1ff;
}

function layer2MappedOffset(activeBank: number, address: number, mapSegment = 0, bankOffset = 0): number {
  const layer2ActiveBankOffsetPre = mapSegment === 3 ? (address >> 14) & 0x03 : mapSegment;
  const layer2ActiveBankOffset = (layer2ActiveBankOffsetPre + bankOffset) & 0x07;
  const layer2ActivePage = (((activeBank + layer2ActiveBankOffset) & 0x7f) << 1) | ((address >> 13) & 0x01);
  const upperNibble = (0x01 + ((layer2ActivePage >> 5) & 0x07)) & 0x0f;
  const layer2A21A13 = (upperNibble << 5) | (layer2ActivePage & 0x1f);
  return OFFS_NEXT_RAM + ((layer2A21A13 & 0xff) << 13) + (address & 0x1fff);
}
