import { describe, expect, it } from "vitest";

import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

// --- Pinned values are the ones both cores (TypeScript and WASM) agreed on at tag
// --- pre-zxnext-ts-removal-2026-09-19.
describe("ZX Next WASM audio mixer", () => {
  it("mixes DAC, EAR, MIC and PSG levels and exports the sample buffer", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    for (const [reg, value] of [
      [0x2d, 0x90],
      [0x2c, 0x70],
      [0x2e, 0xa0]
    ]) {
      exports.zxnextSetNextRegisterDirect(reg, value);
    }
    exports.zxnextWritePort(0x005f, 0x60);

    exports.zxnextSetAudioMixerEarLevelMilli(500);
    exports.zxnextSetAudioMixerMicLevelMilli(-250);
    exports.zxnextSetAudioMixerPsgOutput(4096, 2048);
    exports.zxnextSetAudioMixerVolumeScaleMilli(750);

    // --- $2D writes A, $2C writes B, $2E writes C, $5F writes D (the $2D value also lands in D
    // --- but the later $5F write overrides it)
    expect([0, 1, 2, 3].map(i => exports.zxnextGetDacChannel(i))).toEqual([0x90, 0x70, 0xa0, 0x60]);
    // --- pinned
    expect(exports.zxnextGetAudioMixerMixedLeftWord()).toBe(5297);
    expect(exports.zxnextGetAudioMixerMixedRightWord()).toBe(5121);
    expect(exports.zxnextAppendAudioMixerCurrentSample()).toBe(1);
    expect(exports.zxnextGetAudioMixerSampleCount()).toBe(1);
    expect(exports.zxnextGetAudioMixerSampleLeft(0)).toBe(exports.zxnextGetAudioMixerMixedLeftWord());
    expect(exports.zxnextGetAudioMixerSampleRight(0)).toBe(exports.zxnextGetAudioMixerMixedRightWord());
  });

  it("schedules mixer samples from the 28 MHz frame clock during WASM frame execution", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    wasm.executeMachineFrame();

    // --- A 50 Hz Next frame is 70908 T-states at 3.5 MHz = 567264 clocks of 28 MHz;
    // --- 567264 * 48000 / 28 MHz = 972.45 -> 972 samples
    expect(wasm.wasmV2Runtime!.exports.zxnextGetTactsInFrame()).toBe(567_264);
    const expectedSamples = expectedSamplesForFrame(567_264, 48_000);
    expect(expectedSamples).toBe(972);
    const samples = wasm.getAudioSamples();

    expect(samples.length).toBe(expectedSamples);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetAudioMixerSampleCount()).toBe(expectedSamples);
    expect(samples[0]).toEqual({
      left: wasm.wasmV2Runtime!.exports.zxnextGetAudioMixerSampleLeft(0) / 32768.0,
      right: wasm.wasmV2Runtime!.exports.zxnextGetAudioMixerSampleRight(0) / 32768.0
    });
  });

  it("uses the configured sample rate for full-frame WASM mixer scheduling", async () => {
    for (const sampleRate of [44_100, 48_000, 96_000]) {
      const wasm = await createTestZxNextWasmMachine();
      const exports = wasm.wasmV2Runtime!.exports;

      wasm.setMachineProperty(AUDIO_SAMPLE_RATE, sampleRate);
      wasm.hardReset();
      wasm.executeMachineFrame();

      expect(exports.zxnextGetAudioSampleRate()).toBe(sampleRate);
      expect(wasm.getAudioSamples()).toHaveLength(
        expectedSamplesForFrame(exports.zxnextGetTactsInFrame(), sampleRate)
      );
    }
  });
});

function expectedSamplesForFrame(tactsInFrame28: number, sampleRate: number): number {
  const scaledFrame = tactsInFrame28 * sampleRate;
  return Math.floor(scaledFrame / 28_000_000);
}
