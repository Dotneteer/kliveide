import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import type { TestZxNextMachine } from "../zxnext/TestNextMachine";

/**
 * Step 20: Real-time performance validation.
 *
 * Split out of FinalIntegration.step20.test.ts: these three tests measure elapsed
 * time against a fixed budget, so they fail on a loaded machine while the 33
 * functional tests they used to sit next to do not. Keeping them in a
 * `.perf.test.ts` file leaves `npm test` free of wall-clock assertions and runs
 * them under `npm run test:perf` instead.
 */
describe("Step 20: Final Audio Integration Testing", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
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
});
