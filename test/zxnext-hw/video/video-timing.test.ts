import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";

/*
 * Video timing (catalogue VT-001 - VT-009, VT-011).
 *
 * Hardware (`_input/next-fpga/src/video/zxula_timing.vhd` ~146-310, `zxnext.vhd`):
 * - Per timing: line length c_max_hc + 1 (7 MHz clocks, 2 per 3.5 MHz tact), frame c_max_vc + 1
 *   lines, display origin c_min_vactive, interrupt at (c_int_v, c_int_h):
 *     48K       448 x 312 (60 Hz: 264), vactive 64 (40), int (0, 116)
 *     128K      456 x 311 (60 Hz: 264), vactive 64 (40), int (1, 128)  (60 Hz: vc 0)
 *     +3        456 x 311 (60 Hz: 264), vactive 64 (40), int (1, 126)  (60 Hz: vc 0)
 *     Pentagon  448 x 320, always 50 Hz (zxnext.vhd ~5781), vactive 80, int (319, 439)
 * - ~420-447: `cvc` ($1E bit 0 / $1F, zxnext.vhd ~5928) is set to the $64 offset at hc = c_min_hactive
 *   - 12 of line c_min_vactive and counts lines from there, changing at that hc, wrapping at c_max_vc.
 * - zxnext.vhd ~6644-6649: the 50/60 Hz bit, the timing, the scandoubler and the scanlines take
 *   effect at the next frame; $05 and $09 read those effective values (~5843, ~5855).
 * - zxnext.vhd ~1968-2000: the INT pulse lasts 32 CPU cycles (48K, +3), 36 (128K, Pentagon);
 *   ~5938: $22 bit 7 reads it (`not pulse_int_n`).
 * - im2_peripheral.vhd ~160: $C8 bit 0 latches the ULA interrupt in any interrupt mode until written 1.
 *
 * VT-006 measures without taking an interrupt (no acceptance jitter): from a fixed program start the
 * same IN instruction reads $C8 (has the interrupt happened?) and $1F (which line?) after a delay
 * swept one tact at a time. The two thresholds differ by the interrupt's position inside its line.
 */

type Timing = {
  name: string;
  nr03: number;
  hz60: boolean;
  tactsPerLine: number;
  lines: number;
  /** cvc of the line the interrupt falls in */
  intLine: number;
  /** 7 MHz clocks from the line's cvc change (hc = c_min_hactive - 12) to the interrupt */
  intAfterLineChangeHc: number;
  pulseCycles: number;
};

const TIMINGS: Timing[] = [
  { name: "48K 50 Hz", nr03: 0x90, hz60: false, tactsPerLine: 224, lines: 312, intLine: 248, intAfterLineChangeHc: 0, pulseCycles: 32 },
  { name: "48K 60 Hz", nr03: 0x90, hz60: true, tactsPerLine: 224, lines: 264, intLine: 224, intAfterLineChangeHc: 0, pulseCycles: 32 },
  { name: "128K 50 Hz", nr03: 0xa0, hz60: false, tactsPerLine: 228, lines: 311, intLine: 248, intAfterLineChangeHc: 4, pulseCycles: 36 },
  { name: "128K 60 Hz", nr03: 0xa0, hz60: true, tactsPerLine: 228, lines: 264, intLine: 224, intAfterLineChangeHc: 4, pulseCycles: 36 },
  { name: "+3 50 Hz", nr03: 0xb0, hz60: false, tactsPerLine: 228, lines: 311, intLine: 248, intAfterLineChangeHc: 2, pulseCycles: 32 },
  { name: "+3 60 Hz", nr03: 0xb0, hz60: true, tactsPerLine: 228, lines: 264, intLine: 224, intAfterLineChangeHc: 2, pulseCycles: 32 },
  // --- Pentagon: interrupt at vc 319, hc 439; the line changed at hc 116 of the same line
  { name: "Pentagon", nr03: 0xc0, hz60: false, tactsPerLine: 224, lines: 320, intLine: 239, intAfterLineChangeHc: 323, pulseCycles: 36 }
];

/**
 * From the first tact of a frame in timing `t`: select `reg` on $243B, optionally clear the $C8 ULA
 * status after `clearAt` tacts, wait `wait` more tacts, read `reg` with one IN.
 *
 * The timing is set with the CPU parked and two whole frames run first, so the start point is a frame
 * boundary of the new timing (a timing change applies at the next frame, zxnext.vhd ~6644).
 */
async function probe(s: NextTestSession, t: Timing, reg: number, wait: number, clearAt?: number): Promise<number> {
  s.hardReset();
  await s.loadCode(" .org $8000\n di\n jr $");
  s.setNextReg(0x03, t.nr03).setNextReg(0x05, t.hz60 ? 0x04 : 0x00).setNextReg(0x22, 0x00).runFrames(2);
  await s.loadCode(`
        .org $8000
Start:  di
        ld bc,$243b              ; 10
        ld a,${reg}              ; 7
        out (c),a                ; 12
        ld b,$25                 ; 7: BC = $253B
${clearAt !== undefined ? `${delay(clearAt)}\n        nextreg $c8,$01` : ""}
${delay(wait)}
        in a,(c)
        ld (Result),a
        nextreg $7f,$a5
Stop:   jr Stop
Result: .defb 0
  `, { entry: "Start" });
  s.setNextReg(0x7f, 0); // --- $7F has no reset branch: the previous probe's $A5 survives the reset
  s.runUntilReady({ maxFrames: 10 });
  return s.peek(s.symbol("Result"));
}

/** Smallest `x` in [lo, hi] with `pred(x)`; `pred` must be false at lo and monotonic. */
async function threshold(lo: number, hi: number, pred: (x: number) => Promise<boolean>): Promise<number> {
  if (await pred(lo)) throw new Error(`predicate already true at ${lo}`);
  if (!(await pred(hi))) throw new Error(`predicate still false at ${hi}`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await pred(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Past the interrupt of the first frame (at its start, or for Pentagon at its end - found either way). */
const CLEAR_AT = 20000;
/** The `nextreg $c8,$01` that clears the status: a probe without it reaches the IN this much sooner. */
const NEXTREG_TACTS = 20;

/** The wait (without the status clear) at which the ULA interrupt happens, from the $C8 latch. */
async function interruptAt(s: NextTestSession, t: Timing): Promise<number> {
  const afterClear = await threshold(1000, 90000, async (d) => ((await probe(s, t, 0xc8, d, CLEAR_AT)) & 0x01) !== 0);
  return afterClear + CLEAR_AT + NEXTREG_TACTS;
}

describe.each(ALL_CORES)("video timing - %s core", (core: CoreName) => {
  for (const t of TIMINGS) {
    // --- VT-001 / VT-003 / VT-008
    it(`VT-001: ${t.name} runs ${t.lines} x ${t.tactsPerLine} tacts per frame`, async () => {
      const s = await createSession(core);
      await s.loadCode(` .org $8000\n jr $`);
      s.setNextReg(0x03, t.nr03).setNextReg(0x05, t.hz60 ? 0x04 : 0x00).runFrames(2);
      const before = s.tacts;
      s.runFrames(10);
      // --- a frame end is seen at an instruction boundary: allow less than one JR
      expect(Math.abs(s.tacts - before - 10 * t.lines * t.tactsPerLine), `${s.tacts - before}`).toBeLessThan(12);
    });

    // --- VT-002 / VT-005: every line number appears, the last is c_max_vc
    it(`VT-002: ${t.name} line counter $1E/$1F runs 0 - ${t.lines - 1}`, async () => {
      const s = await createSession(core);
      await s.loadCode(`
        .org $8000
Start:  di
        nextreg $03,${t.nr03}
        nextreg $05,${t.hz60 ? 0x04 : 0x00}
        ld bc,$243b
        ld hl,$c000
        ld de,3000
Sample: ld a,$1e                 ; 7
        out (c),a                ; 12
        inc b                    ; 4
        in a,(c)                 ; 12
        ld (hl),a                ; 7
        inc hl                   ; 6
        dec b                    ; 4
        ld a,$1f                 ; 7
        out (c),a                ; 12
        inc b                    ; 4
        in a,(c)                 ; 12
        ld (hl),a                ; 7
        inc hl                   ; 6
        dec b                    ; 4
        dec de                   ; 6
        ld a,d                   ; 4
        or e                     ; 4
        jr nz,Sample             ; 12 -> 130 tacts: 1.7 samples per line
        nextreg $7f,$a5
Stop:   jr Stop
      `, { entry: "Start" });
      s.runUntilReady({ maxFrames: 20 });
      const raw = s.peekBytes(0xc000, 6000);
      // --- skip the first frame (old timing until the frame ends)
      const lines = new Set<number>();
      for (let i = 1200; i < 3000; i++) lines.add(((raw[2 * i] & 0x01) << 8) | raw[2 * i + 1]);
      const seen = [...lines].sort((a, b) => a - b);
      expect(seen[0]).toBe(0);
      expect(seen[seen.length - 1]).toBe(t.lines - 1);
      expect(seen.length, "every line appears").toBe(t.lines);
      if (t.lines > 256) expect(raw.some((v, i) => i % 2 === 0 && v === 0x01), "$1E bit 0").toBe(true);
    });

    // --- VT-004 / VT-006
    it(`VT-006: ${t.name} interrupt at line ${t.intLine}, ${t.intAfterLineChangeHc / 2} tacts after the line starts`, async () => {
      const s = await createSession(core);
      const intAt = await interruptAt(s, t);
      // --- the line counter at that moment is the interrupt line ...
      expect(await probe(s, t, 0x1f, intAt), "line of the interrupt").toBe(t.intLine & 0xff);
      // --- ... and it changed to that value this many tacts earlier
      const lineStart = await threshold(intAt - 300, intAt, async (d) => (await probe(s, t, 0x1f, d)) === (t.intLine & 0xff));
      const measured = intAt - lineStart;
      expect(Math.abs(measured - t.intAfterLineChangeHc / 2), `${measured} tacts`).toBeLessThanOrEqual(1);
    });

    // --- VT-007: $22 bit 7 is the pulse; it lasts pulseCycles CPU cycles
    it(`VT-007: ${t.name} INT pulse lasts ${t.pulseCycles} tacts`, async () => {
      const s = await createSession(core);
      const intAt = await interruptAt(s, t);
      const pulse = async (d: number) => ((await probe(s, t, 0x22, d)) & 0x80) !== 0;
      const on = await threshold(intAt - 100, intAt + 16, pulse);
      const off = await threshold(on, on + 60, async (d) => !(await pulse(d)));
      expect(off - on).toBe(t.pulseCycles);
    });
  }

  // --- VT-003: the readback and the frame follow the effective (next-frame) 50/60 Hz bit
  it("VT-003: $05 bit 2 reads the 50/60 Hz setting in effect, from the next frame", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    s.setNextReg(0x03, 0xb0).runFrames(1);
    s.setNextReg(0x05, 0x04);
    expect(s.readNextReg(0x05) & 0x04, "same frame").toBe(0x00);
    s.runFrames(1);
    expect(s.readNextReg(0x05) & 0x04, "next frame").toBe(0x04);
  });

  it("VT-008: Pentagon timing ignores the 60 Hz bit", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    s.setNextReg(0x03, 0xc0).setNextReg(0x05, 0x04).runFrames(2);
    expect(s.readNextReg(0x05) & 0x04).toBe(0x00);
    const before = s.tacts;
    s.runFrames(10);
    expect(Math.abs(s.tacts - before - 10 * 320 * 224)).toBeLessThan(12);
  });

  // --- VT-009: ~5186-5193 - config mode only; 111 stores 000. Issue 2 boards (g_video_inc = "10")
  // --- keep bit 0 only, issue 4 all three, so only bit 0 values are written.
  it("VT-009: $11 is written only in config mode", async () => {
    const s = await createSession(core);
    const initial = s.readNextReg(0x11) & 0x07;
    s.setNextReg(0x11, initial ^ 0x01);
    expect(s.readNextReg(0x11), "outside config mode").toBe(initial);
    s.setNextReg(0x03, 0x07); // --- config mode
    s.setNextReg(0x11, 0x01);
    expect(s.readNextReg(0x11)).toBe(0x01);
    s.setNextReg(0x11, 0x07);
    expect(s.readNextReg(0x11), "111 stores 000").toBe(0x00);
  });

  /*
   * VT-010: the picture follows the timing. The buffer starts 48 lines above the display at 50 Hz;
   * a 60 Hz frame has the display from line 40 (c_min_vactive), so its paper sits at buffer row 24 -
   * the TypeScript core's framing, which the WASM core now shares (B20).
   */
  for (const [label, nr05, paperRow] of [["50 Hz", 0x00, 48], ["60 Hz", 0x04, 24]] as const) {
    it(`VT-010: at ${label} the paper starts at buffer row ${paperRow} and is 192 rows tall`, async () => {
      const s = await createSession(core);
      await s.loadCode(`
        .org $8000
        ld hl,$5800              ; attributes: paper 7 (white), ink 0
        ld (hl),$38
        ld de,$5801
        ld bc,$02ff
        ldir
        ld hl,$4000
        ld (hl),$00
        ld de,$4001
        ld bc,$17ff
        ldir
        ld a,2                   ; red border
        out ($fe),a
        nextreg $7f,$a5
        jr $
      `);
      s.setNextReg(0x03, 0xb0).setNextReg(0x05, nr05).runUntilReady().runFrames(3);
      const border = s.pixel(200, 2);
      const column = Array.from({ length: 288 }, (_, y) => s.pixel(200, y));
      const first = column.findIndex((c) => c !== border);
      const last = column.length - 1 - [...column].reverse().findIndex((c, i) => c !== border && 287 - i >= first);
      expect(first, JSON.stringify([border, column[first]])).toBe(paperRow);
      expect(column.slice(first, first + 192).every((c) => c === column[first]), "192 paper rows").toBe(true);
      expect(column[first + 192], "border below").toBe(border);
      void last;
    });
  }

  // --- A reset restarts the frame; the interrupt of the first frame after it must still come
  it("a soft reset in mid-frame keeps the next frame interrupt ($C8 latches it)", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n di\n jr $`);
    s.runFrames(1).step(2000).reset();
    await s.loadCode(` .org $8000\n di\n nextreg $22,0\n nextreg $c8,1\n jr $`);
    s.runFrames(1); // --- only the first frame after the reset
    expect(s.readNextReg(0xc8) & 0x01).toBe(0x01);
  });

  // --- VT-011: effective values, from the next frame
  it("VT-011: $05 bit 0 and $09 bits 1-0 read back from the next frame", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    s.setNextReg(0x05, 0x01).setNextReg(0x09, 0x02).runFrames(1);
    expect(s.readNextReg(0x05) & 0x01).toBe(0x01);
    expect(s.readNextReg(0x09) & 0x03).toBe(0x02);
    s.setNextReg(0x05, 0x00).setNextReg(0x09, 0x01).runFrames(1);
    expect(s.readNextReg(0x05) & 0x01).toBe(0x00);
    expect(s.readNextReg(0x09) & 0x03).toBe(0x01);
  });
});
