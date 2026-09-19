import { describe, expect, it } from "vitest";

import { createSession, displayFileAddress } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";
import { colours, hex8, PAPER_LEFT, PAPER_TOP, writePalette } from "./_ula-helpers";

/*
 * Port $FF beyond the screen mode, and mode changes during the frame (catalogue TMX-006 - TMX-009,
 * TMX-012).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~3607-3622: port_ff_reg takes the whole byte on a port write (~2670: only with the port enable,
 *   $82 bit 0 - no timing condition); NextReg $69 writes bits 5-0, $22 writes bit 6 from its bit 2,
 *   $C4 writes bit 6 from the inverse of its bit 0. Reset clears it.
 * - ~3632, ~6657: bit 6 disables the ULA frame interrupt; ~5938 $22 bit 2 and ~6185 $C4 bit 0
 *   (inverted) read it. Bit 7 is stored and nothing else uses it (no paging effect).
 * - ~2769: `in $FF` returns the whole register with $08 bit 2 and the enable; ~6042 $69 returns
 *   Layer 2 enable, the shadow screen bit and port $FF bits 5-0.
 * - zxula.vhd ~193-210: the screen mode is sampled with the scroll at hc(3:0) = 3 / B, once per 8-pixel
 *   cell, for the fetches of the next cell: a mode change shows from a cell boundary.
 */

describe("Timex port $FF", () => {
  /** A session with an IM 2 handler that counts interrupts in `Ticks`. */
  async function ticking() {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
Start:  di
        ld hl,$bd00
        ld de,$bd01
        ld bc,256
        ld (hl),$ba
        ldir
        ld a,$bd
        ld i,a
        im 2
        nextreg $22,$00          ; line interrupt off, ULA interrupt on
        ei
        nextreg $7f,$a5
Park:   jr Park
Ticks:  .defb 0

        .org $baba
Handler:
        push af
        ld a,(Ticks)
        inc a
        ld (Ticks),a
        pop af
        ei
        reti
    `, { entry: "Start" });
    s.runUntilReady();
    const ticksIn = (frames: number) => {
      const before = s.peek(s.symbol("Ticks"));
      s.runFrames(frames);
      return (s.peek(s.symbol("Ticks")) - before) & 0xff;
    };
    return { s, ticksIn };
  }

  it("TMX-006: port $FF bit 6 disables the ULA interrupt; $22 bit 2 and $C4 bit 0 read and write it", async () => {
    const { s, ticksIn } = await ticking();
    expect(ticksIn(10), "enabled").toBe(10);
    s.out(0x00ff, 0x40);
    expect(s.readNextReg(0x22) & 0x04, "$22 bit 2").toBe(0x04);
    expect(s.readNextReg(0xc4) & 0x01, "$C4 bit 0").toBe(0x00);
    expect(ticksIn(10), "disabled by port $FF").toBe(0);
    s.out(0x00ff, 0x00); // --- a port write sets all eight bits: bit 6 clear enables again
    expect(ticksIn(10), "enabled by port $FF").toBe(10);
    s.setNextReg(0x22, 0x04);
    s.setNextReg(0x08, 0x04); // --- $FF reads the register
    expect(s.in(0x00ff) & 0x40, "$22 bit 2 sets port $FF bit 6").toBe(0x40);
    expect(ticksIn(10), "disabled by $22").toBe(0);
    s.setNextReg(0xc4, 0x01);
    expect(s.in(0x00ff) & 0x40, "$C4 bit 0 clears it").toBe(0x00);
    expect(ticksIn(10), "enabled by $C4").toBe(10);
  });

  it("TMX-007: bit 7 is stored and read through port $FF; $69 has bits 5-0 only; no paging effect", async () => {
    const s = await createSession();
    await s.loadCode(" .org $8000\n di\n jr $");
    const rom = s.peekBytes(0x0000, 16);
    const mmu = () => [0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57].map((r) => s.readNextReg(r));
    const mmuBefore = mmu();
    s.setNextReg(0x08, 0x04).out(0x00ff, 0x86);
    expect(s.in(0x00ff), "port $FF").toBe(0x86);
    expect(s.readNextReg(0x69), "$69: Layer 2 off, no shadow, bits 5-0").toBe(0x06);
    expect(mmu(), "MMU").toEqual(mmuBefore);
    expect([...s.peekBytes(0x0000, 16)], "ROM still at $0000").toEqual([...rom]);
    // --- $69 writes bits 5-0 and leaves bits 7-6 of port $FF alone
    s.setNextReg(0x69, 0x02);
    expect(s.in(0x00ff), "after $69").toBe(0x82);
    // --- ~3610: every reset clears the register, a soft reset too
    s.out(0x00ff, 0xc6).reset();
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0x08, 0x04);
    expect(s.in(0x00ff), "after a soft reset").toBe(0x00);
    expect(s.readNextReg(0x22) & 0x04, "ULA interrupt enabled again").toBe(0x00);
  });

  for (const [timing, nr03] of [["48K", 0x90], ["128K", 0xa0], ["+3", 0xb0], ["Pentagon", 0xc0]] as const) {
    it(`TMX-012: ${timing} timing - port $FF writes need only the port enable ($82 bit 0)`, async () => {
      const s = await createSession();
      await s.loadCode(" .org $8000\n di\n jr $");
      s.setNextReg(0x03, nr03).runFrames(2);
      s.out(0x00ff, 0x06);
      expect(s.readNextReg(0x69) & 0x3f, "written").toBe(0x06);
      s.setNextReg(0x82, 0xfe).out(0x00ff, 0x01);
      expect(s.readNextReg(0x69) & 0x3f, "port disabled: ignored").toBe(0x06);
      s.setNextReg(0x69, 0x02);
      expect(s.readNextReg(0x69) & 0x3f, "$69 still writes it").toBe(0x02);
      s.setNextReg(0x82, 0xff).out(0x00ff, 0x00);
      expect(s.readNextReg(0x69) & 0x3f, "enabled again").toBe(0x00);
    });
  }

  /*
   * TMX-008: once per frame the program sets mode 0 at line 250 and mode 2 (HiColor) at line 96. Cell
   * column 0 has bitmap $F0 on every line, attribute INK 1 PAPER 2 at $5800 and INK 3 PAPER 4 in every
   * HiColor byte at $6000. Rows drawn before the switch show the standard colours, rows after it the
   * HiColor ones; row 96 (the switch line) is not checked.
   */
  it("TMX-008: a mode switch from 0 to 2 in mid-frame changes the rows drawn after it", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
        xor a
        out ($ff),a
        ld a,96
        call WaitLine
        ld a,2
        out ($ff),a
        jr Frame

WaitLine:
        ld e,a
        ld bc,$243b
        ld a,$1f
        out (c),a
        ld bc,$253b
WaitUntil:
        in a,(c)
        cp e
        jr nz,WaitUntil
        ret
    `, { entry: "Start" });
    writePalette(s, [[1, 0xe0], [18, 0x1c], [3, 0x03], [20, 0xfc]]);
    s.setNextReg(0x14, 0xe3);
    for (let row = 0; row < 192; row++) {
      s.poke(displayFileAddress(row, 0), 0xf0).poke(displayFileAddress(row, 0) + 0x2000, (4 << 3) | 3);
    }
    s.poke(0x5800, new Array(768).fill((2 << 3) | 1));
    s.runUntilReady().runFrames(3);
    const band = (y0: number, y1: number) =>
      `${colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP + y0, PAPER_TOP + y1])} | ${colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], [PAPER_TOP + y0, PAPER_TOP + y1])}`;
    expect({ before: band(0, 95), after: band(97, 191) }).toEqual({
      before: `${hex8(0xe0)} | ${hex8(0x1c)}`,
      after: `${hex8(0x03)} | ${hex8(0xfc)}`
    });
  });

  /*
   * TMX-009: `OUT ($FF)` from mode 0 to mode 1 swept one T-state at a time across a paper line. $4000
   * is blank and $6000 all ink, with the same attributes at $5800 and $7800, so the line turns to ink
   * where mode 1 takes effect. The mode is sampled once per 8-pixel cell, so the edge sits on the
   * 16-pixel cell grid and moves 16 pixels every 4 T-states.
   */
  it("TMX-009: a mid-line mode switch takes effect at an 8-pixel cell boundary", async () => {
    const ROW = PAPER_TOP + 100;
    async function edge(d: number): Promise<number> {
      const s = await createSession();
      await s.loadCode(" .org $8000\n di\n jr $");
      writePalette(s, [[1, 0xe0], [18, 0x1c]]);
      s.setNextReg(0x14, 0xe3).setNextReg(0x03, 0xb0);
      s.poke(0x4000, new Array(0x1800).fill(0x00)).poke(0x6000, new Array(0x1800).fill(0xff));
      s.poke(0x5800, new Array(768).fill((2 << 3) | 1)).poke(0x7800, new Array(768).fill((2 << 3) | 1));
      s.out(0x00ff, 0x00).runFrames(3);
      await s.loadCode(`
        .org $8000
Start:  di
${delay(d)}
        ld a,1
        out ($ff),a
        nextreg $7f,$a5
        jr $
      `, { entry: "Start" });
      s.setNextReg(0x7f, 0).runUntilReady({ maxFrames: 5 });
      expect(colours(s, [PAPER_LEFT, PAPER_LEFT + 511], [ROW - 1, ROW - 1]), `${d}: the line above is mode 0`).toBe(hex8(0x1c));
      for (let x = PAPER_LEFT; x < PAPER_LEFT + 512; x++) if (s.pixel(x, ROW) === hex8(0xe0)) return x;
      throw new Error(`${d}: no mode 1 pixel on the line`);
    }
    const xs: number[] = [];
    for (let d = 37450; d < 37450 + 20; d++) xs.push(await edge(d));
    expect(xs.filter((x) => (x - PAPER_LEFT) % 16 !== 0), `edges on the cell grid: ${xs}`).toEqual([]);
    const runs: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      if (i > 0 && xs[i] === xs[i - 1]) runs[runs.length - 1]++;
      else {
        if (i > 0) expect(xs[i] - xs[i - 1], `step at ${i}: ${xs}`).toBe(16);
        runs.push(1);
      }
    }
    expect(runs.slice(1, -1).every((r) => r === 4), `run lengths ${runs}`).toBe(true);
    expect(runs.length).toBeGreaterThanOrEqual(4);
  });
});
