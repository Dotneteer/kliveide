import { describe, expect, it } from "vitest";

import { createBareSam } from "./bare";
import { createSamSession } from "../harness/samcoupe";
import type { SamTestSession } from "../harness/samcoupe";
import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import { samSaaFrequency } from "@emu/machines/samcoupe/SamDebugState";

/*
 * The SAA 1099 and the beeper (plan §8; SOUND_INPUT_IO.md §1-§2): pitch from octave and offset, through to
 * the host's samples; sound enable; sync; the noise LFSR; the envelopes on channels 2 and 5; the beeper.
 */

const RATE = 48_000;

function saa(s: SamTestSession, reg: number, value: number): void {
  s.out(0x01ff, reg);
  s.out(0x00ff, value);
}

async function soundMachine(): Promise<SamTestSession> {
  const s = await createBareSam();
  s.poke(0x0000, [0x18, 0xfe]);
  s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, RATE);
  return s;
}

/** The left side's samples over `frames` frames */
function samples(s: SamTestSession, frames: number, side: 0 | 1 = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < frames; i++) {
    s.runFrames(1);
    for (const sample of s.machine.getAudioSamples()) out.push(side ? sample.right : sample.left);
  }
  return out;
}

/** Rising zero crossings per second */
function frequencyOf(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let crossings = 0;
  for (let i = 1; i < values.length; i++) if (values[i - 1] < mean && values[i] >= mean) crossings++;
  return (crossings * RATE) / values.length;
}

describe("SAM sound", () => {
  it("the formula: N 33, octave 3 is 261.506 Hz (the Technical Manual's middle C)", () => {
    expect(samSaaFrequency(33, 3)).toBeCloseTo(261.506, 2);
    expect(samSaaFrequency(0, 0)).toBeCloseTo(30.58, 1);
    expect(samSaaFrequency(255, 7)).toBeCloseTo(7812.5, 1);
  });

  it("a tone on channel 0 reaches the host's samples at its pitch, left only", async () => {
    const s = await soundMachine();
    saa(s, 0x1c, 0x02);
    saa(s, 0x1c, 0x00);
    saa(s, 0x00, 0x0f);
    saa(s, 0x08, 33);
    saa(s, 0x10, 0x03);
    saa(s, 0x14, 0x01);
    saa(s, 0x1c, 0x01);
    const left = samples(s, 50);
    const right = samples(s, 50, 1);
    expect(frequencyOf(left)).toBeGreaterThan(255);
    expect(frequencyOf(left)).toBeLessThan(268);
    expect(Math.max(...right.map(Math.abs))).toBeLessThan(0.01);
    expect(s.saa().channels[0].frequency).toBeCloseTo(261.5, 0);
  });

  it("1Ch bit 0 = 0 mutes every output", async () => {
    const s = await soundMachine();
    saa(s, 0x00, 0xff);
    saa(s, 0x08, 100);
    saa(s, 0x10, 0x04);
    saa(s, 0x14, 0x01);
    saa(s, 0x1c, 0x00);
    const values = samples(s, 20);
    expect(Math.max(...values.map(Math.abs))).toBeLessThan(0.001);
  });

  it("an octave change waits for the end of the half cycle", async () => {
    const s = await soundMachine();
    saa(s, 0x08, 0);
    saa(s, 0x10, 0x00);
    saa(s, 0x1c, 0x01);
    s.runFrames(1);
    saa(s, 0x10, 0x07);
    // --- Still octave 0 until the half cycle (8.2 ms at 30.6 Hz) ends
    expect(s.wasm.samSaaGetOctave(0)).toBe(0);
    s.runFrames(2);
    expect(s.wasm.samSaaGetOctave(0)).toBe(7);
  });

  it("the noise generator's LFSR is 18-bit Galois (taps 20400h), shifting at 31.25 kHz from source 0", async () => {
    const s = await soundMachine();
    saa(s, 0x16, 0x00);
    saa(s, 0x1c, 0x01);
    const before = s.wasm.samSaaGetLfsr(0) >>> 0;
    s.runFrames(1);
    const after = s.wasm.samSaaGetLfsr(0) >>> 0;
    // --- One frame (19.97 ms) is about 624 shifts
    let r = before;
    let shifts = 0;
    while (r !== after && shifts < 1000) {
      r = r & 1 ? (r >>> 1) ^ 0x20400 : r >>> 1;
      shifts++;
    }
    expect(shifts).toBeGreaterThan(615);
    expect(shifts).toBeLessThan(632);
  });

  it("envelope 0 (external clock) steps on address writes of 18h and acts on channel 2 only", async () => {
    const s = await soundMachine();
    // --- Repetitive attack (shape 7), 4-bit, external clock, enabled
    saa(s, 0x18, 0x80 | 0x20 | (7 << 1));
    const level = () => (s.wasm.samSaaGetEnvelope(0) >>> 24) & 0x0f;
    expect(level()).toBe(0);
    for (let i = 1; i <= 5; i++) {
      s.out(0x01ff, 0x18);
      expect(level()).toBe(i);
    }
    saa(s, 0x02, 0xff);
    saa(s, 0x00, 0x00);
    saa(s, 0x1c, 0x01);
    expect(s.wasm.samSaaGetLevel(0)).toBeGreaterThan(0);
  });

  it("the beeper (FEh bit 4) sounds on both sides", async () => {
    const s = await soundMachine();
    // --- Toggle the beeper every 3000 T: 1 kHz
    const code = [0x3e, 0x10, 0xd3, 0xfe, 0x06, 0xc8, 0x10, 0xfe, 0xaf, 0xd3, 0xfe, 0x06, 0xc8, 0x10, 0xfe, 0x18, 0xef];
    s.poke(0x0100, code);
    s.wasm.samSetCpuPc(0x0100);
    const left = samples(s, 30);
    const right = samples(s, 30, 1);
    expect(Math.max(...left) - Math.min(...left)).toBeGreaterThan(0.1);
    expect(Math.max(...right) - Math.min(...right)).toBeGreaterThan(0.1);
    expect(frequencyOf(left)).toBeGreaterThan(500);
  });

  it("SAM BASIC's BEEP sounds through the beeper", async () => {
    const s = await createSamSession();
    s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, RATE);
    s.bootToBasic();
    s.machine.typeText("BEEP 1,0\n");
    let peak = 0;
    for (let i = 0; i < 150; i++) {
      s.runFrames(1);
      for (const sample of s.machine.getAudioSamples()) peak = Math.max(peak, Math.abs(sample.left));
    }
    expect(peak).toBeGreaterThan(0.05);
  });
});
