import { describe, it, expect, beforeEach } from "vitest";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";

describe("DacDevice Step 5: Create DAC Device", () => {
  let device: DacDevice;

  beforeEach(() => {
    device = new DacDevice();
  });

  // ==================== Initialization Tests ====================

  describe("Initialization", () => {
    it("should initialize all channels to center value (0x80)", () => {
      expect(device.getDacChannel(0)).toBe(0x80);
      expect(device.getDacChannel(1)).toBe(0x80);
      expect(device.getDacChannel(2)).toBe(0x80);
      expect(device.getDacChannel(3)).toBe(0x80);
    });

    it("should initialize via specific getters to 0x80", () => {
      expect(device.getDacA()).toBe(0x80);
      expect(device.getDacB()).toBe(0x80);
      expect(device.getDacC()).toBe(0x80);
      expect(device.getDacD()).toBe(0x80);
    });

    it("should initialize getChannelValues to [0x80, 0x80, 0x80, 0x80]", () => {
      const values = device.getChannelValues();
      expect(values).toEqual([0x80, 0x80, 0x80, 0x80]);
    });

    it("should initialize stereo output to 0 (all channels at center)", () => {
      const output = device.getStereoOutput();
      // 0x80 = 0 as signed (center), 0 * 256 = 0 per channel
      // Two channels: 0 + 0 = 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });
  });

  // ==================== Channel Value Storage Tests ====================

  describe("Channel Value Storage via setDacChannel", () => {
    it("should store value in channel 0", () => {
      device.setDacChannel(0, 0x7f);
      expect(device.getDacChannel(0)).toBe(0x7f);
    });

    it("should store value in channel 1", () => {
      device.setDacChannel(1, 0x40);
      expect(device.getDacChannel(1)).toBe(0x40);
    });

    it("should store value in channel 2", () => {
      device.setDacChannel(2, 0xc0);
      expect(device.getDacChannel(2)).toBe(0xc0);
    });

    it("should store value in channel 3", () => {
      device.setDacChannel(3, 0xff);
      expect(device.getDacChannel(3)).toBe(0xff);
    });

    it("should mask values to 8 bits", () => {
      device.setDacChannel(0, 0x1ff);
      expect(device.getDacChannel(0)).toBe(0xff);

      device.setDacChannel(1, 0x180);
      expect(device.getDacChannel(1)).toBe(0x80);
    });

    it("should handle minimum value 0x00", () => {
      device.setDacChannel(0, 0x00);
      expect(device.getDacChannel(0)).toBe(0x00);
    });

    it("should handle maximum value 0xff", () => {
      device.setDacChannel(0, 0xff);
      expect(device.getDacChannel(0)).toBe(0xff);
    });
  });

  // ==================== Specific Getter/Setter Tests ====================

  describe("Specific Channel Getters/Setters", () => {
    it("should set and get DAC A", () => {
      device.setDacA(0x50);
      expect(device.getDacA()).toBe(0x50);
    });

    it("should set and get DAC B", () => {
      device.setDacB(0x60);
      expect(device.getDacB()).toBe(0x60);
    });

    it("should set and get DAC C", () => {
      device.setDacC(0x70);
      expect(device.getDacC()).toBe(0x70);
    });

    it("should set and get DAC D", () => {
      device.setDacD(0x90);
      expect(device.getDacD()).toBe(0x90);
    });

    it("should maintain independence of channels", () => {
      device.setDacA(0x10);
      device.setDacB(0x20);
      device.setDacC(0x30);
      device.setDacD(0x40);

      expect(device.getDacA()).toBe(0x10);
      expect(device.getDacB()).toBe(0x20);
      expect(device.getDacC()).toBe(0x30);
      expect(device.getDacD()).toBe(0x40);
    });
  });

  // ==================== Array Getter/Setter Tests ====================

  describe("Array-based Channel Operations", () => {
    it("should return all channels via getChannelValues", () => {
      device.setDacA(0x10);
      device.setDacB(0x20);
      device.setDacC(0x30);
      device.setDacD(0x40);

      const values = device.getChannelValues();
      expect(values).toEqual([0x10, 0x20, 0x30, 0x40]);
    });

    it("should set all channels via setChannelValues", () => {
      device.setChannelValues([0xaa, 0xbb, 0xcc, 0xdd]);

      expect(device.getDacA()).toBe(0xaa);
      expect(device.getDacB()).toBe(0xbb);
      expect(device.getDacC()).toBe(0xcc);
      expect(device.getDacD()).toBe(0xdd);
    });

    it("should mask values in setChannelValues", () => {
      device.setChannelValues([0x1ff, 0x180, 0x1f0, 0x100]);

      expect(device.getDacA()).toBe(0xff);
      expect(device.getDacB()).toBe(0x80);
      expect(device.getDacC()).toBe(0xf0);
      expect(device.getDacD()).toBe(0x00);
    });

    it("should reject setChannelValues with wrong array length", () => {
      expect(() => {
        device.setChannelValues([0x80, 0x80, 0x80]);
      }).toThrow("Must provide exactly 4 DAC channel values");

      expect(() => {
        device.setChannelValues([0x80, 0x80, 0x80, 0x80, 0x80]);
      }).toThrow("Must provide exactly 4 DAC channel values");
    });

    it("should return fresh array from getChannelValues", () => {
      const values1 = device.getChannelValues();
      device.setDacA(0x50);
      const values2 = device.getChannelValues();

      expect(values1[0]).toBe(0x80);
      expect(values2[0]).toBe(0x50);
    });
  });

  // ==================== Stereo Output Tests ====================

  describe("Stereo Output Conversion", () => {
    it("should produce zero output when all channels centered", () => {
      const output = device.getStereoOutput();
      // 0x80 = 0 (center), 0 * 256 = 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should convert 0x80 (center) to 0", () => {
      device.setDacA(0x80);
      device.setDacB(0x80);
      const output = device.getStereoOutput();
      // 0x80 = 0 (center), 0 * 256 = 0 per channel
      // A+B = 0 + 0 = 0
      expect(output.left).toBe(0);
    });

    it("should convert 0x00 (minimum) to -128", () => {
      device.setDacA(0x00);
      device.setDacB(0x80); // Center (0)
      const output = device.getStereoOutput();
      // 0x00 = -128, -128 * 256 = -32768
      // 0x80 = 0 
      // A+B = -32768 + 0 = -32768
      expect(output.left).toBe(-32768);
    });

    it("should convert 0xff (maximum) to 127", () => {
      device.setDacA(0xff);
      device.setDacB(0x80); // Center (0)
      const output = device.getStereoOutput();
      // 0xff = 127, 127 * 256 = 32512
      // 0x80 = 0
      // A+B = 32512 + 0 = 32512
      expect(output.left).toBe(32512);
    });

    it("should sum DAC A and B to left channel", () => {
      device.setDacA(0x80); // 0 (center)
      device.setDacB(0x80); // 0 (center)
      const output = device.getStereoOutput();
      expect(output.left).toBe(0);
    });

    it("should sum DAC C and D to right channel", () => {
      device.setDacC(0x7f); // -1, -1 * 256 = -256
      device.setDacD(0x7f); // -1, -1 * 256 = -256
      const output = device.getStereoOutput();
      expect(output.right).toBe(-512);
    });

    it("should handle positive values correctly", () => {
      device.setDacA(0x40); // -64, -64 * 256 = -16384
      device.setDacB(0x50); // -48, -48 * 256 = -12288
      const output = device.getStereoOutput();
      expect(output.left).toBe(-28672);
    });

    it("should handle negative values correctly", () => {
      device.setDacC(0xc0); // 64, 64 * 256 = 16384
      device.setDacD(0xb0); // 48, 48 * 256 = 12288
      const output = device.getStereoOutput();
      expect(output.right).toBe(28672);
    });

    it("should produce independent left and right channels", () => {
      device.setDacA(0x7f); // -1, -1 * 256 = -256
      device.setDacB(0x7f); // -1, -1 * 256 = -256
      device.setDacC(0x80); // 0 (center)
      device.setDacD(0x80); // 0 (center)

      const output = device.getStereoOutput();
      expect(output.left).toBe(-512);
      expect(output.right).toBe(0);
    });
  });

  // ==================== Reset Tests ====================

  describe("Reset Behavior", () => {
    it("should reset all channels to 0x80", () => {
      device.setChannelValues([0x00, 0xff, 0x40, 0xc0]);
      device.reset();

      expect(device.getDacA()).toBe(0x80);
      expect(device.getDacB()).toBe(0x80);
      expect(device.getDacC()).toBe(0x80);
      expect(device.getDacD()).toBe(0x80);
    });

    it("should produce 0 output after reset (0x80 = 0 center per channel)", () => {
      device.setChannelValues([0x10, 0x20, 0x30, 0x40]);
      device.reset();

      const output = device.getStereoOutput();
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should be idempotent", () => {
      device.setChannelValues([0x00, 0xff, 0x40, 0xc0]);
      device.reset();
      const output1 = device.getStereoOutput();
      device.reset();
      const output2 = device.getStereoOutput();

      expect(output1.left).toBe(output2.left);
      expect(output1.right).toBe(output2.right);
    });
  });

  // ==================== Error Handling Tests ====================

  describe("Error Handling", () => {
    it("should throw on invalid channel index -1", () => {
      expect(() => {
        device.setDacChannel(-1, 0x80);
      }).toThrow("Invalid DAC channel: -1. Must be 0-3.");
    });

    it("should throw on invalid channel index 4", () => {
      expect(() => {
        device.getDacChannel(4);
      }).toThrow("Invalid DAC channel: 4. Must be 0-3.");
    });

    it("should throw on invalid channel index 100", () => {
      expect(() => {
        device.setDacChannel(100, 0x80);
      }).toThrow("Invalid DAC channel: 100. Must be 0-3.");
    });

    it("should accept valid channel indices 0-3", () => {
      for (let i = 0; i < 4; i++) {
        device.setDacChannel(i, 0x80 + i);
        expect(device.getDacChannel(i)).toBe((0x80 + i) & 0xff);
      }
    });
  });

  // ==================== State Independence Tests ====================

  describe("State Independence", () => {
    it("should maintain channel independence across operations", () => {
      device.setDacA(0x10);
      device.setDacB(0x20);
      
      device.setDacA(0x30);
      expect(device.getDacA()).toBe(0x30);
      expect(device.getDacB()).toBe(0x20);
    });

    it("should not affect other channels on reset", () => {
      // This test verifies reset() affects all channels
      device.setChannelValues([0x10, 0x20, 0x30, 0x40]);
      device.reset();
      
      for (let i = 0; i < 4; i++) {
        expect(device.getDacChannel(i)).toBe(0x80);
      }
    });

    it("should handle multiple rapid value changes", () => {
      for (let i = 0; i < 100; i++) {
        device.setDacChannel(0, i & 0xff);
        expect(device.getDacChannel(0)).toBe(i & 0xff);
      }
    });

    it("should maintain different values in each channel", () => {
      const testValues = [0x00, 0x55, 0xaa, 0xff];
      device.setChannelValues(testValues);

      testValues.forEach((val, idx) => {
        expect(device.getDacChannel(idx)).toBe(val);
      });
    });
  });

  // ==================== Edge Cases Tests ====================

  describe("Edge Cases", () => {
    it("should handle all 256 possible 8-bit values", () => {
      for (let i = 0; i < 256; i++) {
        device.setDacChannel(0, i);
        expect(device.getDacChannel(0)).toBe(i);
      }
    });

    it("should convert extreme values correctly in stereo output", () => {
      device.setChannelValues([0x00, 0x00, 0xff, 0xff]);
      const output = device.getStereoOutput();

      // 0x00 = -128, -128 * 256 = -32768
      // 0xff = 127, 127 * 256 = 32512
      // Left: -32768 + -32768 = -65536
      // Right: 32512 + 32512 = 65024
      expect(output.left).toBe(-65536);
      expect(output.right).toBe(65024);
    });

    it("should handle mixed extreme and center values", () => {
      device.setChannelValues([0x00, 0x80, 0xff, 0x80]);
      const output = device.getStereoOutput();

      // 0x00 = -128, -128 * 256 = -32768
      // 0x80 = 0 (center)
      // 0xff = 127, 127 * 256 = 32512
      // Left: -32768 + 0 = -32768
      // Right: 32512 + 0 = 32512
      expect(output.left).toBe(-32768);
      expect(output.right).toBe(32512);
    });

    it("should maintain output consistency across multiple reads", () => {
      device.setChannelValues([0x50, 0x60, 0x70, 0x90]);
      
      const output1 = device.getStereoOutput();
      const output2 = device.getStereoOutput();
      
      expect(output1.left).toBe(output2.left);
      expect(output1.right).toBe(output2.right);
    });
  });

  // ==================== Integration Tests ====================

  describe("Integration Scenarios", () => {
    it("should support complex audio scenario", () => {
      // Left channel positive (0xff=127), right channel negative (0x00=-128)
      device.setDacA(0xff); // 127 * 256 = 32512
      device.setDacB(0xff); // 127 * 256 = 32512
      device.setDacC(0x00); // -128 * 256 = -32768
      device.setDacD(0x00); // -128 * 256 = -32768

      let output = device.getStereoOutput();
      expect(output.left).toBeGreaterThan(0);
      expect(output.right).toBeLessThan(0);

      // Switch to right channel positive
      device.setDacA(0x80);
      device.setDacB(0x80);
      device.setDacC(0xff);
      device.setDacD(0xff);

      output = device.getStereoOutput();
      expect(output.left).toBe(0);
      expect(output.right).toBeGreaterThan(0);
    });

    it("should support envelope sweep simulation", () => {
      const values = [];
      for (let i = 0; i <= 255; i++) {
        device.setDacA(i);
        device.setDacB(0x80); // Keep B constant at center
        const output = device.getStereoOutput();
        values.push(output.left);
      }

      // Output progression: 
      // i=0: 0 + (-32768) = -32768
      // i=1: 256 + (-32768) = -32512
      // ...
      // i=127: 32512 + (-32768) = -256
      // i=128: -32768 + (-32768) = -65536 (wraps to negative)
      // ...
      // i=255: -256 + (-32768) = -33024
      
      // Check that it increases from 0 to 127
      for (let i = 1; i < 128; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it("should support stereo pan simulation", () => {
      // Full positive left
      device.setChannelValues([0xff, 0x80, 0x80, 0x80]);
      let output = device.getStereoOutput();
      expect(output.left).toBeGreaterThan(output.right);

      // Center
      device.setChannelValues([0x80, 0x80, 0x80, 0x80]);
      output = device.getStereoOutput();
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);

      // Full positive right
      device.setChannelValues([0x80, 0x80, 0xff, 0x80]);
      output = device.getStereoOutput();
      expect(output.right).toBeGreaterThan(output.left);
    });

    it("should support simultaneous state and output verification", () => {
      const testCases = [
        { dacs: [0x00, 0x00, 0x00, 0x00], left: -65536, right: -65536 },
        { dacs: [0x80, 0x80, 0x80, 0x80], left: 0, right: 0 },
        { dacs: [0x7f, 0x7f, 0x7f, 0x7f], left: -512, right: -512 },
      ];

      testCases.forEach((testCase) => {
        device.setChannelValues(testCase.dacs);

        const values = device.getChannelValues();
        expect(values).toEqual(testCase.dacs);

        const output = device.getStereoOutput();
        expect(output.left).toBe(testCase.left);
        expect(output.right).toBe(testCase.right);
      });
    });
  });
});
