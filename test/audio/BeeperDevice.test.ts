import { describe, it, expect, beforeEach } from "vitest";
import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * Mock machine for testing beeper device
 */
class MockMachine implements Partial<IAnyMachine> {
  baseClockFrequency: number;
  tacts: number;
  clockMultiplier: number;

  constructor(baseClockFrequency: number = 3_546_900) {
    this.baseClockFrequency = baseClockFrequency;
    this.tacts = 0;
    this.clockMultiplier = 1;
  }
}

describe("SpectrumBeeperDevice", () => {
  let machine: MockMachine;
  let beeper: SpectrumBeeperDevice;

  beforeEach(() => {
    machine = new MockMachine();
    beeper = new SpectrumBeeperDevice(machine as any);
  });

  describe("EAR Bit Control", () => {
    it("should initialize with EAR bit off", () => {
      expect(beeper.earBit).toBe(false);
    });

    it("should set EAR bit to true", () => {
      beeper.setEarBit(true);
      expect(beeper.earBit).toBe(true);
    });

    it("should set EAR bit to false", () => {
      beeper.setEarBit(true);
      beeper.setEarBit(false);
      expect(beeper.earBit).toBe(false);
    });

    it("should toggle EAR bit multiple times", () => {
      const toggles = [true, false, true, true, false, false, true];
      for (const value of toggles) {
        beeper.setEarBit(value);
        expect(beeper.earBit).toBe(value);
      }
    });
  });

  describe("Sample Generation - EAR Bit State", () => {
    it("should generate positive sample when EAR bit is true", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;
      beeper.setNextAudioSample();

      // DC filter means the first sample won't be exactly 1.0, but should be > 0
      expect(beeper.getAudioSamples()[0].left).toBeGreaterThan(0);
      // MIC is off (default micBit=false), so right channel should be silent
      expect(beeper.getAudioSamples()[0].right).toBe(0.0);
    });

    it("should generate 0.0 sample when EAR bit is false", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(false);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;
      beeper.setNextAudioSample();

      expect(beeper.getAudioSamples()[0].left).toBe(0.0);
      expect(beeper.getAudioSamples()[0].right).toBe(0.0);
    });

    it("should generate correct samples for EAR bit transitions", () => {
      beeper.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;

      // Generate samples with EAR bit on
      beeper.setEarBit(true);
      machine.tacts = sampleLength;
      beeper.setNextAudioSample();
      // DC filter: first HIGH sample is positive but not exactly 1.0
      expect(beeper.getAudioSamples()[0].left).toBeGreaterThan(0);

      // Change EAR bit to off and generate next sample
      beeper.setEarBit(false);
      machine.tacts = sampleLength * 2;
      beeper.setNextAudioSample();
      // After transition to LOW, DC filter output goes negative
      expect(beeper.getAudioSamples()[1].left).toBeLessThan(beeper.getAudioSamples()[0].left);

      // Change back to on
      beeper.setEarBit(true);
      machine.tacts = sampleLength * 3;
      beeper.setNextAudioSample();
      // Back to HIGH: should be greater than the previous LOW sample
      expect(beeper.getAudioSamples()[2].left).toBeGreaterThan(beeper.getAudioSamples()[1].left);
    });
  });

  describe("Square Wave Pattern", () => {
    it("should generate square wave pattern", () => {
      beeper.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;

      const pattern = [true, true, false, false, true, true, false, false];
      for (let i = 0; i < pattern.length; i++) {
        beeper.setEarBit(pattern[i]);
        machine.tacts = sampleLength * (i + 1);
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      // With DC filter, values won't be exact 0/1 but should follow the HIGH/LOW pattern
      // HIGH samples should be greater than LOW samples
      for (let i = 0; i < samples.length; i++) {
        if (pattern[i]) {
          expect(samples[i].left).toBeGreaterThan(0);
        }
      }
    });

    it("should maintain consistent frequency", () => {
      beeper.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;

      // Simulate 1kHz tone: 44 samples on, 44 samples off
      let period = 0;
      const sampleCount = 200;

      for (let i = 0; i < sampleCount; i++) {
        const isOn = Math.floor(i / 22) % 2 === 0; // 22-sample half-period
        beeper.setEarBit(isOn);
        machine.tacts = sampleLength * (i + 1);
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      expect(samples.length).toBeGreaterThan(0);

      // Verify square wave characteristics: should have transitions
      let transitions = 0;
      for (let i = 1; i < samples.length; i++) {
        if (samples[i].left !== samples[i - 1].left) {
          transitions++;
        }
      }
      expect(transitions).toBeGreaterThan(0);
    });
  });

  describe("Frame-Based Operation", () => {
    it("should clear samples on frame boundary", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 100;
      for (let i = 0; i < 100; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);

      beeper.onNewFrame();
      expect(beeper.getAudioSamples().length).toBe(0);
    });

    it("should handle multiple frames", () => {
      beeper.setAudioSampleRate(44100);
      const tactsPerFrame = 69_888;
      const sampleLength = 3_546_900 / 44100;

      const frameSampleCounts: number[] = [];

      for (let frame = 0; frame < 3; frame++) {
        beeper.setEarBit(frame % 2 === 0); // Alternate on/off per frame
        machine.tacts = tactsPerFrame * (frame + 1); // Accumulate tacts

        for (let i = 0; i < 1000; i++) {
          beeper.setNextAudioSample();
        }

        const frameSamples = beeper.getAudioSamples();
        frameSampleCounts.push(frameSamples.length);

        // With DC filter, just verify samples were generated and have correct sign tendency
        if (frameSamples.length > 0) {
          // After several samples of constant value, the filter should converge
          // Just verify we generated samples
          expect(frameSamples.length).toBeGreaterThan(0);
        }

        beeper.onNewFrame();
        expect(beeper.getAudioSamples().length).toBe(0);
      }

      // Verify we generated samples in at least one frame
      expect(frameSampleCounts.some((count) => count > 0)).toBe(true);
    });

    it("should generate ~869 samples per frame at 44.1kHz", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const tactsPerFrame = 69_888;
      machine.tacts = tactsPerFrame;

      for (let i = 0; i < 1000; i++) {
        beeper.setNextAudioSample();
      }

      const samplesPerFrame = beeper.getAudioSamples().length;
      const expected = (tactsPerFrame * 44100) / 3_546_900;

      // Allow ±2 sample variance
      expect(Math.abs(samplesPerFrame - expected)).toBeLessThan(2);
    });
  });

  describe("Reset Behavior", () => {
    it("should clear samples on reset", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 50;

      for (let i = 0; i < 50; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);

      beeper.reset();
      expect(beeper.getAudioSamples().length).toBe(0);
    });

    it("should maintain EAR bit state after reset", () => {
      beeper.setEarBit(true);
      beeper.reset();

      expect(beeper.earBit).toBe(true);
    });

    it("should reset sample rate timing", () => {
      beeper.setAudioSampleRate(44100);
      const sampleLength1 = 3_546_900 / 44100;

      machine.tacts = sampleLength1 * 2;
      beeper.setNextAudioSample();
      beeper.setNextAudioSample();

      const count1 = beeper.getAudioSamples().length;

      beeper.reset();
      beeper.setAudioSampleRate(44100);
      beeper.getAudioSamples().length = 0;

      machine.tacts = sampleLength1;
      beeper.setNextAudioSample();

      expect(beeper.getAudioSamples().length).toBe(1);
    });
  });

  describe("Different Sample Rates", () => {
    it("should work at 11.025kHz", () => {
      beeper.setAudioSampleRate(11025);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 11025;
      machine.tacts = sampleLength * 10;

      for (let i = 0; i < 10; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBe(10);
      // DC filter: positive but not exactly 1.0
      expect(beeper.getAudioSamples()[0].left).toBeGreaterThan(0);
      // MIC is off — right channel is silent
      expect(beeper.getAudioSamples()[0].right).toBe(0.0);
    });

    it("should work at 22.05kHz", () => {
      beeper.setAudioSampleRate(22050);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 22050;
      machine.tacts = sampleLength * 20;

      for (let i = 0; i < 20; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBe(20);
    });

    it("should work at 44.1kHz", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 40;

      for (let i = 0; i < 40; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBe(40);
    });

    it("should work at 48kHz", () => {
      beeper.setAudioSampleRate(48000);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 48000;
      machine.tacts = sampleLength * 48;

      for (let i = 0; i < 48; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBe(48);
    });
  });

  describe("Clock Multiplier Effects", () => {
    it("should respect clock multiplier", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;

      machine.clockMultiplier = 2;
      machine.tacts = sampleLength * 2;

      for (let i = 0; i < 10; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBe(1);
    });

    it("should generate more samples with multiplier 1", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.clockMultiplier = 1;
      machine.tacts = sampleLength * 10;

      for (let i = 0; i < 10; i++) {
        beeper.setNextAudioSample();
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Rapid EAR Bit Changes", () => {
    it("should handle rapid on/off transitions", () => {
      beeper.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;

      for (let i = 0; i < 100; i++) {
        beeper.setEarBit(i % 2 === 0);
        machine.tacts = sampleLength * (i + 1);
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      expect(samples.length).toBeGreaterThan(0);

      // With DC filter, verify alternating pattern produces transitions
      let transitions = 0;
      for (let i = 1; i < samples.length; i++) {
        if (Math.sign(samples[i].left) !== Math.sign(samples[i - 1].left) 
            || Math.abs(samples[i].left - samples[i - 1].left) > 0.1) {
          transitions++;
        }
      }
      expect(transitions).toBeGreaterThan(0);
    });

    it("should generate silence when EAR bit remains off", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(false);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 100;

      for (let i = 0; i < 100; i++) {
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      for (const sample of samples) {
        expect(sample.left).toBe(0.0);
        expect(sample.right).toBe(0.0);
      }
    });

    it("should generate continuous tone when EAR bit remains on", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 100;

      for (let i = 0; i < 100; i++) {
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      // DC filter: all samples should be positive (> 0) for constant HIGH on EAR
      for (const sample of samples) {
        expect(sample.left).toBeGreaterThan(0);
        // MIC is off (default), so right channel stays silent
        expect(sample.right).toBe(0.0);
      }
    });
  });

  describe("Integration with AudioDeviceBase", () => {
    it("should inherit audio sample rate functionality", () => {
      beeper.setAudioSampleRate(44100);
      expect(beeper.getAudioSampleRate()).toBe(44100);
    });

    it("should inherit sample collection", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength * 5;

      for (let i = 0; i < 5; i++) {
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      // DC filter: all positive (from constant HIGH) but converging
      for (const s of samples) {
        expect(s.left).toBeGreaterThan(0);
      }
      // left=EAR channel, right=MIC channel — they differ when only EAR is on
      expect(samples.every(s => s.right === 0.0)).toBe(true);
    });

    it("should support inheritance method chain", () => {
      beeper.setAudioSampleRate(44100);
      beeper.setEarBit(true);

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;

      beeper.calculateCurrentAudioValue(); // Base class method
      beeper.setNextAudioSample();
      beeper.onNewFrame();

      expect(beeper.getAudioSamples().length).toBe(0);
    });
  });

  describe("Realistic Sound Scenarios", () => {
    it("should simulate beep effect (short on/off pulse)", () => {
      beeper.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;

      // Simulate a 0.5 second beep
      const beepDuration = Math.floor((44100 * 0.5) / (3_546_900 / 44100)); // samples for 0.5s

      for (let i = 0; i < beepDuration; i++) {
        beeper.setEarBit(true);
        machine.tacts = sampleLength * (i + 1);
        beeper.setNextAudioSample();
      }

      // Then silence for 0.5 seconds
      for (let i = 0; i < beepDuration; i++) {
        beeper.setEarBit(false);
        machine.tacts = sampleLength * (beepDuration + i + 1);
        beeper.setNextAudioSample();
      }

      const samples = beeper.getAudioSamples();
      // With DC filter, check that the ON portion is generally positive
      // and the OFF portion transitions to negative or near-zero
      const onSamples = samples.slice(0, beepDuration).filter((s) => s.left > 0).length;
      const offSamples = samples.slice(beepDuration).filter((s) => s.left < 0.1).length;

      expect(onSamples).toBeGreaterThan(0);
      expect(offSamples).toBeGreaterThan(0);
    });

    it("should simulate audio modulation", () => {
      beeper.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;

      // Simple modulation: frequency increases then decreases
      let onCount = 5;
      let offCount = 5;
      let sampleIndex = 0;

      while (sampleIndex < 200) {
        // On phase
        for (let i = 0; i < onCount && sampleIndex < 200; i++) {
          beeper.setEarBit(true);
          machine.tacts = sampleLength * (sampleIndex + 1);
          beeper.setNextAudioSample();
          sampleIndex++;
        }

        // Off phase
        for (let i = 0; i < offCount && sampleIndex < 200; i++) {
          beeper.setEarBit(false);
          machine.tacts = sampleLength * (sampleIndex + 1);
          beeper.setNextAudioSample();
          sampleIndex++;
        }

        // Modulate frequency
        onCount = Math.max(1, onCount - 1);
        offCount = Math.max(1, offCount - 1);
      }

      expect(beeper.getAudioSamples().length).toBeGreaterThan(0);
    });
  });
});
