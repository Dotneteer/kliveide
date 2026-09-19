import { describe, expect, it } from "vitest";

import { onEachCore, type NextTestSession } from "../../harness/zxnext";

/*
 * PAR-004: long-run timing parity - 3000 frames (`ZXNEXT_LONG=1`; 500 by default) of a program that
 * keeps the timing-sensitive parts busy, compared between the cores every 250 frames (100 by default):
 * frame count, tacts, CPU registers and a checksum of RAM.
 *
 * The program takes the ULA interrupt and a line interrupt through IM2, changes the CPU speed from its
 * handler (so the 28 MHz wait states and the speed-scaled interrupt pulse are in play), writes to the
 * contended bank 5 and the border, and HALTs on every other pass. The expectation is the other core;
 * the per-area tests (INT, SPD, VT, MEM) hold the VHDL expectations.
 */

/** The full 3000-frame run takes about a minute (the TypeScript core); `ZXNEXT_LONG=1` selects it. */
const LONG = process.env.ZXNEXT_LONG === "1";
const FRAMES = LONG ? 3000 : 500;
const EVERY = LONG ? 250 : 100;

const PROGRAM = `
        .org $8000
        di
        ; --- IM2: a 257-byte table of $FD at $FE00, "jp Handler" at $FDFD
        ld hl,$fe00
        ld de,$fe01
        ld bc,256
        ld (hl),$fd
        ldir
        ld a,$c3
        ld ($fdfd),a
        ld hl,Handler
        ld ($fdfe),hl
        ld a,$fe
        ld i,a
        im 2
        nextreg $23,100          ; line interrupt at line 100
        nextreg $22,%00000010    ; line interrupt on, ULA interrupt on
        ei
Main:
        ld hl,$4000              ; contended writes to the screen
        ld de,(Counter)
        ld b,64
Fill:
        ld (hl),e
        inc hl
        inc e
        djnz Fill
        ld a,(Counter)
        and 1
        jr z,Main
        halt
        jr Main

Handler:
        push af
        push hl
        ld hl,(Counter)
        inc hl
        ld (Counter),hl
        ld a,l
        out ($fe),a              ; border
        rrca
        rrca
        rrca
        rrca
        and 3
        nextreg $07,a            ; CPU speed steps every 16 interrupts
        pop hl
        pop af
        ei
        reti

Counter .defw 0
`;

function checksum(s: NextTestSession): number {
  const bytes = s.peekBytes(0x4000, 0xc000);
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum = (Math.imul(sum, 31) + bytes[i]) | 0;
  return sum >>> 0;
}

describe("PAR-004: long-run timing parity", () => {
  it(`${FRAMES} frames: frames, tacts, registers and RAM equal every ${EVERY} frames`, { timeout: 300_000 }, async () => {
    const r = await onEachCore(async (s) => {
      await s.loadCode(PROGRAM);
      const samples: Array<{ frames: number; tacts: number; regs: object; ram: number; counter: number }> = [];
      for (let f = EVERY; f <= FRAMES; f += EVERY) {
        s.runFrames(EVERY);
        samples.push({ frames: s.frames, tacts: s.tacts, regs: s.registers(), ram: checksum(s), counter: s.peekWord(s.symbol("Counter")) });
      }
      return samples;
    });
    // --- The program ran: the interrupts counted
    expect(r.ts[r.ts.length - 1].counter, "interrupts taken").toBeGreaterThan(FRAMES);
    for (let i = 0; i < r.ts.length; i++) {
      expect(r.wasm[i], `after ${r.ts[i].frames} frames`).toEqual(r.ts[i]);
    }
  });
});
