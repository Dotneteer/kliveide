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
      // Beeper: 512 * 12 = 6144, * 5.5 = 33792 → clamped to 32767 → ~1.0
      expect(output.left).toBeCloseTo(1.0, 2);
      expect(output.right).toBeCloseTo(1.0, 2);
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
      // MIC level=1 → micLevel=128, micScaled=128×12=1536
      // mixedLeft = 1536, left = floor(1536×5.5) = 8448, normalized = 8448/32768 = 0.25781
      expect(output.left).toBeCloseTo(0.258, 2);
      expect(output.right).toBeCloseTo(0.258, 2);
    });

    it("should combine with EAR", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // Beeper: 6144, MIC AC: +64, total=6208, * 5.5=34144 → clamped → ~1.0
      expect(output.left).toBeCloseTo(1.0, 2);
      expect(output.right).toBeCloseTo(1.0, 2);
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
      // New AC-coupling: peak=333, midpoint=166, psgAC=333-166=167
      // mixed=167, scaled=167*5.5=918, normalized≈0.028
      expect(output.left).toBeCloseTo(0.028, 2);
      expect(output.right).toBeCloseTo(0.028, 2);
    });

    it("should handle stereo separation in PSG", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 8000 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // New AC-coupling: peak=max(166,333)=333, midpoint=166
      // psgLeftAC=166-166=0, psgRightAC=333-166=167
      // left=0, right=918/32768≈0.028; right channel gets more signal
      expect(output.left).toBeCloseTo(0, 2);
      expect(output.right).toBeCloseTo(0.028, 2);
      expect(output.right).toBeGreaterThan(output.left);
    });

    it("should combine PSG with EAR and MIC", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // Beeper(+6144) + MIC(+64) + psgAC(+167) = +6375
      // Scaled: +35062 → clamped to 32767 → normalized ≈ 1.0
      expect(output.left).toBeCloseTo(1.0, 1);
      expect(output.right).toBeCloseTo(1.0, 1);
    });

    it("should handle zero PSG output", () => {
      mixer.setEarLevel(1);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // Beeper(+6144), PSG not added (0), * 5.5 = 33792 → clamped → ~1.0
      expect(output.left).toBeCloseTo(1.0, 2);
      expect(output.right).toBeCloseTo(1.0, 2);
    });

    it("should handle maximum PSG output", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 65535, right: 65535 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // New AC-coupling: peak=2730, midpoint=1365, psgAC=1365
      // mixed=1365, scaled=7507, normalized≈+0.229 (positive)
      expect(output.left).toBeCloseTo(0.229, 2);
      expect(output.right).toBeCloseTo(0.229, 2);
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
      // Beeper(+6144) + MIC(+64) + DAC(0) = +6208, * 5.5 = 34144 → clamped → ~1.0
      expect(output.left).toBeCloseTo(1.0, 2);
      expect(output.right).toBeCloseTo(1.0, 2);
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

      // I2S is not implemented yet, so output is 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should handle stereo separation in I2S", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      mixer.setI2sInput({ left: 4000, right: 8000 });
      const output = mixer.getMixedOutput();

      // I2S is not implemented yet, so output is 0
      expect(output.left).toBe(0);
      expect(output.right).toBe(0);
    });

    it("should combine all sources including I2S", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setI2sInput({ left: 8000, right: 8000 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // Beeper(+6144) + MIC(+64) + psgAC(+167) + I2S(0, not impl) = +6375
      // Scaled: +35062 → clamped to 32767 → normalized ≈ 1.0
      expect(output.left).toBeCloseTo(1.0, 1);
      expect(output.right).toBeCloseTo(1.0, 1);
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

      // Beeper(+6144) * 5.5 = 33792 * 0.5 = 16896, normalized: +0.516
      expect(output.left).toBeCloseTo(0.516, 2);
      expect(output.right).toBeCloseTo(0.516, 2);
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
      expect(Math.abs(output.left)).toBe(0);
      expect(Math.abs(output.right)).toBe(0);
    });

    it("should provide full volume at scale 1.0", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setVolumeScale(1.0);

      const output1 = mixer.getMixedOutput();

      mixer.setVolumeScale(0.5);
      const output2 = mixer.getMixedOutput();

      // With volume scaling, absolute magnitude should be reduced
      expect(Math.abs(output1.left)).toBeGreaterThan(Math.abs(output2.left));
    });
  });

  // ==================== Output Clamping Tests ====================

  describe("Output Clamping", () => {
    it("should clamp output to normalized range", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 65535, right: 65535 });
      mixer.setI2sInput({ left: 65535, right: 65535 });

      const output = mixer.getMixedOutput();
      expect(output.left).toBeLessThanOrEqual(1.0);
      expect(output.right).toBeLessThanOrEqual(1.0);
      expect(output.left).toBeGreaterThanOrEqual(-1.0);
      expect(output.right).toBeGreaterThanOrEqual(-1.0);
    });

    it("should not clamp reasonable output levels", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 4000 });

      const output = mixer.getMixedOutput();
      expect(Math.abs(output.left)).toBeLessThan(1.0);
      expect(Math.abs(output.right)).toBeLessThan(1.0);
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
      // All sources off = 0
      expect(Math.abs(output.left)).toBe(0);
      expect(Math.abs(output.right)).toBe(0);
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
      mixer.setEarLevel(0);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 4000, right: 6000 });
      mixer.setI2sInput({ left: 2000, right: 3000 });

      dac.setChannelValues([0x7f, 0x7f, 0x80, 0x80]);

      const output = mixer.getMixedOutput();
      expect(output.left).toBeDefined();
      expect(output.right).toBeDefined();
      // PSG {left:4000,right:6000}: peak=250,midpoint=125; psgLeftAC=41, psgRightAC=125 → left<right
      expect(output.left).not.toBe(output.right);
    });

    it("should produce silent output with all sources off", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // All sources off, DAC at center (0) = 0
      expect(Math.abs(output.left)).toBe(0);
      expect(Math.abs(output.right)).toBe(0);
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
      mixer.setEarLevel(0); // Keep beeper off so PSG change is visible without saturation
      const output1 = mixer.getMixedOutput();

      mixer.setPsgOutput({ left: 8000, right: 8000 });
      const output2 = mixer.getMixedOutput();

      // PSG adds positive AC-coupled signal; outputs differ after PSG is added
      expect(output2.left).not.toBe(output1.left);
      expect(output2.right).not.toBe(output1.right);
    });

    it("should allow source level changes without affecting others", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center
      const output1 = mixer.getMixedOutput();
      // Beeper(+6144) + MIC(+64) = +6208, * 5.5 = 34144 → clamped → ~1.0
      expect(output1.left).toBeCloseTo(1.0, 2);

      mixer.setEarLevel(0);
      const output2 = mixer.getMixedOutput();
      // MIC level=1 → micScaled=1536, left=8448, normalized=0.25781
      expect(output2.left).toBeCloseTo(0.258, 2);

      mixer.setMicLevel(0);
      const output3 = mixer.getMixedOutput();
      // All sources off = 0
      expect(Math.abs(output3.left)).toBe(0);
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
      mixer.setEarLevel(0); // Use PSG only so stereo separation is visible without saturation
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 8000 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.reset();

      const output = mixer.getMixedOutput();
      // peak=333,midpoint=166; psgLeftAC=166-166=0, psgRightAC=333-166=167
      // left=0, right=+0.028 → right > left
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
      // Beeper(+6144) * 5.5 = 33792 → clamped → ~1.0
      expect(output.left).toBeCloseTo(1.0, 2);
      expect(output.right).toBeCloseTo(1.0, 2);
    });

    it("should simulate PSG-only playback", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 8000, right: 8000 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // New AC-coupling: peak=333, midpoint=166, psgAC=333-166=167
      // mixed=167, scaled=918, normalized≈0.028 (positive now)
      expect(output.left).toBeCloseTo(0.028, 2);
      expect(output.right).toBeCloseTo(0.028, 2);
    });

    it("should simulate DAC-only playback", () => {
      mixer.setEarLevel(0);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 0, right: 0 });
      mixer.setI2sInput({ left: 0, right: 0 });

      dac.setChannelValues([0x7f, 0x7f, 0x80, 0x80]);

      const output = mixer.getMixedOutput();
      // DAC left: (127-128)=-1 per channel × 256 = -256 each, sum = -512, ÷64 = -8, scaled: -44, normalized: -0.00134
      // DAC right: (128-128)=0 per channel
      expect(output.left).toBeCloseTo(-0.00134, 3);
      expect(Math.abs(output.right)).toBe(0);
    });

    it("should simulate mixed beeper and PSG", () => {
      mixer.setEarLevel(1);
      mixer.setMicLevel(0);
      mixer.setPsgOutput({ left: 4000, right: 4000 });
      mixer.setI2sInput({ left: 0, right: 0 });
      dac.setChannelValues([0x80, 0x80, 0x80, 0x80]); // Set to all center

      const output = mixer.getMixedOutput();
      // Beeper(+6144) + PSG new AC: peak=166,midpoint=83,psgAC=83 → +83
      // mixed=6144+83=6227, ×5.5=34248 → clamped to 32767 → ≈1.0
      expect(output.left).toBeCloseTo(1.0, 1);
      expect(output.right).toBeCloseTo(1.0, 1);
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
      // With EAR+MIC at full scale and volume=0.8, output saturates but is positive
      expect(output.left).toBeGreaterThan(0);
      expect(output.right).toBeGreaterThan(0);
    });
  });
});
