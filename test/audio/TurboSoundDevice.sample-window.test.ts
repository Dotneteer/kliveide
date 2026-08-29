import { describe, expect, it } from "vitest";

import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";

describe("TurboSoundDevice PSG sample-window averaging", () => {
  it("averages PSG output over the exact sample window", () => {
    const device = new TurboSoundDevice(109_375); // 28 MHz / 256

    writePsgRegister(device, 0x00, 0x01);
    writePsgRegister(device, 0x01, 0x00);
    writePsgRegister(device, 0x07, 0x3e);
    writePsgRegister(device, 0x08, 0x0f);

    device.setNextAudioSample(256);

    expect(device.getAudioSamples()).toHaveLength(1);
    expect(device.getAudioSamples()[0].left).toBeCloseTo(65_535 / 2, 6);
    expect(device.getAudioSamples()[0].right).toBe(0);
  });

  it("emits every due sample when frame tacts jump across multiple boundaries", () => {
    const device = new TurboSoundDevice(109_375); // 28 MHz / 256

    device.setNextAudioSample(255);
    expect(device.getAudioSamples()).toHaveLength(0);

    device.setNextAudioSample(768);
    expect(device.getAudioSamples()).toHaveLength(3);
  });
});

function writePsgRegister(device: TurboSoundDevice, reg: number, value: number): void {
  device.setPsgRegisterIndex(reg);
  device.writePsgRegisterValue(value);
}
