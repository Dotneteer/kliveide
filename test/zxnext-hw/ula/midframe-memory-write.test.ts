import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession } from "../../harness/zxnext";

/*
 * B8 - screen memory written mid-frame shows from the beam position on ("racing the beam").
 *
 * Hardware: the ULA reads the display file and attributes while it draws each line (zxula.vhd fetches
 * `attr_reg` from memory per character cell as the beam passes), so a write takes effect on the lines
 * drawn after it and not on the ones already drawn.
 *
 * The program, once per frame, busy-waits on NextReg $1F (copper line LSB; zxnext.vhd reads `cvc`):
 * - at line 250 (below the visible frame) it writes PAPER 1 (blue) to column 0 of all 24 character rows
 * - at line 96 (paper row 96, character row 12) it writes PAPER 2 (red) to the same cells.
 * So character rows 0-11 (buffer rows 48-143) show blue and rows 13-23 (buffer rows 152-239) red;
 * row 12 is written while it is being drawn and is not checked. Column 0 = buffer x 96-111.
 */
describe.each(ALL_CORES)("mid-frame attribute writes - %s core", (core) => {
  it("rows drawn before the write keep the old colour, rows after it show the new one", async () => {
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
        di
        nextreg $43,$00
        nextreg $40,17
        nextreg $41,$03          ; PAPER 1 blue
        nextreg $40,18
        nextreg $41,$E0          ; PAPER 2 red
        nextreg $40,23
        nextreg $41,$B6          ; PAPER 7 grey (the rest of the paper)
        nextreg $14,$E3
        ld a,7
        out ($FE),a
        ld hl,$5800
        ld de,$5801
        ld bc,767
        ld (hl),$38              ; PAPER 7
        ldir
        ld hl,$4000              ; clear the bitmap
        ld de,$4001
        ld bc,$17FF
        ld (hl),0
        ldir
        nextreg $7F,$A5
    Frame:
        ld a,250
        call WaitLine
        ld a,$08                 ; PAPER 1
        call FillColumn0
        ld a,96
        call WaitLine
        ld a,$10                 ; PAPER 2
        call FillColumn0
        jr Frame

    ; --- A = attribute: column 0 of the 24 character rows
    FillColumn0:
        ld hl,$5800
        ld de,32
        ld b,24
    FillLoop:
        ld (hl),a
        add hl,de
        djnz FillLoop
        ret

    ; --- returns when the copper line LSB ($1F) becomes A
    WaitLine:
        ld e,a
        ld bc,$243B
        ld a,$1F
        out (c),a
        ld bc,$253B
    WaitUntil:
        in a,(c)
        cp e
        jr nz,WaitUntil
        ret
    `);
    s.runUntilReady().runFrames(3);
    const column = (y0: number, y1: number) => {
      const seen = new Set<string>();
      for (let y = y0; y <= y1; y++) for (let x = 98; x <= 109; x++) seen.add(s.pixel(x, y));
      return [...seen].join(",");
    };
    expect({ top: column(48, 143), bottom: column(152, 239) }).toEqual({ top: "#0000FF", bottom: "#FF0000" });
  });
});
