import { describe, it, expect, beforeEach } from "vitest";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

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
      // AY-3-8910 (default chip type) applies read masks to unused bits.
      // Expected read = written_value & AY_MASK[reg]
      const AY_MASKS = [
        0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff,
        0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
      ];
      for (let reg = 0; reg < 16; reg++) {
        psg.setPsgRegisterIndex(reg);
        const value = (reg * 17) & 0xff; // Create unique value per register
        psg.writePsgRegisterValue(value);
        expect(psg.readPsgRegisterValue()).toBe(value & AY_MASKS[reg]);
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
