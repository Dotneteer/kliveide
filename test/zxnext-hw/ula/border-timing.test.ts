import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";
import { colours, hex8, writePalette } from "./_ula-helpers";

/*
 * Border changes during the frame (catalogue ULA-006, ULA-007).
 *
 * Hardware:
 * - zxula_timing.vhd ~566-580: the line interrupt for line L fires on line L - 1 (cvc = L - 1) at
 *   hc_ula = 255, i.e. near the end of the paper of the line before; so a border OUT in its handler
 *   shows from line L on (line L - 1 and line L are not checked: the exact column depends on the
 *   handler's latency).
 * - zxula.vhd ~427-441: the border reaches the picture through attr_reg, which takes the port $FE
 *   colour (border_clr) only at the shift-register loads (sload, every 8 pixels, at hc(3:0) = 4 / C,
 *   in step with the paper's character cells); only Pentagon timing reloads it every clock. So a
 *   mid-line change moves the edge in steps of 8 ULA pixels (16 buffer pixels) every 4 T-states, on
 *   the 16-pixel grid of the paper cells (buffer x 96 + 16k); on Pentagon it moves 2 pixels (4 buffer
 *   pixels) per T-state.
 */

const BORDER_PALETTE: Array<[number, number]> = [
  [16, 0x00], [17, 0x03], [18, 0xe0], [19, 0xe2], [20, 0x1c], [21, 0x1f], [22, 0xfc], [23, 0xb6]
];

describe.each(ALL_CORES)("ULA border timing - %s core", (core: CoreName) => {
  /*
   * ULA-006: a line-interrupt handler cycles the border through colours 0-7, one stripe per 32 lines:
   * stripe k (colour k) starts at line 8 + 32k. After stripe 7 (line 232) it restarts at line 8, so the
   * top border and lines 0-7 show colour 7.
   */
  it("ULA-006: a line interrupt every 32 lines paints horizontal border stripes at those lines", async () => {
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
Start:  di
        ld hl,$bd00              ; IM2 table: 257 x $BA -> vector $BABA
        ld de,$bd01
        ld bc,256
        ld (hl),$ba
        ldir
        ld a,$bd
        ld i,a
        im 2
        xor a
        ld (Stripe),a
        nextreg $23,8            ; first stripe line
        nextreg $22,%00000110    ; ULA interrupt off, line interrupt on, line MSB 0
        ei
        nextreg $7f,$a5
Park:   jr Park
Stripe: .defb 0

        .org $baba
Handler:
        push af
        ld a,(Stripe)
        out ($fe),a
        inc a
        and 7
        ld (Stripe),a
        ; --- next line = 8 + 32 * stripe
        rrca
        rrca
        rrca                     ; A = stripe * 32 (stripe < 8)
        add a,8
        nextreg $23,a
        pop af
        ei
        reti
    `, { entry: "Start" });
    writePalette(s, BORDER_PALETTE);
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0x00);
    s.runUntilReady().runFrames(3);

    const colourOf = (n: number) => hex8(BORDER_PALETTE[n][1]);
    const seen: string[] = [];
    const want: string[] = [];
    for (let k = 0; k < 8; k++) {
      const first = 8 + 32 * k + 1;
      const last = k < 7 ? 8 + 32 * (k + 1) - 2 : 239;
      const y: [number, number] = [48 + first, 48 + last];
      seen.push(`stripe ${k}: ${colours(s, [0, 95], y)} / ${colours(s, [608, 719], y)}`);
      want.push(`stripe ${k}: ${colourOf(k)} / ${colourOf(k)}`);
    }
    seen.push(`top: ${colours(s, [0, 719], [0, 47])} / ${colours(s, [0, 95], [48, 48 + 6])}`);
    want.push(`top: ${colourOf(7)} / ${colourOf(7)}`);
    seen.push(`bottom: ${colours(s, [0, 719], [48 + 233, 287])}`);
    want.push(`bottom: ${colourOf(7)}`);
    expect(seen).toEqual(want);
  });

  /**
   * The first buffer pixel (raster order) of a new border colour, when `OUT ($FE)` runs `d` T-states
   * after a frame start on timing `nr03`. The border is colour 2 before, colour 4 after.
   */
  async function edge(nr03: number, d: number): Promise<{ row: number; x: number; rowBefore: string }> {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    writePalette(s, [[18, 0xe0], [20, 0x1c]]);
    s.setNextReg(0x14, 0x00).setNextReg(0x03, nr03).out(0xfe, 2).runFrames(3);
    await s.loadCode(`
        .org $8000
Start:  di
${delay(d)}
        ld a,4
        out ($fe),a
        nextreg $7f,$a5
        jr $
    `, { entry: "Start" });
    s.setNextReg(0x7f, 0).runUntilReady({ maxFrames: 5 });
    const found = findEdge(s);
    return { ...found, rowBefore: colours(s, [0, 719], [found.row - 1, found.row - 1]) };
  }

  function findEdge(s: NextTestSession): { row: number; x: number } {
    const target = hex8(0x1c);
    for (let y = 0; y < 288; y++) for (let x = 0; x < 720; x++) if (s.pixel(x, y) === target) return { row: y, x };
    throw new Error("no border change on screen");
  }

  it("ULA-007: +3 timing - a mid-line border change moves in 8-pixel steps on the paper cell grid", async () => {
    // --- a bottom border line (buffer rows 240-287 are border across the whole width)
    const results: Array<{ d: number; row: number; x: number; rowBefore: string }> = [];
    for (let d = 62952; d < 62952 + 24; d++) results.push({ d, ...(await edge(0xb0, d)) });
    const rows = new Set(results.map((r) => r.row));
    expect(rows.size, JSON.stringify(results)).toBe(1);
    const row = results[0].row;
    expect(row, "a bottom border row").toBeGreaterThanOrEqual(241);
    expect(results.every((r) => r.rowBefore === hex8(0xe0)), "the row above is still the old colour").toBe(true);
    const xs = results.map((r) => r.x);
    expect(xs.filter((x) => x % 16 !== 0), `edges on the 16-pixel grid: ${xs}`).toEqual([]);
    // --- the edge advances 16 pixels every 4 T-states: runs of 4 equal values (the first may be short)
    const runs: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      if (i > 0 && xs[i] === xs[i - 1]) runs[runs.length - 1]++;
      else {
        if (i > 0) expect(xs[i] - xs[i - 1], `step at ${results[i].d}`).toBe(16);
        runs.push(1);
      }
    }
    expect(runs.slice(1, -1).every((r) => r === 4), `run lengths ${runs}`).toBe(true);
    expect(runs.length).toBeGreaterThanOrEqual(5);
  });

  it("ULA-007: Pentagon timing - the border changes at the T-state (2 pixels per T-state)", async () => {
    const results: Array<{ d: number; row: number; x: number }> = [];
    for (let d = 61400; d < 61400 + 12; d++) results.push({ d, ...(await edge(0xc0, d)) });
    expect(new Set(results.map((r) => r.row)).size, JSON.stringify(results)).toBe(1);
    expect(results[0].row, "a bottom border row").toBeGreaterThanOrEqual(241);
    const steps = results.slice(1).map((r, i) => r.x - results[i].x);
    expect(steps, JSON.stringify(results)).toEqual(Array(steps.length).fill(4));
  });

  /*
   * ULA-007 with the Copper: the border latch delays only the *port value*; the palette lookup stays
   * per pixel (zxula.vhd ~427-441 latch attr_reg = "00" & border & border, the index; zxnext.vhd looks
   * the colour up per pixel). So when the Copper rewrites the palette entry of the *old* border colour
   * at x = C on the same line as a CPU `OUT ($FE)` at x = B, with the new colour latched at L (the first
   * 16-pixel grid point after B), the line shows:
   *   old entry, old value  up to min(C, L)
   *   old entry, new value  from C to L   - only when C < L, even if the OUT came first (B < C)
   *   new border entry      from L
   * The OUT is swept one T-state at a time across C. C is measured on the last sweep step (OUT far
   * behind the Copper), where the recoloured stretch is certain to show.
   */
  it("ULA-007: a Copper palette write between a border OUT and its latch point shows at once", async () => {
    const OLD = 0xe0; // --- palette entry 18 (border 2) before the Copper write
    const RECOLOURED = 0x03; // --- entry 18 after it
    const NEW = 0x1c; // --- entry 20 (border 4)
    const LINE = 212; // --- copper line = cvc; buffer row 48 + 212 = 260, a bottom border row
    const ROW = 48 + LINE;
    const H = 8; // --- WAIT fires at paper x 64 = buffer x 224
    const NOPS = 16;

    async function row(d: number): Promise<Array<{ x: number; c: string }>> {
      const s = await createSession(core);
      await s.loadCode(" .org $8000\n di\n jr $");
      writePalette(s, [[18, OLD], [20, NEW]]);
      s.setNextReg(0x14, 0x00).setNextReg(0x03, 0xb0).out(0xfe, 2);
      // --- copper list: restore entry 18 at the frame start, recolour it at (LINE, H), halt
      const list = [
        0x40, 18, 0x41, OLD,
        0x80 | (H << 1) | (LINE >> 8), LINE & 0xff,
        ...Array(2 * NOPS).fill(0x00), // --- NOPs: move the palette write into the 16-pixel cell
        0x40, 18, 0x41, RECOLOURED,
        0xff, 0xff
      ];
      s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
      for (const b of list) s.setNextReg(0x60, b);
      s.setNextReg(0x61, 0x00).setNextReg(0x62, 0xc0).runFrames(3);
      await s.loadCode(`
        .org $8000
Start:  di
${delay(d)}
        ld a,4
        out ($fe),a
        nextreg $7f,$a5
        jr $
      `, { entry: "Start" });
      s.setNextReg(0x7f, 0).runUntilReady({ maxFrames: 5 });
      const runs: Array<{ x: number; c: string }> = [];
      for (let x = 0; x < 720; x++) {
        const c = s.pixel(x, ROW);
        if (!runs.length || runs[runs.length - 1].c !== c) runs.push({ x, c });
      }
      return runs;
    }

    const [old, recoloured, fresh] = [hex8(OLD), hex8(RECOLOURED), hex8(NEW)];
    const sweep: Array<{ d: number; runs: Array<{ x: number; c: string }> }> = [];
    for (let d = 62992; d <= 63024; d++) sweep.push({ d, runs: await row(d) });

    // --- C: where the recoloured stretch starts when the OUT is far behind the Copper
    const last = sweep[sweep.length - 1].runs;
    expect(last.map((r) => r.c), `last step ${JSON.stringify(last)}`).toEqual([old, recoloured, fresh]);
    const c = last[1].x;

    const seen: string[] = [];
    const want: string[] = [];
    for (const { d, runs } of sweep) {
      const edge = runs.find((r) => r.c === fresh);
      const l = edge ? edge.x : -1;
      seen.push(`${d}: ${runs.map((r) => `${r.c}@${r.x}`).join(" ")}`);
      want.push(`${d}: ${[`${old}@0`, ...(c < l ? [`${recoloured}@${c}`] : []), `${fresh}@${l}`].join(" ")}`);
      expect(l % 16, `${d}: new colour on the 16-pixel grid`).toBe(0);
    }
    expect(seen).toEqual(want);
    // --- The case the latch makes interesting must be in the sweep: an OUT before C whose latch point
    // --- follows C. The OUT moves 4 pixels per T-state (Pentagon test above; the latch hides it here),
    // --- so the first OUT whose latch is the grid point after C lies at most 4 pixels past the grid
    // --- point before C: C at least 8 pixels into its cell guarantees one.
    expect(c % 16, `C = ${c}`).toBeGreaterThanOrEqual(8);
    expect(sweep.some(({ runs }) => runs.length === 3 && runs[2].x - 16 < c && runs[2].x > c), "an OUT whose latch point follows C").toBe(true);
  });
});
