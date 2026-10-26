import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * Port $FF (ULA floating bus / Timex readback) and the +3 floating bus on $0FFD (catalogue PORT-006 -
 * PORT-008).
 *
 * Hardware:
 * - zxnext.vhd ~2769: $FF reads the Timex register when $08 bit 2 and the port enable (bit 0) are set,
 *   otherwise the ULA floating bus; ~4493 that is `ula_floating_bus` in 48K and 128K timing, $FF in
 *   +3 and Pentagon timing.
 * - zxula.vhd ~306-340, 573: in the display area each 8-tact character cell puts the pixel and
 *   attribute bytes the ULA fetches on the bus for its second half (hc 9-15) and $FF for the first
 *   (hc 1-8); in the border it is $FF. In +3 timing bit 0 of those bytes reads 1, and outside them the
 *   bus holds `p3_floating_bus_dat` - the last byte read or written in a contended bank (~4478-4488:
 *   banks 4-7 in +3 timing, by page, not by address).
 * - zxnext.vhd ~2545, 4497: $0FFD (A15-12 = 0000, A1-0 = 01) is the +3 floating bus port in +3
 *   timing with enable bit 4; it reads $FF while $7FFD is locked.
 *
 * The screen is filled with one pixel byte and one attribute byte so every floating-bus value is one
 * of three. The sampling loop takes 44 tacts per read, so it lands on every phase of the 8-tact cell.
 */

const PIXEL = 0x55;
const ATTR = 0x38;
const SAMPLES = 2000;

/** Fills the screen, syncs to a frame interrupt and samples `port` SAMPLES times into $C000. */
function samplerProgram(timing: number, port: number, setup = "", afterFill = ""): string {
  return `
        .org $8000
Start:
        nextreg $03,${timing}
        nextreg $08,$00          ; bit 2 = 0: $FF is the floating bus
${setup}
        ld hl,$4000
        ld (hl),${PIXEL}
        ld de,$4001
        ld bc,$17ff
        ldir
        ld hl,$5800
        ld (hl),${ATTR}
        ld de,$5801
        ld bc,$02ff
        ldir
${afterFill}
        ld a,$b0                 ; IM 2, handler just returns
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
        halt                     ; sampling starts at the frame interrupt
        di
        ld hl,$c000
        ld de,${SAMPLES}
        ld bc,${port}
Sample: in a,(c)                 ; 12
        ld (hl),a                ; 7
        inc hl                   ; 6
        dec de                   ; 6
        ld a,d                   ; 4
        or e                     ; 4
        jr nz,Sample             ; 12 -> 51 tacts
        nextreg $7f,$a5
Stop:   jr Stop
`;
}

async function sample(timing: number, port: number, setup = "", afterFill = ""): Promise<number[]> {
  const s = await createSession();
  await s.loadCode(samplerProgram(timing, port, setup, afterFill), { entry: "Start" });
  s.runUntilReady({ maxFrames: 10 });
  return Array.from(s.peekBytes(0xc000, SAMPLES));
}

const T48 = 0x90;
const T128 = 0xa0;
const TP3 = 0xb0;

const histogram = (values: number[]) =>
  values.reduce<Record<string, number>>((h, v) => ((h[v.toString(16)] = (h[v.toString(16)] ?? 0) + 1), h), {});

describe("floating bus", () => {
  for (const [name, timing] of [["48K", T48], ["128K", T128]] as const) {
    it(`PORT-006: in ${name} timing $FF reads the pixel and attribute bytes during the display, $FF elsewhere`, async () => {
      const values = await sample(timing, 0x00ff);
      const h = histogram(values);
      expect(Object.keys(h).sort(), JSON.stringify(h)).toEqual(["38", "55", "ff"]);
      // --- ~64 top border lines come first: the first 250 samples (12750 tacts) are all $FF
      expect(values.slice(0, 250).every((v) => v === 0xff)).toBe(true);
      // --- 192 x 128 display tacts of a ~70000-tact frame, half of each cell: roughly 1 in 6
      const busy = values.filter((v) => v !== 0xff).length / values.length;
      expect(busy, JSON.stringify(h)).toBeGreaterThan(0.08);
      expect(busy).toBeLessThan(0.3);
    });
  }

  it("PORT-006: in +3 timing $FF reads $FF", async () => {
    const values = await sample(TP3, 0x00ff);
    expect(histogram(values)).toEqual({ ff: SAMPLES });
  });

  it("PORT-007: with $08 bit 2 set $FF reads the Timex register instead", async () => {
    const s = await createSession();
    s.setNextReg(0x03, T48).out(0x00ff, 0x3a);
    s.setNextReg(0x08, 0x04);
    expect(s.in(0x00ff)).toBe(0x3a);
    s.setNextReg(0x69, 0x05); // --- $69 bits 5-0 write the same register
    expect(s.in(0x00ff)).toBe(0x05);
  });

  // --- PORT-008
  it("PORT-008: in +3 timing $0FFD reads the display bytes (bit 0 set) and the last contended access", async () => {
    // --- The sampling loop writes to $C000 (bank 0, not contended); $4000 holds the pixels
    const values = await sample(TP3, 0x0ffd);
    const h = histogram(values);
    // --- border: the last contended access was the attribute fill (LDIR into bank 5) = $38
    expect(Object.keys(h).sort(), JSON.stringify(h)).toEqual(["38", "39", "55"]);
  });

  it("PORT-008: $0FFD reads the last byte written to or read from a contended bank", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        ld a,$a7
        ld ($6000),a             ; bank 5: contended in +3 timing
        ld bc,$0ffd
        in a,(c)
        ld ($a000),a
        ld a,$3c
        ld ($c000),a             ; bank 0: not contended
        in a,(c)
        ld ($a001),a
        ld a,($6000)             ; a read is latched too
        ld a,$5a
        ld ($6001),a
        ld a,($6000)
        in a,(c)
        ld ($a002),a
        nextreg $7f,$a5
        jr $
    `);
    s.runUntilReady();
    expect(Array.from(s.peekBytes(0xa000, 3)).map((v) => v.toString(16))).toEqual(["a7", "a7", "a7"]);
  });

  describe("PORT-006: the bytes are the ones the ULA fetches", () => {
    /*
     * zxula.vhd ~191-250: floating_bus_r takes the byte the ULA reads, from the address it forms - the
     * column moved by the coarse X scroll ($26 bits 7-3), the line by the Y scroll ($27, wrapped at
     * 192), the display file and colour address by the Timex mode (port $FF bits 2-0), forced to the
     * standard screen while the shadow screen (bank 7) is shown.
     *
     * Each pair of runs is the same program but for one setting, so sample i falls on the same beam
     * position in both, and the screen's bytes say which address each sample came from.
     */
    const fill = (pairs: Array<[number, number, number]>) =>
      pairs.map(([addr, len, v]) => `
        ld hl,${addr}
        ld (hl),${v}
        ld de,${addr + 1}
        ld bc,${len - 1}
        ldir`).join("\n");

    /** Bitmap byte = its column (0-31), attribute = $80 + its column */
    const COLUMNS = `
        ld hl,$4000
Col:    ld a,l
        and $1f
        ld (hl),a
        inc hl
        ld a,h
        cp $58
        jr nz,Col
Attr:   ld a,l
        and $1f
        or $80
        ld (hl),a
        inc hl
        ld a,h
        cp $5b
        jr nz,Attr`;

    /** Bitmap byte = its line (0-191), attribute = $C0 + its character row (0-23) */
    const LINES = `
        ld b,0
Line:   ld a,b                  ; HL = the line's address: 010 Y7Y6 Y2Y1Y0 | Y5Y4Y3 X4-X0
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

    /** Samples port $FF in 128K timing, with `code` run after the sampler's own screen fill */
    const run = (code: string) => sample(T128, 0x00ff, "", code);

    it("moves with the X scroll by whole columns", async () => {
      const plain = await run(COLUMNS);
      const scrolled = await run(`${COLUMNS}\n        nextreg $26,${8 * 5 + 3}`); // 5 columns and 3 dots
      const expected = plain.map((v) => (v === 0xff ? v : (v & 0xe0) | ((v + 5) & 0x1f)));
      expect(plain.filter((v) => v !== 0xff).length).toBeGreaterThan(100);
      expect(scrolled).toEqual(expected);
    });

    it("moves with the Y scroll, wrapping at line 192", async () => {
      const plain = await run(LINES);
      const scrolled = await run(`${LINES}\n        nextreg $27,${8 * 13}`); // 13 character rows
      const expected = plain.map((v) => (v === 0xff ? v : v < 0xc0 ? (v + 104) % 192 : 0xc0 + (((v & 0x1f) + 13) % 24)));
      expect(scrolled).toEqual(expected);
      // --- a scroll inside a character row: the bitmap bytes follow it line by line
      const fine = await run(`${LINES}\n        nextreg $27,5`);
      plain.forEach((v, i) => {
        if (v < 0xc0) expect(fine[i]).toBe((v + 5) % 192);
      });
    });

    it("follows the Timex mode's display file and colour address, and the shadow screen", async () => {
      // --- the sampler's $4000 bitmap $55 and $5800 attributes $38; then $6000 bitmap $33, $7800
      // --- attributes $44, and bank 7 (paged in at $C000 for the fill) bitmap $77, attributes $66
      const screens = `${fill([[0x6000, 0x1800, 0x33], [0x7800, 0x300, 0x44]])}
        ld bc,$7ffd
        ld a,$07
        out (c),a
${fill([[0xc000, 0x1800, 0x77], [0xd800, 0x300, 0x66]])}
        ld a,$00
        out (c),a`;
      const values = async (mode: number, shadow = false) => {
        const set = new Set(await run(`${screens}
        ld a,${mode}
        out ($ff),a
        ld bc,$7ffd
        ld a,${shadow ? 0x08 : 0x00}
        out (c),a`));
        return [...set].sort((a, b) => a - b).map((v) => v.toString(16));
      };
      expect(await values(0x00)).toEqual(["38", "55", "ff"]); // standard: $4000 and $5800
      expect(await values(0x01)).toEqual(["33", "44", "ff"]); // second screen
      expect(await values(0x02)).toEqual(["33", "55", "ff"]); // hi-colour: bitmap $4000, colour $6000
      expect(await values(0x06)).toEqual(["33", "55", "ff"]); // hi-res: both bitmaps
      expect(await values(0x01, true)).toEqual(["66", "77", "ff"]); // shadow screen: bank 7, standard
    });
  });

  it("PORT-008: $0FFD reads $FF while $7FFD is locked, when disabled, and outside +3 timing", async () => {
    const run = async (setup: (s: Awaited<ReturnType<typeof createSession>>) => void) => {
      const s = await createSession();
      setup(s);
      await s.loadCode(`
        .org $8000
        ld a,$a7
        ld ($6000),a
        ld bc,$0ffd
        in a,(c)
        ld ($a000),a
        nextreg $7f,$a5
        jr $
      `);
      s.runUntilReady();
      return s.peek(0xa000);
    };
    expect(await run(() => {}), "reference").toBe(0xa7);
    expect(await run((s) => s.out(0x7ffd, 0x20)), "locked").toBe(0xff);
    expect(await run((s) => s.setNextReg(0x82, 0xef)), "enable bit 4 clear").toBe(0xff);
    expect(await run((s) => s.setNextReg(0x03, T128)), "128K timing").toBe(0xff);
  });
});
