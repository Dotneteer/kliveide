import { describe, expect, it } from "vitest";

import { onEachCore } from "../../harness/zxnext";
import { ALIGNED_RATE } from "../audio/_audio-helpers";

/*
 * PAR-003: audio parity - an AY + DAC + beeper program, recorded on both cores: the mixed left/right
 * samples must match sample for sample (to the bit at 43.75 kHz, within 1 LSB at 44.1 kHz). The
 * expectation is the other core; the AY, DAC and BEEP tests hold the VHDL levels and frequencies.
 *
 * The program sets the AY playing a tone (A), noise (B) and an envelope (C), and then loops forever:
 * the beeper toggles and the Specdrum DAC ($DF, both mono channels) steps on every pass, and every 256
 * passes the tone period changes. Interrupts are off, so the loop is the whole timeline.
 */

const PROGRAM = `
        .org $8000
        di
        ld bc,$fffd
        ld hl,AyInit
        ld e,12
AyLoop:
        ld a,(hl)                ; register
        out (c),a
        inc hl
        ld a,(hl)                ; value
        ld b,$bf
        out (c),a
        ld b,$ff
        inc hl
        dec e
        jr nz,AyLoop
        ld d,0                   ; DAC value
        ld e,0                   ; pass counter
Main:
        ld a,d
        out ($df),a              ; Specdrum
        add a,7
        ld d,a
        ld a,e
        and $10
        out ($fe),a              ; beeper (EAR bit 4)
        inc e
        jr nz,Main
        ; --- every 256 passes: a new tone period for channel A
        ld bc,$fffd
        xor a
        out (c),a
        ld b,$bf
        ld a,d
        out (c),a
        jr Main

AyInit:
        .defb 0,$40, 1,$01        ; A: period $140
        .defb 6,$0a               ; noise period
        .defb 4,$20, 5,$00        ; C: period $020
        .defb 7,%00101100         ; tone A, noise B, tone C on
        .defb 8,$0f, 9,$0c        ; A, B levels
        .defb 10,$10              ; C: envelope
        .defb 11,$00, 12,$04      ; envelope period
        .defb 13,$0e              ; envelope shape: triangle
`;

const FRAMES = 25;

describe("PAR-003: audio parity", () => {
  for (const rate of [ALIGNED_RATE, 44_100]) {
    it(`AY + DAC + beeper at ${rate} Hz: the same samples on both cores`, async () => {
      const r = await onEachCore(
        async (s) => {
          await s.loadCode(PROGRAM);
          s.runFrames(2).startAudio().runFrames(FRAMES);
          const samples = s.audio();
          return { left: samples.map((x) => x.left), right: samples.map((x) => x.right) };
        },
        { audioSampleRate: rate }
      );
      expect(r.ts.left.length, "samples recorded").toBeGreaterThan(rate / 50);
      expect(r.wasm.left.length, "sample count").toBe(r.ts.left.length);
      const swing = Math.max(...r.ts.left) - Math.min(...r.ts.left);
      expect(swing, "the program makes sound").toBeGreaterThan(0);
      let worst = { i: -1, diff: 0 };
      for (const channel of ["left", "right"] as const) {
        for (let i = 0; i < r.ts[channel].length; i++) {
          const diff = Math.abs(r.ts[channel][i] - r.wasm[channel][i]);
          if (diff > worst.diff) worst = { i, diff };
        }
      }
      // --- At most 1 LSB of the 16-bit output: at 44.1 kHz the sample length (634.92 master clocks)
      // --- is not whole, and the TypeScript core adds it up in floating point while the WASM core keeps
      // --- it as an exact fraction, so a sample boundary can sit a hair apart. At 43.75 kHz (640 clocks)
      // --- the cores agree to the bit.
      expect(worst.diff, `the largest difference (sample ${worst.i})`).toBeLessThanOrEqual(rate === ALIGNED_RATE ? 0 : 1 / 32768);
    });
  }
});
