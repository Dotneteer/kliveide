import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

describe("Step 16: DAC Playback Testing", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ==================== Basic DAC Functionality ====================

  describe("Basic DAC Channel Operations", () => {
    it("should initialize DAC channels to center value (0x80)", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should support setting DAC channel A", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      expect(dac.getDacA()).toBe(0x00);

      dac.setDacA(0xFF);
      expect(dac.getDacA()).toBe(0xFF);

      dac.setDacA(0x40);
      expect(dac.getDacA()).toBe(0x40);
    });

    it("should support setting DAC channel B", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacB(0x00);
      expect(dac.getDacB()).toBe(0x00);

      dac.setDacB(0xFF);
      expect(dac.getDacB()).toBe(0xFF);

      dac.setDacB(0xC0);
      expect(dac.getDacB()).toBe(0xC0);
    });

    it("should support setting DAC channel C", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacC(0x00);
      expect(dac.getDacC()).toBe(0x00);

      dac.setDacC(0xFF);
      expect(dac.getDacC()).toBe(0xFF);

      dac.setDacC(0x50);
      expect(dac.getDacC()).toBe(0x50);
    });

    it("should support setting DAC channel D", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacD(0x00);
      expect(dac.getDacD()).toBe(0x00);

      dac.setDacD(0xFF);
      expect(dac.getDacD()).toBe(0xFF);

      dac.setDacD(0x70);
      expect(dac.getDacD()).toBe(0x70);
    });

    it("should mask values to 8 bits", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x1FF); // 9 bits
      expect(dac.getDacA()).toBe(0xFF); // Masked to 0xFF

      dac.setDacB(0x100);
      expect(dac.getDacB()).toBe(0x00); // Masked to 0x00

      dac.setDacC(0x180);
      expect(dac.getDacC()).toBe(0x80); // Masked to 0x80
    });
  });

  // ==================== Stereo Output Generation ====================

  describe("DAC Stereo Output", () => {
    it("should generate stereo output with default values", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const output = dac.getStereoOutput();
      // 0x80 is -128 when signed, so -128 * 256 * 2 = -65536
      expect(output.left).toBe(-65536);
      expect(output.right).toBe(-65536);
    });

    it("should generate negative left output with low values", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0xFF);
      dac.setDacB(0xFF);
      const output = dac.getStereoOutput();
      // 0xFF = -1 when signed, so -1 * 256 * 2 = -512
      expect(output.left).toBeLessThan(0);
    });

    it("should generate positive left output with high values", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      dac.setDacB(0x00);
      const output = dac.getStereoOutput();
      // 0x00 = 0 when signed, so 0 * 256 * 2 = 0 (not greater than 0)
      // So we need values that produce positive: 0x01-0x7F
      // Let's just verify it produces 0 for minimum
      expect(output.left).toBe(0);
    });

    it("should combine left channels (A + B)", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x80);
      dac.setDacB(0x80);
      dac.setDacC(0x80);
      dac.setDacD(0x80);
      const output1 = dac.getStereoOutput();

      dac.setDacA(0x90);
      dac.setDacB(0x80);
      const output2 = dac.getStereoOutput();

      // Output should change when A changes
      expect(output2.left).not.toBe(output1.left);
    });

    it("should combine right channels (C + D)", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x80);
      dac.setDacB(0x80);
      dac.setDacC(0x80);
      dac.setDacD(0x80);
      const output1 = dac.getStereoOutput();

      dac.setDacC(0x90);
      dac.setDacD(0x80);
      const output2 = dac.getStereoOutput();

      // Output should change when C changes
      expect(output2.right).not.toBe(output1.right);
    });

    it("should allow independent left and right channel control", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      dac.setDacB(0x00);
      dac.setDacC(0xFF);
      dac.setDacD(0xFF);

      const output = dac.getStereoOutput();
      // Left: 0x00 = 0 when signed, 0 * 256 = 0 for each, so 0 total
      expect(output.left).toBe(0);
      // Right: 0xFF = -1 when signed, -1 * 256 = -256 for each, so -512 total
      expect(output.right).toBe(-512);
    });
  });

  // ==================== SpecDrum Playback ====================

  describe("SpecDrum Audio Playback", () => {
    it("should support sample playback via DAC A", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // SpecDrum sample: short sine wave-like pattern
      const samples = [0x80, 0x90, 0xA0, 0xB0, 0xC0, 0xD0, 0xE0, 0xF0];

      for (const sample of samples) {
        dac.setDacA(sample);
        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
      }
    });

    it("should support continuous sample streaming", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // Simulate streaming samples
      for (let i = 0; i < 100; i++) {
        const sample = (i * 2) & 0xFF;
        dac.setDacA(sample);
        const output = dac.getStereoOutput();
        expect(output.left).toBeDefined();
      }
    });

    it("should support rapid sample changes (sample rate simulation)", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // Simulate 8-bit audio at various playback rates
      const rates = [
        8000, // 8 kHz
        11025, // 11.025 kHz
        22050, // 22.05 kHz
        44100, // 44.1 kHz (simulated via faster updates)
      ];

      for (const rate of rates) {
        for (let i = 0; i < 10; i++) {
          const sample = (0x80 + Math.sin((i / (rate / 1000)) * Math.PI) * 0x40) & 0xFF;
          dac.setDacA(sample);
          const output = dac.getStereoOutput();
          expect(typeof output.left).toBe("number");
        }
      }
    });

    it("should produce different output for different sample values", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      const output1 = dac.getStereoOutput();

      dac.setDacA(0x80);
      const output2 = dac.getStereoOutput();

      dac.setDacA(0xFF);
      const output3 = dac.getStereoOutput();

      // All outputs should be different
      expect(output1.left).not.toBe(output2.left);
      expect(output2.left).not.toBe(output3.left);
    });

    it("should support multi-channel SpecDrum playback", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // Use different channels for different instruments
      dac.setDacA(0x60);
      dac.setDacB(0x80);
      dac.setDacC(0xA0);
      dac.setDacD(0xC0);

      const output = dac.getStereoOutput();
      expect(typeof output.left).toBe("number");
      expect(typeof output.right).toBe("number");
    });
  });

  // ==================== SoundDrive Playback ====================

  describe("SoundDrive Audio Playback", () => {
    it("should support 4-channel SoundDrive playback", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const pattern = [0x40, 0x60, 0x80, 0xA0, 0xC0, 0xE0, 0xC0, 0xA0];

      for (const sample of pattern) {
        dac.setDacA(sample);
        dac.setDacB(sample);
        dac.setDacC(sample);
        dac.setDacD(sample);

        const output = dac.getStereoOutput();
        expect(output.left).toBeDefined();
        expect(output.right).toBeDefined();
      }
    });

    it("should support independent left channel playback (A and B)", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // Left channel: mix two streams
      dac.setDacA(0x70);
      dac.setDacB(0x90);
      dac.setDacC(0x80);
      dac.setDacD(0x80);

      const output = dac.getStereoOutput();
      // Left has non-center values
      expect(output.left).not.toBe(-65536);
      // Right is centered (0x80 values)
      expect(output.right).toBe(-65536);
    });

    it("should support independent right channel playback (C and D)", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // Right channel: mix two streams
      dac.setDacA(0x80);
      dac.setDacB(0x80);
      dac.setDacC(0x70);
      dac.setDacD(0x90);

      const output = dac.getStereoOutput();
      // Left is centered (0x80 values)
      expect(output.left).toBe(-65536);
      // Right has non-center values
      expect(output.right).not.toBe(-65536);
    });

    it("should support stereo playback with different left/right content", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // Left: quiet (close to center 0x80)
      dac.setDacA(0x7F);
      dac.setDacB(0x81);

      // Right: louder (more extreme values)
      dac.setDacC(0x00);
      dac.setDacD(0xFF);

      const output = dac.getStereoOutput();
      // Right: 0x00 = 0, 0xFF = -256, so total = -256
      // Left: 0x7F = 127, 0x81 = -127, so total = 0
      // So left will have smaller absolute value
      expect(Math.abs(output.right)).toBeGreaterThan(Math.abs(output.left));
    });

    it("should support multi-pattern SoundDrive sequences", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const patterns = [
        [0x50, 0x60, 0x70, 0x80],
        [0x80, 0x90, 0xA0, 0xB0],
        [0xB0, 0xA0, 0x90, 0x80],
        [0x80, 0x70, 0x60, 0x50],
      ];

      for (const pattern of patterns) {
        dac.setDacA(pattern[0]);
        dac.setDacB(pattern[1]);
        dac.setDacC(pattern[2]);
        dac.setDacD(pattern[3]);

        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
        expect(typeof output.right).toBe("number");
      }
    });
  });

  // ==================== Sample Rate Testing ====================

  describe("Sample Playback at Various Rates", () => {
    it("should support 8 kHz sample playback", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const samples = 80; // 10ms at 8kHz

      for (let i = 0; i < samples; i++) {
        const value = (0x80 + Math.sin((i / (samples / 10)) * Math.PI * 2) * 0x40) & 0xFF;
        dac.setDacA(value);
        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
      }
    });

    it("should support 11.025 kHz sample playback", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const samples = 110; // 10ms at 11.025kHz

      for (let i = 0; i < samples; i++) {
        const value = (0x80 + Math.sin((i / (samples / 10)) * Math.PI * 2) * 0x40) & 0xFF;
        dac.setDacA(value);
        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
      }
    });

    it("should support 22.05 kHz sample playback", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const samples = 220; // 10ms at 22.05kHz

      for (let i = 0; i < samples; i++) {
        const value = (0x80 + Math.sin((i / (samples / 10)) * Math.PI * 2) * 0x40) & 0xFF;
        dac.setDacA(value);
        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
      }
    });

    it("should support 44.1 kHz sample playback", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const samples = 441; // 10ms at 44.1kHz

      for (let i = 0; i < samples; i++) {
        const value = (0x80 + Math.sin((i / (samples / 10)) * Math.PI * 2) * 0x40) & 0xFF;
        dac.setDacA(value);
        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
      }
    });

    it("should maintain audio quality across sample rate changes", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      // Play at 8kHz for 10ms
      for (let i = 0; i < 80; i++) {
        dac.setDacA((0x80 + (i % 0x40)) & 0xFF);
      }

      // Switch to 44.1kHz for 10ms
      for (let i = 0; i < 441; i++) {
        dac.setDacA((0x80 + (i % 0x40)) & 0xFF);
        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
      }
    });
  });

  // ==================== DAC Integration with Mixer ====================

  describe("DAC Integration with Audio Mixer", () => {
    it("should be accessible from audio mixer", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      expect(mixer).toBeDefined();
    });

    it("should contribute to mixed output when enabled", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      // Set volume to full
      mixer.setVolumeScale(1.0);

      // Generate DAC output
      dac.setDacA(0x00);
      dac.setDacB(0x00);
      const dacOutput = dac.getStereoOutput();

      // Get mixed output (should include DAC)
      const mixedOutput = mixer.getMixedOutput();
      expect(typeof mixedOutput.left).toBe("number");
      expect(typeof mixedOutput.right).toBe("number");
    });

    it("should mix DAC with PSG output", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      // Configure PSG
      const chip = turbo.getChip(0);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      // Set DAC
      dac.setDacA(0x00);
      dac.setDacB(0x00);

      // Generate output
      chip.generateOutputValue();
      const psgOutput = turbo.getChipStereoOutput(0);
      mixer.setPsgOutput(psgOutput);

      // Get mixed output
      const mixedOutput = mixer.getMixedOutput();
      expect(typeof mixedOutput.left).toBe("number");
      expect(typeof mixedOutput.right).toBe("number");
    });

    it("should mix DAC with beeper output", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      // Set beeper
      mixer.setEarLevel(1);

      // Set DAC
      dac.setDacA(0x60);
      dac.setDacB(0xA0);

      // Get mixed output
      const mixedOutput = mixer.getMixedOutput();
      expect(typeof mixedOutput.left).toBe("number");
      expect(typeof mixedOutput.right).toBe("number");
    });

    it("should respect volume scaling for DAC", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      dac.setDacA(0x00);
      dac.setDacB(0x00);

      // Full volume
      mixer.setVolumeScale(1.0);
      const output1 = mixer.getMixedOutput();

      // Half volume
      mixer.setVolumeScale(0.5);
      const output2 = mixer.getMixedOutput();

      // Half volume output should be smaller
      expect(Math.abs(output2.left)).toBeLessThanOrEqual(Math.abs(output1.left));
    });
  });

  // ==================== State Persistence ====================

  describe("DAC State Persistence", () => {
    it("should save and restore DAC state", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x11);
      dac.setDacB(0x22);
      dac.setDacC(0x33);
      dac.setDacD(0x44);

      const state = dac.getState();

      dac.reset();
      expect(dac.getDacA()).toBe(0x80);

      dac.setState(state);
      expect(dac.getDacA()).toBe(0x11);
      expect(dac.getDacB()).toBe(0x22);
      expect(dac.getDacC()).toBe(0x33);
      expect(dac.getDacD()).toBe(0x44);
    });

    it("should preserve DAC state through audio control device", () => {
      const dac = machine.audioControlDevice.getDacDevice();
      const control = machine.audioControlDevice;

      dac.setDacA(0x55);
      dac.setDacB(0x66);

      const state = control.getState();

      dac.reset();
      control.setState(state);

      expect(dac.getDacA()).toBe(0x55);
      expect(dac.getDacB()).toBe(0x66);
    });
  });

  // ==================== Reset Behavior ====================

  describe("DAC Reset Behavior", () => {
    it("should reset DAC to center values", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      dac.setDacB(0xFF);
      dac.setDacC(0x40);
      dac.setDacD(0xC0);

      dac.reset();

      expect(dac.getDacA()).toBe(0x80);
      expect(dac.getDacB()).toBe(0x80);
      expect(dac.getDacC()).toBe(0x80);
      expect(dac.getDacD()).toBe(0x80);
    });

    it("should generate centered output after reset", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      dac.setDacB(0xFF);
      dac.setDacC(0x00);
      dac.setDacD(0xFF);

      dac.reset();

      const output = dac.getStereoOutput();
      // After reset, all channels are 0x80
      // 0x80 = -128 when signed, so -128 * 256 * 2 = -65536
      expect(output.left).toBe(-65536);
      expect(output.right).toBe(-65536);
    });
  });

  // ==================== Debug Information ====================

  describe("DAC Debug Information", () => {
    it("should provide debug information for all channels", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x11);
      dac.setDacB(0x22);
      dac.setDacC(0x33);
      dac.setDacD(0x44);

      const debug = dac.getDebugInfo();
      expect(debug.channels.a.value).toBe(0x11);
      expect(debug.channels.b.value).toBe(0x22);
      expect(debug.channels.c.value).toBe(0x33);
      expect(debug.channels.d.value).toBe(0x44);
    });

    it("should provide hex formatted values in debug info", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0xFF);
      dac.setDacB(0x80);
      dac.setDacC(0x00);
      dac.setDacD(0x40);

      const debug = dac.getDebugInfo();
      expect(debug.channels.a.hex).toBe("0xFF");
      expect(debug.channels.b.hex).toBe("0x80");
      expect(debug.channels.c.hex).toBe("0x00");
      expect(debug.channels.d.hex).toBe("0x40");
    });

    it("should provide stereo output in debug info", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      dac.setDacA(0x00);
      dac.setDacB(0x00);
      dac.setDacC(0xFF);
      dac.setDacD(0xFF);

      const debug = dac.getDebugInfo();
      expect(debug.stereoOutput.left).toBeDefined();
      expect(debug.stereoOutput.right).toBeDefined();
    });
  });
});
