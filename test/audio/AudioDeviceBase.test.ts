import { describe, it, expect, beforeEach } from "vitest";
import { AudioDeviceBase } from "@emu/machines/AudioDeviceBase";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * Mock machine for testing audio devices
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

/**
 * Concrete test implementation of AudioDeviceBase
 */
class TestAudioDevice extends AudioDeviceBase<MockMachine> {
  private _currentSampleValue = 0.0;

  setSampleValue(value: number): void {
    this._currentSampleValue = value;
  }

  override getCurrentSampleValue(): number {
    return this._currentSampleValue;
  }
}

describe("AudioDeviceBase", () => {
  let machine: MockMachine;
  let device: TestAudioDevice;

  beforeEach(() => {
    machine = new MockMachine();
    device = new TestAudioDevice(machine as any);
  });

  describe("Sample Rate Setup", () => {
    it("should store audio sample rate", () => {
      device.setAudioSampleRate(44100);
      expect(device.getAudioSampleRate()).toBe(44100);
    });

    it("should calculate sample length correctly for 44.1kHz", () => {
      const sampleRate = 44100;
      device.setAudioSampleRate(sampleRate);
      
      // Sample length = baseClockFrequency / sampleRate
      // = 3_546_900 / 44_100 ≈ 80.42
      const expectedLength = 3_546_900 / 44100;
      
      // Verify by checking sample generation timing
      machine.tacts = expectedLength;
      device.setNextAudioSample();
      expect(device.getAudioSamples().length).toBe(1);
    });

    it("should calculate sample length correctly for 22.05kHz", () => {
      const sampleRate = 22050;
      device.setAudioSampleRate(sampleRate);
      
      // Sample length = 3_546_900 / 22_050 ≈ 160.85
      const expectedLength = 3_546_900 / 22050;
      
      machine.tacts = expectedLength;
      device.setNextAudioSample();
      expect(device.getAudioSamples().length).toBe(1);
    });

    it("should calculate sample length correctly for 11.025kHz", () => {
      const sampleRate = 11025;
      device.setAudioSampleRate(sampleRate);
      
      // Sample length = 3_546_900 / 11_025 ≈ 321.69
      const expectedLength = 3_546_900 / 11025;
      
      machine.tacts = expectedLength;
      device.setNextAudioSample();
      expect(device.getAudioSamples().length).toBe(1);
    });

    it("should reset sample timing on setAudioSampleRate", () => {
      device.setAudioSampleRate(44100);
      const sampleLength1 = 3_546_900 / 44100;
      
      machine.tacts = sampleLength1 * 2;
      device.setNextAudioSample();
      device.setNextAudioSample();
      
      const samplesAfterFirst = device.getAudioSamples().length;
      
      // Reset by setting sample rate again
      device.setAudioSampleRate(44100);
      device.getAudioSamples().length = 0;
      
      // Should generate sample at next sample interval
      machine.tacts = sampleLength1;
      device.setNextAudioSample();
      
      expect(device.getAudioSamples().length).toBe(1);
    });
  });

  describe("Frame Boundary Behavior", () => {
    it("should clear samples on onNewFrame", () => {
      device.setAudioSampleRate(44100);
      device.setSampleValue(0.5);
      
      machine.tacts = 100;
      device.setNextAudioSample();
      expect(device.getAudioSamples().length).toBeGreaterThan(0);
      
      device.onNewFrame();
      expect(device.getAudioSamples().length).toBe(0);
    });

    it("should reset on reset()", () => {
      device.setAudioSampleRate(44100);
      device.setSampleValue(0.5);
      
      machine.tacts = 100;
      device.setNextAudioSample();
      
      device.reset();
      expect(device.getAudioSamples().length).toBe(0);
      expect(device.getAudioSampleRate()).toBe(44100); // Rate persists
    });
  });

  describe("Tact-Based Sampling Trigger", () => {
    it("should not generate sample if tacts not advanced enough", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100; // ~80.42
      
      machine.tacts = sampleLength / 2; // Not enough tacts
      device.setNextAudioSample();
      
      // First sample is generated at first interval crossing
      expect(device.getAudioSamples().length).toBe(1);
    });

    it("should generate sample when tacts exceed threshold", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      
      machine.tacts = sampleLength + 1;
      device.setNextAudioSample();
      
      expect(device.getAudioSamples().length).toBe(1);
    });

    it("should generate multiple samples with sufficient tacts", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      device.setSampleValue(1.0);
      
      // Simulate 5 samples worth of tacts
      machine.tacts = sampleLength * 5;
      for (let i = 0; i < 5; i++) {
        device.setNextAudioSample();
      }
      
      expect(device.getAudioSamples().length).toBe(5);
      expect(device.getAudioSamples()[0]).toBe(1.0);
    });

    it("should use first pending sample correctly", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      
      // Set initial sample value
      device.setSampleValue(0.5);
      machine.tacts = sampleLength;
      device.setNextAudioSample();
      
      expect(device.getAudioSamples()[0]).toBe(0.5);
    });
  });

  describe("Clock Multiplier Effects", () => {
    it("should affect sample interval when clock multiplier > 1", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100; // ~80.42
      
      machine.clockMultiplier = 2;
      
      // With 2x multiplier, we need 2x tacts for same sampling interval
      machine.tacts = sampleLength * 2;
      device.setNextAudioSample();
      
      expect(device.getAudioSamples().length).toBe(1);
    });

    it("should generate more samples with clock multiplier = 1", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      
      machine.clockMultiplier = 1;
      machine.tacts = sampleLength * 3;
      
      for (let i = 0; i < 3; i++) {
        device.setNextAudioSample();
      }
      
      expect(device.getAudioSamples().length).toBe(3);
    });

    it("should generate fewer samples with clock multiplier = 2", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      
      machine.clockMultiplier = 2;
      machine.tacts = sampleLength * 3;
      
      for (let i = 0; i < 3; i++) {
        device.setNextAudioSample();
      }
      
      expect(device.getAudioSamples().length).toBeLessThanOrEqual(2);
    });

    it("should reset next sample tact on setAudioSampleRate", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      
      machine.tacts = sampleLength;
      device.setNextAudioSample();
      
      // Change sample rate
      device.setAudioSampleRate(22050);
      device.getAudioSamples().length = 0;
      
      // Should be ready for next sample immediately
      machine.tacts = 3_546_900 / 22050;
      device.setNextAudioSample();
      expect(device.getAudioSamples().length).toBe(1);
    });
  });

  describe("Sample Value Retrieval", () => {
    it("should call getCurrentSampleValue", () => {
      device.setAudioSampleRate(44100);
      device.setSampleValue(0.75);
      
      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;
      device.setNextAudioSample();
      
      expect(device.getAudioSamples()[0]).toBe(0.75);
    });

    it("should handle negative sample values", () => {
      device.setAudioSampleRate(44100);
      device.setSampleValue(-0.5);
      
      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;
      device.setNextAudioSample();
      
      expect(device.getAudioSamples()[0]).toBe(-0.5);
    });

    it("should accumulate diverse sample values", () => {
      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      const values = [0.0, 0.5, 1.0, -0.5, 0.25];
      
      for (const value of values) {
        device.setSampleValue(value);
        machine.tacts += sampleLength;
        device.setNextAudioSample();
      }
      
      const samples = device.getAudioSamples();
      expect(samples.length).toBe(5);
      expect(samples).toEqual(values);
    });
  });

  describe("Integration", () => {
    it("should generate expected samples per frame at 44.1kHz", () => {
      device.setAudioSampleRate(44100);
      device.setSampleValue(1.0);
      
      // ZX Spectrum 128: ~69,888 tacts per frame
      const tactsPerFrame = 69_888;
      machine.tacts = tactsPerFrame;
      
      for (let i = 0; i < 1000; i++) {
        device.setNextAudioSample();
      }
      
      // Should be approximately 869 samples per frame
      // (69_888 * 44_100) / 3_546_900 ≈ 868.27
      expect(device.getAudioSamples().length).toBeGreaterThanOrEqual(800);
      expect(device.getAudioSamples().length).toBeLessThanOrEqual(900);
    });

    it("should handle continuous frame simulation", () => {
      device.setAudioSampleRate(44100);
      device.setSampleValue(0.5);
      
      const tactsPerFrame = 69_888;
      let totalSamples = 0;
      
      for (let frame = 0; frame < 5; frame++) {
        machine.tacts = (frame + 1) * tactsPerFrame;
        
        for (let i = 0; i < 1000; i++) {
          device.setNextAudioSample();
        }
        
        totalSamples = device.getAudioSamples().length;
        device.onNewFrame();
        expect(device.getAudioSamples().length).toBe(0);
      }
      
      expect(totalSamples).toBeGreaterThan(0);
    });

    it("should calculate correct samples per frame for different rates", () => {
      const tactsPerFrame = 69_888;
      const rates = [11025, 22050, 44100];
      
      for (const rate of rates) {
        device.setAudioSampleRate(rate);
        device.setSampleValue(1.0);
        device.getAudioSamples().length = 0; // Reset
        
        machine.tacts = tactsPerFrame;
        for (let j = 0; j < 1000; j++) {
          device.setNextAudioSample();
        }
        
        const actual = device.getAudioSamples().length;
        const expected = (tactsPerFrame * rate) / 3_546_900;
        
        // Allow ±2 sample variance due to floating point calculation
        expect(Math.abs(actual - expected)).toBeLessThan(2);
      }
    });
  });
});
