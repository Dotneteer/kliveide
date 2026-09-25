import { describe, expect, it } from "vitest";

import { createZ88Session, type Z88TestSession } from "../harness/z88";

/*
 * The Cambridge Z88 beeper, as the app's audio pipeline receives it: the machine's samples of the
 * last frame. The ear bit is COM.SBIT (port $B0 bit 6) with the 3200 Hz oscillator (SRUN) off.
 */

/** COM = RAMS | LCDON, plus SBIT when the ear bit is set */
const COM_EAR_OFF = 0x05;
const COM_EAR_ON = 0x45;

async function beeperSession(): Promise<Z88TestSession> {
  const s = await createZ88Session({ audioSampleRate: 44_100 });
  await s.loadCode(`
      .org $8000
spin: jr spin
  `);
  return s;
}

describe("Audio Integration Tests", () => {
  describe("Cambridge Z88 beeper", () => {
    it("should collect audio samples with correct type", async () => {
      const s = await beeperSession();
      s.out(0xb0, COM_EAR_ON);
      s.runFrames(1);

      const samples = s.machine.getAudioSamples();
      expect(samples.length).toBeGreaterThan(0);

      for (const sample of samples) {
        expect(sample).toHaveProperty("left");
        expect(sample).toHaveProperty("right");
        expect(typeof sample.left).toBe("number");
        expect(typeof sample.right).toBe("number");
      }
    });

    it("should generate samples when EAR bit changes", async () => {
      const s = await beeperSession();
      s.out(0xb0, COM_EAR_OFF);
      s.runFrames(1);
      // --- The machine reuses its sample objects frame by frame: keep the values
      const samplesOff = s.machine.getAudioSamples().map(({ left, right }) => ({ left, right }));

      s.out(0xb0, COM_EAR_ON);
      s.runFrames(1);
      const samplesOn = s.machine.getAudioSamples().map(({ left, right }) => ({ left, right }));

      expect(samplesOff.length).toBeGreaterThan(0);
      expect(samplesOn.length).toBeGreaterThan(0);
      // --- A frame is 5 ms: 220.5 samples at 44.1 kHz
      expect(samplesOff.length + samplesOn.length).toBeGreaterThanOrEqual(440);
      expect(samplesOff.every((sample) => sample.left === 0)).toBe(true);
      expect(samplesOn.some((sample) => sample.left !== 0)).toBe(true);
    });
  });
});
