import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM beeper audio", () => {
  it("tracks EAR/MIC transitions and weights the sample by their duration", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    wasm.setTacts(10);
    exports.zxnextSetBeeperOutput(1, 0);

    wasm.setTacts(30);
    exports.zxnextSetBeeperOutput(1, 1);

    wasm.setTacts(50);

    expect(exports.zxnextGetBeeperEar()).toBe(1);
    expect(exports.zxnextGetBeeperMic()).toBe(1);
    expect(exports.zxnextGetBeeperOutputLevelMilli()).toBe(1000);
    // --- Pinned: the values the TypeScript SpectrumBeeperDevice and the WASM core agreed on at
    // --- tag pre-zxnext-ts-removal-2026-09-19.
    expect(exports.zxnextGetBeeperSampleLeftMilli()).toBe(800);
    expect(exports.zxnextGetBeeperSampleRightMilli()).toBe(400);
  });

  it("drives beeper EAR/MIC state from ULA port $FE writes", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    // --- $FE bit 4 is EAR, bit 3 is MIC
    wasm.doWritePort(0x00fe, 0x18);

    expect(exports.zxnextGetBeeperEar()).toBe(1);
    expect(exports.zxnextGetBeeperMic()).toBe(1);
    expect(exports.zxnextGetBeeperOutputLevelMilli()).toBe(1000);

    wasm.doWritePort(0x00fe, 0x00);

    expect(exports.zxnextGetBeeperEar()).toBe(0);
    expect(exports.zxnextGetBeeperMic()).toBe(0);
    expect(exports.zxnextGetBeeperOutputLevelMilli()).toBe(0);
  });
});
