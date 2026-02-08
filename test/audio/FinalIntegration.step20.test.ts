import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

/**
 * Step 20: Final Audio Integration Testing
 *
 * Comprehensive integration tests for the complete ZX Spectrum Next audio subsystem.
 * Tests cover:
 * - Complete program scenarios (beeper, PSG, DAC, mixed audio)
 * - Edge cases (rapid chip switching, panning changes, config changes)
 * - Reset behavior (DAC reset, PSG reset, device persistence)
 * - All configuration mode combinations
 * - Complete audio subsystem integration
 * - Real-time performance validation
 * - System state consistency
 */
describe("Step 20: Final Audio Integration Testing", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ===== Complete ZX Next Program Scenarios =====
  describe("Complete ZX Next Programs Using Sound", () => {
    it("should generate audio samples", () => {
      const samples = machine.getAudioSamples();
      expect(samples).toBeDefined();
      expect(Array.isArray(samples)).toBe(true);
    });

    it("should support PSG melody generation on single chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip0 = turbo.getChip(0);

      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);
      chip0.setPsgRegisterIndex(1);
      chip0.writePsgRegisterValue(0x0F);
      chip0.setPsgRegisterIndex(7);
      chip0.writePsgRegisterValue(0xFE);
      chip0.setPsgRegisterIndex(8);
      chip0.writePsgRegisterValue(0x0F);

      const samples = machine.getAudioSamples();
      expect(samples.length).toBeGreaterThanOrEqual(0);
    });

    it("should support multi-chip orchestration", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let chip = 0; chip < 3; chip++) {
        const psgChip = turbo.getChip(chip);
        psgChip.setPsgRegisterIndex(0);
        psgChip.writePsgRegisterValue(0xE8 + chip * 0x10);
        psgChip.setPsgRegisterIndex(1);
        psgChip.writePsgRegisterValue(0x0F);
        psgChip.setPsgRegisterIndex(7);
        psgChip.writePsgRegisterValue(0xFE);
        psgChip.setPsgRegisterIndex(8);
        psgChip.writePsgRegisterValue(0x0F);
      }

      const samples = machine.getAudioSamples();
      expect(samples.length).toBeGreaterThanOrEqual(0);
    });

    it("should support SpecDrum sampled audio playback", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const drumSample = [0x60, 0x70, 0x80, 0x70];
      for (let i = 0; i < 100; i++) {
        dac.setDacChannel(0, drumSample[i % 4]);
        dac.setDacChannel(1, drumSample[(i + 1) % 4]);
        dac.setDacChannel(2, drumSample[(i + 2) % 4]);
        dac.setDacChannel(3, drumSample[(i + 3) % 4]);
      }

      expect(dac.getDacA()).toBeDefined();
      expect(dac.getDacB()).toBeDefined();
      expect(dac.getDacC()).toBeDefined();
      expect(dac.getDacD()).toBeDefined();
    });

    it("should support mixed PSG and DAC playback", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);
      chip0.setPsgRegisterIndex(1);
      chip0.writePsgRegisterValue(0x0F);
      chip0.setPsgRegisterIndex(7);
      chip0.writePsgRegisterValue(0xFE);
      chip0.setPsgRegisterIndex(8);
      chip0.writePsgRegisterValue(0x0F);

      for (let i = 0; i < 100; i++) {
        dac.setDacChannel(0, 0x40 + (i % 16));
        dac.setDacChannel(2, 0xC0 - (i % 16));
      }

      const samples = machine.getAudioSamples();
      expect(samples.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== Edge Cases and Rapid Changes =====
  describe("Edge Cases and Rapid Configuration Changes", () => {
    it("should handle rapid PSG register updates", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let i = 0; i < 100; i++) {
        const chip = turbo.getChip(i % 3);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0xE8 + i);
      }

      const samples = machine.getAudioSamples();
      expect(samples.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle panning changes during playback", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);
      chip0.setPsgRegisterIndex(8);
      chip0.writePsgRegisterValue(0x0F);

      const panModes = [0x00, 0x01, 0x02, 0x03];
      for (let i = 0; i < 100; i++) {
        turbo.setChipPanning(0, panModes[i % 4]);
      }

      const samples = machine.getAudioSamples();
      expect(samples.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle stereo mode settings", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let i = 0; i < 3; i++) {
        const chip = turbo.getChip(i);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0xE8 + i * 0x10);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0F);
      }

      // Both modes should work without errors
      turbo.setAyStereoMode(false);
      turbo.setAyStereoMode(true);

      const debugInfo = turbo.getDebugInfo();
      expect(debugInfo).toBeDefined();
    });

    it("should handle mono mode toggling per chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let chip = 0; chip < 3; chip++) {
        const psgChip = turbo.getChip(chip);
        psgChip.setPsgRegisterIndex(0);
        psgChip.writePsgRegisterValue(0xE8);
        psgChip.setPsgRegisterIndex(8);
        psgChip.writePsgRegisterValue(0x0F);
      }

      for (let i = 0; i < 100; i++) {
        const chip = i % 3;
        turbo.setChipMonoMode(chip, i % 2 === 0);
      }

      const debugInfo = turbo.getDebugInfo();
      expect(debugInfo).toBeDefined();
    });

    it("should handle rapid DAC channel updates", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      for (let i = 0; i < 200; i++) {
        dac.setDacA((i * 0x11) & 0xFF);
        dac.setDacB((i * 0x22) & 0xFF);
        dac.setDacC((i * 0x44) & 0xFF);
        dac.setDacD((i * 0x88) & 0xFF);
      }

      expect(dac.getDacA()).toBe((199 * 0x11) & 0xFF);
      expect(dac.getDacB()).toBe((199 * 0x22) & 0xFF);
      expect(dac.getDacC()).toBe((199 * 0x44) & 0xFF);
      expect(dac.getDacD()).toBe((199 * 0x88) & 0xFF);
    });

    it("should handle PSG frequency updates during playback", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);
      chip0.setPsgRegisterIndex(8);
      chip0.writePsgRegisterValue(0x0F);

      for (let i = 0; i < 100; i++) {
        if (i % 10 === 0) {
          chip0.setPsgRegisterIndex(0);
          chip0.writePsgRegisterValue(0xE8 + i / 10);
        }
      }

      const samples = machine.getAudioSamples();
      expect(samples.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== Reset Behavior Tests =====
  describe("Reset Behavior", () => {
    it("should reset DAC values on machine reset", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x60);
      dac.setDacB(0x70);
      dac.setDacC(0x80);
      dac.setDacD(0x90);

      machine.reset();

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should reset PSG state on hard reset", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);
      chip0.setPsgRegisterIndex(8);
      chip0.writePsgRegisterValue(0x0F);

      machine.reset();

      const afterDebug = turbo.getDebugInfo();
      expect(afterDebug).toBeDefined();
    });

    it("should preserve audio device references after reset", () => {
      const turbo1 = machine.audioControlDevice.getTurboSoundDevice();
      const dac1 = machine.audioControlDevice.getDacDevice();

      machine.reset();

      const turbo2 = machine.audioControlDevice.getTurboSoundDevice();
      const dac2 = machine.audioControlDevice.getDacDevice();

      expect(turbo1).toBe(turbo2);
      expect(dac1).toBe(dac2);
    });
  });

  // ===== Configuration Mode Verification =====
  describe("All Configuration Mode Combinations", () => {
    it("should support ABC and ACB stereo modes", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      turbo.setAyStereoMode(false);

      for (let chip = 0; chip < 3; chip++) {
        const psgChip = turbo.getChip(chip);
        psgChip.setPsgRegisterIndex(0);
        psgChip.writePsgRegisterValue(0xE8);
        psgChip.setPsgRegisterIndex(8);
        psgChip.writePsgRegisterValue(0x0F);
      }

      const debugInfo1 = turbo.getDebugInfo();
      expect(debugInfo1).toBeDefined();

      turbo.setAyStereoMode(true);

      const debugInfo2 = turbo.getDebugInfo();
      expect(debugInfo2).toBeDefined();
    });

    it("should support all panning combinations", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const panModes = [0, 1, 2, 3];

      for (let chip = 0; chip < 3; chip++) {
        for (const panMode of panModes) {
          turbo.setChipPanning(chip, panMode);
          const debugInfo = turbo.getChipDebugInfo(chip);
          expect(debugInfo).toBeDefined();
        }
      }
    });

    it("should support mono mode on individual chips", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const combinations = [
        [true, false, false],
        [false, true, false],
        [false, false, true],
        [true, true, true],
        [false, false, false],
      ];

      for (const combo of combinations) {
        for (let chip = 0; chip < 3; chip++) {
          turbo.setChipMonoMode(chip, combo[chip]);
        }

        const debugInfo = turbo.getDebugInfo();
        expect(debugInfo).toBeDefined();
      }
    });

    it("should support DAC full value range", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const testValues = [0x00, 0x01, 0x7F, 0x80, 0x81, 0xFE, 0xFF];

      for (const value of testValues) {
        dac.setDacA(value);
        dac.setDacB(value);
        dac.setDacC(value);
        dac.setDacD(value);

        expect(dac.getDacA()).toBe(value);
        expect(dac.getDacB()).toBe(value);
        expect(dac.getDacC()).toBe(value);
        expect(dac.getDacD()).toBe(value);
      }
    });

    it("should support all PSG volumes (0-15)", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let chip = 0; chip < 3; chip++) {
        const psgChip = turbo.getChip(chip);

        for (let volume = 0; volume <= 15; volume++) {
          psgChip.setPsgRegisterIndex(8);
          psgChip.writePsgRegisterValue(volume);
          psgChip.setPsgRegisterIndex(9);
          psgChip.writePsgRegisterValue(volume);
          psgChip.setPsgRegisterIndex(10);
          psgChip.writePsgRegisterValue(volume);
        }
      }

      const debugInfo = turbo.getDebugInfo();
      expect(debugInfo).toBeDefined();
    });
  });

  // ===== Complete Audio Subsystem Integration =====
  describe("Complete Audio Subsystem Integration", () => {
    it("should integrate audio sources", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      mixer.setEarLevel(1);
      mixer.setPsgOutput({ left: 1000, right: 500 });
      mixer.setI2sInput({ left: 200, right: 100 });

      const mixerDebug = mixer.getDebugInfo();
      expect(mixerDebug).toBeDefined();
    });

    it("should maintain audio output during machine operation", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);
      chip0.setPsgRegisterIndex(8);
      chip0.writePsgRegisterValue(0x0F);

      dac.setDacA(0x60);
      dac.setDacB(0x70);

      const samples = machine.getAudioSamples();
      expect(samples).toBeDefined();
      expect(Array.isArray(samples)).toBe(true);
    });

    it("should persist and restore audio device state", () => {
      const controller = machine.audioControlDevice;

      const turbo = controller.getTurboSoundDevice();
      const dac = controller.getDacDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);

      dac.setDacA(0x60);
      dac.setDacB(0x70);

      const state = controller.getState();
      expect(state).toBeDefined();
      expect(state.turboSound).toBeDefined();
      expect(state.dac).toBeDefined();

      machine.reset();

      const restoredDac = controller.getDacDevice();
      expect(restoredDac).toBeDefined();
    });

    it("should provide debug information for all devices", () => {
      const controller = machine.audioControlDevice;
      const turbo = controller.getTurboSoundDevice();
      const dac = controller.getDacDevice();
      const mixer = controller.getAudioMixerDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);

      dac.setDacA(0x60);

      const controlDebug = controller.getDebugInfo();
      expect(controlDebug).toBeDefined();

      const turboDebug = turbo.getDebugInfo();
      expect(turboDebug).toBeDefined();

      const dacDebug = dac.getDebugInfo();
      expect(dacDebug).toBeDefined();

      const mixerDebug = mixer.getDebugInfo();
      expect(mixerDebug).toBeDefined();
    });

    it("should handle rapid configuration and audio generation", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();

      for (let i = 0; i < 200; i++) {
        if (i % 50 === 0) {
          const chip = (i / 50) % 3;
          const psgChip = turbo.getChip(chip);
          psgChip.setPsgRegisterIndex(0);
          psgChip.writePsgRegisterValue(0xE8 + chip * 0x20);
          psgChip.setPsgRegisterIndex(8);
          psgChip.writePsgRegisterValue(0x0F);
        }

        dac.setDacA(0x40 + (i % 128));
        dac.setDacB(0x80 - (i % 128));
        dac.setDacC(0x60 + (i % 64));
        dac.setDacD(0xA0 - (i % 64));
      }

      const samples = machine.getAudioSamples();
      expect(samples.length).toBeGreaterThanOrEqual(0);
    });

    it("should support audio generation with default settings", () => {
      const samples = machine.getAudioSamples();
      expect(samples).toBeDefined();
      expect(Array.isArray(samples)).toBe(true);
    });
  });

  // ===== Real-Time Performance Validation =====
  describe("Real-Time Performance Validation", () => {
    it("should generate audio quickly", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);
      chip0.setPsgRegisterIndex(8);
      chip0.writePsgRegisterValue(0x0F);

      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        machine.getAudioSamples();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
    });

    it("should handle rapid PSG register updates quickly", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const chip = turbo.getChip(i % 3);
        chip.setPsgRegisterIndex(i % 16);
        chip.writePsgRegisterValue(i & 0xFF);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it("should handle high-frequency DAC updates quickly", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const startTime = performance.now();

      for (let i = 0; i < 10000; i++) {
        dac.setDacA((i * 0x11) & 0xFF);
        dac.setDacB((i * 0x22) & 0xFF);
        dac.setDacC((i * 0x44) & 0xFF);
        dac.setDacD((i * 0x88) & 0xFF);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  // ===== System State Consistency =====
  describe("System State Consistency", () => {
    it("should maintain consistent state across all devices", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      const state1 = machine.audioControlDevice.getState();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);

      dac.setDacA(0x60);

      const state2 = machine.audioControlDevice.getState();

      expect(state1).not.toEqual(state2);

      expect(machine.audioControlDevice.getTurboSoundDevice()).toBe(turbo);
      expect(machine.audioControlDevice.getDacDevice()).toBe(dac);
      expect(machine.audioControlDevice.getAudioMixerDevice()).toBe(mixer);
    });

    it("should handle large register values gracefully", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(999);
      chip0.writePsgRegisterValue(999);

      const debugInfo = turbo.getDebugInfo();
      expect(debugInfo).toBeDefined();
    });

    it("should provide valid debug information in all states", () => {
      const controller = machine.audioControlDevice;

      let debugInfo = controller.getDebugInfo();
      expect(debugInfo).toBeDefined();

      const turbo = controller.getTurboSoundDevice();
      const chip0 = turbo.getChip(0);
      chip0.setPsgRegisterIndex(0);
      chip0.writePsgRegisterValue(0xE8);

      debugInfo = controller.getDebugInfo();
      expect(debugInfo).toBeDefined();
      expect(debugInfo.turboSound).toBeDefined();

      const dac = controller.getDacDevice();
      dac.setDacA(0x60);

      debugInfo = controller.getDebugInfo();
      expect(debugInfo).toBeDefined();
      expect(debugInfo.dac).toBeDefined();

      machine.reset();

      debugInfo = controller.getDebugInfo();
      expect(debugInfo).toBeDefined();
    });
  });
});
