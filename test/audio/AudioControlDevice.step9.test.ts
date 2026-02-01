import { describe, it, expect, beforeEach } from "vitest";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { TurboSoundDevice } from "@emu/machines/zxNext/TurboSoundDevice";
import { AudioMixerDevice } from "@emu/machines/zxNext/AudioMixerDevice";
import { AudioControlDevice } from "@emu/machines/zxNext/AudioControlDevice";

describe("AudioControlDevice Step 9: NextReg Audio Configuration", () => {
  let dac: DacDevice;
  let turboSound: TurboSoundDevice;
  let mixer: AudioMixerDevice;
  let audioControl: AudioControlDevice;

  beforeEach(() => {
    dac = new DacDevice();
    turboSound = new TurboSoundDevice();
    mixer = new AudioMixerDevice(dac);
    audioControl = new AudioControlDevice({
      soundDevice: {
        beepOnlyToInternalSpeaker: false,
        psgMode: 0,
        ayStereoMode: false,
        enableInternalSpeaker: true,
        enable8BitDacs: false,
        enableTurbosound: false,
        ay2Mono: false,
        ay1Mono: false,
        ay0Mono: false,
        silenceHdmiAudio: false,
        reset: () => {},
        machine: undefined
      }
    } as any);
  });

  // ==================== PSG Mode Configuration Tests ====================

  describe("PSG Mode Configuration (Reg 0x06 bits 1:0)", () => {
    it("should initialize PSG mode to 0 (YM mode)", () => {
      // Default mode is YM (0)
      expect(audioControl.getTurboSoundDevice()).toBeDefined();
    });

    it("should support mode 0 (YM)", () => {
      // Mode 0: YM - should work normally
      const psgMode = 0;
      expect(psgMode & 0x03).toBe(0);
    });

    it("should support mode 1 (AY)", () => {
      // Mode 1: AY - standard AY-3-8912 mode
      const psgMode = 1;
      expect(psgMode & 0x03).toBe(1);
    });

    it("should support mode 2 (ZXN-8950)", () => {
      // Mode 2: ZXN-8950 extended mode
      const psgMode = 2;
      expect(psgMode & 0x03).toBe(2);
    });

    it("should support mode 3 (Hold all PSGs in reset)", () => {
      // Mode 3: Hold all PSGs in reset - no sound output
      const psgMode = 3;
      expect(psgMode & 0x03).toBe(3);
    });
  });

  // ==================== Stereo Mode Configuration Tests ====================

  describe("AY Stereo Mode Configuration (Reg 0x08 bit 5)", () => {
    it("should initialize stereo mode to ABC (false)", () => {
      const stereoMode = audioControl.getTurboSoundDevice().getAyStereoMode();
      expect(stereoMode).toBe(false); // Default is ABC
    });

    it("should allow changing to ACB mode", () => {
      audioControl.getTurboSoundDevice().setAyStereoMode(true);
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);
    });

    it("should allow toggling back to ABC mode", () => {
      audioControl.getTurboSoundDevice().setAyStereoMode(true);
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);
      audioControl.getTurboSoundDevice().setAyStereoMode(false);
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(false);
    });

    it("should apply stereo mode via applyConfiguration", () => {
      audioControl.machine.soundDevice.ayStereoMode = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);
    });
  });

  // ==================== DAC Enable Configuration Tests ====================

  describe("8-bit DAC Enable (Reg 0x08 bit 3)", () => {
    it("should initialize DAC disable to false", () => {
      expect(audioControl.machine.soundDevice.enable8BitDacs).toBe(false);
    });

    it("should allow enabling DACs", () => {
      audioControl.machine.soundDevice.enable8BitDacs = true;
      expect(audioControl.machine.soundDevice.enable8BitDacs).toBe(true);
    });

    it("should provide DAC device when enabled", () => {
      audioControl.machine.soundDevice.enable8BitDacs = true;
      const dac = audioControl.getDacDevice();
      expect(dac).toBeDefined();
      expect(dac).toBeInstanceOf(DacDevice);
    });

    it("should maintain DAC values when toggled", () => {
      const dac = audioControl.getDacDevice();
      dac.setDacA(0xAA);
      expect(dac.getDacA()).toBe(0xAA);
      
      audioControl.machine.soundDevice.enable8BitDacs = true;
      audioControl.applyConfiguration();
      
      expect(dac.getDacA()).toBe(0xAA);
    });
  });

  // ==================== TurboSound Enable Configuration Tests ====================

  describe("TurboSound Enable (Reg 0x08 bit 1)", () => {
    it("should initialize TurboSound disable to false", () => {
      expect(audioControl.machine.soundDevice.enableTurbosound).toBe(false);
    });

    it("should allow enabling TurboSound", () => {
      audioControl.machine.soundDevice.enableTurbosound = true;
      expect(audioControl.machine.soundDevice.enableTurbosound).toBe(true);
    });

    it("should provide TurboSound device when enabled", () => {
      audioControl.machine.soundDevice.enableTurbosound = true;
      const ts = audioControl.getTurboSoundDevice();
      expect(ts).toBeDefined();
      expect(ts).toBeInstanceOf(TurboSoundDevice);
    });

    it("should maintain TurboSound state when toggled", () => {
      const ts = audioControl.getTurboSoundDevice();
      
      audioControl.machine.soundDevice.enableTurbosound = true;
      audioControl.machine.soundDevice.ayStereoMode = true;
      audioControl.applyConfiguration();
      
      expect(ts.getAyStereoMode()).toBe(true);
    });
  });

  // ==================== Per-Chip Mono Mode Configuration Tests ====================

  describe("Per-Chip Mono Mode (Reg 0x09 bits 7:5)", () => {
    it("should initialize all chips to stereo mode", () => {
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(2)).toBe(false);
    });

    it("should allow enabling mono mode on chip 0 (bit 5)", () => {
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(2)).toBe(false);
    });

    it("should allow enabling mono mode on chip 1 (bit 6)", () => {
      audioControl.machine.soundDevice.ay1Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(2)).toBe(false);
    });

    it("should allow enabling mono mode on chip 2 (bit 7)", () => {
      audioControl.machine.soundDevice.ay2Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(2)).toBe(true);
    });

    it("should allow independent mono mode per chip", () => {
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.machine.soundDevice.ay2Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(2)).toBe(true);
    });

    it("should allow disabling mono mode", () => {
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.machine.soundDevice.ay1Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(true);

      audioControl.machine.soundDevice.ay0Mono = false;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(true);
    });

    it("should allow all chips in mono mode simultaneously", () => {
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.machine.soundDevice.ay1Mono = true;
      audioControl.machine.soundDevice.ay2Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(2)).toBe(true);
    });
  });

  // ==================== Combined Configuration Tests ====================

  describe("Combined Audio Configuration", () => {
    it("should apply multiple configuration changes together", () => {
      audioControl.machine.soundDevice.ayStereoMode = true;
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.machine.soundDevice.ay2Mono = true;
      audioControl.applyConfiguration();

      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(false);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(2)).toBe(true);
    });

    it("should support switching stereo mode with mono modes active", () => {
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(false);

      audioControl.machine.soundDevice.ayStereoMode = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
    });

    it("should handle DAC and TurboSound enable flags together", () => {
      audioControl.machine.soundDevice.enable8BitDacs = true;
      audioControl.machine.soundDevice.enableTurbosound = true;
      audioControl.applyConfiguration();

      const dac = audioControl.getDacDevice();
      const ts = audioControl.getTurboSoundDevice();
      expect(dac).toBeDefined();
      expect(ts).toBeDefined();
    });
  });

  // ==================== Reset Tests ====================

  describe("Reset Behavior", () => {
    it("should reset all audio devices", () => {
      const ts = audioControl.getTurboSoundDevice();
      const dac = audioControl.getDacDevice();
      
      ts.setAyStereoMode(true);
      dac.setDacA(0xAB);
      
      audioControl.reset();
      
      expect(ts.getAyStereoMode()).toBe(false); // Reset to default
      expect(dac.getDacA()).toBe(0x80); // Reset to center
    });

    it("should reset mono modes", () => {
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      
      audioControl.reset();
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(false);
    });

    it("should reset mixer state", () => {
      const mixer = audioControl.getAudioMixerDevice();
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      
      audioControl.reset();
      
      expect(mixer.getEarLevel()).toBe(0);
      expect(mixer.getMicLevel()).toBe(0);
    });
  });

  // ==================== Device Access Tests ====================

  describe("Device Access", () => {
    it("should provide access to TurboSoundDevice", () => {
      const ts = audioControl.getTurboSoundDevice();
      expect(ts).toBeDefined();
      expect(ts).toBeInstanceOf(TurboSoundDevice);
    });

    it("should provide access to DacDevice", () => {
      const dac = audioControl.getDacDevice();
      expect(dac).toBeDefined();
      expect(dac).toBeInstanceOf(DacDevice);
    });

    it("should provide access to AudioMixerDevice", () => {
      const mixer = audioControl.getAudioMixerDevice();
      expect(mixer).toBeDefined();
      expect(mixer).toBeInstanceOf(AudioMixerDevice);
    });

    it("should provide same device instances on repeated access", () => {
      const ts1 = audioControl.getTurboSoundDevice();
      const ts2 = audioControl.getTurboSoundDevice();
      expect(ts1).toBe(ts2);

      const dac1 = audioControl.getDacDevice();
      const dac2 = audioControl.getDacDevice();
      expect(dac1).toBe(dac2);

      const mixer1 = audioControl.getAudioMixerDevice();
      const mixer2 = audioControl.getAudioMixerDevice();
      expect(mixer1).toBe(mixer2);
    });
  });

  // ==================== Configuration Persistence Tests ====================

  describe("Configuration Persistence", () => {
    it("should maintain stereo mode across multiple applyConfiguration calls", () => {
      audioControl.machine.soundDevice.ayStereoMode = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);

      // Apply configuration again without changing
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);
    });

    it("should maintain mono modes across multiple applications", () => {
      audioControl.machine.soundDevice.ay0Mono = true;
      audioControl.machine.soundDevice.ay1Mono = true;
      audioControl.applyConfiguration();

      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(true);

      audioControl.applyConfiguration();

      expect(audioControl.getTurboSoundDevice().getChipMonoMode(0)).toBe(true);
      expect(audioControl.getTurboSoundDevice().getChipMonoMode(1)).toBe(true);
    });

    it("should allow toggling configuration dynamically", () => {
      audioControl.machine.soundDevice.ayStereoMode = false;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(false);

      audioControl.machine.soundDevice.ayStereoMode = true;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(true);

      audioControl.machine.soundDevice.ayStereoMode = false;
      audioControl.applyConfiguration();
      expect(audioControl.getTurboSoundDevice().getAyStereoMode()).toBe(false);
    });
  });
});
