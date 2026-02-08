import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

describe("Step 12: Audio State Persistence", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ==================== TurboSound State Persistence ====================

  describe("TurboSound State Save/Load", () => {
    it("should save and restore selected chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(1);
      expect(turbo.getSelectedChipId()).toBe(1);

      const state = turbo.getState();
      turbo.selectChip(2);
      expect(turbo.getSelectedChipId()).toBe(2);

      turbo.setState(state);
      expect(turbo.getSelectedChipId()).toBe(1);
    });

    it("should save and restore panning per chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.setChipPanning(0, 0x1); // Right only
      turbo.setChipPanning(1, 0x2); // Left only
      turbo.setChipPanning(2, 0x0); // Muted

      const state = turbo.getState();

      // Change panning
      turbo.setChipPanning(0, 0x3); // Stereo
      turbo.setChipPanning(1, 0x3); // Stereo
      turbo.setChipPanning(2, 0x3); // Stereo

      // Verify changed
      expect(turbo.getChipPanning(0)).toBe(0x3);
      expect(turbo.getChipPanning(1)).toBe(0x3);
      expect(turbo.getChipPanning(2)).toBe(0x3);

      // Restore
      turbo.setState(state);
      expect(turbo.getChipPanning(0)).toBe(0x1);
      expect(turbo.getChipPanning(1)).toBe(0x2);
      expect(turbo.getChipPanning(2)).toBe(0x0);
    });

    it("should save and restore AY stereo mode", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      expect(turbo.getAyStereoMode()).toBe(false); // Default ABC

      turbo.setAyStereoMode(true); // ACB mode
      expect(turbo.getAyStereoMode()).toBe(true);

      const state = turbo.getState();

      turbo.setAyStereoMode(false);
      expect(turbo.getAyStereoMode()).toBe(false);

      turbo.setState(state);
      expect(turbo.getAyStereoMode()).toBe(true);
    });

    it("should save and restore mono mode per chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.setChipMonoMode(0, true);
      turbo.setChipMonoMode(1, true);
      turbo.setChipMonoMode(2, false);

      const state = turbo.getState();

      // Change mono modes
      turbo.setChipMonoMode(0, false);
      turbo.setChipMonoMode(1, false);
      turbo.setChipMonoMode(2, true);

      // Restore
      turbo.setState(state);
      expect(turbo.getChipMonoMode(0)).toBe(true);
      expect(turbo.getChipMonoMode(1)).toBe(true);
      expect(turbo.getChipMonoMode(2)).toBe(false);
    });

    it("should save and restore PSG register state", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      // Set up chip 0
      turbo.selectChip(0);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0xAA);
      turbo.selectRegister(1);
      turbo.writeSelectedRegister(0x55);

      // Set up chip 1
      turbo.selectChip(1);
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0x33);

      const state = turbo.getState();

      // Reset to defaults
      turbo.reset();
      expect(turbo.getSelectedChipId()).toBe(0);

      // Restore
      turbo.setState(state);
      expect(turbo.getSelectedChipId()).toBe(1);

      turbo.selectChip(0);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0xAA);
      turbo.selectRegister(1);
      expect(turbo.readSelectedRegister()).toBe(0x55);

      turbo.selectChip(1);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0x33);
    });
  });

  // ==================== DAC State Persistence ====================

  describe("DAC State Save/Load", () => {
    it("should save and restore all DAC channel values", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x11);
      dac.setDacB(0x22);
      dac.setDacC(0x33);
      dac.setDacD(0x44);

      const state = dac.getState();

      // Change values
      dac.setDacA(0xFF);
      dac.setDacB(0xFF);
      dac.setDacC(0xFF);
      dac.setDacD(0xFF);

      // Restore
      dac.setState(state);
      expect(dac.getDacA()).toBe(0x11);
      expect(dac.getDacB()).toBe(0x22);
      expect(dac.getDacC()).toBe(0x33);
      expect(dac.getDacD()).toBe(0x44);
    });

    it("should save and restore DAC state across reset", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0xAA);
      dac.setDacB(0xBB);
      dac.setDacC(0xCC);
      dac.setDacD(0xDD);

      const state = dac.getState();

      // Reset DAC (clears to 0x80)
      dac.reset();
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);

      // Restore
      dac.setState(state);
      expect(dac.getDacA()).toBe(0xAA);
      expect(dac.getDacB()).toBe(0xBB);
      expect(dac.getDacC()).toBe(0xCC);
      expect(dac.getDacD()).toBe(0xDD);
    });

    it("should handle edge case values 0x00 and 0xFF", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      dac.setDacB(0xFF);
      dac.setDacC(0x00);
      dac.setDacD(0xFF);

      const state = dac.getState();

      dac.setDacA(0x80);
      dac.setDacB(0x80);
      dac.setDacC(0x80);
      dac.setDacD(0x80);

      dac.setState(state);
      expect(dac.getDacA()).toBe(0x00);
      expect(dac.getDacB()).toBe(0xFF);
      expect(dac.getDacC()).toBe(0x00);
      expect(dac.getDacD()).toBe(0xFF);
    });
  });

  // ==================== AudioMixer State Persistence ====================

  describe("AudioMixer State Save/Load", () => {
    it("should save and restore EAR level", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      mixer.setEarLevel(1);
      expect(mixer.getEarLevel()).toBe(512);

      const state = mixer.getState();

      mixer.setEarLevel(0);
      expect(mixer.getEarLevel()).toBe(0);

      mixer.setState(state);
      expect(mixer.getEarLevel()).toBe(512);
    });

    it("should save and restore MIC level", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      mixer.setMicLevel(1);
      expect(mixer.getMicLevel()).toBe(128);

      const state = mixer.getState();

      mixer.setMicLevel(0);
      expect(mixer.getMicLevel()).toBe(0);

      mixer.setState(state);
      expect(mixer.getMicLevel()).toBe(128);
    });

    it("should save and restore PSG output", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      mixer.setPsgOutput({ left: 1000, right: 2000 });
      const state = mixer.getState();

      mixer.setPsgOutput({ left: 0, right: 0 });
      expect(mixer.getPsgOutput()).toEqual({ left: 0, right: 0 });

      mixer.setState(state);
      expect(mixer.getPsgOutput()).toEqual({ left: 1000, right: 2000 });
    });

    it("should save and restore I2S input", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      mixer.setI2sInput({ left: 500, right: 1500 });
      const state = mixer.getState();

      mixer.setI2sInput({ left: 0, right: 0 });
      expect(mixer.getI2sInput()).toEqual({ left: 0, right: 0 });

      mixer.setState(state);
      expect(mixer.getI2sInput()).toEqual({ left: 500, right: 1500 });
    });

    it("should save and restore volume scale", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      mixer.setVolumeScale(0.5);
      const state = mixer.getState();

      mixer.setVolumeScale(0.75);
      expect(mixer.getVolumeScale()).toBe(0.75);

      mixer.setState(state);
      expect(mixer.getVolumeScale()).toBe(0.5);
    });
  });

  // ==================== AudioControlDevice State Persistence ====================

  describe("AudioControlDevice State Save/Load", () => {
    it("should save and restore all audio device states together", () => {
      const control = machine.audioControlDevice;
      const turbo = control.getTurboSoundDevice();
      const dac = control.getDacDevice();
      const mixer = control.getAudioMixerDevice();

      // Set up all devices
      turbo.selectChip(1);
      turbo.setAyStereoMode(true);
      turbo.setChipMonoMode(0, true);
      dac.setDacA(0x55);
      dac.setDacB(0x66);
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);

      const state = control.getState();

      // Reset all devices
      control.reset();
      expect(turbo.getSelectedChipId()).toBe(0);
      expect(turbo.getAyStereoMode()).toBe(false);
      expect(turbo.getChipMonoMode(0)).toBe(false);
      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(mixer.getEarLevel()).toBe(0);
      expect(mixer.getMicLevel()).toBe(0);

      // Restore
      control.setState(state);
      expect(turbo.getSelectedChipId()).toBe(1);
      expect(turbo.getAyStereoMode()).toBe(true);
      expect(turbo.getChipMonoMode(0)).toBe(true);
      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacB()).toBe(0x66);
      expect(mixer.getEarLevel()).toBe(512);
      expect(mixer.getMicLevel()).toBe(128);
    });
  });

  // ==================== Machine-Level State Persistence ====================

  describe("Machine Audio State Save/Load", () => {
    it("should provide machine-level audio state access", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();

      turbo.selectChip(2);
      dac.setDacA(0x77);

      const state = machine.getAudioDeviceState();

      turbo.selectChip(0);
      dac.setDacA(0x80);

      machine.setAudioDeviceState(state);
      expect(turbo.getSelectedChipId()).toBe(2);
      expect(dac.getDacA()).toBe(0x77);
    });

    it("should handle null state gracefully", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(1);

      machine.setAudioDeviceState(null);
      expect(turbo.getSelectedChipId()).toBe(1); // Unchanged
    });

    it("should handle undefined state gracefully", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(1);

      machine.setAudioDeviceState(undefined);
      expect(turbo.getSelectedChipId()).toBe(1); // Unchanged
    });
  });

  // ==================== State Persistence Across Machine Reset ====================

  describe("State Persistence with Machine Reset", () => {
    it("should preserve audio state after machine reset if saved", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();

      // Set initial state
      turbo.selectChip(2);
      turbo.setChipMonoMode(0, true);
      dac.setDacA(0x33);
      dac.setDacC(0x99);

      // Save state
      const audioState = machine.getAudioDeviceState();

      // Machine reset clears audio devices
      machine.audioControlDevice.reset();
      expect(turbo.getSelectedChipId()).toBe(0);
      expect(turbo.getChipMonoMode(0)).toBe(false);
      expect(dac.getDacA()).toBe(0x80);

      // Restore from saved state
      machine.setAudioDeviceState(audioState);
      expect(turbo.getSelectedChipId()).toBe(2);
      expect(turbo.getChipMonoMode(0)).toBe(true);
      expect(dac.getDacA()).toBe(0x33);
      expect(dac.getDacC()).toBe(0x99);
    });

    it("should correctly restore complex multi-chip configuration", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      // Configure chip 0
      turbo.selectChip(0);
      turbo.setChipMonoMode(0, true);
      turbo.setChipPanning(0, 0x1); // Right
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0xAA);

      // Configure chip 1
      turbo.selectChip(1);
      turbo.setChipMonoMode(1, false);
      turbo.setChipPanning(1, 0x2); // Left
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0xBB);

      // Configure chip 2
      turbo.selectChip(2);
      turbo.setChipMonoMode(2, true);
      turbo.setChipPanning(2, 0x3); // Stereo
      turbo.selectRegister(0);
      turbo.writeSelectedRegister(0xCC);

      turbo.setAyStereoMode(true);

      const state = turbo.getState();

      // Reset
      turbo.reset();

      // Verify reset to defaults
      expect(turbo.getSelectedChipId()).toBe(0);
      expect(turbo.getChipMonoMode(0)).toBe(false);
      expect(turbo.getAyStereoMode()).toBe(false);

      // Restore
      turbo.setState(state);

      // Verify restoration
      expect(turbo.getSelectedChipId()).toBe(2);
      expect(turbo.getAyStereoMode()).toBe(true);

      turbo.selectChip(0);
      expect(turbo.getChipMonoMode(0)).toBe(true);
      expect(turbo.getChipPanning(0)).toBe(0x1);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0xAA);

      turbo.selectChip(1);
      expect(turbo.getChipMonoMode(1)).toBe(false);
      expect(turbo.getChipPanning(1)).toBe(0x2);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0xBB);

      turbo.selectChip(2);
      expect(turbo.getChipMonoMode(2)).toBe(true);
      expect(turbo.getChipPanning(2)).toBe(0x3);
      turbo.selectRegister(0);
      expect(turbo.readSelectedRegister()).toBe(0xCC);
    });
  });

  // ==================== State Serialization Format ====================

  describe("State Serialization Format", () => {
    it("should serialize to plain object format", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(1);
      turbo.setAyStereoMode(true);

      const state = turbo.getState();

      expect(typeof state).toBe("object");
      expect(state).not.toBeNull();
      expect("selectedChip" in state).toBe(true);
      expect("ayStereoMode" in state).toBe(true);
      expect("chipPanning" in state).toBe(true);
      expect("chipMonoMode" in state).toBe(true);
      expect("chipStates" in state).toBe(true);
    });

    it("should serialize DAC state with all channels", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      dac.setDacA(0x11);
      dac.setDacB(0x22);
      dac.setDacC(0x33);
      dac.setDacD(0x44);

      const state = dac.getState();

      expect(typeof state).toBe("object");
      expect("dacChannels" in state).toBe(true);
      expect(Array.isArray(state.dacChannels)).toBe(true);
      expect(state.dacChannels.length).toBe(4);
      expect(state.dacChannels[0]).toBe(0x11);
      expect(state.dacChannels[1]).toBe(0x22);
      expect(state.dacChannels[2]).toBe(0x33);
      expect(state.dacChannels[3]).toBe(0x44);
    });

    it("should serialize mixer state with all audio levels", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 100, right: 200 });

      const state = mixer.getState();

      expect(typeof state).toBe("object");
      expect("earLevel" in state).toBe(true);
      expect("micLevel" in state).toBe(true);
      expect("psgOutput" in state).toBe(true);
      expect("volumeScale" in state).toBe(true);
    });
  });
});
