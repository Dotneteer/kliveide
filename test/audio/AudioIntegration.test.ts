import { beforeEach, describe, expect, it } from "vitest";

import { Z88BeeperDevice } from "@emu/machines/z88/Z88BeeperDevice";
import type { IZ88BlinkDevice } from "@emu/machines/z88/IZ88BlinkDevice";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";

class MockZ88BlinkDevice implements Partial<IZ88BlinkDevice> {
  COM = 0x00;
}

class MockZ88Machine implements Partial<IZ88Machine> {
  baseClockFrequency = 3_276_800;
  tacts = 0;
  clockMultiplier = 1;
  currentFrameTact = 0;
  tactsInFrame = 65_536;
  frames = 0;
  uiFrameFrequency = 1;
  blinkDevice: IZ88BlinkDevice;

  constructor() {
    this.blinkDevice = new MockZ88BlinkDevice() as IZ88BlinkDevice;
  }

  advanceTacts(count: number): void {
    this.currentFrameTact += count;
    this.tacts += count;
  }
}

describe("Audio Integration Tests", () => {
  describe("Z88BeeperDevice", () => {
    let z88Machine: MockZ88Machine;
    let z88Beeper: Z88BeeperDevice;

    beforeEach(() => {
      z88Machine = new MockZ88Machine();
      z88Beeper = new Z88BeeperDevice(z88Machine as IZ88Machine);
      z88Beeper.setAudioSampleRate(44100);
    });

    it("should collect audio samples with correct type", () => {
      z88Beeper.setEarBit(true);

      for (let tact = 0; tact < z88Machine.tactsInFrame; tact += 16) {
        z88Machine.advanceTacts(16);
        z88Beeper.setNextAudioSample();
      }

      const samples = z88Beeper.getAudioSamples();
      expect(samples.length).toBeGreaterThan(0);

      for (const sample of samples) {
        expect(sample).toHaveProperty("left");
        expect(sample).toHaveProperty("right");
        expect(typeof sample.left).toBe("number");
        expect(typeof sample.right).toBe("number");
      }
    });

    it("should generate samples when EAR bit changes", () => {
      z88Beeper.setEarBit(false);

      for (let tact = 0; tact < 2000; tact += 16) {
        z88Machine.advanceTacts(16);
        z88Beeper.setNextAudioSample();
      }

      const samplesOff = z88Beeper.getAudioSamples().length;

      z88Machine.blinkDevice.COM = 0x00;
      z88Beeper.onNewFrame();
      z88Beeper.setEarBit(true);

      for (let tact = 0; tact < 2000; tact += 16) {
        z88Machine.advanceTacts(16);
        z88Beeper.setNextAudioSample();
      }

      const samplesOn = z88Beeper.getAudioSamples().length;

      expect(samplesOff).toBeGreaterThan(0);
      expect(samplesOn).toBeGreaterThan(0);
    });
  });
});
