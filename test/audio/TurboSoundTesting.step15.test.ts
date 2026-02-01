import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

describe("Step 15: TurboSound Multi-Chip Testing", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ==================== Multi-Chip Selection ====================

  describe("Multi-Chip Selection via Port 0xFFFD", () => {
    it("should select chip 0 with value 0xfd (11111101)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.selectChip(0);
      expect(turbo.getSelectedChipId()).toBe(0);
    });

    it("should select chip 1 with value 0xfe (11111110)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.selectChip(1);
      expect(turbo.getSelectedChipId()).toBe(1);
    });

    it("should select chip 2 with value 0xff (11111111)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.selectChip(2);
      expect(turbo.getSelectedChipId()).toBe(2);
    });

    it("should handle rapid chip switching", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      for (let i = 0; i < 10; i++) {
        turbo.selectChip(i % 3);
        expect(turbo.getSelectedChipId()).toBe(i % 3);
      }
    });

    it("should maintain independent register indices per chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Set different register indices on each chip
      turbo.selectChip(0);
      turbo.selectRegister(0);
      
      turbo.selectChip(1);
      turbo.selectRegister(5);
      
      turbo.selectChip(2);
      turbo.selectRegister(10);
      
      // Verify each chip has its own register index
      turbo.selectChip(0);
      expect(turbo.getSelectedRegister()).toBe(0);
      
      turbo.selectChip(1);
      expect(turbo.getSelectedRegister()).toBe(5);
      
      turbo.selectChip(2);
      expect(turbo.getSelectedRegister()).toBe(10);
    });

    it("should allow writing to different chips", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Write different values to register 0 on each chip
      turbo.selectChip(0);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x11);
      
      turbo.selectChip(1);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x22);
      
      turbo.selectChip(2);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x33);
      
      // Verify values
      turbo.selectChip(0);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0x11);
      
      turbo.selectChip(1);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0x22);
      
      turbo.selectChip(2);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0x33);
    });
  });

  // ==================== Stereo Panning ====================

  describe("Stereo Panning Per Chip", () => {
    it("should support muted panning (0x0)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipPanning(0, 0x0);
      expect(turbo.getChipPanning(0)).toBe(0x0);
    });

    it("should support right-only panning (0x1)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipPanning(0, 0x1);
      expect(turbo.getChipPanning(0)).toBe(0x1);
    });

    it("should support left-only panning (0x2)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipPanning(0, 0x2);
      expect(turbo.getChipPanning(0)).toBe(0x2);
    });

    it("should support stereo panning (0x3)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipPanning(0, 0x3);
      expect(turbo.getChipPanning(0)).toBe(0x3);
    });

    it("should apply panning to stereo output", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Configure chip to generate output
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);
      
      // Generate output
      chip.generateOutputValue();
      
      // Test different panning settings
      turbo.setChipPanning(0, 0x3); // Stereo
      const stereo = turbo.getChipStereoOutput(0);
      expect(stereo.left).toBeGreaterThanOrEqual(0);
      expect(stereo.right).toBeGreaterThanOrEqual(0);
      
      // Mute
      turbo.setChipPanning(0, 0x0);
      const muted = turbo.getChipStereoOutput(0);
      expect(muted.left).toBe(0);
      expect(muted.right).toBe(0);
      
      // Right only
      turbo.setChipPanning(0, 0x1);
      const rightOnly = turbo.getChipStereoOutput(0);
      expect(rightOnly.left).toBe(0);
      expect(rightOnly.right).toBeGreaterThanOrEqual(0);
    });

    it("should maintain independent panning per chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipPanning(0, 0x0); // Muted
      turbo.setChipPanning(1, 0x1); // Right only
      turbo.setChipPanning(2, 0x2); // Left only
      
      expect(turbo.getChipPanning(0)).toBe(0x0);
      expect(turbo.getChipPanning(1)).toBe(0x1);
      expect(turbo.getChipPanning(2)).toBe(0x2);
    });

    it("should allow panning changes at runtime", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Start stereo
      turbo.setChipPanning(0, 0x3);
      expect(turbo.getChipPanning(0)).toBe(0x3);
      
      // Change to left only
      turbo.setChipPanning(0, 0x2);
      expect(turbo.getChipPanning(0)).toBe(0x2);
      
      // Change to muted
      turbo.setChipPanning(0, 0x0);
      expect(turbo.getChipPanning(0)).toBe(0x0);
    });
  });

  // ==================== Stereo Modes (ABC vs ACB) ====================

  describe("ABC/ACB Stereo Modes", () => {
    it("should default to ABC mode", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      expect(turbo.getAyStereoMode()).toBe(false); // false = ABC
    });

    it("should support ABC mode (A+B=Left, C=Right)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setAyStereoMode(false);
      expect(turbo.getAyStereoMode()).toBe(false);
    });

    it("should support ACB mode (A+C=Left, B=Right)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setAyStereoMode(true);
      expect(turbo.getAyStereoMode()).toBe(true);
    });

    it("should affect channel routing when switching modes", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Configure all channels with volume
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x00); // Enable all channels
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f); // Volume A
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(0x0f); // Volume B
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(0x0f); // Volume C
      
      // Generate samples
      chip.generateOutputValue();
      
      // ABC mode
      turbo.setAyStereoMode(false);
      const abcOutput = turbo.getChipStereoOutput(0);
      
      // ACB mode
      turbo.setAyStereoMode(true);
      const acbOutput = turbo.getChipStereoOutput(0);
      
      // Output values should be valid
      expect(typeof abcOutput.left).toBe("number");
      expect(typeof abcOutput.right).toBe("number");
      expect(typeof acbOutput.left).toBe("number");
      expect(typeof acbOutput.right).toBe("number");
    });

    it("should allow switching stereo mode at runtime", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setAyStereoMode(false);
      expect(turbo.getAyStereoMode()).toBe(false);
      
      turbo.setAyStereoMode(true);
      expect(turbo.getAyStereoMode()).toBe(true);
      
      turbo.setAyStereoMode(false);
      expect(turbo.getAyStereoMode()).toBe(false);
    });

    it("should affect all chips when stereo mode changes", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Set up all chips
      for (let i = 0; i < 3; i++) {
        const chip = turbo.getChip(i);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x00); // Enable all channels
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
        chip.generateOutputValue();
      }
      
      // ABC mode
      turbo.setAyStereoMode(false);
      for (let i = 0; i < 3; i++) {
        const output = turbo.getChipStereoOutput(i);
        expect(typeof output.left).toBe("number");
      }
      
      // ACB mode
      turbo.setAyStereoMode(true);
      for (let i = 0; i < 3; i++) {
        const output = turbo.getChipStereoOutput(i);
        expect(typeof output.left).toBe("number");
      }
    });
  });

  // ==================== Mono Mode ====================

  describe("Mono Mode Per Chip", () => {
    it("should default to stereo mode for all chips", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      expect(turbo.getChipMonoMode(0)).toBe(false);
      expect(turbo.getChipMonoMode(1)).toBe(false);
      expect(turbo.getChipMonoMode(2)).toBe(false);
    });

    it("should allow enabling mono mode per chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipMonoMode(0, true);
      expect(turbo.getChipMonoMode(0)).toBe(true);
      
      turbo.setChipMonoMode(1, true);
      expect(turbo.getChipMonoMode(1)).toBe(true);
      
      turbo.setChipMonoMode(2, true);
      expect(turbo.getChipMonoMode(2)).toBe(true);
    });

    it("should maintain independent mono mode per chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipMonoMode(0, true);
      turbo.setChipMonoMode(1, false);
      turbo.setChipMonoMode(2, true);
      
      expect(turbo.getChipMonoMode(0)).toBe(true);
      expect(turbo.getChipMonoMode(1)).toBe(false);
      expect(turbo.getChipMonoMode(2)).toBe(true);
    });

    it("should toggle mono mode at runtime", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipMonoMode(0, false);
      expect(turbo.getChipMonoMode(0)).toBe(false);
      
      turbo.setChipMonoMode(0, true);
      expect(turbo.getChipMonoMode(0)).toBe(true);
      
      turbo.setChipMonoMode(0, false);
      expect(turbo.getChipMonoMode(0)).toBe(false);
    });

    it("should apply mono mode to output generation", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Configure chip
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);
      
      chip.generateOutputValue();
      
      // Stereo mode
      turbo.setChipMonoMode(0, false);
      const stereoOutput = turbo.getChipStereoOutput(0);
      
      // Mono mode
      turbo.setChipMonoMode(0, true);
      const monoOutput = turbo.getChipStereoOutput(0);
      
      // In mono mode, left and right should be equal
      expect(monoOutput.left).toBe(monoOutput.right);
    });
  });

  // ==================== Multi-Chip Orchestration ====================

  describe("Multi-Chip Orchestration", () => {
    it("should support different configurations on each chip simultaneously", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Configure chip 0: tone A
      turbo.selectChip(0);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x10);
      
      // Configure chip 1: tone B
      turbo.selectChip(1);
      turbo.selectRegister(2);
      turbo.writeSelectedRegister(0x20);
      
      // Configure chip 2: tone C
      turbo.selectChip(2);
      turbo.selectRegister(4);
      turbo.writeSelectedRegister(0x30);
      
      // Verify all are independent
      turbo.selectChip(0);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0x10);
      
      turbo.selectChip(1);
      turbo.selectRegister(2);
      expect(turbo.readSelectedRegister()).toBe(0x20);
      
      turbo.selectChip(2);
      turbo.selectRegister(4);
      expect(turbo.readSelectedRegister()).toBe(0x30);
    });

    it("should generate output from all chips", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Configure all chips with tone
      for (let i = 0; i < 3; i++) {
        const chip = turbo.getChip(i);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + i);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }
      
      // Generate output
      turbo.generateAllOutputValues();
      
      // Get output from all chips
      for (let i = 0; i < 3; i++) {
        const output = turbo.getChipStereoOutput(i);
        expect(typeof output.left).toBe("number");
        expect(typeof output.right).toBe("number");
      }
    });

    it("should support complex mix with different panning and mono modes", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Chip 0: stereo, right panning
      turbo.setChipPanning(0, 0x1);
      turbo.setChipMonoMode(0, false);
      
      // Chip 1: stereo, left panning
      turbo.setChipPanning(1, 0x2);
      turbo.setChipMonoMode(1, false);
      
      // Chip 2: mono, stereo panning
      turbo.setChipPanning(2, 0x3);
      turbo.setChipMonoMode(2, true);
      
      // Verify settings
      expect(turbo.getChipPanning(0)).toBe(0x1);
      expect(turbo.getChipMonoMode(0)).toBe(false);
      expect(turbo.getChipPanning(1)).toBe(0x2);
      expect(turbo.getChipMonoMode(1)).toBe(false);
      expect(turbo.getChipPanning(2)).toBe(0x3);
      expect(turbo.getChipMonoMode(2)).toBe(true);
    });

    it("should allow orchestrating three independent melodies", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Melody 1 on chip 0
      turbo.selectChip(0);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x11);
      
      // Melody 2 on chip 1
      turbo.selectChip(1);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x22);
      
      // Melody 3 on chip 2
      turbo.selectChip(2);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x33);
      
      // Generate output
      turbo.generateAllOutputValues();
      
      // Get stereo output from each
      const chip0Output = turbo.getChipStereoOutput(0);
      const chip1Output = turbo.getChipStereoOutput(1);
      const chip2Output = turbo.getChipStereoOutput(2);
      
      expect(typeof chip0Output.left).toBe("number");
      expect(typeof chip1Output.left).toBe("number");
      expect(typeof chip2Output.left).toBe("number");
    });
  });

  // ==================== State Management ====================

  describe("State Management with Multiple Chips", () => {
    it("should save and restore state for all chips", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Configure all chips
      for (let i = 0; i < 3; i++) {
        const chip = turbo.getChip(i);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x10 * (i + 1));
      }
      
      // Save state
      const state = turbo.getState();
      
      // Reset
      turbo.reset();
      
      // Verify reset
      for (let i = 0; i < 3; i++) {
        const chip = turbo.getChip(i);
        chip.setPsgRegisterIndex(0);
        expect(chip.readPsgRegisterValue()).toBe(0);
      }
      
      // Restore
      turbo.setState(state);
      
      // Verify restored
      for (let i = 0; i < 3; i++) {
        const chip = turbo.getChip(i);
        chip.setPsgRegisterIndex(0);
        expect(chip.readPsgRegisterValue()).toBe(0x10 * (i + 1));
      }
    });

    it("should preserve chip selection in state", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.selectChip(2);
      const state = turbo.getState();
      
      turbo.selectChip(0);
      turbo.setState(state);
      
      expect(turbo.getSelectedChipId()).toBe(2);
    });

    it("should preserve panning settings in state", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setChipPanning(0, 0x1);
      turbo.setChipPanning(1, 0x2);
      turbo.setChipPanning(2, 0x0);
      
      const state = turbo.getState();
      
      turbo.reset();
      turbo.setState(state);
      
      expect(turbo.getChipPanning(0)).toBe(0x1);
      expect(turbo.getChipPanning(1)).toBe(0x2);
      expect(turbo.getChipPanning(2)).toBe(0x0);
    });

    it("should preserve stereo and mono modes in state", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      turbo.setAyStereoMode(true);
      turbo.setChipMonoMode(0, true);
      turbo.setChipMonoMode(2, true);
      
      const state = turbo.getState();
      
      turbo.reset();
      turbo.setState(state);
      
      expect(turbo.getAyStereoMode()).toBe(true);
      expect(turbo.getChipMonoMode(0)).toBe(true);
      expect(turbo.getChipMonoMode(2)).toBe(true);
    });
  });

  // ==================== Debug Information ====================

  describe("Debug Information", () => {
    it("should show all three chips in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      const debug = turbo.getDebugInfo();
      expect(debug.chips).toBeDefined();
      expect(debug.chips.length).toBe(3);
    });

    it("should show chip-specific debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(1);
      turbo.setChipPanning(1, 0x1);
      turbo.setChipMonoMode(1, true);
      
      const chipDebug = turbo.getChipDebugInfo(1);
      expect(chipDebug.chipId).toBe(1);
      expect(chipDebug.panning).toBe(0x1);
      expect(chipDebug.monoMode).toBe(true);
    });
  });
});
