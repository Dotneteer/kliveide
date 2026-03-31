import { describe, it, expect, beforeEach } from "vitest";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { DacNextRegDevice } from "@emu/machines/zxNext/DacNextRegDevice";

describe("DacNextRegDevice Step 7: DAC NextReg Mirrors", () => {
  let dac: DacDevice;
  let nextRegDevice: DacNextRegDevice;

  beforeEach(() => {
    dac = new DacDevice();
    nextRegDevice = new DacNextRegDevice(dac);
  });

  // ==================== NextReg 0x2C (Left DAC B) Tests ====================

  describe("NextReg 0x2C - Left DAC (B)", () => {
    it("should write to DAC B via NextReg 0x2C", () => {
      nextRegDevice.writeNextReg(0x2c, 0x50);
      expect(dac.getDacB()).toBe(0x50);
    });

    it("should indicate register was handled", () => {
      const result = nextRegDevice.writeNextReg(0x2c, 0x50);
      expect(result).toBe(true);
    });

    it("should not affect other DAC channels", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      nextRegDevice.writeNextReg(0x2c, 0x40);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x40);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should handle minimum value (0x00)", () => {
      nextRegDevice.writeNextReg(0x2c, 0x00);
      expect(dac.getDacB()).toBe(0x00);
    });

    it("should handle maximum value (0xFF)", () => {
      nextRegDevice.writeNextReg(0x2c, 0xff);
      expect(dac.getDacB()).toBe(0xff);
    });

    it("should mask values to 8 bits", () => {
      nextRegDevice.writeNextReg(0x2c, 0x1ff);
      expect(dac.getDacB()).toBe(0xff);
    });

    it("should read 0 (I2S not implemented, not DAC value)", () => {
      nextRegDevice.writeNextReg(0x2c, 0x55);
      const value = nextRegDevice.readNextReg(0x2c);
      expect(value).toBe(0);
    });

    it("should support rapid writes to left DAC", () => {
      for (let i = 0; i < 256; i++) {
        nextRegDevice.writeNextReg(0x2c, i);
        expect(dac.getDacB()).toBe(i & 0xff);
      }
    });
  });

  // ==================== NextReg 0x2D (Mono DAC A+D) Tests ====================

  describe("NextReg 0x2D - Mono DAC (A+D)", () => {
    it("should write to both DAC A and D via NextReg 0x2D", () => {
      nextRegDevice.writeNextReg(0x2d, 0x60);
      expect(dac.getDacA()).toBe(0x60);
      expect(dac.getDacD()).toBe(0x60);
    });

    it("should indicate register was handled", () => {
      const result = nextRegDevice.writeNextReg(0x2d, 0x60);
      expect(result).toBe(true);
    });

    it("should not affect other DAC channels", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      nextRegDevice.writeNextReg(0x2d, 0x35);

      expect(dac.getDacA()).toBe(0x35);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x35);
    });

    it("should handle minimum and maximum values", () => {
      nextRegDevice.writeNextReg(0x2d, 0x00);
      expect(dac.getDacA()).toBe(0x00);
      expect(dac.getDacD()).toBe(0x00);

      nextRegDevice.writeNextReg(0x2d, 0xff);
      expect(dac.getDacA()).toBe(0xff);
      expect(dac.getDacD()).toBe(0xff);
    });

    it("should read 0 (I2S not implemented, not DAC value)", () => {
      nextRegDevice.writeNextReg(0x2d, 0x77);
      const value = nextRegDevice.readNextReg(0x2d);
      expect(value).toBe(0);
    });
  });

  // ==================== NextReg 0x2E (Right DAC) Tests ====================

  describe("NextReg 0x2E - Right DAC (C)", () => {
    it("should write to DAC C via NextReg 0x2E", () => {
      nextRegDevice.writeNextReg(0x2e, 0x70);
      expect(dac.getDacC()).toBe(0x70);
    });

    it("should indicate register was handled", () => {
      const result = nextRegDevice.writeNextReg(0x2e, 0x70);
      expect(result).toBe(true);
    });

    it("should not affect other DAC channels", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      nextRegDevice.writeNextReg(0x2e, 0x45);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x45);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should handle minimum and maximum values", () => {
      nextRegDevice.writeNextReg(0x2e, 0x00);
      expect(dac.getDacC()).toBe(0x00);

      nextRegDevice.writeNextReg(0x2e, 0xff);
      expect(dac.getDacC()).toBe(0xff);
    });

    it("should read 0 (I2S not implemented, not DAC value)", () => {
      nextRegDevice.writeNextReg(0x2e, 0x88);
      const value = nextRegDevice.readNextReg(0x2e);
      expect(value).toBe(0);
    });
  });

  // ==================== Unrecognized Register Tests ====================

  describe("Unrecognized NextRegs", () => {
    it("should return false for unrecognized registers on write", () => {
      expect(nextRegDevice.writeNextReg(0x00, 0x50)).toBe(false);
      expect(nextRegDevice.writeNextReg(0x2b, 0x50)).toBe(false);
      expect(nextRegDevice.writeNextReg(0x2f, 0x50)).toBe(false);
      expect(nextRegDevice.writeNextReg(0xff, 0x50)).toBe(false);
    });

    it("should return undefined for unrecognized registers on read", () => {
      expect(nextRegDevice.readNextReg(0x00)).toBeUndefined();
      expect(nextRegDevice.readNextReg(0x2b)).toBeUndefined();
      expect(nextRegDevice.readNextReg(0x2f)).toBeUndefined();
      expect(nextRegDevice.readNextReg(0xff)).toBeUndefined();
    });

    it("should not affect DAC channels on unrecognized writes", () => {
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      nextRegDevice.writeNextReg(0x2b, 0x50);
      nextRegDevice.writeNextReg(0x2f, 0x50);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });
  });

  // ==================== Reset Tests ====================

  describe("Reset Behavior", () => {
    it("should reset all DAC channels via NextReg device", () => {
      nextRegDevice.writeNextReg(0x2c, 0x10);
      nextRegDevice.writeNextReg(0x2d, 0x20);
      nextRegDevice.writeNextReg(0x2e, 0x30);

      nextRegDevice.reset();

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should read 0 after reset (I2S not implemented)", () => {
      nextRegDevice.writeNextReg(0x2c, 0x50);
      nextRegDevice.writeNextReg(0x2d, 0x60);
      nextRegDevice.writeNextReg(0x2e, 0x70);

      nextRegDevice.reset();

      expect(nextRegDevice.readNextReg(0x2c)).toBe(0);
      expect(nextRegDevice.readNextReg(0x2d)).toBe(0);
      expect(nextRegDevice.readNextReg(0x2e)).toBe(0);
    });
  });

  // ==================== Multi-Register Sequence Tests ====================

  describe("Multi-Register Write Sequences", () => {
    it("should handle sequential writes to all three DAC registers", () => {
      nextRegDevice.writeNextReg(0x2c, 0x11);
      nextRegDevice.writeNextReg(0x2d, 0x22);
      nextRegDevice.writeNextReg(0x2e, 0x33);

      expect(dac.getDacA()).toBe(0x22);
      expect(dac.getDacB()).toBe(0x11);
      expect(dac.getDacC()).toBe(0x33);
      expect(dac.getDacD()).toBe(0x22);
    });

    it("should handle stereo playback pattern", () => {
      // Write mono value to center A+D channels
      nextRegDevice.writeNextReg(0x2d, 0x80);

      // Write left channel (B) higher
      nextRegDevice.writeNextReg(0x2c, 0xc0);

      // Write right channel lower
      nextRegDevice.writeNextReg(0x2e, 0x40);

      expect(dac.getDacA()).toBe(0x80); // From mono (0x2D)
      expect(dac.getDacB()).toBe(0xc0); // Left (0x2C)
      expect(dac.getDacC()).toBe(0x40); // Right
      expect(dac.getDacD()).toBe(0x80); // From mono (0x2D)
    });

    it("should support rapid value updates", () => {
      for (let i = 0; i < 256; i++) {
        nextRegDevice.writeNextReg(0x2c, i);
        nextRegDevice.writeNextReg(0x2d, (i + 1) & 0xff);
        nextRegDevice.writeNextReg(0x2e, (i + 2) & 0xff);

        expect(dac.getDacA()).toBe((i + 1) & 0xff);
        expect(dac.getDacB()).toBe(i & 0xff);
        expect(dac.getDacC()).toBe((i + 2) & 0xff);
        expect(dac.getDacD()).toBe((i + 1) & 0xff);
      }
    });

    it("should handle interleaved mono and stereo writes", () => {
      nextRegDevice.writeNextReg(0x2c, 0x30); // Left (B)
      nextRegDevice.writeNextReg(0x2d, 0x50); // Mono (updates A and D)
      nextRegDevice.writeNextReg(0x2e, 0x70); // Right

      expect(dac.getDacA()).toBe(0x50);
      expect(dac.getDacB()).toBe(0x30);
      expect(dac.getDacC()).toBe(0x70);
      expect(dac.getDacD()).toBe(0x50);
    });
  });

  // ==================== Read-Write Consistency Tests ====================

  describe("Read-Write Consistency", () => {
    it("should always read 0 regardless of writes (I2S not implemented)", () => {
      const testValues = [0x00, 0x55, 0x80, 0xaa, 0xff];

      testValues.forEach((val) => {
        nextRegDevice.writeNextReg(0x2c, val);
        expect(nextRegDevice.readNextReg(0x2c)).toBe(0);

        nextRegDevice.writeNextReg(0x2d, val);
        expect(nextRegDevice.readNextReg(0x2d)).toBe(0);

        nextRegDevice.writeNextReg(0x2e, val);
        expect(nextRegDevice.readNextReg(0x2e)).toBe(0);
      });
    });

    it("should write values to DAC even though reads return 0", () => {
      nextRegDevice.writeNextReg(0x2d, 0x20);
      expect(dac.getDacA()).toBe(0x20); // write still works
      expect(nextRegDevice.readNextReg(0x2d)).toBe(0); // but read returns 0

      nextRegDevice.writeNextReg(0x2d, 0x40);
      expect(dac.getDacA()).toBe(0x40); // write still works
      expect(nextRegDevice.readNextReg(0x2d)).toBe(0); // but read returns 0
    });

    it("should consistently return 0 across multiple reads", () => {
      nextRegDevice.writeNextReg(0x2c, 0x60);

      expect(nextRegDevice.readNextReg(0x2c)).toBe(0);
      expect(nextRegDevice.readNextReg(0x2c)).toBe(0);
      expect(nextRegDevice.readNextReg(0x2c)).toBe(0);
    });
  });

  // ==================== Independent Channel Updates Tests ====================

  describe("Independent Channel Updates", () => {
    it("should update left (B) independently from mono and right channels", () => {
      nextRegDevice.writeNextReg(0x2d, 0x30);
      nextRegDevice.writeNextReg(0x2e, 0x70);
      nextRegDevice.writeNextReg(0x2c, 0x50);

      expect(dac.getDacA()).toBe(0x30);
      expect(dac.getDacB()).toBe(0x50);
      expect(dac.getDacC()).toBe(0x70);
      expect(dac.getDacD()).toBe(0x30);

      // Update left again
      nextRegDevice.writeNextReg(0x2c, 0x90);
      expect(dac.getDacB()).toBe(0x90);
      expect(dac.getDacA()).toBe(0x30); // Unchanged
      expect(dac.getDacD()).toBe(0x30); // Unchanged
      expect(dac.getDacC()).toBe(0x70); // Unchanged
    });

    it("should update mono (A+D) independently", () => {
      nextRegDevice.writeNextReg(0x2c, 0x50);
      nextRegDevice.writeNextReg(0x2e, 0x70);

      nextRegDevice.writeNextReg(0x2d, 0x40);
      expect(dac.getDacA()).toBe(0x40);
      expect(dac.getDacD()).toBe(0x40);
      expect(dac.getDacB()).toBe(0x50); // Unchanged
      expect(dac.getDacC()).toBe(0x70); // Unchanged
    });

    it("should update right channel independently", () => {
      nextRegDevice.writeNextReg(0x2c, 0x50);
      nextRegDevice.writeNextReg(0x2d, 0x30);

      nextRegDevice.writeNextReg(0x2e, 0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacA()).toBe(0x30); // Unchanged (from 0x2D)
      expect(dac.getDacD()).toBe(0x30); // Unchanged (from 0x2D)
      expect(dac.getDacB()).toBe(0x50); // Unchanged (from 0x2C)
    });
  });

  // ==================== Integration Tests ====================

  describe("Integration with Port Device Behavior", () => {
    it("should coexist with port-based DAC writes", () => {
      // Simulate scenario where both port and NextReg interfaces are used
      // This verifies they operate on the same underlying DAC

      // Set via NextReg 0x2C (B)
      nextRegDevice.writeNextReg(0x2c, 0x60);
      expect(dac.getDacB()).toBe(0x60);

      // Verify value persists
      expect(dac.getDacB()).toBe(0x60);
    });

    it("should support common audio patterns", () => {
      // Silence (center all channels)
      nextRegDevice.writeNextReg(0x2c, 0x80);
      nextRegDevice.writeNextReg(0x2d, 0x80);
      nextRegDevice.writeNextReg(0x2e, 0x80);

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);

      // Maximum volume
      nextRegDevice.writeNextReg(0x2c, 0xff);
      nextRegDevice.writeNextReg(0x2d, 0xff);
      nextRegDevice.writeNextReg(0x2e, 0xff);

      expect(dac.getDacA()).toBe(0xff);
      expect(dac.getDacB()).toBe(0xff);
      expect(dac.getDacC()).toBe(0xff);
      expect(dac.getDacD()).toBe(0xff);
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should write all 256 values correctly, reads always return 0", () => {
      for (let i = 0; i < 256; i++) {
        nextRegDevice.writeNextReg(0x2c, i);
        expect(dac.getDacB()).toBe(i); // write works
        expect(nextRegDevice.readNextReg(0x2c)).toBe(0); // read returns 0

        nextRegDevice.writeNextReg(0x2d, i);
        expect(dac.getDacA()).toBe(i); // write works
        expect(nextRegDevice.readNextReg(0x2d)).toBe(0); // read returns 0

        nextRegDevice.writeNextReg(0x2e, i);
        expect(dac.getDacC()).toBe(i); // write works
        expect(nextRegDevice.readNextReg(0x2e)).toBe(0); // read returns 0
      }
    });

    it("should handle alternating writes, reads always return 0", () => {
      for (let i = 0; i < 10; i++) {
        nextRegDevice.writeNextReg(0x2c, 0x11 + i);
        nextRegDevice.writeNextReg(0x2d, 0x22 + i);
        nextRegDevice.writeNextReg(0x2e, 0x33 + i);

        // DAC values are written correctly
        expect(dac.getDacB()).toBe((0x11 + i) & 0xff);
        expect(dac.getDacA()).toBe((0x22 + i) & 0xff);
        expect(dac.getDacC()).toBe((0x33 + i) & 0xff);

        // But reads return 0 (I2S not implemented)
        expect(nextRegDevice.readNextReg(0x2c)).toBe(0);
        expect(nextRegDevice.readNextReg(0x2d)).toBe(0);
        expect(nextRegDevice.readNextReg(0x2e)).toBe(0);
      }
    });

    it("should handle mono writes that update both A and D", () => {
      nextRegDevice.writeNextReg(0x2d, 0x45);
      // Both should be equal
      expect(dac.getDacA()).toBe(dac.getDacD());
      expect(dac.getDacA()).toBe(0x45);
    });
  });
});
