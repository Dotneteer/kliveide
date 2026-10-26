import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * When a scroll or Timex mode write reaches the floating bus (catalogue PORT-006).
 *
 * Hardware: zxula.vhd samples the scroll (px, py) and the screen mode once per 8-dot cell, at
 * hc(3:0) = 3 and B, and the bytes the floating bus shows (~306-340) are fetched from the addresses
 * formed with those samples. A write in the middle of a line therefore reaches the floating bus only
 * from the next sample point on.
 *
 * Each program writes a setting, reads port $FF a few tacts later, writes the setting back and reads
 * again, in a loop whose length (not a multiple of the 228-tact line) walks the write across every
 * phase of the cell. The pad (NOPs between the write and its read) varies per program. The samples
 * go to $C000; these programs are replayed on the simulated FPGA core by F3 (test/vhdl/f3/), which
 * compares the whole RAM.
 */

const SAMPLES = 2000;

/** Bitmap byte = its column, attributes $80 + column; second file $40 + column, $A0 + column */
const COLUMNS = `
        ld hl,$4000
Col:    ld a,l
        and $1f
        ld (hl),a
        set 5,h
        or $40
        ld (hl),a
        res 5,h
        inc hl
        ld a,h
        cp $58
        jr nz,Col
Attr:   ld a,l
        and $1f
        or $80
        ld (hl),a
        set 5,h
        or $20
        ld (hl),a
        res 5,h
        inc hl
        ld a,h
        cp $5b
        jr nz,Attr`;

/** Bitmap byte = its line (0-191), attributes $C0 + character row */
const LINES = `
        ld b,0
Line:   ld a,b
        and $07
        ld h,a
        ld a,b
        and $c0
        rrca
        rrca
        rrca
        or h
        or $40
        ld h,a
        ld a,b
        and $38
        rlca
        rlca
        ld l,a
        ld c,32
Fill:   ld (hl),b
        inc l
        dec c
        jr nz,Fill
        inc b
        ld a,b
        cp 192
        jr nz,Line
        ld hl,$5800
        ld b,0
Row:    ld c,32
        ld a,b
        or $c0
Cell:   ld (hl),a
        inc hl
        dec c
        jr nz,Cell
        inc b
        ld a,b
        cp 24
        jr nz,Row`;

/**
 * The write that sets the setting, the one that restores it, and a filler that makes the loop's length
 * (plus 8 tacts per NOP) not a multiple of 4 tacts, the cell: 116 + 7 tacts for the NextReg writes,
 * 109 for the OUTs. Lines are 228 tacts, a multiple of 4, so the loop length alone walks the write
 * across the cell's four tact positions.
 */
const SETTINGS = {
  scrollX: { screen: COLUMNS, set: "nextreg $26,8", same: "nextreg $26,0", reset: "nextreg $26,0", filler: "ld a,(hl)" },
  scrollY: { screen: LINES, set: "nextreg $27,1", same: "nextreg $27,0", reset: "nextreg $27,0", filler: "ld a,(hl)" },
  timex: {
    screen: COLUMNS,
    set: "ld a,1\n        out ($ff),a",
    same: "ld a,0\n        out ($ff),a",
    reset: "xor a\n        out ($ff),a",
    filler: ""
  }
} as const;

/** The byte the changed setting shows where the unchanged one shows `v` (undefined: not predictable) */
const CHANGED: Record<keyof typeof SETTINGS, (v: number) => number | undefined> = {
  scrollX: (v) => (v & 0xe0) | ((v + 1) & 0x1f), // one column on
  scrollY: (v) => (v < 0xc0 ? (v + 1) % 192 : undefined), // one line on; the row may or may not change
  timex: (v) => (v < 0x80 ? v | 0x40 : v | 0x20) // the second display file
};

/** `control`: the first write is replaced by one of the same length that changes nothing */
function program(setting: keyof typeof SETTINGS, pad: number, control = false): string {
  const { screen, set, same, reset, filler } = SETTINGS[setting];
  const nops = "        nop\n".repeat(pad);
  return `
        .org $8000
Start:
        nextreg $03,$a0          ; 128K timing
        nextreg $08,$00          ; port $FF reads the floating bus
${screen}
        ld a,$b0                 ; IM 2, the handler only returns
        ld i,a
        im 2
        ld hl,$b000
        ld (hl),$b2
        ld de,$b001
        ld bc,$0100
        ldir
        ld a,$fb                 ; ei
        ld ($b2b2),a
        ld a,$ed                 ; reti
        ld ($b2b3),a
        ld a,$4d
        ld ($b2b4),a
        ei
        halt
        di
        ld hl,$c000
        ld de,${SAMPLES / 2}
        ld bc,$00ff
Sample: ${control ? same : set}
${nops}        in a,(c)
        ld (hl),a
        inc hl
        ${reset}
${nops}        in a,(c)
        ld (hl),a
        inc hl
        ${filler}
        dec de
        ld a,d
        or e
        jr nz,Sample
        nextreg $7f,$a5
Stop:   jr Stop
`;
}

async function sample(setting: keyof typeof SETTINGS, pad: number, control = false): Promise<number[]> {
  const s = await createSession();
  await s.loadCode(program(setting, pad, control), { entry: "Start" });
  s.runUntilReady({ maxFrames: 20 });
  return Array.from(s.peekBytes(0xc000, SAMPLES));
}

describe("floating bus: when a mid-line write reaches it", () => {
  for (const setting of Object.keys(SETTINGS) as Array<keyof typeof SETTINGS>) {
    for (const pad of [0, 1, 2, 3]) {
      it(`${setting}, read ${pad} NOP(s) after the write`, async () => {
        const values = await sample(setting, pad);
        const plain = await sample(setting, pad, true);
        // --- each sample shows the setting before the write ("old") or after it ("new")
        const census = { afterSet: { old: 0, new: 0 }, afterReset: { old: 0, new: 0 } };
        values.forEach((v, i) => {
          const c = plain[i];
          if (c === 0xff) return expect(v).toBe(0xff);
          const changed = CHANGED[setting](c);
          if (changed === undefined) return;
          const set = i % 2 === 0; // even samples follow the write that changes, odd ones the restore
          expect([c, changed]).toContain(v);
          const shows = v === changed ? (set ? "new" : "old") : set ? "old" : "new";
          census[set ? "afterSet" : "afterReset"][shows]++;
        });
        // --- the CPU's IN comes at least ~10 tacts after its own write, past the next sample point:
        // --- it always sees the write (checked against the simulated FPGA core by F3)
        expect(census.afterSet.old + census.afterReset.old).toBe(0);
        expect(census.afterSet.new).toBeGreaterThan(50);
        expect(census.afterReset.new).toBeGreaterThan(50);
      });
    }
  }
});

/*
 * The Copper writes at an exact beam position: WAIT(line, H) releases at hcount >= H * 8 + 12
 * (copper.vhd), and the MOVE after it writes the NextReg the next 28 MHz tick. On every display line
 * the list sets the setting at H1 and restores it at H2, while the CPU samples port $FF every 55
 * tacts. 55 and the 228-tact line have no common factor, so the reads fall on every tact of the line,
 * at every distance from the Copper's writes.
 */
const COPPER_SAMPLES = 4000;
const COPPER = {
  scrollX: { screen: COLUMNS, reg: 0x26, value: 8 },
  scrollY: { screen: LINES, reg: 0x27, value: 1 },
  timex: { screen: COLUMNS, reg: 0x69, value: 1 }
} as const;
/** The HC at which an IN first sees a Copper write made at H1, as measured on the FPGA core */
const NEW_FROM: Record<number, number> = { 10: 216, 11: 220 };

/** The Copper's set position H1 (8-HC units); it restores at H1 + 10 */
function copperProgram(setting: keyof typeof COPPER, H1: number, control = false): string {
  const H2 = H1 + 10;
  const { screen, reg, value } = COPPER[setting];
  const set = control ? 0 : value;
  return `
        .org $8000
Start:
        nextreg $03,$a0          ; 128K timing
        nextreg $08,$00          ; port $FF reads the floating bus
${screen}
        nextreg $62,$00          ; the Copper stopped, its list from 0
        nextreg $61,$00
        ld hl,0                  ; for each display line: WAIT(line,H1) MOVE reg,set WAIT(line,H2) MOVE reg,0
CopLine:
        ld a,${0x80 | (H1 << 1)}
        or h
        nextreg $63,a
        ld a,l
        nextreg $63,a
        nextreg $63,${reg}
        nextreg $63,${set}
        ld a,${0x80 | (H2 << 1)}
        or h
        nextreg $63,a
        ld a,l
        nextreg $63,a
        nextreg $63,${reg}
        nextreg $63,0
        inc hl
        ld a,l
        cp 192
        jr nz,CopLine
        nextreg $63,$ff          ; HALT
        nextreg $63,$ff
        nextreg $62,$c0          ; run the list from 0, restarting at line 0 of every frame
        ld a,$b0                 ; IM 2, the handler only returns
        ld i,a
        im 2
        ld hl,$b000
        ld (hl),$b2
        ld de,$b001
        ld bc,$0100
        ldir
        ld a,$fb                 ; ei
        ld ($b2b2),a
        ld a,$ed                 ; reti
        ld ($b2b3),a
        ld a,$4d
        ld ($b2b4),a
        ei
        halt
        halt                     ; a whole frame of the Copper first
        di
        ld hl,$c000
        ld de,${COPPER_SAMPLES}
        ld bc,$00ff
Sample: in a,(c)                 ; 12
        ld (hl),a                ; 7
        inc hl                   ; 6
        nop                      ; 4
        dec de                   ; 6
        ld a,d                   ; 4
        or e                     ; 4
        jr nz,Sample             ; 12 -> 55 tacts, coprime with the 228-tact line
        nextreg $7f,$a5
Stop:   jr Stop
`;
}

/** The samples, and the beam (line, HC) as each IN instruction starts */
async function copperSample(setting: keyof typeof COPPER, h1: number, control = false) {
  const s = await createSession();
  await s.loadCode(copperProgram(setting, h1, control), { entry: "Start" });
  s.runTo("Sample", { maxFrames: 20 });
  const beams: Array<{ line: number; hc: number }> = [];
  for (let i = 0; i < COPPER_SAMPLES; i++) {
    const b = s.beamPosition();
    beams.push({ line: b.line, hc: b.lineTact });
    s.step(8);
  }
  s.runUntilReady({ maxFrames: 5 });
  return { values: Array.from(s.peekBytes(0xc000, COPPER_SAMPLES)), beams };
}

describe("floating bus: a Copper write in the middle of a line", () => {
  for (const setting of Object.keys(COPPER) as Array<keyof typeof COPPER>) {
    for (const h1 of [10, 11]) it(`${setting}, set at H ${h1}`, async () => {
      const { values, beams } = await copperSample(setting, h1);
      const { values: plain } = await copperSample(setting, h1, true);
      // --- A sample shows the changed setting exactly when its IN starts at HC NEW_FROM[h1] up to 80 HC
      // --- later. Each 16-HC group's floating bus window is 4 reads; with H1 = 11 the change falls
      // --- inside the window: its first two reads still show the old setting, its last two the new.
      // --- Every sample (4,000 per program) matches the simulated FPGA core (F3).
      let changedSeen = 0;
      values.forEach((v, i) => {
        const c = plain[i];
        if (c === 0xff) return expect(v).toBe(0xff);
        const changed = CHANGED[setting](c);
        if (changed === undefined) return;
        const hc = beams[i].hc;
        const inChange = hc >= NEW_FROM[h1] && hc < NEW_FROM[h1] + 80;
        expect(`HC ${hc}: ${v.toString(16)}`).toBe(`HC ${hc}: ${(inChange ? changed : c).toString(16)}`);
        if (inChange) changedSeen++;
      });
      expect(changedSeen).toBeGreaterThan(20);
    });
  }
});
