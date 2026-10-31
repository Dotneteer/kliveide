import { describe, expect, it } from "vitest";

import { createSession, piI2sWord, type NextTestSession, type PiI2sSamples } from "../../harness/zxnext";
import { TonePiI2sSource } from "@emu/machines/zxNext/piI2s/PiI2sSource";

/*
 * Raspberry Pi I2S audio input (catalogue I2S-001 - I2S-010; `.plans/PI_I2S_AUDIO_PLAN.md`).
 *
 * Hardware (`vendor/next-fpga/3.02.01/src`):
 * - zxnext.vhd ~2239-2246: NR $A2 bit 7 / 6 enable left / right (pi_i2s_en = either), bits 3 / 2 mute,
 *   bit 0 routes to EAR. ~6415: the i2s entity is held in reset while both enables are 0.
 * - i2s/i2s_receive.vhd: the top 13 bits of each word, latched at the WS edge that ends it (WS rising:
 *   left, falling: right). i2s.vhd: (not r(12)) & r(11 downto 3), 10-bit offset binary; reset 0 reads $200.
 * - ~2314-2315: pi_audio_X is "10" & X"00" when off, muted or routed to EAR; a side whose enable is
 *   clear takes the other side's word.
 * - ~5952-5961: $2C / $2E read bits 9-2 of pi_audio_L / R and latch bits 1-0 for $2D (bits 7-6).
 * - ~2317-2330: pi_fe_ear rises at L(9..8) or R(9..8) = "11", falls at "00"; 0 unless enabled and routed.
 *   ~3456: port $FE bit 6 = (i_AUDIO_EAR xor pi_fe_ear) or ...
 * - audio/audio_mixer.vhd:89-100: the I2S word (0-1023) is summed per side, one unit per step; a DAC
 *   channel is 4 units per step.
 */

const RATE = 48_000;
/** A rate whose sample period is exactly 1000 clocks of 28 MHz */
const EXACT_RATE = 28_000;

async function next(audioSampleRate?: number): Promise<NextTestSession> {
  const s = await createSession(audioSampleRate ? { audioSampleRate } : {});
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s;
}

const constant = (left: number, right: number, length?: number): PiI2sSamples => ({
  rate: RATE,
  length,
  sample: () => [left, right]
});

/** $2C (or $2E) then $2D: the whole 10-bit word as the Next reads it */
function readWord(s: NextTestSession, reg: 0x2c | 0x2e): number {
  const high = s.readNextReg(reg);
  const low = s.readNextReg(0x2d);
  return (high << 2) | (low >> 6);
}

describe("Pi I2S audio input", () => {
  it("I2S-001: with no Pi, $2C / $2D / $2E read the rest values whatever $A2 says", async () => {
    const s = await next();
    for (const a2 of [0x00, 0xc0, 0x80, 0x40, 0xcc, 0xc1]) {
      s.setNextReg(0xa2, a2).runFrames(1);
      expect([s.readNextReg(0x2c), s.readNextReg(0x2d), s.readNextReg(0x2e)], `$A2 = ${a2}`).toEqual([0x80, 0x00, 0x80]);
    }
  });

  it("I2S-002: a sample s reads back as ((s >> 6) & $3FF) xor $200", async () => {
    const s = await next();
    s.setNextReg(0xa2, 0xc0);
    for (const [left, right] of [
      [0, 0],
      [32767, -32768],
      [-32768, 32767],
      [1234, -1234],
      [64, -64],
      [0x1fc0, -0x2ac0]
    ]) {
      s.piI2sConnect(constant(left, right)).runFrames(1);
      expect(readWord(s, 0x2c), `left ${left}`).toBe(piI2sWord(left));
      expect(readWord(s, 0x2e), `right ${right}`).toBe(piI2sWord(right));
    }
    expect(piI2sWord(0)).toBe(0x200);
    expect(piI2sWord(32767)).toBe(0x3ff);
    expect(piI2sWord(-32768)).toBe(0x000);
  });

  it("I2S-003: $2D holds the low bits of the last $2C / $2E read", async () => {
    const s = await next();
    const left = 0x41 << 6; // --- word $241: low bits 01
    const right = 0x42 << 6; // --- word $242: low bits 10
    s.setNextReg(0xa2, 0xc0).piI2sConnect(constant(left, right)).runFrames(1);
    s.readNextReg(0x2c);
    expect(s.readNextReg(0x2d)).toBe(0x40);
    s.readNextReg(0x2e);
    expect(s.readNextReg(0x2d)).toBe(0x80);
    // --- Reading $2D latches nothing
    expect(s.readNextReg(0x2d)).toBe(0x80);
  });

  it("I2S-004: the enables select, duplicate and mute the sides", async () => {
    const s = await next();
    const a = 0x100 << 6;
    const b = -(0x80 << 6);
    s.piI2sConnect(constant(a, b));
    const read = (a2: number) => {
      s.setNextReg(0xa2, a2).runFrames(1);
      return [readWord(s, 0x2c), readWord(s, 0x2e)];
    };
    const wa = piI2sWord(a);
    const wb = piI2sWord(b);
    expect(read(0xc0), "stereo").toEqual([wa, wb]);
    expect(read(0x80), "left only: both sides left").toEqual([wa, wa]);
    expect(read(0x40), "right only: both sides right").toEqual([wb, wb]);
    expect(read(0xc8), "left muted").toEqual([0x200, wb]);
    expect(read(0xc4), "right muted").toEqual([wa, 0x200]);
    expect(read(0xc1), "routed to EAR").toEqual([0x200, 0x200]);
    expect(read(0x00), "off").toEqual([0x200, 0x200]);
  });

  it("I2S-005: each sample's left word lands half a period before its right word", async () => {
    const s = await next();
    // --- Sample k carries k in both words, so the receiver shows which sample each side last latched
    s.setNextReg(0xa2, 0xc0).piI2sConnect({ rate: EXACT_RATE, sample: (k) => [(k % 512) << 6, (k % 512) << 6] });
    let ahead = 0;
    let level = 0;
    for (let i = 0; i < 2000; i++) {
      s.step(1);
      const { left, right } = s.piI2sReceiver();
      const l = left ^ 0x200;
      const r = right ^ 0x200;
      if (l === r) level++;
      else {
        // --- Only ever the left side ahead, by one sample
        expect((l - r + 512) % 512).toBe(1);
        ahead++;
      }
    }
    // --- The left word is ahead for half of every period
    expect(ahead / (ahead + level)).toBeGreaterThan(0.4);
    expect(ahead / (ahead + level)).toBeLessThan(0.6);
  });

  it("I2S-006: clearing both enables resets the receiver to its rest word", async () => {
    const s = await next();
    const v = 0x7fff;
    s.setNextReg(0xa2, 0xc0).piI2sConnect(constant(v, v)).runFrames(1);
    expect(s.piI2sReceiver().left).toBe(piI2sWord(v));
    s.setNextReg(0xa2, 0x00);
    expect(s.piI2sReceiver()).toMatchObject({ left: 0x200, right: 0x200 });
    s.setNextReg(0xa2, 0xc0);
    expect(s.piI2sReceiver()).toMatchObject({ left: 0x200, right: 0x200 });
    s.runFrames(1);
    expect(s.piI2sReceiver()).toMatchObject({ left: piI2sWord(v), right: piI2sWord(v) });
  });

  it("I2S-007: a stream that ends stops clocking and the receiver holds its last words", async () => {
    const s = await next();
    s.setNextReg(0xa2, 0xc0).piI2sConnect({ rate: RATE, length: 100, sample: (k) => [k << 6, -(k << 6)] });
    s.runFrames(3);
    expect(s.piI2sStatus()).toMatchObject({ ended: true, position: 100 });
    expect(s.piI2sReceiver()).toMatchObject({ left: piI2sWord(99 << 6), right: piI2sWord(-(99 << 6)) });
    s.piI2sDisconnect().runFrames(1);
    expect(s.piI2sStatus()).toBeUndefined();
    expect(s.piI2sReceiver()).toMatchObject({ left: piI2sWord(99 << 6), right: piI2sWord(-(99 << 6)) });
  });

  it("I2S-008: routed to EAR, port $FE bit 6 follows the hysteresis on the top two bits", async () => {
    const s = await next();
    const bit6 = () => (s.in(0x00fe) & 0x40) !== 0;
    const feed = (v: number) => s.piI2sConnect(constant(v, v)).runFrames(1);
    s.setNextReg(0xa2, 0xc1);
    expect(bit6(), "rest").toBe(false);
    feed(0x7fff); // --- word $3FF: "11"
    expect(bit6(), "11 sets it").toBe(true);
    feed(0); // --- word $200: "10"
    expect(bit6(), "10 holds 1").toBe(true);
    feed(-0x4000); // --- word $100: "01"
    expect(bit6(), "01 holds 1").toBe(true);
    feed(-0x8000); // --- word $000: "00"
    expect(bit6(), "00 clears it").toBe(false);
    feed(0x3fff); // --- word $2FF: "10"
    expect(bit6(), "10 holds 0").toBe(false);
    feed(0x7fff);
    expect(bit6()).toBe(true);
    s.setNextReg(0xa2, 0xc0);
    expect(bit6(), "not routed").toBe(false);
    expect(s.piI2sReceiver().ear).toBe(false);
    s.setNextReg(0xa2, 0xc1);
    expect(bit6(), "routed again: the latched words are still 11").toBe(true);
  });

  it("I2S-009: the mixer adds one unit per step, a quarter of a DAC step", async () => {
    const s = await next(RATE);
    s.setNextReg(0x08, 0x18); // --- internal speaker + DACs
    const last = () => {
      const a = s.startAudio().runFrames(1).audio();
      return a[a.length - 1];
    };
    const base = last();
    s.setNextReg(0x2c, 0x81); // --- DAC B one step up: left +4 units
    const dac = last();
    s.setNextReg(0x2c, 0x80);
    s.setNextReg(0xa2, 0xc0).piI2sConnect(constant(4 << 6, -(4 << 6))).runFrames(1);
    const i2s = last();
    expect(dac.left - base.left).not.toBe(0);
    expect(i2s.left - base.left).toBe(dac.left - base.left);
    expect(i2s.right - base.right).toBe(-(dac.left - base.left));
    // --- Muted, the I2S word leaves the mix
    s.setNextReg(0xa2, 0xcc);
    expect(last()).toEqual(base);
  });

  it("I2S-011: a checkpoint restored mid-stream replays the same reads and the same audio", async () => {
    const s = await next(RATE);
    s.setNextReg(0xa2, 0xc0).piI2sConnect({ rate: 44_100, sample: (k) => [((k * 977) % 65536) - 32768, ((k * 331) % 65536) - 32768] });
    s.runFrames(3);
    const run = () => {
      const out: number[] = [];
      s.startAudio();
      for (let f = 0; f < 6; f++) {
        s.runFrames(1);
        out.push(s.readNextReg(0x2c), s.readNextReg(0x2d), s.readNextReg(0x2e), s.in(0x00fe), s.piI2sStatus()!.position);
      }
      return { reads: out, audio: s.audio() };
    };
    s.captureCheckpoint("mid");
    const first = run();
    s.restoreCheckpoint("mid");
    const second = run();
    expect(second.reads).toEqual(first.reads);
    expect(second.audio).toEqual(first.audio);
    // --- The words moved between frames: the comparison saw a live stream
    expect(new Set(first.reads.filter((_, i) => i % 5 === 0)).size).toBeGreaterThan(3);
    expect(new Set(first.audio.map((a) => a.left)).size).toBeGreaterThan(10);
  });

  it("I2S-012: connecting a stream drops the held checkpoint", async () => {
    const s = await next();
    s.captureCheckpoint("before");
    s.piI2sConnect(constant(1, 1));
    expect(() => s.restoreCheckpoint("before")).toThrow(/No checkpoint/);
  });

  it("I2S-010: a tone source reaches the mix as a tone", async () => {
    const s = await next(RATE);
    s.setNextReg(0xa2, 0xc0).piI2sConnect(new TonePiI2sSource(1000, 1, "left", RATE)).runFrames(1);
    const a = s.startAudio().runFrames(5).audio();
    const left = a.map((x) => x.left);
    const right = a.map((x) => x.right);
    // --- Zero crossings of a 1 kHz tone: about 2 per ms
    let crossings = 0;
    for (let i = 1; i < left.length; i++) if (left[i] >= 0 !== left[i - 1] >= 0) crossings++;
    const ms = (a.length / RATE) * 1000;
    expect(crossings / ms).toBeGreaterThan(1.8);
    expect(crossings / ms).toBeLessThan(2.2);
    expect(new Set(right).size).toBe(1);
  });
});
