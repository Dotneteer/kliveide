import { describe, expect, it } from "vitest";

import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM PSG/TurboSound audio", () => {
  it("matches TypeScript chip selection, panning, mono mode, and YM register readback", async () => {
    const oracle = new TurboSoundDevice();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.enableTurbosound = true;
    exports.zxnextSetPsgTurbosoundEnabled(1);

    oracle.setPsgRegisterIndex(0xfd);
    exports.zxnextSetPsgRegisterIndex(0xfd);
    oracle.setPsgRegisterIndex(0x01);
    exports.zxnextSetPsgRegisterIndex(0x01);
    oracle.writePsgRegisterValue(0xf5);
    exports.zxnextWritePsgRegisterValue(0xf5);

    oracle.setAyStereoMode(true);
    oracle.setChipMonoMode(2, true);
    exports.zxnextSetPsgAyStereoMode(1);
    exports.zxnextSetPsgChipMonoMode(2, 1);

    expect(exports.zxnextGetPsgSelectedChip()).toBe(oracle.getSelectedChipId());
    expect(exports.zxnextGetPsgSelectedRegister()).toBe(oracle.getSelectedRegister());
    expect(exports.zxnextGetPsgChipPanning(2)).toBe(oracle.getChipPanning(2));
    expect(exports.zxnextGetPsgChipMonoMode(2)).toBe(oracle.getChipMonoMode(2) ? 1 : 0);
    expect(exports.zxnextGetPsgRegister(2, 1)).toBe(oracle.getChip(2).readPsgRegisterValue());
    expect(exports.zxnextReadPsgRegisterValue()).toBe(oracle.readPsgRegisterValue());
  });

  it("exposes deterministic noise/envelope movement and stereo samples", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    exports.zxnextSetPsgRegisterIndex(0x08);
    exports.zxnextWritePsgRegisterValue(0x1f);
    exports.zxnextSetPsgRegisterIndex(0x09);
    exports.zxnextWritePsgRegisterValue(0x10);
    exports.zxnextSetPsgRegisterIndex(0x0a);
    exports.zxnextWritePsgRegisterValue(0x08);
    exports.zxnextSetPsgRegisterIndex(0x0d);
    exports.zxnextWritePsgRegisterValue(0x0f);

    const rngBefore = exports.zxnextGetPsgNoiseRng(0);
    const envBefore = exports.zxnextGetPsgEnvelopeStep(0);
    exports.zxnextGeneratePsgOutput(0);

    expect(exports.zxnextGetPsgNoiseRng(0)).not.toBe(rngBefore);
    expect(exports.zxnextGetPsgEnvelopeStep(0)).toBeLessThan(envBefore);
    expect(exports.zxnextGetPsgStereoLeft(0)).toBeGreaterThan(0);
    expect(exports.zxnextGetPsgStereoRight(0)).toBeGreaterThan(0);
  });
});
