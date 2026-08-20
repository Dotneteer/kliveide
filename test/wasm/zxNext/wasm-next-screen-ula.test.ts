import { describe, expect, it } from "vitest";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

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
});
