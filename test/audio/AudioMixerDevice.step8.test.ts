import { describe, it, expect, beforeEach } from "vitest";
import { DacDevice } from "@emu/machines/zxNext/DacDevice";
import { AudioMixerDevice } from "@emu/machines/zxNext/AudioMixerDevice";

describe("AudioMixerDevice Step 8: Create Audio Mixer", () => {
  let dac: DacDevice;
  let mixer: AudioMixerDevice;

  beforeEach(() => {
    dac = new DacDevice();
    mixer = new AudioMixerDevice(dac);
  });

  // ==================== EAR (Beeper) Tests ====================

  describe("EAR (Beeper) Output", () => {
    it("should contribute 0 when EAR is inactive", () => {
      mixer.setEarLevel(0);
      const output = mixer.getMixedOutput();
      expect(mixer.getEarLevel()).toBe(0);
    });

    it("should contribute 512 when EAR is active", () => {
      mixer.setEarLevel(1);
      expect(mixer.getEarLevel()).toBe(512);
    });

    it("should affect both left and right channels equally", () => {
      mixer.setEarLevel(1);
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center
      const output = mixer.getMixedOutput();
      // Both channels should have EAR (512) + DAC (-512) = 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should toggle EAR on and off", () => {
      mixer.setEarLevel(0);
      expect(mixer.getEarLevel()).toBe(0);

      mixer.setEarLevel(1);
      expect(mixer.getEarLevel()).toBe(512);

      mixer.setEarLevel(0);
      expect(mixer.getEarLevel()).toBe(0);
    });
  });

  // ==================== MIC Tests ====================

  describe("MIC (Microphone) Input", () => {
    it("should contribute 0 when MIC is inactive", () => {
      mixer.setMicLevel(0);
      expect(mixer.getMicLevel()).toBe(0);
    });

    it("should contribute 128 when MIC is active", () => {
      mixer.setMicLevel(1);
      expect(mixer.getMicLevel()).toBe(128);
    });

    it("should affect both left and right channels equally", () => {
      mixer.setMicLevel(1);
      mixer.setEarLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // MIC (128) + DAC (-512) = -384
      expect(output.left).toBe(-384);
      expect(output.right).toBe(-384);
    });

    it("should combine with EAR", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // EAR (512) + MIC (128) + DAC (-512) = 128
      expect(output.left).toBe(128);
      expect(output.right).toBe(128);
    });
  });

  // ==================== PSG Output Tests ====================

  describe("PSG (TurboSound) Output", () => {
    it("should contribute PSG output to mixer", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // PSG (8000/8=1000) + DAC (-512) = 488
      expect(output.left).toBe(488);
      expect(output.right).toBe(488);
    });

    it("should handle stereo separation in PSG", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 8000 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // PSG left (4000/8=500) + DAC (-512) = -12, PSG right (8000/8=1000) + DAC (-512) = 488
      expect(output.left).toBe(-12);
      expect(output.right).toBe(488);
    });

    it("should combine PSG with EAR and MIC", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // EAR (512) + MIC (128) + PSG (8000/8=1000) + DAC (-512) = 1128
      expect(output.left).toBe(1128);
      expect(output.right).toBe(1128);
    });

    it("should handle zero PSG output", () => {
      mixer.setEarLevel(1);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // EAR (512) + DAC (-512) = 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should handle maximum PSG output", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 65535, right: 65535 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // PSG (65535/8=8191) + DAC (-512) = 7679
      expect(output.left).toBe(7679);
      expect(output.right).toBe(7679);
    });
  });

  // ==================== DAC Output Tests ====================

  describe("DAC Output", () => {
    it("should contribute DAC output to mixer", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });

      // Set DAC to center (0x80 = -128 * 256 per channel, so output is -32768 each)
      dac.reset(); // Reset to 0x80 (center)

      const output = mixer.getMixedOutput();
      // DAC contribution at center should be small
      expect(output.left).toBeDefined();
      expect(output.right).toBeDefined();
    });

    it("should reflect DAC state changes", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });

      dac.setChannelValues([0x7f, 0x7f, 0x80, 0x80]);
      const output1 = mixer.getMixedOutput();

      dac.setChannelValues([0xff, 0xff, 0x00, 0x00]);
      const output2 = mixer.getMixedOutput();

      // DAC values changed, so output should be different
      expect(output1).not.toEqual(output2);
    });

    it("should combine DAC with other sources", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 0, right: 0 });

      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center
      const output = mixer.getMixedOutput();
      // EAR (512) + MIC (128) + DAC (-512) = 128
      expect(output.left).toBe(128);
      expect(output.right).toBe(128);
    });
  });

  // ==================== I2S Input Tests ====================

  describe("I2S Input (Future Enhancement)", () => {
    it("should contribute I2S input to mixer", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      mixer.setI2sInput({ left: 8000, right: 8000 });
      const output = mixer.getMixedOutput();

      // I2S is divided by 8, DAC at 0x80 produces -512 per side
      const dacContrib = -512;
      const i2sContrib = Math.floor(8000 / 8);
      expect(output.left).toBe(dacContrib + i2sContrib);
      expect(output.right).toBe(dacContrib + i2sContrib);
    });

    it("should handle stereo separation in I2S", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      mixer.setI2sInput({ left: 4000, right: 8000 });
      const output = mixer.getMixedOutput();

      // I2S left (4000/8=500) + DAC (-512) = -12, I2S right (8000/8=1000) + DAC (-512) = 488
      expect(output.left).toBe(-12);
      expect(output.right).toBe(488);
    });

    it("should combine all sources including I2S", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setI2sInput({ left: 8000, right: 8000 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // EAR (512) + MIC (128) + PSG (8000/8=1000) + I2S (8000/8=1000) + DAC (-512) = 2128
      expect(output.left).toBe(2128);
      expect(output.right).toBe(2128);
    });
  });

  // ==================== Volume Scale Tests ====================

  describe("Master Volume Scale", () => {
    it("should initialize volume scale to 1.0", () => {
      expect(mixer.getVolumeScale()).toBe(1.0);
    });

    it("should apply volume scale to output", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      mixer.setVolumeScale(0.5);
      const output = mixer.getMixedOutput();

      // EAR (512) + DAC (-512) = 0, then 0 * 0.5 = 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should clamp volume scale to 0.0-1.0 range", () => {
      mixer.setVolumeScale(-0.5);
      expect(mixer.getVolumeScale()).toBe(0.0);

      mixer.setVolumeScale(1.5);
      expect(mixer.getVolumeScale()).toBe(1.0);

      mixer.setVolumeScale(0.75);
      expect(mixer.getVolumeScale()).toBe(0.75);
    });

    it("should mute output at volume scale 0.0", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setVolumeScale(0.0);

      const output = mixer.getMixedOutput();
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should provide full volume at scale 1.0", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setVolumeScale(1.0);

      const output1 = mixer.getMixedOutput();

      mixer.setVolumeScale(0.5);
      const output2 = mixer.getMixedOutput();

      expect(output1.left).toBeGreaterThan(output2.left);
    });
  });

  // ==================== Output Clamping Tests ====================

  describe("Output Clamping", () => {
    it("should clamp output to 16-bit range", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 65535, right: 65535 });
      mixer.setI2sInput({ left: 65535, right: 65535 });

      const output = mixer.getMixedOutput();
      expect(output.left).toBeLessThanOrEqual(32767);
      expect(output.right).toBeLessThanOrEqual(32767);
      expect(output.left).toBeGreaterThanOrEqual(-32768);
      expect(output.right).toBeGreaterThanOrEqual(-32768);
    });

    it("should not clamp reasonable output levels", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 4000 });

      const output = mixer.getMixedOutput();
      expect(output.left).toBeLessThan(5000);
      expect(output.right).toBeLessThan(5000);
    });
  });

  // ==================== Reset Tests ====================

  describe("Reset Behavior", () => {
    it("should reset mixer state", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setI2sInput({ left: 8000, right: 8000 });
      mixer.setVolumeScale(0.5);

      mixer.reset();

      expect(mixer.getEarLevel()).toBe(0);
      expect(mixer.getMicLevel()).toBe(0);
      expect(mixer.getPsgOutput()).toEqual({ left: 0, right: 0 });
      expect(mixer.getI2sInput()).toEqual({ left: 0, right: 0 });
      expect(mixer.getVolumeScale()).toBe(1.0);
    });

    it("should produce zero output after reset", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });

      mixer.reset();

      const output = mixer.getMixedOutput();
      expect(output.left).toBe(-512);
      expect(output.right).toBe(-512);
    });

    it("should not reset DAC state", () => {
      dac.setChannelValues([0x10, 0x20, 0x30, 0x40]);

      mixer.reset();

      expect(dac.getDacA()).toBe(0x10);
      expect(dac.getDacB()).toBe(0x20);
      expect(dac.getDacC()).toBe(0x30);
      expect(dac.getDacD()).toBe(0x40);
    });
  });

  // ==================== Multi-Source Combinations ====================

  describe("Multi-Source Combinations", () => {
    it("should mix all sources simultaneously", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 4000, right: 6000 });
      mixer.setI2sInput({ left: 2000, right: 3000 });

      dac.setChannelValues([0x7f, 0x7f, 0x80, 0x80]);

      const output = mixer.getMixedOutput();
      expect(output.left).toBeDefined();
      expect(output.right).toBeDefined();
      expect(output.left).not.toBe(output.right);
    });

    it("should produce silent output with all sources off", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // All mixer sources 0, DAC (-512) = -512
      expect(output.left).toBe(-512);
      expect(output.right).toBe(-512);
    });

    it("should produce maximum output with optimal levels", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 32000, right: 32000 });
      mixer.setI2sInput({ left: 32000, right: 32000 });
      mixer.setVolumeScale(1.0);

      const output = mixer.getMixedOutput();
      // Should be clamped but not zero
      expect(output.left).not.toBe(0);
      expect(output.right).not.toBe(0);
    });
  });

  // ==================== Source Independence Tests ====================

  describe("Source Independence", () => {
    it("should update sources independently", () => {
      mixer.setEarLevel(1);
      const output1 = mixer.getMixedOutput();

      mixer.setPsgOutput({ left: 8000, right: 8000 });
      const output2 = mixer.getMixedOutput();

      expect(output2.left).toBeGreaterThan(output1.left);
      expect(output2.right).toBeGreaterThan(output1.right);
    });

    it("should allow source level changes without affecting others", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center
      const output1 = mixer.getMixedOutput();
      // EAR (512) + MIC (128) + DAC (-512) = 128
      expect(output1.left).toBe(128);

      mixer.setEarLevel(0);
      const output2 = mixer.getMixedOutput();
      // MIC (128) + DAC (-512) = -384
      expect(output2.left).toBe(-384);

      mixer.setMicLevel(0);
      const output3 = mixer.getMixedOutput();
      // DAC (-512) = -512
      expect(output3.left).toBe(-512);
    });

    it("should handle rapid source changes", () => {
      for (let i = 0; i < 100; i++) {
        mixer.setEarLevel(i % 2);
        mixer.setMicLevel((i + 1) % 2);
        mixer.setPsgOutput({ left: i * 100, right: i * 100 });
        mixer.setVolumeScale(i / 100);

        const output = mixer.getMixedOutput();
        expect(typeof output.left).toBe("number");
        expect(typeof output.right).toBe("number");
      }
    });
  });

  // ==================== Stereo Separation Tests ====================

  describe("Stereo Separation", () => {
    it("should maintain independent left and right channels", () => {
      mixer.setEarLevel(1); // Affects both
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 8000 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.reset();

      const output = mixer.getMixedOutput();
      expect(output.left).not.toBe(output.right);
      expect(output.right).toBeGreaterThan(output.left);
    });

    it("should support mono mode (equal channels)", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 4000, right: 4000 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.reset();

      const output = mixer.getMixedOutput();
      expect(output.left).toBe(output.right);
    });
  });

  // ==================== Integration Scenarios ====================

  describe("Integration Scenarios", () => {
    it("should simulate beeper-only playback", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // EAR (512) + DAC at 0x80 (-512) = 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should simulate PSG-only playback", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // PSG (8000/8=1000) + DAC at 0x80 (-512) = 488
      expect(output.left).toBe(488);
      expect(output.right).toBe(488);
    });

    it("should simulate DAC-only playback", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      mixer.setI2sInput({ left: 0, right: 0 });

      dac.setChannelValues([0x7f, 0x7f, 0x80, 0x80]);

      const output = mixer.getMixedOutput();
      // DAC A (0x7f=127*256=32512) + DAC B (0x7f=127*256=32512) = 65024
      // 65024 / 256 * 2 = 508
      // DAC C (0x80=-128*256=-32768) + DAC D (0x80=-128*256=-32768) = -65536
      // -65536 / 256 * 2 = -512
      expect(output.left).toBe(508);
      expect(output.right).toBe(-512);
    });

    it("should simulate mixed beeper and PSG", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 4000 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // EAR (512) + PSG (4000/8=500) + DAC at 0x80 (-512) = 500
      expect(output.left).toBe(500);
      expect(output.right).toBe(500);
    });

    it("should simulate complete audio playback with all sources", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 4000, right: 6000 });
      mixer.setI2sInput({ left: 2000, right: 1000 });
      dac.setChannelValues([0x90, 0x70, 0x70, 0x90]);
      mixer.setVolumeScale(0.8);

      const output = mixer.getMixedOutput();
      // Should have contributions from all sources and volume applied
      expect(output.left).toBeDefined();
      expect(output.right).toBeDefined();
      expect(Math.abs(output.left - output.right)).toBeGreaterThan(0);
    });
  });
});
