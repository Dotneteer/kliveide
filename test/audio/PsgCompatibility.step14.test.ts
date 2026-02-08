import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

describe("Step 14: Single PSG Compatibility (ZX Spectrum 128 Backward Compatibility)", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ==================== Default Chip Selection ====================

  describe("Default Chip Selection", () => {
    it("should default to chip 0 on startup", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      expect(turbo.getSelectedChipId()).toBe(0);
    });

    it("should allow PSG operations without explicit chip selection", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Operations should work on default chip 0
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x42);
      
      expect(turbo.readSelectedRegister()).toBe(0x42);
    });

    it("should maintain chip 0 selection across multiple operations", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      for (let i = 0; i < 5; i++) {
        turbo.selectRegister(i);
        turbo.writeSelectedRegister(i * 10);
      }
      
      expect(turbo.getSelectedChipId()).toBe(0);
    });

    it("should reset chip selection to 0 on machine reset", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(2);
      expect(turbo.getSelectedChipId()).toBe(2);
      
      turbo.reset();
      expect(turbo.getSelectedChipId()).toBe(0);
    });
  });

  // ==================== Single Chip Isolation ====================

  describe("Single Chip Isolation", () => {
    it("should not affect other chips when operating on chip 0", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip0 = turbo.getChip(0);
      const chip1 = turbo.getChip(1);
      const chip2 = turbo.getChip(2);
      
      // Set all chips to different states
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0x11);
      
      chip1.setPsgRegisterIndex(0);
      chip1.writePsgRegisterValue(0x22);
      
      chip2.setPsgRegisterIndex(0);
      chip2.writePsgRegisterValue(0x33);
      
      // Verify they are independent
      chip0.setPsgRegisterIndex(0);
      expect(chip0.readPsgRegisterValue()).toBe(0x11);
      
      chip1.setPsgRegisterIndex(0);
      expect(chip1.readPsgRegisterValue()).toBe(0x22);
      
      chip2.setPsgRegisterIndex(0);
      expect(chip2.readPsgRegisterValue()).toBe(0x33);
    });

    it("should not interfere with chip state when using TurboSound methods", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Setup chip 0
      turbo.selectChip(0);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x55);
      
      // Setup chip 1
      turbo.selectChip(1);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x66);
      
      // Return to chip 0 and verify
      turbo.selectChip(0);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0x55);
      
      // Verify chip 1 unchanged
      turbo.selectChip(1);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0x66);
    });

    it("should allow independent register indices per chip", () => {
      const chip0 = machine.audioControlDevice.getTurboSoundDevice().getChip(0);
      const chip1 = machine.audioControlDevice.getTurboSoundDevice().getChip(1);
      
      chip0.setPsgRegisterIndex(3);
      chip1.setPsgRegisterIndex(7);
      
      expect(chip0.psgRegisterIndex).toBe(3);
      expect(chip1.psgRegisterIndex).toBe(7);
    });
  });

  // ==================== PSG Core Functionality ====================

  describe("PSG Core Functionality", () => {
    it("should allow tone configuration on chip 0", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Configure tone A
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x42);
      chip.setPsgRegisterIndex(1);
      chip.writePsgRegisterValue(0x00);
      
      // Verify state
      chip.setPsgRegisterIndex(0);
      expect(chip.readPsgRegisterValue()).toBe(0x42);
    });

    it("should support volume control on all channels", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Set volumes for all channels
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f); // Channel A
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(0x0a); // Channel B
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(0x05); // Channel C
      
      // Verify volumes
      chip.setPsgRegisterIndex(8);
      expect(chip.readPsgRegisterValue()).toBe(0x0f);
      chip.setPsgRegisterIndex(9);
      expect(chip.readPsgRegisterValue()).toBe(0x0a);
      chip.setPsgRegisterIndex(10);
      expect(chip.readPsgRegisterValue()).toBe(0x05);
    });

    it("should support envelope generation", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Set envelope frequency
      chip.setPsgRegisterIndex(11);
      chip.writePsgRegisterValue(0x50);
      chip.setPsgRegisterIndex(12);
      chip.writePsgRegisterValue(0x00);
      
      // Set envelope shape
      chip.setPsgRegisterIndex(13);
      chip.writePsgRegisterValue(0x0a);
      
      // Verify envelope settings
      chip.setPsgRegisterIndex(11);
      expect(chip.readPsgRegisterValue()).toBe(0x50);
    });

    it("should support noise generation", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Set noise frequency
      chip.setPsgRegisterIndex(6);
      chip.writePsgRegisterValue(0x1f);
      
      // Verify noise frequency
      chip.setPsgRegisterIndex(6);
      expect(chip.readPsgRegisterValue()).toBe(0x1f);
    });

    it("should support mixer control", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Set mixer flags (all channels enabled)
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x00);
      
      // Verify mixer setting
      chip.setPsgRegisterIndex(7);
      expect(chip.readPsgRegisterValue()).toBe(0x00);
    });

    it("should generate output with configured tone and volume", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Configure tone A
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(1);
      chip.writePsgRegisterValue(0x00);
      
      // Enable tone A with volume
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e); // Enable tone A only
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f); // Max volume
      
      // Generate samples
      for (let i = 0; i < 10; i++) {
        chip.generateOutputValue();
      }
      
      // Verify output was generated
      const output = turbo.getChipStereoOutput(0);
      expect(typeof output.left).toBe("number");
      expect(typeof output.right).toBe("number");
    });
  });

  // ==================== Default Mixer Behavior ====================

  describe("Default Mixer Behavior", () => {
    it("should have default stereo mode ABC", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      expect(turbo.getAyStereoMode()).toBe(false); // false = ABC mode
    });

    it("should have stereo panning enabled by default for chip 0", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      expect(turbo.getChipPanning(0)).toBe(0x3); // 0x3 = stereo
    });

    it("should have mono mode disabled by default", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      expect(turbo.getChipMonoMode(0)).toBe(false);
    });

    it("should route audio to mixer correctly in default configuration", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      
      // Configure chip 0 with tone
      const chip = turbo.getChip(0);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);
      
      turbo.generateAllOutputValues();
      
      // Get mixer output
      const output = mixer.getMixedOutput();
      expect(typeof output.left).toBe("number");
      expect(typeof output.right).toBe("number");
    });

    it("should apply volume scale to PSG output", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      
      // Configure PSG output
      mixer.setPsgOutput({ left: 1000, right: 1000 });
      
      mixer.setVolumeScale(0.5);
      const output = mixer.getMixedOutput();
      
      expect(typeof output.left).toBe("number");
      expect(typeof output.right).toBe("number");
    });
  });

  // ==================== 128K Software Compatibility ====================

  describe("ZX Spectrum 128K Software Compatibility", () => {
    it("should handle typical 128K PSG write pattern", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Typical 128K program pattern: set up tone and volume
      const registers = [
        { index: 0, value: 0x01 }, // Tone A low
        { index: 1, value: 0x00 }, // Tone A high
        { index: 8, value: 0x0f }, // Volume A
        { index: 7, value: 0x3e }  // Mixer
      ];
      
      for (const reg of registers) {
        chip.setPsgRegisterIndex(reg.index);
        chip.writePsgRegisterValue(reg.value);
      }
      
      // Verify all settings
      for (const reg of registers) {
        chip.setPsgRegisterIndex(reg.index);
        expect(chip.readPsgRegisterValue()).toBe(reg.value);
      }
    });

    it("should support register sweep pattern used in demo effects", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Sweep register 0 (tone A low byte) through values
      for (let value = 0; value < 256; value += 10) {
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(value);
        
        chip.setPsgRegisterIndex(0);
        expect(chip.readPsgRegisterValue()).toBe(value & 0xff);
      }
    });

    it("should support interrupt-driven sample generation", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Configure PSG
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);
      
      // Simulate interrupt-driven sample generation
      const samples = [];
      for (let i = 0; i < 5; i++) {
        chip.generateOutputValue();
        const output = turbo.getChipStereoOutput(0);
        samples.push(output);
      }
      
      expect(samples.length).toBe(5);
      for (const sample of samples) {
        expect(typeof sample.left).toBe("number");
        expect(typeof sample.right).toBe("number");
      }
    });

    it("should preserve state across multiple PSG programs", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // First program
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x10);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x05);
      
      // Switch to different settings (second program)
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x20);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0a);
      
      // Verify current state
      chip.setPsgRegisterIndex(0);
      expect(chip.readPsgRegisterValue()).toBe(0x20);
      chip.setPsgRegisterIndex(8);
      expect(chip.readPsgRegisterValue()).toBe(0x0a);
    });
  });

  // ==================== Reset Behavior ====================

  describe("Reset Behavior", () => {
    it("should reset PSG to initial state", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Set non-default values
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0xff);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);
      
      // Reset
      chip.reset();
      
      // Verify reset to defaults
      chip.setPsgRegisterIndex(0);
      expect(chip.readPsgRegisterValue()).toBe(0);
      chip.setPsgRegisterIndex(8);
      expect(chip.readPsgRegisterValue()).toBe(0);
    });

    it("should reset TurboSound to default state", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      // Change state
      turbo.selectChip(2);
      turbo.setAyStereoMode(true);
      turbo.setChipMonoMode(0, true);
      
      // Reset
      turbo.reset();
      
      // Verify reset
      expect(turbo.getSelectedChipId()).toBe(0);
      expect(turbo.getAyStereoMode()).toBe(false);
      expect(turbo.getChipMonoMode(0)).toBe(false);
    });

    it("should reset AudioControlDevice completely", () => {
      const control = machine.audioControlDevice;
      const turbo = control.getTurboSoundDevice();
      const dac = control.getDacDevice();
      const mixer = control.getAudioMixerDevice();
      
      // Change state
      turbo.selectChip(1);
      dac.setDacA(0x7f);
      mixer.setEarLevel(1);
      
      // Reset all
      control.reset();
      
      // Verify all reset
      expect(turbo.getSelectedChipId()).toBe(0);
      expect(dac.getDacA()).toBe(0x80);
      expect(mixer.getEarLevel()).toBe(0);
    });
  });

  // ==================== State Persistence ====================

  describe("State Persistence with Single Chip", () => {
    it("should save and restore single chip state", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      // Configure chip
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x55);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0a);
      
      // Save state
      const state = chip.getState();
      
      // Reset
      chip.reset();
      
      // Verify reset
      chip.setPsgRegisterIndex(0);
      expect(chip.readPsgRegisterValue()).toBe(0);
      
      // Restore
      chip.setState(state);
      
      // Verify restored
      chip.setPsgRegisterIndex(0);
      expect(chip.readPsgRegisterValue()).toBe(0x55);
    });

    it("should save and restore audio device state", () => {
      const control = machine.audioControlDevice;
      
      // Configure all devices
      control.getTurboSoundDevice().selectChip(0);
      control.getTurboSoundDevice().getChip(0).setPsgRegisterIndex(0);
      control.getTurboSoundDevice().getChip(0).writePsgRegisterValue(0x77);
      
      // Save
      const state = control.getState();
      
      // Reset
      control.reset();
      
      // Restore
      control.setState(state);
      
      // Verify
      const chip = control.getTurboSoundDevice().getChip(0);
      chip.setPsgRegisterIndex(0);
      expect(chip.readPsgRegisterValue()).toBe(0x77);
    });
  });

  // ==================== Debug Information ====================

  describe("Debug Information", () => {
    it("should provide debug info for single chip setup", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);
      
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x42);
      
      const debug = chip.getDebugInfo();
      expect(debug).toBeDefined();
      expect(debug.chipId).toBe(0);
      expect(debug.registers[0]).toBe(0x42);
    });

    it("should show correct default configuration in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      
      const debug = turbo.getDebugInfo();
      expect(debug.selectedChip).toBe(0);
      expect(debug.ayStereoMode).toBe("ABC");
      expect(debug.chips[0].monoMode).toBe(false);
    });
  });
});
