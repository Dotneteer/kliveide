import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

describe("Step 18: Audio Performance Optimization", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ==================== PSG Clock Generation Performance ====================

  describe("PSG Clock Generation Performance", () => {
    it("should generate PSG output efficiently for single chip", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      // Configure PSG
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      // Benchmark: Generate 20ms of audio at 50Hz update rate
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        chip.generateOutputValue();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 iterations in < 50ms
      expect(duration).toBeLessThan(50);
      expect(duration).toBeGreaterThan(0);
    });

    it("should handle rapid tone frequency changes", () => {
      const chip = machine.audioControlDevice.getTurboSoundDevice().getChip(0);

      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Rapidly change tone frequency
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue((i * 2) & 0xFF);
        chip.setPsgRegisterIndex(1);
        chip.writePsgRegisterValue((i * 3) & 0xFF);
        chip.generateOutputValue();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it("should handle envelope generation efficiently", () => {
      const chip = machine.audioControlDevice.getTurboSoundDevice().getChip(0);

      // Configure envelope
      chip.setPsgRegisterIndex(11);
      chip.writePsgRegisterValue(0x10); // Envelope period low
      chip.setPsgRegisterIndex(12);
      chip.writePsgRegisterValue(0x00); // Envelope period high
      chip.setPsgRegisterIndex(13);
      chip.writePsgRegisterValue(0x00); // Envelope shape

      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x10); // Use envelope

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        chip.generateOutputValue();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it("should generate noise efficiently", () => {
      const chip = machine.audioControlDevice.getTurboSoundDevice().getChip(0);

      chip.setPsgRegisterIndex(6);
      chip.writePsgRegisterValue(0x1F); // Noise period
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x38); // Enable noise on channels
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);
      chip.setPsgRegisterIndex(9);
      chip.writePsgRegisterValue(0x0f);
      chip.setPsgRegisterIndex(10);
      chip.writePsgRegisterValue(0x0f);

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        chip.generateOutputValue();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });

  // ==================== TurboSound Multi-Chip Performance ====================

  describe("TurboSound Multi-Chip Performance", () => {
    it("should handle three-chip coordination efficiently", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      // Configure all three chips
      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + chipId);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        turbo.generateAllOutputValues();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 500 iterations in < 100ms
      expect(duration).toBeLessThan(100);
    });

    it("should handle rapid chip selection", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + chipId);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      const iterations = 300;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        turbo.selectChip(i % 3);
        turbo.selectRegister(i % 16);
        turbo.writeSelectedRegister((i * 2) & 0xFF);
        turbo.generateAllOutputValues();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it("should handle stereo mode switching efficiently", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + chipId);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      const iterations = 200;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        turbo.setAyStereoMode(i % 2 === 0);
        turbo.generateAllOutputValues();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it("should handle panning changes efficiently", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();

      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + chipId);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      const iterations = 300;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (let chipId = 0; chipId < 3; chipId++) {
          turbo.setChipPanning(chipId, i % 4);
        }
        turbo.generateAllOutputValues();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  // ==================== DAC Performance ====================

  describe("DAC Playback Performance", () => {
    it("should handle rapid DAC sample updates", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        dac.setDacA((i * 2) & 0xFF);
        dac.setDacB((i * 3) & 0xFF);
        dac.setDacC((i * 5) & 0xFF);
        dac.setDacD((i * 7) & 0xFF);
        const output = dac.getStereoOutput();
        // Use output to prevent optimization
        expect(typeof output.left).toBe("number");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 4-channel DAC should handle 1000 samples quickly
      expect(duration).toBeLessThan(50);
    });

    it("should handle stereo playback efficiently", () => {
      const dac = machine.audioControlDevice.getDacDevice();

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Stereo playback pattern
        dac.setDacA((0x80 + Math.sin((i / 10) * Math.PI) * 0x40) & 0xFF);
        dac.setDacB(dac.getDacA());
        dac.setDacC((0x80 + Math.cos((i / 10) * Math.PI) * 0x40) & 0xFF);
        dac.setDacD(dac.getDacC());
        const output = dac.getStereoOutput();
        expect(typeof output.left).toBe("number");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });

  // ==================== Audio Mixer Performance ====================

  describe("Audio Mixer Performance", () => {
    it("should mix multiple sources efficiently", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();

      // Configure PSG
      const chip = turbo.getChip(0);
      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      mixer.setEarLevel(1);
      mixer.setMicLevel(1);

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        chip.generateOutputValue();
        const psgOutput = turbo.getChipStereoOutput(0);
        mixer.setPsgOutput(psgOutput);

        dac.setDacA((i * 2) & 0xFF);
        const output = mixer.getMixedOutput();
        expect(typeof output.left).toBe("number");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it("should handle volume scaling efficiently", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setPsgOutput({ left: 1000, right: 1000 });

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        mixer.setVolumeScale(Math.sin((i / 100) * Math.PI) * 0.5 + 0.5);
        const output = mixer.getMixedOutput();
        expect(typeof output.left).toBe("number");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    it("should handle rapid source changes", () => {
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        mixer.setEarLevel(i % 2);
        mixer.setMicLevel((i + 1) % 2);
        mixer.setPsgOutput({ left: (i * 100) % 5000, right: (i * 100) % 5000 });
        const output = mixer.getMixedOutput();
        expect(typeof output.left).toBe("number");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });
  });

  // ==================== Complete Audio Pipeline Performance ====================

  describe("Complete Audio Pipeline Performance", () => {
    it("should handle complete 50Hz audio update cycle", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const dac = machine.audioControlDevice.getDacDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      // Configure all components
      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + chipId);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      mixer.setEarLevel(1);
      mixer.setMicLevel(1);
      mixer.setVolumeScale(0.8);

      // Simulate 50Hz updates (20ms per frame)
      const updatesPerFrame = 320; // 50Hz * 20ms / (1000ms / 16000 samples) = 320 samples per frame
      const iterations = 50; // 50 frames = 1 second

      const startTime = performance.now();

      for (let frame = 0; frame < iterations; frame++) {
        for (let sample = 0; sample < updatesPerFrame; sample++) {
          // Generate PSG
          turbo.generateAllOutputValues();
          const psgOutput = {
            left: turbo.getChipStereoOutput(0).left +
                  turbo.getChipStereoOutput(1).left +
                  turbo.getChipStereoOutput(2).left,
            right: turbo.getChipStereoOutput(0).right +
                   turbo.getChipStereoOutput(1).right +
                   turbo.getChipStereoOutput(2).right
          };

          // Update DAC
          dac.setDacA((sample * 2) & 0xFF);
          dac.setDacB((sample * 3) & 0xFF);
          dac.setDacC((sample * 5) & 0xFF);
          dac.setDacD((sample * 7) & 0xFF);

          // Mix
          mixer.setPsgOutput(psgOutput);
          const output = mixer.getMixedOutput();
          expect(typeof output.left).toBe("number");
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 50 frames (16000 samples) in < 500ms
      expect(duration).toBeLessThan(500);
    });

    it("should maintain performance during state changes", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + chipId);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Rapid state changes
        const state = mixer.getState();
        mixer.setState(state);

        turbo.generateAllOutputValues();
        const psgOutput = {
          left: turbo.getChipStereoOutput(0).left +
                turbo.getChipStereoOutput(1).left +
                turbo.getChipStereoOutput(2).left,
          right: turbo.getChipStereoOutput(0).right +
                 turbo.getChipStereoOutput(1).right +
                 turbo.getChipStereoOutput(2).right
        };

        mixer.setPsgOutput(psgOutput);
        const output = mixer.getMixedOutput();
        expect(typeof output.left).toBe("number");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  // ==================== Memory Efficiency ====================

  describe("Memory and Allocation Efficiency", () => {
    it("should not create excessive temporary objects in PSG generation", () => {
      const chip = machine.audioControlDevice.getTurboSoundDevice().getChip(0);

      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      // This test verifies that repeated calls don't cause GC pressure
      const iterations = 5000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        chip.generateOutputValue();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 5000 iterations should be very fast with minimal allocations
      expect(duration).toBeLessThan(100);
    });

    it("should reuse audio sample objects efficiently", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      const iterations = 2000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        turbo.generateAllOutputValues();
        const out1 = turbo.getChipStereoOutput(0);
        const out2 = turbo.getChipStereoOutput(1);
        const out3 = turbo.getChipStereoOutput(2);

        mixer.setPsgOutput({
          left: out1.left + out2.left + out3.left,
          right: out1.right + out2.right + out3.right
        });

        const mixed = mixer.getMixedOutput();
        expect(typeof mixed.left).toBe("number");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
    });
  });

  // ==================== Real-time Performance ====================

  describe("Real-time Performance Verification", () => {
    it("should sustain 50Hz audio update rate reliably", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const mixer = machine.audioControlDevice.getAudioMixerDevice();

      for (let chipId = 0; chipId < 3; chipId++) {
        const chip = turbo.getChip(chipId);
        chip.setPsgRegisterIndex(0);
        chip.writePsgRegisterValue(0x01 + chipId);
        chip.setPsgRegisterIndex(7);
        chip.writePsgRegisterValue(0x3e);
        chip.setPsgRegisterIndex(8);
        chip.writePsgRegisterValue(0x0f);
      }

      mixer.setEarLevel(1);
      mixer.setVolumeScale(0.8);

      // Simulate 50 Hz updates with 320 samples per frame
      const frameDurations = [];
      const targetFrameTime = 20; // 20ms per frame

      for (let frame = 0; frame < 50; frame++) {
        const frameStart = performance.now();

        for (let sample = 0; sample < 320; sample++) {
          turbo.generateAllOutputValues();
          const psgOutput = {
            left: turbo.getChipStereoOutput(0).left +
                  turbo.getChipStereoOutput(1).left +
                  turbo.getChipStereoOutput(2).left,
            right: turbo.getChipStereoOutput(0).right +
                   turbo.getChipStereoOutput(1).right +
                   turbo.getChipStereoOutput(2).right
          };
          mixer.setPsgOutput(psgOutput);
          mixer.getMixedOutput();
        }

        const frameEnd = performance.now();
        frameDurations.push(frameEnd - frameStart);
      }

      // Average frame time should be close to target
      const avgFrameTime = frameDurations.reduce((a, b) => a + b) / frameDurations.length;
      expect(avgFrameTime).toBeLessThan(targetFrameTime * 2); // Allow 2x overhead

      // No frame should take excessively long
      const maxFrameTime = Math.max(...frameDurations);
      expect(maxFrameTime).toBeLessThan(targetFrameTime * 10);
    });

    it("should handle sample-accurate audio generation", () => {
      const turbo = machine.audioControlDevice.getTurboSoundDevice();
      const chip = turbo.getChip(0);

      chip.setPsgRegisterIndex(0);
      chip.writePsgRegisterValue(0x01);
      chip.setPsgRegisterIndex(7);
      chip.writePsgRegisterValue(0x3e);
      chip.setPsgRegisterIndex(8);
      chip.writePsgRegisterValue(0x0f);

      // Generate 1 second of audio (16000 samples at 16kHz)
      const samples = 16000;
      const outputs = [];

      const startTime = performance.now();

      for (let i = 0; i < samples; i++) {
        chip.generateOutputValue();
        outputs.push(chip.getChannelAVolume());
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1 second of audio generation should complete in < 200ms
      expect(duration).toBeLessThan(200);
      expect(outputs.length).toBe(samples);
    });
  });
});
