import { describe, expect, it } from "vitest";

import { createZ88Session, Z88_HARNESS_BACKENDS, type Z88Sample } from "../harness/z88";

/*
 * The Z88 beeper, driven by the Blink's COM register.
 *
 * Hardware (Blink documentation): with COM.SRUN set the speaker plays the Blink's 3200 Hz tone
 * unless COM.SBIT is set, which silences it; with SRUN clear, SBIT drives the speaker directly.
 *
 * The machine's samples go through a DC high-pass filter, so a level change shows as a jump of
 * about 1.0 between consecutive samples; a steady level decays towards 0. The tests count jumps.
 *
 * Step 0.3 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */

const COM_RAMS = 0x04;
const COM_SBIT = 0x40;
const COM_SRUN = 0x80;
const SAMPLE_RATE = 48_000;

/** The number of level changes (jumps larger than 0.5) in the left channel */
function levelChanges(samples: Z88Sample[]): number {
  let changes = 0;
  for (let i = 1; i < samples.length; i++) {
    if (Math.abs(samples[i].left - samples[i - 1].left) > 0.5) changes++;
  }
  return changes;
}

describe.each(Z88_HARNESS_BACKENDS)("Z88 beeper (%s)", (backend) => {
  async function spinning() {
    const s = await createZ88Session({ backend, audioSampleRate: SAMPLE_RATE });
    await s.loadCode(`
      .org $8000
spin: jr spin
    `);
    return s;
  }

  it("produces one sample per 1/48000 s: 100 samples per 5 ms frame", async () => {
    const s = await spinning();
    s.runFrames(1).startAudio().runFrames(10);
    expect(s.audio().length).toBeGreaterThanOrEqual(2398);
    expect(s.audio().length).toBeLessThanOrEqual(2402);
    for (const sample of s.audio()) expect(sample.left).toBe(sample.right);
  });

  it("SRUN and SBIT set: silence", async () => {
    const s = await spinning();
    s.out(0xb0, COM_RAMS | COM_SRUN | COM_SBIT);
    s.startAudio().runFrames(10);
    expect(s.audio().every((x) => x.left === 0)).toBe(true);
  });

  it("SRUN set, SBIT clear: the 3200 Hz tone (6400 level changes per second)", async () => {
    const s = await spinning();
    s.out(0xb0, COM_RAMS | COM_SRUN);
    s.startAudio().runFrames(20);
    // --- 20 frames = 100 ms = 640 half periods of 512 tacts
    const changes = levelChanges(s.audio());
    expect(changes).toBeGreaterThanOrEqual(638);
    expect(changes).toBeLessThanOrEqual(642);
    expect(s.blinkState().COM & COM_SRUN).toBe(COM_SRUN);
  });

  it("SRUN clear: SBIT drives the speaker directly", async () => {
    const s = await spinning();
    // --- One frame at the resting level first, so the first change has a sample before it
    s.startAudio().runFrames(1);
    for (let i = 0; i < 6; i++) {
      s.out(0xb0, COM_RAMS | (i % 2 === 0 ? COM_SBIT : 0));
      s.runFrames(2);
    }
    expect(levelChanges(s.audio())).toBe(6);
    expect(s.blinkState().earBit).toBe(false);
  });

  it("SBIT with SRUN clear sets the ear bit the Blink panel shows", async () => {
    const s = await spinning();
    s.out(0xb0, COM_RAMS | COM_SBIT);
    expect(s.blinkState().earBit).toBe(true);
    // --- With SRUN set, SBIT no longer drives the ear bit
    s.out(0xb0, COM_RAMS | COM_SRUN);
    expect(s.blinkState().earBit).toBe(true);
  });

  it("the oscillator bit follows the 3200 Hz tone: it flips every 512 tacts", async () => {
    const s = await spinning();
    const seen = new Set<boolean>();
    for (let i = 0; i < 40; i++) {
      s.step(20);
      seen.add(s.blinkState().oscBit);
    }
    expect([...seen].sort()).toEqual([false, true]);
    const expected = Math.floor(s.tacts / 512) % 2 === 1;
    expect(s.blinkState().oscBit).toBe(expected);
  });
});
