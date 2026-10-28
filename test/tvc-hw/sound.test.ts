import { describe, expect, it } from "vitest";

import { createTvcSession, type TvcTestSession } from "../harness/tvc";
import { bareMachine, ROM_CRTC } from "./bare";

/*
 * The TVC's sound and timer (`.plans/VIDEOTON_TVC_PLAN.md` §10; TVC_HARDWARE_OVERVIEW.md §5): a
 * 12-bit divider of 4096 - n clocks at 3.125 MHz, then a 4-bit counter whose bit 3 is the square
 * wave and, with port 05h bit 5, the sound interrupt. The cursor interrupt is off here (R10 = 23h,
 * cursor mode 01, as the ROM's tape routines set it), so only the sound can interrupt.
 */

const NO_CURSOR = [...ROM_CRTC.slice(0, 10), 0x23, ...ROM_CRTC.slice(11)];

async function soundMachine(): Promise<TvcTestSession> {
  const s = await createTvcSession();
  bareMachine(s, { halt: false, crtc: NO_CURSOR });
  s.wasm.tvcWritePort(0x07, 0);
  return s;
}

/** Sets the divisor n (12 bits) and port 05h's control bits (4: square wave, 5: interrupt) */
function setSound(s: TvcTestSession, n: number, control: number, amplitude = 15): void {
  s.wasm.tvcWritePort(0x04, n & 0xff);
  s.wasm.tvcWritePort(0x05, control | ((n >> 8) & 0x0f));
  s.wasm.tvcWritePort(0x06, amplitude << 2);
}

/** Runs about `tacts` T-states (whole instructions of the `JR $` loop) */
function runTacts(s: TvcTestSession, tacts: number): void {
  const start = s.wasm.tvcGetTacts();
  while ((s.wasm.tvcGetTacts() - start) >>> 0 < tacts) s.step(1);
}

describe("TVC sound: the divider and the counter", () => {
  it("counts one step every 4096 - n T-states after a restart (IN 5Bh)", async () => {
    const s = await soundMachine();
    setSound(s, 4096 - 100, 0x00);
    s.wasm.tvcReadPort(0x5b);
    const start = s.wasm.tvcGetTacts();
    runTacts(s, 650);
    const elapsed = (s.wasm.tvcGetTacts() - start) >>> 0;
    expect(s.wasm.tvcGetSoundCounter()).toBe(Math.floor(elapsed / 100) & 15);
  });

  it("raises the shared interrupt 16 divider periods after a restart, then every 16 (plan Q2)", async () => {
    const s = await soundMachine();
    setSound(s, 4096 - 100, 0x20);
    s.wasm.tvcReadPort(0x5b);
    s.wasm.tvcWritePort(0x07, 0);
    const start = s.wasm.tvcGetTacts();
    while (s.wasm.tvcGetItPending() === 0) s.step(1);
    const first = (s.wasm.tvcGetTacts() - start) >>> 0;
    // --- 1,600 T, seen within one JR (12 T) and one character (2 T)
    expect(first).toBeGreaterThanOrEqual(1600);
    expect(first).toBeLessThan(1600 + 14);
    s.wasm.tvcWritePort(0x07, 0);
    while (s.wasm.tvcGetItPending() === 0) s.step(1);
    const second = (s.wasm.tvcGetTacts() - start) >>> 0;
    expect(second).toBeGreaterThanOrEqual(3200);
    expect(second).toBeLessThan(3200 + 14);
  });

  it("does not interrupt with port 05h bit 5 clear", async () => {
    const s = await soundMachine();
    setSound(s, 4096 - 100, 0x00);
    s.wasm.tvcReadPort(0x5b);
    runTacts(s, 5000);
    expect(s.wasm.tvcGetItPending()).toBe(0);
  });
});

describe("TVC sound: the output", () => {
  /** The current frame's samples (left channel) */
  const samples = (s: TvcTestSession) => {
    const r = s.machine.wasmV2Runtime!;
    return Array.from({ length: r.exports.tvcGetAudioSampleCount() }, (_, i) => r.audioSamples[i * 2]);
  };

  it("plays a square wave at 195,312.5 / (4096 - n) Hz: n = 3901 is 1,001.6 Hz", async () => {
    const s = await soundMachine();
    s.wasm.tvcSetAudioSampleRate(44_100, Math.exp((-2 * Math.PI * 1.4) / 44_100));
    setSound(s, 3901, 0x10);
    s.runFrames(5);
    const all: number[] = [];
    for (let i = 0; i < 20; i++) {
      s.runFrames(1);
      all.push(...samples(s));
    }
    // --- Rising zero crossings over the run, against the expected cycles
    let rising = 0;
    for (let i = 1; i < all.length; i++) if (all[i - 1] < 0 && all[i] >= 0) rising++;
    const seconds = all.length / 44_100;
    expect(rising / seconds).toBeGreaterThan(1001.6 * 0.98);
    expect(rising / seconds).toBeLessThan(1001.6 * 1.02);
  });

  it("with port 05h bit 4 clear, puts the amplitude straight on the DAC: a step makes a pulse", async () => {
    const s = await soundMachine();
    s.wasm.tvcSetAudioSampleRate(44_100, Math.exp((-2 * Math.PI * 1.4) / 44_100));
    setSound(s, 0, 0x00, 0);
    s.runFrames(20);
    s.wasm.tvcWritePort(0x06, 15 << 2);
    s.runFrames(1);
    const out = samples(s);
    // --- The AC-coupled output jumps by the step (0.5 of full scale) and slowly settles back
    expect(Math.max(...out)).toBeGreaterThan(0.4);
    expect(out[out.length - 1]).toBeLessThan(Math.max(...out));
  });
});
