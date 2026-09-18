import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type AudioSample, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { MASTER_CLOCK } from "./_audio-helpers";

/*
 * 8-bit DACs - Soundrive, Covox, Specdrum (catalogue DAC-002 - DAC-012; DAC-001 is `dac-enable.test.ts`,
 * DAC-013 is DMA-020).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~2385-2391, ~2614-2620: the DAC ports decode the low byte only. Channel A: $1F (Soundrive 1,
 *   enable bit 17), $F1 (Soundrive 2, bit 18), $3F (Profi Covox, bit 19), and the mono A+D ports $FB
 *   (Pentagon, bit 21 and only while bit 18 is off) and $DF (Specdrum, bit 23). B: $0F (bit 17 or 20), $F3
 *   (18), mono B+C $B3 (GS Covox, bit 22). C: $4F (17 or 20), $F9 (18), $B3. D: $5F (17 or 19), $FB (18),
 *   the mono A+D ports. Enable bits 16-23 are NextReg $84.
 * - ~2731-2734: port writes also need $08 bit 3 (`dac_hw_en`). ~2664-2681: while Soundrive 2 is on, $F1 and
 *   $F9 writes do not also reach $7FFD/$DFFD/$1FFD/$3FFD (`port_fd_conflict_wr`).
 * - ~2630: with Specdrum on and the mouse ports ($83 bit 5) off, $DF also reads the Kempston port $1F.
 *   DAC ports themselves are write-only: they are not internal read responses (~2759), so they read $FF.
 * - audio/soundrive.vhd: four 8-bit channels, $80 after reset or while $08 bit 3 is 0; pcm_L = A + B,
 *   pcm_R = C + D. NextReg mirrors: $2C writes B, $2D writes A and D, $2E writes C (~4830).
 * - ~5952-5961: reading $2C/$2E returns bits 9-2 of the Pi I2S sample, not the DAC, and latches its bits
 *   1-0 for $2D (bits 7-6). With I2S off the sample is "10" & X"00" (~2314): $80, and $00 from $2D.
 * - audio/audio_mixer.vhd: dac_L = pcm_dac_L * 4 is summed linearly into the output.
 */

const RATE = 48_000;
const DAC_ON = 0x18; // --- $08: internal speaker + DACs; TurboSound off

async function dac(core: CoreName, nr08 = DAC_ON): Promise<NextTestSession> {
  const s = await createSession(core, { audioSampleRate: RATE });
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s.setNextReg(0x08, nr08);
}

const record = (s: NextTestSession, frames = 1): AudioSample[] => s.startAudio().runFrames(frames).audio();
/** The steady level after a frame (DAC values are static). */
const level = (s: NextTestSession): AudioSample => {
  const a = record(s);
  return a[a.length - 1];
};

/**
 * Which channels a write to `port` sets: writes $FF, then finds the channel through the NextReg
 * mirrors - $2C resets only B, $2E only C, $2D resets A and D. Leaves every channel at $80.
 */
function channels(s: NextTestSession, port: number): string {
  const base = level(s);
  s.out(port, 0xff);
  const raised = level(s);
  const out: string[] = [];
  if (raised.left !== base.left) {
    s.setNextReg(0x2c, 0x80);
    out.push(level(s).left === base.left ? "B" : "A");
  }
  if (raised.right !== base.right) {
    s.setNextReg(0x2e, 0x80);
    out.push(level(s).right === base.right ? "C" : "D");
  }
  s.setNextReg(0x2c, 0x80).setNextReg(0x2d, 0x80).setNextReg(0x2e, 0x80);
  return out.sort().join("") || "-";
}

/** $84 with the given enable bits (16-23) cleared. */
const without = (...bits: number[]) => bits.reduce((v, b) => v & ~(1 << (b - 16)), 0xff);

type PortCase = [id: string, what: string, nr84: number, port: number, expected: string];
const PORTS: PortCase[] = [
  ["DAC-002", "Soundrive 1 $1F", 0xff, 0x001f, "A"],
  ["DAC-002", "Soundrive 1 $0F", 0xff, 0x000f, "B"],
  ["DAC-002", "Soundrive 1 $4F", 0xff, 0x004f, "C"],
  ["DAC-002", "Soundrive 1 $5F", 0xff, 0x005f, "D"],
  ["DAC-002", "the high byte is not decoded: $A51F", 0xff, 0xa51f, "A"],
  ["DAC-002", "bit 17 off: $1F", without(17), 0x001f, "-"],
  ["DAC-002", "bit 17 off: $0F still Covox", without(17), 0x000f, "B"],
  ["DAC-002", "bits 17, 20 off: $0F", without(17, 20), 0x000f, "-"],
  ["DAC-002", "bits 17, 20 off: $4F", without(17, 20), 0x004f, "-"],
  ["DAC-002", "bit 17 off: $5F still Profi Covox", without(17), 0x005f, "D"],
  ["DAC-003", "Soundrive 2 $F1", 0xff, 0x00f1, "A"],
  ["DAC-003", "Soundrive 2 $F3", 0xff, 0x00f3, "B"],
  ["DAC-003", "Soundrive 2 $F9", 0xff, 0x00f9, "C"],
  ["DAC-003", "Soundrive 2 $FB", 0xff, 0x00fb, "D"],
  ["DAC-003", "bit 18 off: $F1", without(18), 0x00f1, "-"],
  ["DAC-003", "bit 18 off: $F3", without(18), 0x00f3, "-"],
  ["DAC-003", "bit 18 off: $F9", without(18), 0x00f9, "-"],
  ["DAC-004", "Profi Covox $3F", 0xff, 0x003f, "A"],
  ["DAC-004", "Profi Covox $5F", without(17), 0x005f, "D"],
  ["DAC-004", "bit 19 off: $3F", without(19), 0x003f, "-"],
  ["DAC-004", "bits 17, 19 off: $5F", without(17, 19), 0x005f, "-"],
  ["DAC-005", "Covox $0F", without(17), 0x000f, "B"],
  ["DAC-005", "Covox $4F", without(17), 0x004f, "C"],
  ["DAC-006", "Pentagon $FB with Soundrive 2 off", without(18), 0x00fb, "AD"],
  ["DAC-006", "bits 18, 21 off: $FB", without(18, 21), 0x00fb, "-"],
  ["DAC-007", "GS Covox $B3", 0xff, 0x00b3, "BC"],
  ["DAC-007", "bit 22 off: $B3", without(22), 0x00b3, "-"],
  ["DAC-008", "Specdrum $DF", 0xff, 0x00df, "AD"],
  ["DAC-008", "bit 23 off: $DF", without(23), 0x00df, "-"]
];

describe.each(ALL_CORES)("DACs - %s core", (core) => {
  for (const [id, what, nr84, port, expected] of PORTS) {
    it(`${id}: ${what} writes ${expected === "-" ? "no channel" : expected}`, async () => {
      const s = await dac(core);
      s.setNextReg(0x84, nr84);
      expect(channels(s, port)).toBe(expected);
    });
  }

  it("DAC-002: A and B play on the left, C and D on the right, each at its own value", async () => {
    const s = await dac(core);
    const base = level(s);
    s.out(0x1f, 0xff).out(0x0f, 0x00); // --- A +127, B -128: left moves by -1 unit
    s.out(0x4f, 0xc0).out(0x5f, 0xc0); // --- C +64, D +64: right moves by +128 units
    const l = level(s);
    const unit = (l.right - base.right) / 128;
    expect(unit, "a DAC step moves the output").not.toBe(0);
    expect((l.left - base.left) / unit).toBeCloseTo(-1, 1);
  });

  it("DAC-003: while Soundrive 2 is on, $7FF1 is a DAC write and does not page like $7FFD", async () => {
    const s = await dac(core);
    s.out(0x7ff1, 0x03);
    expect(s.readNextReg(0x56), "slot 6 unchanged").toBe(0x00);
    s.setNextReg(0x84, without(18));
    s.out(0x7ff1, 0x03);
    expect(s.readNextReg(0x56), "Soundrive 2 off: $7FF1 pages bank 3 like $7FFD").toBe(0x06);
  });

  it("DAC-008: with Specdrum on and the mouse ports off, $DF also reads Kempston $1F; DAC ports read $FF", async () => {
    const s = await dac(core);
    s.setNextReg(0x05, 0x40); // --- joystick 1 = Kempston 1 (port $1F)
    const kempston = s.in(0x001f);
    expect(kempston, "Kempston answers").not.toBe(0xff);
    expect(s.in(0x00df), "mouse ports on: $DF is only the Specdrum DAC").toBe(0xff);
    s.setNextReg(0x83, s.readNextReg(0x83) & ~0x20);
    expect(s.in(0x00df), "mouse ports off: $DF reads Kempston").toBe(kempston);
    expect(s.in(0x00b3), "GS Covox is write-only").toBe(0xff);
  });

  it("DAC-009: the output moves in equal steps with the DAC value", async () => {
    const s = await dac(core);
    const at = (v: number) => level(s.out(0x1f, v)).left;
    const values = [0x00, 0x40, 0x80, 0xc0, 0xff];
    const levels = values.map(at);
    const unit = (levels[4] - levels[0]) / 255;
    expect(unit).not.toBe(0);
    for (let i = 0; i < values.length; i++) expect((levels[i] - levels[0]) / unit, `$${values[i].toString(16)}`).toBeCloseTo(values[i], 0);
  });

  it("DAC-010: a Z80 loop writing a ramp at a fixed rate plays that ramp in time", async () => {
    // --- One OUT every 400 T-states at 3.5 MHz (contention off): 256 steps take 102400 T-states.
    const s = await dac(core, DAC_ON | 0x40);
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $07,0
        xor a
        ld c,$1f
Step:   out (c),a         ; 12
        ld b,28           ; 7
Dly:    djnz Dly          ; 27 * 13 + 8
        nop               ; 4
        nop               ; 4
        inc a             ; 4
        jp nz,Step        ; 10    = 400
        ld a,$ff
        out (c),a
Park:   jr Park
`,
      { entry: "Start" }
    );
    const left = side(record(s, 3));
    const lo = Math.min(...left);
    const hi = Math.max(...left);
    // --- The first OUT drops channel A from $80 to 0; the ramp starts when the level leaves that floor
    const floor = left.indexOf(lo);
    const start = left.findIndex((v, i) => i > floor && v > lo);
    const end = left.findIndex((v, i) => i > start && v === hi);
    const samplesPerStep = (400 * 8 * RATE) / MASTER_CLOCK; // --- 400 T-states = 3200 master clocks
    expect(end - start, "255 steps").toBeGreaterThan(254 * samplesPerStep - 2);
    expect(end - start).toBeLessThan(255 * samplesPerStep + 2);
    const ramp = left.slice(start, end);
    expect(ramp.every((v, i) => i === 0 || v >= ramp[i - 1]), "never falls").toBe(true);
  });

  it("DAC-011: $2C writes B, $2D writes A and D, $2E writes C", async () => {
    const s = await dac(core);
    const base = level(s);
    s.setNextReg(0x2c, 0xff);
    const b = level(s);
    expect([b.left !== base.left, b.right !== base.right], "$2C: left only").toEqual([true, false]);
    s.setNextReg(0x2c, 0x80).setNextReg(0x2e, 0xff);
    const c = level(s);
    expect([c.left !== base.left, c.right !== base.right], "$2E: right only").toEqual([false, true]);
    s.setNextReg(0x2e, 0x80).setNextReg(0x2d, 0xff);
    const ad = level(s);
    expect([ad.left - base.left, ad.right - base.right].map((d) => d / (b.left - base.left)), "$2D: one channel a side").toEqual([1, 1]);
  });

  it("DAC-011: the mirrors are ignored while the DACs are disabled", async () => {
    const s = await dac(core, 0x10);
    const silent = level(s);
    s.setNextReg(0x2c, 0xff).setNextReg(0x2d, 0xff).setNextReg(0x2e, 0xff).setNextReg(0x08, DAC_ON);
    expect(level(s)).toEqual(silent);
  });

  it("DAC-011: reads of $2C/$2E give the I2S sample ($80 with I2S off), $2D its low bits", async () => {
    const s = await dac(core);
    s.setNextReg(0x2c, 0x12).setNextReg(0x2d, 0x34).setNextReg(0x2e, 0x56);
    expect(s.readNextReg(0x2c)).toBe(0x80);
    expect(s.readNextReg(0x2d)).toBe(0x00);
    expect(s.readNextReg(0x2e)).toBe(0x80);
  });

  it("DAC-012: after a soft reset every channel is back at $80", async () => {
    const s = await dac(core);
    const silent = level(s);
    for (const port of [0x1f, 0x0f, 0x4f, 0x5f]) s.out(port, 0xff);
    expect(level(s)).not.toEqual(silent);
    s.reset();
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    s.setNextReg(0x08, DAC_ON);
    expect(level(s), "the DAC-disabled level: all channels $80").toEqual(silent);
  });
});

const side = (samples: AudioSample[]) => samples.map((x) => x.left);
