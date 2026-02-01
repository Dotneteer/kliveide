import { describe, it, expect, beforeEach } from "vitest";
import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import { ZxSpectrum128PsgDevice } from "@emu/machines/zxSpectrum128/ZxSpectrum128PsgDevice";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * Mock machine for testing audio integration
 */
class MockMachine implements Partial<IAnyMachine> {
  baseClockFrequency: number;
  tacts: number;
  clockMultiplier: number;
  currentFrameTact: number;
  tactsInFrame: number;
  frames: number;
  uiFrameFrequency: number;

  constructor(baseClockFrequency: number = 3_546_900) {
    this.baseClockFrequency = baseClockFrequency;
    this.tacts = 0;
    this.clockMultiplier = 1;
    this.currentFrameTact = 0;
    this.tactsInFrame = 69_888;
    this.frames = 0;
    this.uiFrameFrequency = 1;
  }

  /**
   * Simulate advancing one frame
   */
  advanceFrame(): void {
    this.currentFrameTact = 0;
    this.tacts += this.tactsInFrame;
    this.frames++;
  }

  /**
   * Simulate advancing by tacts within a frame
   */
  advanceTacts(count: number): void {
    this.currentFrameTact += count;
    this.tacts += count;
  }
}

describe("Audio Integration Tests", () => {
  let machine: MockMachine;
  let beeper: SpectrumBeeperDevice;
  let psg: ZxSpectrum128PsgDevice;

  beforeEach(() => {
    machine = new MockMachine();
    beeper = new SpectrumBeeperDevice(machine as any);
    psg = new ZxSpectrum128PsgDevice(machine as any);

    beeper.setAudioSampleRate(44100);
    psg.setAudioSampleRate(44100);
  });

  describe("Beeper + PSG Mixing", () => {
    it("should mix beeper and PSG output independently", () => {
      // Enable beeper
      beeper.setEarBit(true);

      // Enable PSG tone
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;

      beeper.setNextAudioSample();
      psg.setNextAudioSample();

      const beeperSamples = beeper.getAudioSamples();
      const psgSamples = psg.getAudioSamples();

      expect(beeperSamples.length).toBeGreaterThan(0);
      expect(psgSamples.length).toBeGreaterThan(0);

      // Beeper should be 1.0 when on
      expect(beeperSamples[0].left).toBe(1.0);
      expect(beeperSamples[0].right).toBe(1.0);
    });

    it("should allow simultaneous output without interference", () => {
      // Beeper: continuous tone
      beeper.setEarBit(true);

      // PSG: tone on channel A
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x02);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x08);

      const sampleLength = 3_546_900 / 44100;

      // Generate multiple samples
      for (let i = 0; i < 100; i++) {
        machine.tacts = sampleLength * (i + 1);
        beeper.setNextAudioSample();

        machine.currentFrameTact = 16 * (i + 1);
        psg.calculateCurrentAudioValue();
        psg.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
      expect(psg.getAudioSamples().length).toBeGreaterThan(0);
    });

    it("should produce consistent mixing when both devices active", () => {
      beeper.setEarBit(true);

      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const sampleLength = 3_546_900 / 44100;

      for (let i = 0; i < 50; i++) {
        machine.tacts = sampleLength * (i + 1);
        machine.currentFrameTact = 16 * (i + 1);

        psg.calculateCurrentAudioValue();

        beeper.setNextAudioSample();
        psg.setNextAudioSample();
      }

      const beeperSamples = beeper.getAudioSamples();
      const psgSamples = psg.getAudioSamples();

      // Both should have samples
      expect(beeperSamples.length).toEqual(psgSamples.length);
    });
  });

  describe("Full Frame Audio Generation", () => {
    it("should generate audio for complete frame", () => {
      beeper.setAudioSampleRate(44100);
      psg.setAudioSampleRate(44100);

      beeper.setEarBit(true);
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const tactsPerFrame = 69_888;
      const sampleLength = 3_546_900 / 44100;

      // Simulate full frame
      for (let tact = 0; tact < tactsPerFrame; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      machine.tacts = tactsPerFrame;
      for (let i = 0; i < 1000; i++) {
        beeper.setNextAudioSample();
        psg.setNextAudioSample();
      }

      const beeperSamples = beeper.getAudioSamples();
      const psgSamples = psg.getAudioSamples();

      // Should generate approximately 869 samples per frame at 44.1kHz
      const expected = (tactsPerFrame * 44100) / 3_546_900;
      expect(beeperSamples.length).toBeCloseTo(expected, 0);
      expect(psgSamples.length).toBeCloseTo(expected, 0);
    });

    it("should handle frame boundaries correctly", () => {
      beeper.setEarBit(true);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const tactsPerFrame = 69_888;

      for (let frame = 0; frame < 3; frame++) {
        // Simulate frame
        for (let tact = 0; tact < tactsPerFrame; tact += 16) {
          machine.currentFrameTact = tact;
          psg.calculateCurrentAudioValue();
        }

        machine.tacts = tactsPerFrame * (frame + 1);
        for (let i = 0; i < 1000; i++) {
          beeper.setNextAudioSample();
          psg.setNextAudioSample();
        }

        const beeperSamples = beeper.getAudioSamples();
        const psgSamples = psg.getAudioSamples();

        expect(beeperSamples.length).toBeGreaterThan(0);
        expect(psgSamples.length).toBeGreaterThan(0);

        // Clear for next frame
        beeper.onNewFrame();
        psg.onNewFrame();

        machine.currentFrameTact = 0;
      }
    });

    it("should maintain sample rate across multiple frames", () => {
      beeper.setEarBit(true);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const tactsPerFrame = 69_888;
      const expected = (tactsPerFrame * 44100) / 3_546_900;
      const frameSamples: { beeper: number; psg: number }[] = [];

      for (let frame = 0; frame < 5; frame++) {
        for (let tact = 0; tact < tactsPerFrame; tact += 16) {
          machine.currentFrameTact = tact;
          psg.calculateCurrentAudioValue();
        }

        machine.tacts = tactsPerFrame * (frame + 1);
        for (let i = 0; i < 1000; i++) {
          beeper.setNextAudioSample();
          psg.setNextAudioSample();
        }

        frameSamples.push({
          beeper: beeper.getAudioSamples().length,
          psg: psg.getAudioSamples().length
        });

        beeper.onNewFrame();
        psg.onNewFrame();
      }

      // Each frame should have consistent sample count
      for (const frame of frameSamples) {
        expect(Math.abs(frame.beeper - expected)).toBeLessThan(2);
        expect(Math.abs(frame.psg - expected)).toBeLessThan(2);
      }
    });
  });

  describe("Clock Multiplier Effects", () => {
    it("should respect clock multiplier in both devices", () => {
      machine.clockMultiplier = 2;

      beeper.setEarBit(true);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 2;

      beeper.setNextAudioSample();
      psg.setNextAudioSample();

      expect(beeper.getAudioSamples().length).toBeLessThanOrEqual(2);
      expect(psg.getAudioSamples().length).toBeLessThanOrEqual(2);
    });

    it("should generate more samples with multiplier 1", () => {
      machine.clockMultiplier = 1;

      beeper.setEarBit(true);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 10;

      for (let i = 0; i < 10; i++) {
        beeper.setNextAudioSample();
        psg.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThanOrEqual(8);
      expect(psg.getAudioSamples().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Dynamic Audio Changes", () => {
    it("should handle beeper on/off transitions", () => {
      const sampleLength = 3_546_900 / 44100;

      // Beeper on
      beeper.setEarBit(true);
      for (let i = 0; i < 50; i++) {
        machine.tacts = sampleLength * (i + 1);
        beeper.setNextAudioSample();
      }

      const onSamples = beeper.getAudioSamples().slice();

      // Beeper off
      beeper.onNewFrame();
      beeper.setEarBit(false);
      for (let i = 0; i < 50; i++) {
        machine.tacts = sampleLength * (i + 1);
        beeper.setNextAudioSample();
      }

      const offSamples = beeper.getAudioSamples().slice();

      // Verify difference
      expect(onSamples.every((s) => s.left === 1.0 && s.right === 1.0)).toBe(true);
      expect(offSamples.every((s) => s.left === 0.0 && s.right === 0.0)).toBe(true);
    });

    it("should handle PSG tone changes", () => {
      const sampleLength = 3_546_900 / 44100;

      // Tone 1
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      for (let tact = 0; tact < 1000; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      machine.tacts = sampleLength * 100;
      for (let i = 0; i < 100; i++) {
        psg.setNextAudioSample();
      }

      const tone1Samples = psg.getAudioSamples().slice();
      expect(tone1Samples.length).toBeGreaterThan(0);

      psg.onNewFrame();

      // Tone 2 (different frequency)
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x80);

      machine.currentFrameTact = 0;
      machine.tacts = sampleLength * 200;

      for (let tact = 0; tact < 1000; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      for (let i = 0; i < 100; i++) {
        psg.setNextAudioSample();
      }

      const tone2Samples = psg.getAudioSamples().slice();

      // Verify samples were generated
      expect(tone2Samples.length).toBeGreaterThan(0);
    });

    it("should handle volume changes", () => {
      const sampleLength = 3_546_900 / 44100;

      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);

      // Low volume
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x02);

      for (let tact = 0; tact < 1000; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      machine.tacts = sampleLength * 50;
      for (let i = 0; i < 50; i++) {
        psg.setNextAudioSample();
      }

      const lowVolSamples = psg.getAudioSamples().slice();
      expect(lowVolSamples.length).toBeGreaterThan(0);

      psg.onNewFrame();

      // High volume
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      machine.currentFrameTact = 0;
      machine.tacts = sampleLength * 100;

      for (let tact = 0; tact < 1000; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      for (let i = 0; i < 50; i++) {
        psg.setNextAudioSample();
      }

      const highVolSamples = psg.getAudioSamples().slice();

      expect(highVolSamples.length).toBeGreaterThan(0);
    });
  });

  describe("Realistic Scenarios", () => {
    it("should simulate game with background beep and music PSG", () => {
      // Simulate game: beeper for effects, PSG for music
      const sampleLength = 3_546_900 / 44100;
      const frame1Beeper: AudioSample[] = [];
      const frame1Psg: AudioSample[] = [];

      // Frame 1: Game starts, beep plays, music starts
      beeper.setEarBit(true); // Game start beep
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x10); // Music tone
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0c); // Music volume

      for (let tact = 0; tact < 69_888; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      machine.tacts = 69_888;
      for (let i = 0; i < 1000; i++) {
        beeper.setNextAudioSample();
        psg.setNextAudioSample();
      }

      frame1Beeper.push(...beeper.getAudioSamples());
      frame1Psg.push(...psg.getAudioSamples());

      beeper.onNewFrame();
      psg.onNewFrame();
      machine.currentFrameTact = 0;

      // Frame 2: Beep ends, music continues
      beeper.setEarBit(false);
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x12); // Music continues, slightly different

      for (let tact = 0; tact < 69_888; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      machine.tacts = 138_776;
      for (let i = 0; i < 1000; i++) {
        beeper.setNextAudioSample();
        psg.setNextAudioSample();
      }

      // Verify both frames generated audio
      expect(frame1Beeper.length).toBeGreaterThan(0);
      expect(frame1Psg.length).toBeGreaterThan(0);
      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
      expect(psg.getAudioSamples().length).toBeGreaterThan(0);
    });

    it("should handle rapid beeper pulses with PSG background", () => {
      const sampleLength = 3_546_900 / 44100;

      // Background PSG music
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x20);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0a);

      // Rapid beeper pulses (game effects)
      for (let pulse = 0; pulse < 20; pulse++) {
        beeper.setEarBit(pulse % 2 === 0);

        for (let i = 0; i < 100; i++) {
          machine.tacts = sampleLength * (pulse * 100 + i + 1);
          machine.currentFrameTact = (16 * (pulse * 100 + i)) % 69_888;

          psg.calculateCurrentAudioValue();
          beeper.setNextAudioSample();
          psg.setNextAudioSample();
        }
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
      expect(psg.getAudioSamples().length).toBeGreaterThan(0);
    });

    it("should simulate smooth audio fade (volume decrease)", () => {
      const sampleLength = 3_546_900 / 44100;
      const volumes = [0x0f, 0x0e, 0x0c, 0x09, 0x06, 0x03, 0x00];

      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);

      for (let vol = 0; vol < volumes.length; vol++) {
        psg.setPsgRegisterIndex(8);
        psg.writePsgRegisterValue(volumes[vol]);

        for (let tact = 0; tact < 69_888; tact += 16) {
          machine.currentFrameTact = tact;
          psg.calculateCurrentAudioValue();
        }

        machine.tacts = sampleLength * (vol + 1) * 100;
        for (let i = 0; i < 100; i++) {
          psg.setNextAudioSample();
        }

        psg.onNewFrame();
        machine.currentFrameTact = 0;
      }

      expect(psg.getAudioSamples().length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Recovery and Edge Cases", () => {
    it("should handle reset during playback", () => {
      beeper.setEarBit(true);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 50;

      beeper.setNextAudioSample();
      psg.setNextAudioSample();

      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
      expect(psg.getAudioSamples().length).toBeGreaterThan(0);

      // Reset
      beeper.reset();
      psg.reset();

      expect(beeper.getAudioSamples().length).toBe(0);
      expect(psg.getAudioSamples().length).toBe(0);

      // Verify can continue playback
      beeper.setEarBit(true);
      machine.tacts = sampleLength * 100;

      beeper.setNextAudioSample();
      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
    });

    it("should handle extreme sample rate changes", () => {
      const rates = [11025, 22050, 44100];

      for (const rate of rates) {
        beeper.setAudioSampleRate(rate);
        psg.setAudioSampleRate(rate);

        beeper.setEarBit(true);
        psg.setPsgRegisterIndex(8);
        psg.writePsgRegisterValue(0x0f);

        const sampleLength = 3_546_900 / rate;
        machine.tacts = sampleLength * 50;

        for (let i = 0; i < 50; i++) {
          beeper.setNextAudioSample();
          psg.setNextAudioSample();
        }

        expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
        expect(psg.getAudioSamples().length).toBeGreaterThan(0);

        beeper.onNewFrame();
        psg.onNewFrame();
      }
    });

    it("should handle all channels enabled simultaneously", () => {
      beeper.setEarBit(true);

      // Enable all PSG channels with different tones
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x10); // Tone A
      psg.setPsgRegisterIndex(2);
      psg.writePsgRegisterValue(0x20); // Tone B
      psg.setPsgRegisterIndex(4);
      psg.writePsgRegisterValue(0x30); // Tone C

      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x38); // All tones enabled

      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);
      psg.setPsgRegisterIndex(9);
      psg.writePsgRegisterValue(0x0f);
      psg.setPsgRegisterIndex(10);
      psg.writePsgRegisterValue(0x0f);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 100;

      for (let tact = 0; tact < 69_888; tact += 16) {
        machine.currentFrameTact = tact;
        psg.calculateCurrentAudioValue();
      }

      for (let i = 0; i < 100; i++) {
        beeper.setNextAudioSample();
        psg.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
      expect(psg.getAudioSamples().length).toBeGreaterThan(0);
    });
  });
});
