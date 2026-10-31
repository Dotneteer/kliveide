import { describe, expect, it } from "vitest";

import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { bareMachine } from "./bare";

/*
 * DAVE's sound (`.plans/ENTERPRISE_PLAN.md` Phase 4, §8.2-§8.3): the tone channels' pitch, the
 * polynomial counters' periods, the noise clock, sync, the high-pass and ring modulator, D/A mode,
 * the two sides, BFh bit 1, and the samples the host gets. The CPU sits in `DI; HALT`; a halted cycle
 * is 4 T, a quarter of a DAVE tick, so stepping sees every tick.
 */

const RATE = 48_000;

const out = (s: EpTestSession, register: number, value: number) => s.wasm.epWritePort(0xa0 + register, value);

/** A fresh bare machine with every channel silent and the noise off */
async function quiet(options: { bf?: number } = {}): Promise<EpTestSession> {
  const s = await createEpSession();
  bareMachine(s, { bf: options.bf ?? 0x0c });
  for (let r = 0; r < 16; r++) out(s, r, 0);
  return s;
}

/** Steps until DAVE has ticked `ticks` times, calling `each` after every tick */
function ticks(s: EpTestSession, count: number, each: () => void): void {
  const tickHalves = (s.wasm.epGetBf() & 0x02) !== 0 ? 48 : 32;
  let next = s.wasm.epGetHalfClock() + tickHalves;
  for (let n = 0; n < count; ) {
    s.step(1);
    while (((s.wasm.epGetHalfClock() - next) | 0) >= 0) {
      n++;
      next += tickHalves;
      each();
    }
  }
}

/** The number of times a value changes over `count` ticks */
function changes(s: EpTestSession, count: number, read: () => number): number {
  let last = read();
  let n = 0;
  ticks(s, count, () => {
    const v = read();
    if (v !== last) n++;
    last = v;
  });
  return n;
}

/** The repeat length of a register's sequence of states over `count` ticks */
function period(s: EpTestSession, count: number, read: () => number): number {
  const states: number[] = [];
  ticks(s, count, () => states.push(read()));
  for (let p = 1; p < states.length / 2; p++) {
    if (states.every((v, i) => i < p || v === states[i - p])) return p;
  }
  return -1;
}

describe("DAVE's tone channels", () => {
  it("toggles at 125 000 / (n + 1) Hz: code 124 changes ch0's output every 125 ticks", async () => {
    const s = await quiet();
    out(s, 0, 124);
    expect(changes(s, 2500, () => s.wasm.epGetChannelOutputs() & 1)).toBe(20);
  });

  it("holds a channel at 0 while its sync bit is set, and counts on when it clears", async () => {
    const s = await quiet();
    out(s, 0, 9);
    out(s, 7, 0x01);
    expect(changes(s, 200, () => s.wasm.epGetChannelOutputs() & 1)).toBe(0);
    expect(s.wasm.epGetChannelOutputs() & 1).toBe(0);
    out(s, 7, 0x00);
    expect(changes(s, 200, () => s.wasm.epGetChannelOutputs() & 1)).toBe(20);
  });

  it("runs every frequency at 2/3 with BFh bit 1 (DAVE's input taken as 12 MHz)", async () => {
    const s = await quiet({ bf: 0x0e });
    out(s, 0, 9);
    const start = s.wasm.epGetTacts();
    // --- 20 changes = 200 ticks of 24 T
    changes(s, 200, () => s.wasm.epGetChannelOutputs() & 1);
    const elapsed = (s.wasm.epGetTacts() - start) >>> 0;
    expect(Math.abs(elapsed - 200 * 24)).toBeLessThan(8);
  });

  it("forces ch0 to 0 on each falling edge of ch1 with the high-pass (A1h bit 6)", async () => {
    const s = await quiet();
    out(s, 0, 199);
    out(s, 2, 9);
    let high = 0;
    ticks(s, 4000, () => (high += s.wasm.epGetChannelOutputs() & 1));
    // --- Without the filter ch0 is high half the time
    expect(high).toBeGreaterThan(1900);
    out(s, 1, 0x40);
    high = 0;
    ticks(s, 4000, () => (high += s.wasm.epGetChannelOutputs() & 1));
    // --- With it, ch0 is high for at most one ch1 period (20 ticks) after each of its own rises
    expect(high).toBeLessThan(4000 / 400 * 2 * 20 + 20);
    expect(high).toBeGreaterThan(0);
  });

  it("ring-modulates even a held channel: ch0 and ch2 both held, ring on, gives a constant 1 (§1 D)", async () => {
    const s = await quiet();
    out(s, 7, 0x05);
    out(s, 1, 0x80);
    out(s, 8, 40);
    ticks(s, 10, () => {});
    expect(s.wasm.epGetChannelOutputs() & 1).toBe(1);
    expect(s.wasm.epGetSideLevel(0)).toBe(40);
  });
});

describe("the polynomial counters", () => {
  it("repeat after 15, 31 and 127 steps (4, 5 and 7 bits), all stepped at 250 kHz", async () => {
    const s = await quiet();
    expect(period(s, 300, () => s.wasm.epGetPoly(0))).toBe(15);
    expect(period(s, 300, () => s.wasm.epGetPoly(1))).toBe(31);
    expect(period(s, 400, () => s.wasm.epGetPoly(2))).toBe(127);
  });

  it("gives the variable poly its length (A6h bits 3-2) and steps it at 250 kHz when swapped (bit 4)", async () => {
    const s = await quiet();
    // --- 9 bits (11), swapped: the variable poly steps every tick
    out(s, 6, 0x1c);
    expect(period(s, 1200, () => s.wasm.epGetPoly(3))).toBe(511);
    // --- 11 bits (10)
    out(s, 6, 0x18);
    expect(period(s, 4500, () => s.wasm.epGetPoly(3))).toBe(2047);
  });

  it("steps the noise poly at 31.25 kHz by default (every 8 ticks), or on a tone channel's falling edge", async () => {
    const s = await quiet();
    // --- (one either way: where the counting window starts against the clock's phase)
    out(s, 6, 0x00);
    expect(Math.abs(changes(s, 800, () => s.wasm.epGetPoly(3)) - 100)).toBeLessThanOrEqual(1);
    // --- Clocked by ch0 with code 9: it falls every 20 ticks
    out(s, 0, 9);
    out(s, 6, 0x01);
    expect(Math.abs(changes(s, 800, () => s.wasm.epGetPoly(3)) - 40)).toBeLessThanOrEqual(1);
  });

  it("samples a poly with distortion: code 8 on the 4-bit poly repeats every 5 reloads (the EXOS book's example)", async () => {
    const s = await quiet();
    // --- 9 ticks a reload, 15-step poly: the sampled bits repeat every 15 / gcd(9, 15) = 5 reloads (45 ticks)
    out(s, 0, 8);
    out(s, 1, 0x10);
    expect(period(s, 900, () => s.wasm.epGetChannelOutputs() & 1)).toBe(45);
  });
});

describe("the outputs", () => {
  it("sums each side's amplitudes for the channels that are high, independently", async () => {
    const s = await quiet();
    out(s, 7, 0x05);
    out(s, 1, 0x80);
    out(s, 8, 20);
    out(s, 12, 0);
    ticks(s, 4, () => {});
    expect([s.wasm.epGetSideLevel(0), s.wasm.epGetSideLevel(1)]).toEqual([20, 0]);
  });

  it("puts out 4 x the ch0 amplitude in D/A mode (A7h bit 3 left, bit 4 right)", async () => {
    const s = await quiet();
    out(s, 8, 63);
    out(s, 12, 10);
    out(s, 7, 0x08);
    ticks(s, 2, () => {});
    expect([s.wasm.epGetSideLevel(0), s.wasm.epGetSideLevel(1)]).toEqual([252, 0]);
    out(s, 7, 0x18);
    ticks(s, 2, () => {});
    expect([s.wasm.epGetSideLevel(0), s.wasm.epGetSideLevel(1)]).toEqual([252, 40]);
  });

  it("gives the host a 1 kHz tone on the left only, at the host's rate", async () => {
    const s = await quiet();
    s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, RATE);
    out(s, 0, 124);
    out(s, 8, 63);
    s.runFrames(5);
    const left: number[] = [];
    const right: number[] = [];
    let count = 0;
    for (let f = 0; f < 25; f++) {
      s.runFrames(1);
      const samples = s.machine.getAudioSamples();
      count += samples.length;
      for (const x of samples) {
        left.push(x.left);
        right.push(x.right);
      }
    }
    // --- 25 frames of 79 942 T at 4 MHz: 0.4996 s, 23 982 samples
    expect(Math.abs(count - (25 * 79_942 * RATE) / 4_000_000)).toBeLessThan(25);
    // --- Zero crossings of the DC-free signal: two a cycle, 1000 Hz
    let crossings = 0;
    for (let i = 1; i < left.length; i++) if ((left[i - 1] < 0) !== (left[i] < 0)) crossings++;
    const hz = crossings / 2 / (left.length / RATE);
    expect(Math.abs(hz - 1000)).toBeLessThan(5);
    // --- One channel at full amplitude: a quarter of full scale, +-0.125 after the DC filter
    const peak = Math.max(...left.map(Math.abs));
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThan(0.2);
    expect(Math.max(...right.map(Math.abs))).toBeLessThan(1e-9);
  });
});

describe("EXOS's sound", () => {
  it("clicks when a key is pressed at IS-BASIC's prompt, and is silent otherwise", async () => {
    const s = await createEpSession();
    s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, RATE);
    s.bootToBasic();
    const loudness = (frames: number) => {
      let peak = 0;
      for (let f = 0; f < frames; f++) {
        s.runFrames(1);
        for (const x of s.machine.getAudioSamples()) peak = Math.max(peak, Math.abs(x.left), Math.abs(x.right));
      }
      return peak;
    };
    loudness(25);
    expect(loudness(25)).toBeLessThan(0.01);
    // --- A (row 1, column 6): EXOS's keyboard driver clicks on tone channel 0
    s.keyDown(14);
    const click = loudness(4);
    s.keyUp(14);
    expect(click).toBeGreaterThan(0.02);
  });
});
