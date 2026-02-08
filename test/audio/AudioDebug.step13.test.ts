import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

describe("Step 13: Audio Debug Support", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ==================== PSG Chip Debug Info ====================

  describe("PsgChip Debug Info", () => {
    it("should provide complete chip debug information", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e); // Enable channel A tone
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f); // Channel A volume

      const debug = chip.getDebugInfo();

      expect(debug).toBeDefined();
      expect(debug.chipId).toBe(0);
      expect(debug.registerIndex).toBe(8);
      expect(debug.registers).toBeDefined();
      expect(debug.registers.length).toBe(16);
    });

    it("should track channel A state in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x42);
      chip.setPsgRegisterIndex(1);
      chip.writePsgRegisterValue(0x00);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      const debug = chip.getDebugInfo();
      expect(debug.channels.a).toBeDefined();
      expect(debug.channels.a.tone).toBe(0x42);
      expect(debug.channels.a.volume).toBe(0x0f);
      expect(debug.channels.a.toneEnabled).toBe(false); // Disabled by default (mixer reg 7)
    });

    it("should track channel B state in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(2);
      chip.writePsgRegisterValue(0x55);
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(0x0a);

      const debug = chip.getDebugInfo();
      expect(debug.channels.b).toBeDefined();
      expect(debug.channels.b.tone).toBe(0x55);
      expect(debug.channels.b.volume).toBe(0x0a);
    });

    it("should track channel C state in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(4);
      chip.writePsgRegisterValue(0x33);
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(0x08);

      const debug = chip.getDebugInfo();
      expect(debug.channels.c).toBeDefined();
      expect(debug.channels.c.tone).toBe(0x33);
      expect(debug.channels.c.volume).toBe(0x08);
    });

    it("should track noise state in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(6);
      chip.writePsgRegisterValue(0x1f);

      const debug = chip.getDebugInfo();
      expect(debug.noise).toBeDefined();
      expect(debug.noise.frequency).toBe(0x1f);
      expect(debug.noise.seed).toBe(0);
      expect(debug.noise.counter).toBe(0);
    });

    it("should track envelope state in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(11);
      chip.writePsgRegisterValue(0x50);
      chip.setPsgRegisterIndex(12);
      chip.writePsgRegisterValue(0x00);
      chip.setPsgRegisterIndex(13);
      chip.writePsgRegisterValue(0x0a);

      const debug = chip.getDebugInfo();
      expect(debug.envelope).toBeDefined();
      expect(debug.envelope.frequency).toBe(0x50);
      expect(debug.envelope.style).toBe(0x0a);
    });

    it("should include channel output volumes in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      chip.generateOutputValue();

      const debug = chip.getDebugInfo();
      expect(debug.channels.a.output).toBeDefined();
      expect(typeof debug.channels.a.output).toBe("number");
      expect(debug.channels.a.output).toBeGreaterThanOrEqual(0);
    });

    it.skip("should include diagnostics in debug info", () => {
      // Diagnostic logging has been removed from audio implementation
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      const debug = chip.getDebugInfo();
      expect(debug.diagnostics).toBeDefined();
      expect(debug.diagnostics.started).toBe(false);
      expect(debug.diagnostics.samplesCount).toBe(0);
      expect(debug.diagnostics.orphanSum).toBe(0);
      expect(debug.diagnostics.orphanSamples).toBe(0);
    });
  });

  // ==================== TurboSound Debug Info ====================

  describe("TurboSound Debug Info", () => {
    it("should provide TurboSound debug information", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const debug = turbo.getDebugInfo();

      expect(debug).toBeDefined();
      expect(debug.selectedChip).toBe(0);
      expect(debug.ayStereoMode).toBe("ABC");
      expect(debug.chips).toBeDefined();
      expect(debug.chips.length).toBe(3);
    });

    it("should track stereo mode in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.setAyStereoMode(false);

      let debug = turbo.getDebugInfo();
      expect(debug.ayStereoMode).toBe("ABC");

      turbo.setAyStereoMode(true);
      debug = turbo.getDebugInfo();
      expect(debug.ayStereoMode).toBe("ACB");
    });

    it("should track selected chip in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      turbo.selectChip(0);
      expect(turbo.getDebugInfo().selectedChip).toBe(0);

      turbo.selectChip(1);
      expect(turbo.getDebugInfo().selectedChip).toBe(1);

      turbo.selectChip(2);
      expect(turbo.getDebugInfo().selectedChip).toBe(2);
    });

    it("should track panning per chip in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.setChipPanning(0, 0x1); // Right only
      turbo.setChipPanning(1, 0x2); // Left only
      turbo.setChipPanning(2, 0x3); // Stereo

      const debug = turbo.getDebugInfo();
      expect(debug.chips[0].panning).toBe(0x1);
      expect(debug.chips[1].panning).toBe(0x2);
      expect(debug.chips[2].panning).toBe(0x3);
    });

    it("should track mono mode per chip in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.setChipMonoMode(0, true);
      turbo.setChipMonoMode(1, false);
      turbo.setChipMonoMode(2, true);

      const debug = turbo.getDebugInfo();
      expect(debug.chips[0].monoMode).toBe(true);
      expect(debug.chips[1].monoMode).toBe(false);
      expect(debug.chips[2].monoMode).toBe(true);
    });

    it("should provide individual chip debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(1);
      turbo.setChipPanning(1, 0x1);
      turbo.setChipMonoMode(1, true);

      const debug = turbo.getChipDebugInfo(1);
      expect(debug).toBeDefined();
      expect(debug.chipId).toBe(1);
      expect(debug.panning).toBe(0x1);
      expect(debug.monoMode).toBe(true);
      expect(debug.debug).toBeDefined();
    });

    it("should include all three chips in debug info", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      const debug = turbo.getDebugInfo();
      expect(debug.chips.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        expect(debug.chips[i].chipId).toBe(i);
        expect(debug.chips[i].debug).toBeDefined();
      }
    });
  });

  // ==================== DAC Debug Info ====================

  describe("DAC Debug Info", () => {
    it("should provide DAC debug information", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const debug = dac.getDebugInfo();

      expect(debug).toBeDefined();
      expect(debug.channels).toBeDefined();
      expect(debug.channels.a).toBeDefined();
      expect(debug.channels.b).toBeDefined();
      expect(debug.channels.c).toBeDefined();
      expect(debug.channels.d).toBeDefined();
    });

    it("should track all DAC channel values in debug info", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      dac.setDacA(0x55);
      dac.setDacB(0x66);
      dac.setDacC(0x77);
      dac.setDacD(0x88);

      const debug = dac.getDebugInfo();
      expect(debug.channels.a.value).toBe(0x55);
      expect(debug.channels.b.value).toBe(0x66);
      expect(debug.channels.c.value).toBe(0x77);
      expect(debug.channels.d.value).toBe(0x88);
    });

    it("should provide hex format for DAC values", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      dac.setDacA(0xff);
      dac.setDacB(0x00);
      dac.setDacC(0xa5);

      const debug = dac.getDebugInfo();
      expect(debug.channels.a.hex).toBe("0xFF");
      expect(debug.channels.b.hex).toBe("0x00");
      expect(debug.channels.c.hex).toBe("0xA5");
    });

    it("should include stereo output in DAC debug info", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      dac.setDacA(0x80);
      dac.setDacB(0x80);
      dac.setDacC(0x80);
      dac.setDacD(0x80);

      const debug = dac.getDebugInfo();
      expect(debug.stereoOutput).toBeDefined();
      // The DAC converts to 16-bit scaled output, just verify it's a number
      expect(typeof debug.stereoOutput.left).toBe("number");
      expect(typeof debug.stereoOutput.right).toBe("number");
    });

    it("should track DAC channel value changes", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x80);
      let debug = dac.getDebugInfo();
      expect(debug.channels.a.value).toBe(0x80);

      dac.setDacA(0x7f);
      debug = dac.getDebugInfo();
      expect(debug.channels.a.value).toBe(0x7f);
    });
  });

  // ==================== Audio Mixer Debug Info ====================

  describe("AudioMixer Debug Info", () => {
    it("should provide mixer debug information", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      const debug = mixer.getDebugInfo();

      expect(debug).toBeDefined();
      expect(debug.sources).toBeDefined();
      expect(debug.volume).toBeDefined();
      expect(debug.output).toBeDefined();
    });

    it("should track EAR and MIC levels in debug info", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);

      const debug = mixer.getDebugInfo();
      expect(debug.sources.ear.level).toBe(512);
      expect(debug.sources.ear.enabled).toBe(true);
      expect(debug.sources.mic.level).toBe(128);
      expect(debug.sources.mic.enabled).toBe(true);
    });

    it("should track disabled audio sources", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);

      const debug = mixer.getDebugInfo();
      expect(debug.sources.ear.level).toBe(0);
      expect(debug.sources.ear.enabled).toBe(false);
      expect(debug.sources.mic.level).toBe(0);
      expect(debug.sources.mic.enabled).toBe(false);
    });

    it("should track PSG output in debug info", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      mixer.setPsgOutput({ left: 1000, right: 2000 });

      const debug = mixer.getDebugInfo();
      expect(debug.sources.psg.left).toBe(1000);
      expect(debug.sources.psg.right).toBe(2000);
    });

    it("should track I2S input in debug info", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      mixer.setI2sInput({ left: 500, right: 1500 });

      const debug = mixer.getDebugInfo();
      expect(debug.sources.i2s.left).toBe(500);
      expect(debug.sources.i2s.right).toBe(1500);
    });

    it("should track volume scale in debug info", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      mixer.setVolumeScale(0.5);

      const debug = mixer.getDebugInfo();
      expect(debug.volume.scale).toBe(0.5);
      expect(debug.volume.scaledPercent).toBe("50.0%");
    });

    it("should include mixed output in debug info", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      mixer.setEarLevel(1);

      const debug = mixer.getDebugInfo();
      expect(debug.output.mixed).toBeDefined();
      expect(debug.output.mixed.left).toBeDefined();
      expect(debug.output.mixed.right).toBeDefined();
    });
  });

  // ==================== AudioControlDevice Debug Info ====================

  describe("AudioControlDevice Debug Info", () => {
    it("should provide comprehensive audio debug information", () => {
      const control = machine.audioControlDevice;
      const debug = control.getDebugInfo();

      expect(debug).toBeDefined();
      expect(debug.turboSound).toBeDefined();
      expect(debug.dac).toBeDefined();
      expect(debug.mixer).toBeDefined();
    });

    it("should aggregate debug info from all sub-devices", () => {
      const control = machine.audioControlDevice;
      const turbo = control.getTurboSoundDevice();
      const dac = control.getDacDevice();
      const mixer = control.getAudioMixerDevice();

      turbo.selectChip(1);
      dac.setDacA(0x7f);
      mixer.setEarLevel(1);

      const debug = control.getDebugInfo();
      expect(debug.turboSound.selectedChip).toBe(1);
      expect(debug.dac.channels.a.value).toBe(0x7f);
      expect(debug.mixer.sources.ear.level).toBe(512);
    });

    it("should reflect all configuration in debug info", () => {
      const control = machine.audioControlDevice;
      const turbo = control.getTurboSoundDevice();
      const dac = control.getDacDevice();
      const mixer = control.getAudioMixerDevice();

      // Configure all devices
      turbo.selectChip(2);
      turbo.setAyStereoMode(true);
      turbo.setChipMonoMode(0, true);
      dac.setDacA(0x55);
      mixer.setMicLevel(1);
      mixer.setVolumeScale(0.75);

      const debug = control.getDebugInfo();

      // Verify TurboSound config
      expect(debug.turboSound.selectedChip).toBe(2);
      expect(debug.turboSound.ayStereoMode).toBe("ACB");
      expect(debug.turboSound.chips[0].monoMode).toBe(true);

      // Verify DAC config
      expect(debug.dac.channels.a.value).toBe(0x55);

      // Verify Mixer config
      expect(debug.mixer.sources.mic.enabled).toBe(true);
      expect(debug.mixer.volume.scale).toBe(0.75);
    });
  });

  // ==================== Debug Info Consistency ====================

  describe("Debug Info Consistency", () => {
    it("should maintain consistent debug info across multiple calls", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      turbo.selectChip(1);
      turbo.setChipPanning(1, 0x2);

      const debug1 = turbo.getDebugInfo();
      const debug2 = turbo.getDebugInfo();

      expect(debug1.selectedChip).toBe(debug2.selectedChip);
      expect(debug1.chips[1].panning).toBe(debug2.chips[1].panning);
    });

    it("should update debug info when state changes", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      let debug = dac.getDebugInfo();
      expect(debug.channels.a.value).toBe(0x80); // Default

      dac.setDacA(0x7f);
      debug = dac.getDebugInfo();
      expect(debug.channels.a.value).toBe(0x7f);
    });

    it("should handle debug info for independent devices", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();

      const turboDebug = turbo.getDebugInfo();
      const dacDebug = dac.getDebugInfo();

      expect(turboDebug).not.toEqual(dacDebug);
      expect(turboDebug.selectedChip).toBeDefined();
      expect(dacDebug.channels).toBeDefined();
    });
  });
});
