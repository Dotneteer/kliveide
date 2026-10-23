import { describe, expect, it } from "vitest";

import { createHtSession, type Ht1080zTestSession } from "../harness/ht1080z";
import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";

/*
 * The Phase 5 sound tests (`.plans/HT1080Z_PLAN.md` §10, §13; `_input/ht1080z/SOUND_AY.md`): the AY's
 * ports, its clock (the CPU clock, measured as a tone's pitch in the sample buffer), the beeper and
 * its relay mute, the user manual's sea program, the PSG panel, and when the AY is reset.
 */

const CODE = 0x6000;
const RESULTS = 0x6100;
const RATE = 44_100;

/** Puts machine code at CODE, jumps there and runs to its closing `JR $` */
function run(s: Ht1080zTestSession, code: number[]): Ht1080zTestSession {
  s.poke(CODE, [...code, 0x18, 0xfe]);
  s.machine.pc = CODE;
  return s.runTo(CODE + code.length, { maxFrames: 5 });
}

/** `OUT (1Fh),reg : OUT (1Eh),value` for each pair */
const ay = (...pairs: [number, number][]) => pairs.flatMap(([reg, value]) => [0x3e, reg, 0xd3, 0x1f, 0x3e, value, 0xd3, 0x1e]);

async function booted(model = "ht1080z-s2"): Promise<Ht1080zTestSession> {
  const s = (await createHtSession({ model })).bootToPrompt();
  s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, RATE);
  return s;
}

/** The samples of the next `frames` frames (the left channel; the mix is mono) */
function record(s: Ht1080zTestSession, frames: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < frames; i++) {
    s.runFrames(1);
    out.push(...s.machine.getAudioSamples().map((x) => x.left));
  }
  return out;
}

/** The pitch of a periodic signal: rising zero crossings per second */
function pitch(samples: number[]): number {
  let rising = 0;
  let first = -1;
  let last = -1;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1] < 0 && samples[i] >= 0) {
      rising++;
      if (first < 0) first = i;
      last = i;
    }
  }
  return ((rising - 1) * RATE) / (last - first);
}

const rms = (samples: number[]) => Math.sqrt(samples.reduce((a, x) => a + x * x, 0) / samples.length);

describe("HT-1080Z sound: the AY's ports", () => {
  it("OUT 1Fh selects, OUT 1Eh writes, IN 1Fh reads back; IN 1Eh is open bus", async () => {
    const s = await booted();
    run(s, [
      ...ay([0, 0x5a], [6, 0x1b], [11, 0xa5]),
      0x3e, 0, 0xd3, 0x1f, 0xdb, 0x1f, 0x32, RESULTS & 0xff, RESULTS >> 8,
      0x3e, 6, 0xd3, 0x1f, 0xdb, 0x1f, 0x32, (RESULTS + 1) & 0xff, RESULTS >> 8,
      0x3e, 11, 0xd3, 0x1f, 0xdb, 0x1e, 0x32, (RESULTS + 2) & 0xff, RESULTS >> 8,
      0xdb, 0x1f, 0x32, (RESULTS + 3) & 0xff, RESULTS >> 8
    ]);
    // --- R6 holds 5 bits (the AY's read masks); 1Eh reads FFh whatever is selected
    expect([0, 1, 2, 3].map((i) => s.peek(RESULTS + i))).toEqual([0x5a, 0x1b, 0xff, 0xa5]);
  });

  it("I/O ports A and B read FFh as inputs (nothing on the user port) and their value as outputs", async () => {
    const s = await booted();
    const readReg = (reg: number, at: number) => [0x3e, reg, 0xd3, 0x1f, 0xdb, 0x1f, 0x32, at & 0xff, at >> 8];
    run(s, [...ay([14, 0x12], [15, 0x34]), ...readReg(14, RESULTS), ...readReg(15, RESULTS + 1)]);
    expect([s.peek(RESULTS), s.peek(RESULTS + 1)]).toEqual([0xff, 0xff]);
    run(s, [...ay([7, 0xc0]), ...readReg(14, RESULTS + 2), ...readReg(15, RESULTS + 3)]);
    expect([s.peek(RESULTS + 2), s.peek(RESULTS + 3)]).toEqual([0x12, 0x34]);
  });
});

describe("HT-1080Z sound: the AY's clock is the CPU clock", () => {
  it("a tone period of 100 plays 1,110.9 Hz on the /64 (1,777,417 Hz / 16 / 100), within 1 %", async () => {
    const s = await booted("ht1080z-64");
    run(s, ay([0, 100], [1, 0], [7, 0x3e], [8, 15]));
    const samples = record(s, 50).slice(2000);
    expect(pitch(samples)).toBeGreaterThan(1110.9 * 0.99);
    expect(pitch(samples)).toBeLessThan(1110.9 * 1.01);
  });

  it("and 1,108.75 Hz on Series II, whose clock is 1,774,000 Hz", async () => {
    const s = await booted("ht1080z-s2");
    run(s, ay([0, 100], [1, 0], [7, 0x3e], [8, 15]));
    const measured = pitch(record(s, 50).slice(2000));
    expect(Math.abs(measured - 1_774_000 / 1600) / (1_774_000 / 1600)).toBeLessThan(0.01);
  });

  it("delivers a frame's worth of samples every frame: 44,100 Hz x 34,944 T / 1,774,000 Hz", async () => {
    const s = await booted();
    const counts: number[] = [];
    for (let i = 0; i < 20; i++) {
      s.runFrames(1);
      counts.push(s.machine.getAudioSamples().length);
    }
    const expected = (RATE * 34_944) / 1_774_000;
    for (const n of counts) expect(Math.abs(n - expected)).toBeLessThan(1.5);
    expect(Math.abs(counts.reduce((a, n) => a + n, 0) / counts.length - expected)).toBeLessThan(0.1);
    expect(s.wasm.ht1080zGetAudioOverflows()).toBe(0);
  });
});

describe("HT-1080Z sound: the beeper", () => {
  /** A loop toggling port FF between `a` and `b`, roughly 1 kHz, for a few frames */
  function toggling(a: number, b: number): number[] {
    // --- LD A,a ; OUT (FF),A ; LD B,60 ; DJNZ $ ; LD A,b ; OUT (FF),A ; LD B,60 ; DJNZ $ ; JR start
    return [0x3e, a, 0xd3, 0xff, 0x06, 60, 0x10, 0xfe, 0x3e, b, 0xd3, 0xff, 0x06, 60, 0x10, 0xfe, 0x18, 0xee];
  }

  it("sounds from port FF bits 0-1 at three levels", async () => {
    const s = await booted();
    run(s, [0x3e, 0x01, 0xd3, 0xff]);
    expect(s.wasm.ht1080zGetBeeperLevel()).toBe(100);
    run(s, [0x3e, 0x02, 0xd3, 0xff]);
    expect(s.wasm.ht1080zGetBeeperLevel()).toBe(-100);
    run(s, [0x3e, 0x03, 0xd3, 0xff]);
    expect(s.wasm.ht1080zGetBeeperLevel()).toBe(0);
    s.poke(CODE, toggling(0x01, 0x02));
    s.machine.pc = CODE;
    expect(rms(record(s, 10).slice(500))).toBeGreaterThan(0.2);
  });

  it("is muted while the relay bit (FF bit 2) is on", async () => {
    const s = await booted();
    // --- The DC filter (1.4 Hz) starts with the samples: let it settle on the silent AY's level
    record(s, 100);
    s.poke(CODE, toggling(0x05, 0x06));
    s.machine.pc = CODE;
    expect(rms(record(s, 10).slice(500))).toBeLessThan(0.001);
    expect(s.wasm.ht1080zGetBeeperLevel()).toBe(0);
  });
});

describe("HT-1080Z sound: BASIC, the PSG panel and reset", () => {
  /** The user manual's "sea" program (Appendix D, p. 30): noise on all three channels, envelope 14 */
  const SEA = [
    "10 FOR I=0 TO 15",
    "20 READ A",
    "30 OUT 31,I:OUT 30,A",
    "40 NEXT I",
    "50 DATA 0,0,0,0,0,0,31,199,16,16,16",
    "60 DATA 255,60,14,0,0",
    "70 END",
    "RUN",
    ""
  ].join("\n");

  it("the manual's sea program plays noise, and the PSG panel shows its registers", async () => {
    const s = await booted();
    s.typeKeys(SEA, { settle: 30 });
    const state = s.machine.psgDevice.getPsgState();
    expect(Array.from(state.regValues)).toEqual([0, 0, 0, 0, 0, 0, 31, 199, 16, 16, 16, 255, 60, 14, 0, 0]);
    expect([state.noiseAEnabled, state.noiseBEnabled, state.noiseCEnabled]).toEqual([true, true, true]);
    expect([state.toneAEnabled, state.envA, state.envStyle, state.noiseFreq]).toEqual([false, true, 14, 31]);
    const samples = record(s, 100);
    expect(rms(samples)).toBeGreaterThan(0.01);
    // --- Noise, not a tone: far more sign changes than a 28 Hz envelope makes, and irregular gaps
    let changes = 0;
    for (let i = 1; i < samples.length; i++) if (Math.sign(samples[i]) !== Math.sign(samples[i - 1])) changes++;
    expect(changes).toBeGreaterThan(500);
  });

  it("the RESET key leaves the AY playing; a power-on silences it", async () => {
    const s = await booted();
    run(s, ay([0, 100], [7, 0x3e], [8, 15]));
    await s.machine.executeCustomCommand("reset_key");
    s.runFrames(20);
    expect(s.machine.psgDevice.getPsgState().volA).toBe(15);
    expect(rms(record(s, 10))).toBeGreaterThan(0.05);
    await s.machine.hardReset();
    expect(s.machine.psgDevice.getPsgState().volA).toBe(0);
  });
});
