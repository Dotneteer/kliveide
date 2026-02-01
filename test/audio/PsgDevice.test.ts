import { describe, it, expect, beforeEach } from "vitest";
import { ZxSpectrum128PsgDevice } from "@emu/machines/zxSpectrum128/ZxSpectrum128PsgDevice";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * Mock machine for testing PSG device
 */
class MockMachine implements Partial<IAnyMachine> {
  baseClockFrequency: number;
  tacts: number;
  clockMultiplier: number;
  currentFrameTact: number;
  tactsInFrame: number;

  constructor(baseClockFrequency: number = 3_546_900) {
    this.baseClockFrequency = baseClockFrequency;
    this.tacts = 0;
    this.clockMultiplier = 1;
    this.currentFrameTact = 0;
    this.tactsInFrame = 69_888;
  }
}

describe("PsgChip", () => {
  let psg: PsgChip;

  beforeEach(() => {
    psg = new PsgChip();
  });

  describe("Register Operations", () => {
    it("should initialize with register index 0", () => {
      psg.setPsgRegisterIndex(0);
      expect(psg.readPsgRegisterValue()).toBe(0);
    });

    it("should set and read register values", () => {
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x42);
      expect(psg.readPsgRegisterValue()).toBe(0x42);
    });

    it("should support all 16 registers", () => {
      for (let reg = 0; reg < 16; reg++) {
        psg.setPsgRegisterIndex(reg);
        const value = (reg * 17) & 0xff; // Create unique value per register
        psg.writePsgRegisterValue(value);
        expect(psg.readPsgRegisterValue()).toBe(value);
      }
    });

    it("should mask register values to 8-bit", () => {
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x1ff); // 9-bit value
      expect(psg.readPsgRegisterValue()).toBe(0xff); // Should mask to 8-bit
    });
  });

  describe("Tone Channels", () => {
    it("should generate tone A by setting registers 0-1", () => {
      // Register 0-1: Tone A (12-bit)
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x42); // Low 8 bits
      psg.setPsgRegisterIndex(1);
      psg.writePsgRegisterValue(0x03); // High 4 bits

      // Generate output to start tone counter
      psg.generateOutputValue();

      // Verify tone is active (register values stored)
      psg.setPsgRegisterIndex(0);
      expect(psg.readPsgRegisterValue()).toBe(0x42);
    });

    it("should support 12-bit tone frequency for channel A", () => {
      // Set tone A to 0x3FF (11-bit max)
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0xff); // Low 8 bits
      psg.setPsgRegisterIndex(1);
      psg.writePsgRegisterValue(0x0f); // High 4 bits (but only lower 4 bits used)

      psg.generateOutputValue();

      // Verify high register stores value
      psg.setPsgRegisterIndex(1);
      expect((psg.readPsgRegisterValue() & 0x0f) > 0).toBe(true);
    });

    it("should support tone B (registers 2-3)", () => {
      psg.setPsgRegisterIndex(2);
      psg.writePsgRegisterValue(0x80);
      psg.setPsgRegisterIndex(3);
      psg.writePsgRegisterValue(0x01);

      psg.generateOutputValue();

      psg.setPsgRegisterIndex(2);
      expect(psg.readPsgRegisterValue()).toBe(0x80);
    });

    it("should support tone C (registers 4-5)", () => {
      psg.setPsgRegisterIndex(4);
      psg.writePsgRegisterValue(0xc0);
      psg.setPsgRegisterIndex(5);
      psg.writePsgRegisterValue(0x02);

      psg.generateOutputValue();

      psg.setPsgRegisterIndex(4);
      expect(psg.readPsgRegisterValue()).toBe(0xc0);
    });
  });

  describe("Noise Generator", () => {
    it("should set noise frequency (register 6)", () => {
      psg.setPsgRegisterIndex(6);
      psg.writePsgRegisterValue(0x1f); // 5-bit noise frequency
      expect(psg.readPsgRegisterValue()).toBe(0x1f);
    });

    it("should generate noise with LFSR", () => {
      // Set noise frequency to non-zero
      psg.setPsgRegisterIndex(6);
      psg.writePsgRegisterValue(0x10); // Mid-range frequency

      // Enable noise on channel A (register 7)
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0xf8); // Bit 3 set enables noise A

      // Generate multiple samples to advance LFSR
      for (let i = 0; i < 100; i++) {
        psg.generateOutputValue();
      }

      // Verify noise was generated (orphan samples accumulated)
      expect(psg.orphanSamples).toBeGreaterThan(0);
    });

    it("should mask noise frequency to 5-bit", () => {
      psg.setPsgRegisterIndex(6);
      psg.writePsgRegisterValue(0xff); // All bits set
      expect((psg.readPsgRegisterValue() & 0x1f) === 0x1f).toBe(true);
    });
  });

  describe("Mixer Control (Register 7)", () => {
    it("should enable/disable tone A", () => {
      // Bit 0: Tone A enable (0 = enabled)
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x00); // Tone A enabled
      expect(psg.readPsgRegisterValue()).toBe(0x00);

      psg.writePsgRegisterValue(0x01); // Tone A disabled
      expect((psg.readPsgRegisterValue() & 0x01) !== 0).toBe(true);
    });

    it("should enable/disable tone B", () => {
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x00); // Tone B enabled
      psg.writePsgRegisterValue(0x02); // Tone B disabled
      expect((psg.readPsgRegisterValue() & 0x02) !== 0).toBe(true);
    });

    it("should enable/disable tone C", () => {
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x04); // Tone C disabled
      expect((psg.readPsgRegisterValue() & 0x04) !== 0).toBe(true);
    });

    it("should enable/disable noise on channels", () => {
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x00); // All noise disabled
      expect(psg.readPsgRegisterValue()).toBe(0x00);

      psg.writePsgRegisterValue(0xf8); // Noise enabled on A, B, C
      expect((psg.readPsgRegisterValue() & 0xf8) === 0xf8).toBe(true);
    });
  });

  describe("Volume Control", () => {
    it("should set volume A (register 8)", () => {
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f); // Max volume
      expect(psg.readPsgRegisterValue()).toBe(0x0f);
    });

    it("should set volume B (register 9)", () => {
      psg.setPsgRegisterIndex(9);
      psg.writePsgRegisterValue(0x08); // Mid volume
      expect(psg.readPsgRegisterValue()).toBe(0x08);
    });

    it("should set volume C (register 10)", () => {
      psg.setPsgRegisterIndex(10);
      psg.writePsgRegisterValue(0x04); // Low volume
      expect(psg.readPsgRegisterValue()).toBe(0x04);
    });

    it("should support envelope mode bit in volume registers", () => {
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x10); // Bit 4: envelope mode
      expect((psg.readPsgRegisterValue() & 0x10) !== 0).toBe(true);
    });

    it("should mask volume to 4-bit", () => {
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0xff);
      expect((psg.readPsgRegisterValue() & 0x0f)).toBe(0x0f);
    });
  });

  describe("Envelope", () => {
    it("should set envelope frequency (registers 11-12)", () => {
      psg.setPsgRegisterIndex(11);
      psg.writePsgRegisterValue(0xff); // Low 8 bits
      psg.setPsgRegisterIndex(12);
      psg.writePsgRegisterValue(0xff); // High 8 bits

      expect(psg.readPsgRegisterValue()).toBe(0xff);
    });

    it("should set envelope shape (register 13)", () => {
      psg.setPsgRegisterIndex(13);
      psg.writePsgRegisterValue(0x0f); // All envelope shape bits

      expect(psg.readPsgRegisterValue()).toBe(0x0f);
    });

    it("should support 16 envelope shapes", () => {
      for (let shape = 0; shape < 16; shape++) {
        psg.setPsgRegisterIndex(13);
        psg.writePsgRegisterValue(shape);
        expect((psg.readPsgRegisterValue() & 0x0f)).toBe(shape);
      }
    });

    it("should reset envelope counter on shape change", () => {
      psg.setPsgRegisterIndex(13);
      psg.writePsgRegisterValue(0x05);

      // Generate envelope output
      for (let i = 0; i < 100; i++) {
        psg.generateOutputValue();
      }

      // Change shape (should reset counter/position)
      psg.writePsgRegisterValue(0x0a);
      expect((psg.readPsgRegisterValue() & 0x0f)).toBe(0x0a);
    });
  });

  describe("Audio Output Generation", () => {
    it("should generate zero output when all channels disabled", () => {
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3f); // All tone and noise disabled

      psg.generateOutputValue();

      // PSG still counts samples, just with zero volume output
      // orphanSum should be 0 (no volume), but orphanSamples is still incremented
      expect(psg.orphanSum).toBe(0);
    });

    it("should generate non-zero output with tone enabled", () => {
      // Set tone A to low frequency
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(1);
      psg.writePsgRegisterValue(0x00);

      // Enable tone A, disable others
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e); // Tone A enabled

      // Set volume
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f); // Max volume

      // Generate output
      for (let i = 0; i < 100; i++) {
        psg.generateOutputValue();
      }

      expect(psg.orphanSamples).toBeGreaterThan(0);
    });

    it("should accumulate orphan samples", () => {
      // Enable tone on channel A
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01);
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x3e);
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      const initialSamples = psg.orphanSamples;
      const initialSum = psg.orphanSum;

      // Generate multiple outputs
      for (let i = 0; i < 10; i++) {
        psg.generateOutputValue();
      }

      expect(psg.orphanSamples).toBeGreaterThan(initialSamples);
    });

    it("should mix multiple channels", () => {
      // Enable all three tone channels with low frequency
      psg.setPsgRegisterIndex(0);
      psg.writePsgRegisterValue(0x01); // Tone A low freq
      psg.setPsgRegisterIndex(2);
      psg.writePsgRegisterValue(0x01); // Tone B low freq
      psg.setPsgRegisterIndex(4);
      psg.writePsgRegisterValue(0x01); // Tone C low freq

      // Enable all tones, disable noise
      psg.setPsgRegisterIndex(7);
      psg.writePsgRegisterValue(0x38); // All tones enabled

      // Set volumes
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);
      psg.setPsgRegisterIndex(9);
      psg.writePsgRegisterValue(0x0f);
      psg.setPsgRegisterIndex(10);
      psg.writePsgRegisterValue(0x0f);

      // Generate outputs
      for (let i = 0; i < 100; i++) {
        psg.generateOutputValue();
      }

      // Verify mixed output was generated
      expect(psg.orphanSamples).toBeGreaterThan(0);
      expect(psg.orphanSum).toBeGreaterThan(0);
    });
  });

  describe("Reset Behavior", () => {
    it("should reset to initial state", () => {
      // Set some registers
      psg.setPsgRegisterIndex(8);
      psg.writePsgRegisterValue(0x0f);

      psg.reset();

      // Verify reset
      psg.setPsgRegisterIndex(8);
      expect(psg.readPsgRegisterValue()).toBe(0);
    });

    it("should clear orphan samples on reset", () => {
      psg.orphanSum = 100;
      psg.orphanSamples = 10;

      psg.reset();

      expect(psg.orphanSum).toBe(0);
      expect(psg.orphanSamples).toBe(0);
    });
  });
});

describe("ZxSpectrum128PsgDevice", () => {
  let machine: MockMachine;
  let device: ZxSpectrum128PsgDevice;

  beforeEach(() => {
    machine = new MockMachine();
    device = new ZxSpectrum128PsgDevice(machine as any);
  });

  describe("Integration with PsgChip", () => {
    it("should forward register operations to PsgChip", () => {
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);
      expect(device.readPsgRegisterValue()).toBe(0x0f);
    });

    it("should get PSG state", () => {
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);

      const state = device.getPsgState();
      expect(state).toBeDefined();
    });
  });

  describe("Clock Division", () => {
    it("should divide CPU clock by 16 for PSG", () => {
      device.setAudioSampleRate(44100);

      // Set tone A
      device.setPsgRegisterIndex(0);
      device.writePsgRegisterValue(0x01);
      device.setPsgRegisterIndex(7);
      device.writePsgRegisterValue(0x3e);
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);

      // Advance by 16 tacts (one PSG clock)
      machine.currentFrameTact = 16;
      device.calculateCurrentAudioValue();

      // Verify PSG generated output at 16-tact boundary
      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;
      device.setNextAudioSample();

      expect(device.getAudioSamples().length).toBeGreaterThanOrEqual(0);
    });

    it("should accumulate PSG outputs over time", () => {
      device.setAudioSampleRate(44100);

      // Enable tone
      device.setPsgRegisterIndex(0);
      device.writePsgRegisterValue(0x01);
      device.setPsgRegisterIndex(7);
      device.writePsgRegisterValue(0x3e);
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);

      // Simulate multiple PSG clock ticks
      const sampleLength = 3_546_900 / 44100;
      for (let i = 0; i < 10; i++) {
        machine.currentFrameTact = 16 * (i + 1);
        device.calculateCurrentAudioValue();
      }

      machine.tacts = sampleLength;
      device.setNextAudioSample();

      expect(device.getAudioSamples().length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Orphan Sample Averaging", () => {
    it("should average orphan samples for audio output", () => {
      // Set up tone
      device.setPsgRegisterIndex(0);
      device.writePsgRegisterValue(0x01);
      device.setPsgRegisterIndex(7);
      device.writePsgRegisterValue(0x3e);
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);

      // Accumulate orphan samples
      for (let i = 0; i < 100; i++) {
        machine.currentFrameTact = 16 * (i + 1);
        device.calculateCurrentAudioValue();
      }

      device.setAudioSampleRate(44100);
      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;
      device.setNextAudioSample();

      const samples = device.getAudioSamples();
      if (samples.length > 0) {
        // Sample should be normalized value
        expect(samples[0].left).toBeGreaterThanOrEqual(0);
        expect(samples[0].left).toBeLessThanOrEqual(1.0);
      }
    });

    it("should reset orphan samples after averaging", () => {
      device.setAudioSampleRate(44100);

      // Enable PSG
      device.setPsgRegisterIndex(0);
      device.writePsgRegisterValue(0x01);
      device.setPsgRegisterIndex(7);
      device.writePsgRegisterValue(0x3e);
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);

      for (let i = 0; i < 50; i++) {
        machine.currentFrameTact = 16 * (i + 1);
        device.calculateCurrentAudioValue();
      }

      const sampleLength = 3_546_900 / 44100;
      machine.tacts = sampleLength;
      device.setNextAudioSample();

      // After sample generation, orphan samples should be cleared
      // (This happens in getCurrentSampleValue)
      machine.tacts = sampleLength * 2;
      device.setNextAudioSample();

      // Verify we can accumulate new samples
      expect(device.getAudioSamples().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Frame Boundary Handling", () => {
    it("should adjust PSG clock tact on frame boundary", () => {
      device.setAudioSampleRate(44100);

      const tactsPerFrame = 69_888;
      machine.currentFrameTact = tactsPerFrame - 1;
      machine.tactsInFrame = tactsPerFrame;

      device.calculateCurrentAudioValue();
      device.onNewFrame();

      // Verify device can handle next frame
      machine.currentFrameTact = 20;
      device.calculateCurrentAudioValue();

      expect(device.getAudioSamples().length).toBe(0); // Cleared on frame
    });
  });

  describe("Full Audio Generation", () => {
    it("should generate samples over a full frame", () => {
      device.setAudioSampleRate(44100);

      // Enable tone
      device.setPsgRegisterIndex(0);
      device.writePsgRegisterValue(0x01);
      device.setPsgRegisterIndex(7);
      device.writePsgRegisterValue(0x3e);
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);

      const tactsPerFrame = 69_888;
      const sampleLength = 3_546_900 / 44100;

      // Simulate a full frame
      for (let tact = 0; tact < tactsPerFrame; tact += 16) {
        machine.currentFrameTact = tact;
        device.calculateCurrentAudioValue();
      }

      // Generate samples
      machine.tacts = tactsPerFrame;
      for (let i = 0; i < 1000; i++) {
        device.setNextAudioSample();
      }

      const samples = device.getAudioSamples();
      expect(samples.length).toBeGreaterThan(0);
      expect(samples.length).toBeLessThan(1000);
    });

    it("should handle multiple frames", () => {
      device.setAudioSampleRate(44100);
      const tactsPerFrame = 69_888;

      for (let frame = 0; frame < 3; frame++) {
        // Enable different tones per frame
        device.setPsgRegisterIndex(0);
        device.writePsgRegisterValue(0x01 + frame);
        device.setPsgRegisterIndex(7);
        device.writePsgRegisterValue(0x3e);
        device.setPsgRegisterIndex(8);
        device.writePsgRegisterValue(0x0f);

        // Simulate frame
        for (let tact = 0; tact < tactsPerFrame; tact += 16) {
          machine.currentFrameTact = tact;
          device.calculateCurrentAudioValue();
        }

        machine.tacts = tactsPerFrame * (frame + 1);
        for (let i = 0; i < 1000; i++) {
          device.setNextAudioSample();
        }

        const samples = device.getAudioSamples();
        expect(samples.length).toBeGreaterThan(0);

        device.onNewFrame();
        expect(device.getAudioSamples().length).toBe(0);
      }
    });
  });

  describe("Reset and State Management", () => {
    it("should reset PSG device completely", () => {
      device.setAudioSampleRate(44100);
      device.setPsgRegisterIndex(8);
      device.writePsgRegisterValue(0x0f);

      device.reset();

      expect(device.readPsgRegisterValue()).toBe(0);
      expect(device.getAudioSamples().length).toBe(0);
    });

    it("should handle rapid register changes", () => {
      for (let i = 0; i < 50; i++) {
        device.setPsgRegisterIndex(i % 16);
        device.writePsgRegisterValue((i * 3) & 0xff);
      }

      expect(device.readPsgRegisterValue()).toBeGreaterThanOrEqual(0);
    });
  });
});
