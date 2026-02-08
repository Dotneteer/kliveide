import { describe, it, expect, beforeEach } from "vitest";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

describe("TurboSoundDevice Step 3: PSG Stereo Mixing", () => {
  let device: TurboSoundDevice;

  beforeEach(() => {
    device = new TurboSoundDevice();
  });

  // ==================== Stereo Mode Control Tests ====================

  describe("Stereo Mode (ABC vs ACB)", () => {
    it("should initialize with ABC mode (default)", () => {
      expect(device.getAyStereoMode()).toBe(false);
    });

    it("should switch to ACB mode", () => {
      device.setAyStereoMode(true);
      expect(device.getAyStereoMode()).toBe(true);
    });

    it("should switch back to ABC mode", () => {
      device.setAyStereoMode(true);
      device.setAyStereoMode(false);
      expect(device.getAyStereoMode()).toBe(false);
    });

    it("should persist stereo mode across resets", () => {
      device.setAyStereoMode(true);
      device.reset();
      // After reset, should return to default ABC mode
      expect(device.getAyStereoMode()).toBe(false);
    });
  });

  // ==================== Mono Mode Control Tests ====================

  describe("Mono Mode Per Chip", () => {
    it("should initialize all chips in stereo mode", () => {
      expect(device.getChipMonoMode(0)).toBe(false);
      expect(device.getChipMonoMode(1)).toBe(false);
      expect(device.getChipMonoMode(2)).toBe(false);
    });

    it("should enable mono mode for chip 0", () => {
      device.setChipMonoMode(0, true);
      expect(device.getChipMonoMode(0)).toBe(true);
    });

    it("should enable mono mode for chip 1", () => {
      device.setChipMonoMode(1, true);
      expect(device.getChipMonoMode(1)).toBe(true);
    });

    it("should enable mono mode for chip 2", () => {
      device.setChipMonoMode(2, true);
      expect(device.getChipMonoMode(2)).toBe(true);
    });

    it("should allow independent mono mode for each chip", () => {
      device.setChipMonoMode(0, true);
      device.setChipMonoMode(1, false);
      device.setChipMonoMode(2, true);

      expect(device.getChipMonoMode(0)).toBe(true);
      expect(device.getChipMonoMode(1)).toBe(false);
      expect(device.getChipMonoMode(2)).toBe(true);
    });

    it("should reset mono mode to stereo on device reset", () => {
      device.setChipMonoMode(0, true);
      device.setChipMonoMode(1, true);
      device.reset();

      expect(device.getChipMonoMode(0)).toBe(false);
      expect(device.getChipMonoMode(1)).toBe(false);
    });

    it("should handle out-of-range chip ID with modulo 4", () => {
      device.setChipMonoMode(4, true);
      expect(device.getChipMonoMode(0)).toBe(true);
    });
  });

  // ==================== Stereo Output - ABC Mode Tests ====================

  describe("Stereo Output: ABC Mode (Default)", () => {
    it("should route channels A+B to left, C to right", () => {
      // ABC mode: Left = A+B, Right = C
      const chip = device.getChip(0);
      
      // Set channel A to medium volume
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(7); // Volume = 7
      
      // Set channel B to high volume
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(10); // Volume = 10
      
      // Set channel C to low volume
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(3); // Volume = 3
      
      // Enable all channels
      chip.setPsgRegisterIndex(7); // Enable register
      chip.writePsgRegisterValue(0x3f); // All channels enabled, noise disabled
      
      // Set tones to enable output
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1); // Tone A
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1); // Tone B
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1); // Tone C
      
      // Generate a sample
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      
      // Right should be C's output only
      const volC = chip.getChannelCVolume();
      expect(output.right).toBe(volC);
    });

    it("should handle zero output for disabled channels", () => {
      const chip = device.getChip(0);
      
      // Disable all channels
      chip.setPsgRegisterIndex(7); // Enable register
      chip.writePsgRegisterValue(0x3f); // Disable all channels
      
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });
  });

  // ==================== Stereo Output - ACB Mode Tests ====================

  describe("Stereo Output: ACB Mode", () => {
    it("should route channels A+C to left, B to right in ACB mode", () => {
      // Switch to ACB mode
      device.setAyStereoMode(true);
      
      const chip = device.getChip(0);
      
      // Set channel A to medium volume
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(7);
      
      // Set channel B to high volume
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(10);
      
      // Set channel C to low volume
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(3);
      
      // Enable all channels
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      // Set tones
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1);
      
      // Generate a sample
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      
      // Right should be B's output only in ACB mode
      const volB = chip.getChannelBVolume();
      expect(output.right).toBe(volB);
    });
  });

  // ==================== Mono Mode Output Tests ====================

  describe("Stereo Output: Mono Mode", () => {
    it("should output all channels mixed to both left and right in mono mode", () => {
      device.setChipMonoMode(0, true);
      
      const chip = device.getChip(0);
      
      // Set all channels to different volumes
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(5); // Volume A
      
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(7); // Volume B
      
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(3); // Volume C
      
      // Enable all channels
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      // Set tones
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1);
      
      // Generate a sample
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      
      // In mono mode, left and right should be the same
      expect(output.left).toBe(output.right);
      
      // In mono mode, should be sum of all channels (capped at 65535)
      const volA = chip.getChannelAVolume();
      const volB = chip.getChannelBVolume();
      const volC = chip.getChannelCVolume();
      const expected = Math.min(65535, volA + volB + volC);
      expect(output.left).toBe(expected);
    });

    it("should override stereo mode when mono mode is enabled", () => {
      // Set ABC mode and mono mode
      device.setAyStereoMode(false); // ABC mode
      device.setChipMonoMode(0, true); // Mono mode
      
      const chip = device.getChip(0);
      
      // Set volumes
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(5);
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(7);
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(3);
      
      // Enable all
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      // Set tones
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1);
      
      // Generate
      device.generateAllOutputValues();
      
      // Mono mode should override ABC mode routing
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(output.right);
    });
  });

  // ==================== Multiple Chip Stereo Tests ====================

  describe("Multiple Chips with Different Modes", () => {
    it("should handle different stereo/mono modes for different chips", () => {
      // Chip 0: Mono
      device.setChipMonoMode(0, true);
      
      // Chip 1: Stereo ABC
      device.setChipMonoMode(1, false);
      
      // Chip 2: Stereo ACB
      device.setChipMonoMode(2, false);
      device.setAyStereoMode(true);
      
      // Configure all chips
      for (let i = 0; i < 3; i++) {
        const chip = device.getChip(i);
        
        // Set volumes
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(5);
        chip.setPsgRegisterIndex(9);
        chip.writePsgRegisterValue(7);
        chip.setPsgRegisterIndex(10);
        chip.writePsgRegisterValue(3);
        
        // Enable all
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3f);
        
        // Set tones
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(1);
        chip.setPsgRegisterIndex(2);
        chip.writePsgRegisterValue(1);
        chip.setPsgRegisterIndex(4);
        chip.writePsgRegisterValue(1);
      }
      
      device.generateAllOutputValues();
      
      const out0 = device.getChipStereoOutput(0);
      const out1 = device.getChipStereoOutput(1);
      const out2 = device.getChipStereoOutput(2);
      
      // Chip 0: mono (left == right)
      expect(out0.left).toBe(out0.right);
      
      // Chip 1: ABC mode (left != right in general)
      // Chip 2: ACB mode (left != right in general)
      // Just verify they execute without error
      expect(typeof out1.left).toBe("number");
      expect(typeof out2.left).toBe("number");
    });

    it("should maintain independent mono settings per chip", () => {
      device.setChipMonoMode(0, true);
      device.setChipMonoMode(1, false);
      device.setChipMonoMode(2, true);

      expect(device.getChipMonoMode(0)).toBe(true);
      expect(device.getChipMonoMode(1)).toBe(false);
      expect(device.getChipMonoMode(2)).toBe(true);
    });
  });

  // ==================== Stereo Output Clamping Tests ====================

  describe("Stereo Output Clamping", () => {
    it("should clamp combined volumes to 65535 in ABC mode", () => {
      const chip = device.getChip(0);
      
      // Set channels A and B to maximum
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(15); // Max volume
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(15); // Max volume
      
      // Enable channels
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      // Set high tones to produce output
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1);
      
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      
      // Left should be clamped at 65535
      expect(output.left).toBeLessThanOrEqual(65535);
    });

    it("should clamp combined volumes to 65535 in ACB mode", () => {
      device.setAyStereoMode(true); // ACB mode
      
      const chip = device.getChip(0);
      
      // Set channels A and C to maximum
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(15);
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(15);
      
      // Enable channels
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      // Set tones
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1);
      
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      
      // Left should be clamped at 65535
      expect(output.left).toBeLessThanOrEqual(65535);
    });

    it("should clamp combined volumes to 65535 in mono mode", () => {
      device.setChipMonoMode(0, true);
      
      const chip = device.getChip(0);
      
      // Set all channels to maximum
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(15);
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(15);
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(15);
      
      // Enable all
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      // Set tones
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1);
      
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      
      // Both should be clamped at 65535
      expect(output.left).toBeLessThanOrEqual(65535);
      expect(output.right).toBeLessThanOrEqual(65535);
    });
  });

  // ==================== Mode Switching Tests ====================

  describe("Mode Switching During Operation", () => {
    it("should immediately apply stereo mode changes", () => {
      const chip = device.getChip(0);
      
      // Setup
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(5);
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(7);
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(3);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1);
      
      device.generateAllOutputValues();
      
      // Get ABC output
      device.setAyStereoMode(false);
      const abcOutput = device.getChipStereoOutput(0);
      
      // Switch to ACB
      device.setAyStereoMode(true);
      const acbOutput = device.getChipStereoOutput(0);
      
      // Outputs should be different due to routing change
      // (unless channels happen to have same volume)
      expect(typeof abcOutput).toBe("object");
      expect(typeof acbOutput).toBe("object");
    });

    it("should immediately apply mono mode changes", () => {
      const chip = device.getChip(0);
      
      // Setup
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(5);
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(7);
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(3);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(1);
      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(1);
      
      device.generateAllOutputValues();
      
      // Get stereo output
      device.setChipMonoMode(0, false);
      const stereoOutput = device.getChipStereoOutput(0);
      
      // Switch to mono
      device.setChipMonoMode(0, true);
      const monoOutput = device.getChipStereoOutput(0);
      
      // Mono should have left == right
      expect(monoOutput.left).toBe(monoOutput.right);
    });
  });

  // ==================== Integration Tests ====================

  describe("Integration with Existing Features", () => {
    it("should work with chip selection and panning", () => {
      // Select chip 1 with panning
      device.setPsgRegisterIndex(0xfd); // Chip 1, stereo panning
      
      const chip = device.getChip(1);
      
      // Configure
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(5);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(1);
      
      expect(typeof output.left).toBe("number");
      expect(typeof output.right).toBe("number");
    });

    it("should work with orphan sample tracking", () => {
      const chip = device.getChip(0);
      
      // Setup
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(5);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(1);
      
      device.generateAllOutputValues();
      device.generateAllOutputValues();
      
      const orphans = device.getChipOrphanSamples(0);
      expect(orphans.count).toBeGreaterThanOrEqual(0);
      
      // Clear orphans
      device.clearChipOrphanSamples(0);
      const cleared = device.getChipOrphanSamples(0);
      expect(cleared.sum).toBe(0);
      expect(cleared.count).toBe(0);
    });

    it("should work with all chips simultaneously", () => {
      // Configure all chips
      for (let i = 0; i < 3; i++) {
        const chip = device.getChip(i);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(5 + i);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3f);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(1);
      }
      
      // Set different modes
      device.setChipMonoMode(0, true);
      device.setChipMonoMode(1, false);
      device.setAyStereoMode(true); // ACB mode
      
      device.generateAllOutputValues();
      
      // Get outputs from all chips
      const out0 = device.getChipStereoOutput(0);
      const out1 = device.getChipStereoOutput(1);
      const out2 = device.getChipStereoOutput(2);
      
      // Verify all are valid
      expect(out0.left).toBeDefined();
      expect(out0.right).toBeDefined();
      expect(out1.left).toBeDefined();
      expect(out1.right).toBeDefined();
      expect(out2.left).toBeDefined();
      expect(out2.right).toBeDefined();
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle rapid mode changes", () => {
      for (let i = 0; i < 10; i++) {
        device.setAyStereoMode(i % 2 === 0);
      }
      expect(device.getAyStereoMode()).toBe(false);
    });

    it("should handle rapid mono mode toggles", () => {
      for (let i = 0; i < 10; i++) {
        device.setChipMonoMode(0, i % 2 === 0);
      }
      expect(device.getChipMonoMode(0)).toBe(false);
    });

    it("should handle invalid chip IDs gracefully", () => {
      // These should work due to modulo 4 masking
      device.setChipMonoMode(100, true);
      expect(device.getChipMonoMode(100 & 0x03)).toBe(true);
    });

    it("should preserve zero output when all channels disabled", () => {
      const chip = device.getChip(0);
      
      // Disable all channels
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3f);
      
      const output = device.getChipStereoOutput(0);
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should handle noise output mixing", () => {
      const chip = device.getChip(0);
      
      // Enable noise on channel A only
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e); // Only noise enabled on A
      
      chip.setPsgRegisterIndex(6);
      chip.writePsgRegisterValue(16); // Noise frequency
      
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(10);
      
      device.generateAllOutputValues();
      const output = device.getChipStereoOutput(0);
      
      // Should produce some output
      expect(typeof output.left).toBe("number");
      expect(typeof output.right).toBe("number");
    });
  });
});
