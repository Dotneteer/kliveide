import { describe, expect, it } from "vitest";

import { AudioMixerDevice } from "@emu/machines/zxNext/AudioMixerDevice";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import { createTestZxNextWasmMachine, createZxNextOracleHarness } from "./wasm-next-test-helpers";

describe("ZX Next WASM audio mixer", () => {
  it("matches TypeScript mixer routing and exports the sample buffer", async () => {
    const dac = new DacDevice();
    const mixer = new AudioMixerDevice(dac);
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    dac.setChannelValues([0x90, 0x70, 0xa0, 0x60]);
    for (const [reg, value] of [
      [0x2d, 0x90],
      [0x2c, 0x70],
      [0x2e, 0xa0]
    ]) {
      exports.zxnextSetNextRegisterDirect(reg, value);
    }
    exports.zxnextWritePort(0x005f, 0x60);

    mixer.setEarLevel(0.5);
    mixer.setMicLevel(-0.25);
    mixer.setPsgOutput({ left: 4096, right: 2048 });
    mixer.setVolumeScale(0.75);
    exports.zxnextSetAudioMixerEarLevelMilli(500);
    exports.zxnextSetAudioMixerMicLevelMilli(-250);
    exports.zxnextSetAudioMixerPsgOutput(4096, 2048);
    exports.zxnextSetAudioMixerVolumeScaleMilli(750);

    const expected = mixer.getMixedOutput();
    expect(exports.zxnextGetAudioMixerMixedLeftWord()).toBe(Math.trunc(expected.left * 32768));
    expect(exports.zxnextGetAudioMixerMixedRightWord()).toBe(Math.trunc(expected.right * 32768));
    expect(exports.zxnextAppendAudioMixerCurrentSample()).toBe(1);
    expect(exports.zxnextGetAudioMixerSampleCount()).toBe(1);
    expect(exports.zxnextGetAudioMixerSampleLeft(0)).toBe(exports.zxnextGetAudioMixerMixedLeftWord());
    expect(exports.zxnextGetAudioMixerSampleRight(0)).toBe(exports.zxnextGetAudioMixerMixedRightWord());
  });

  it("schedules mixer samples from the 28 MHz frame clock during WASM frame execution", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    wasm.executeMachineFrame();

    const expectedSamples = expectedSamplesForFrame(oracle.tactsInFrame, 48_000);
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
