import { describe, expect, it } from "vitest";

import { AudioMixerDevice } from "@emu/machines/zxNext/AudioMixerDevice";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

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
});
