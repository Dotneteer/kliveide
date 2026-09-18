import { describe, expect, it } from "vitest";

import { ALL_CORES, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { colours, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "./_ula-helpers";

/*
 * LoRes and Radastan (catalogue LOR-001 - LOR-009).
 *
 * Hardware:
 * - video/lores.vhd (the whole module, transcribed in `loresIndex` below): x = display x + $32 (8 bits),
 *   y = display y + $33 folded back once it reaches 192. LoRes: address y(7:1) & x(7:1), + $800 when
 *   y >= 96 (the bottom half from $6000); pixel = (data(7:4) + $6A offset) & data(3:0). Radastan ($6A bit
 *   5): address dfile & y(7:1) & x(7:2), dfile = port $FF bit 0 XOR $6A bit 4 (zxnext.vhd ~6742);
 *   pixel = high nibble (the offset, or "11" & offset(1:0) with ULA+) & the data nibble picked by x(1).
 *   The pixel is valid inside the ULA clip window only.
 * - zxnext.vhd ~6879, ~6926-6937: with $15 bit 7 a valid LoRes pixel replaces the ULA pixel and is looked
 *   up in the ULA palette (the $43 bit 1 selection, no ULANext); ~7009: the ULA is transparent where
 *   LoRes is clipped (the border still shows); ~7046-7049: $14 and $68 bit 7 apply as to the ULA.
 * - ~5885, ~5973-5976, ~6045: $15 bit 7, $32, $33 and $6A read back.
 */

type LoRes = { sx: number; sy: number; radastan: boolean; dfile: number; offset: number; ulaPlus: boolean };
const PLAIN: LoRes = { sx: 0, sy: 0, radastan: false, dfile: 0, offset: 0, ulaPlus: false };

/** lores.vhd: the palette index of display pixel (x, y), 0-255 x 0-191, from bank 5 contents `mem`. */
function loresIndex(mem: Uint8Array, p: LoRes, dx: number, dy: number): number {
  const x = (dx + p.sx) & 0xff;
  const yPre = dy + p.sy;
  const y = yPre >= 192 ? (((((yPre >> 6) & 3) + 1) & 3) << 6) | (yPre & 0x3f) : yPre & 0xff;
  if (!p.radastan) {
    let addr = ((y >> 1) << 7) | (x >> 1);
    if (y >= 96) addr = ((((addr >> 11) + 1) & 7) << 11) | (addr & 0x7ff);
    const d = mem[addr & 0x3fff];
    return ((((d >> 4) + p.offset) & 0x0f) << 4) | (d & 0x0f);
  }
  const d = mem[((p.dfile << 13) | ((y >> 1) << 6) | (x >> 2)) & 0x3fff];
  const lo = x & 0x02 ? d & 0x0f : d >> 4;
  const hi = p.ulaPlus ? 0x0c | (p.offset & 0x03) : p.offset & 0x0f;
  return (hi << 4) | lo;
}

/** Bank 5 filled with a fixed pseudo-random pattern; palette entry i holds colour i (every index distinct). */
async function loresScreen(core: CoreName): Promise<{ s: NextTestSession; mem: Uint8Array }> {
  const s = await parkedSession(core);
  const mem = new Uint8Array(0x4000);
  let seed = 0x1234;
  for (let i = 0; i < mem.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    mem[i] = (seed >> 16) & 0xff;
  }
  s.poke(0x4000, mem);
  writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i] as [number, number]));
  // --- $14 = $4A = $E3: an index-$E3 pixel is transparent and shows the fallback - the same colour
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).out(0xfe, 1);
  return { s, mem };
}

/** Every paper pixel that differs from the model (at most 8 reported); `outside` gives the expected colour elsewhere. */
function mismatches(s: NextTestSession, expected: (x: number, y: number) => string): string[] {
  const bad: string[] = [];
  for (let y = 0; y < 192 && bad.length < 8; y++) {
    for (let x = 0; x < 256 && bad.length < 8; x++) {
      const want = expected(x, y);
      const got = [s.pixel(PAPER_LEFT + 2 * x, PAPER_TOP + y), s.pixel(PAPER_LEFT + 2 * x + 1, PAPER_TOP + y)];
      if (got[0] !== want || got[1] !== want) bad.push(`(${x},${y}): ${got.join("/")} != ${want}`);
    }
  }
  return bad;
}

const border = (s: NextTestSession) => colours(s, [0, 95], [0, 287]) + " " + colours(s, [0, 719], [0, 47]);

describe.each(ALL_CORES)("LoRes / Radastan - %s core", (core: CoreName) => {
  for (const offset of [0, 5]) {
    it(`LOR-001 / LOR-002: $15 bit 7 shows 128x96 LoRes from $4000 / $6000${offset ? `, palette offset ${offset}` : ""}`, async () => {
      const { s, mem } = await loresScreen(core);
      s.setNextReg(0x6a, offset).setNextReg(0x15, 0x80).runFrames(2);
      expect(s.readNextReg(0x15) & 0x80, "$15 bit 7").toBe(0x80);
      expect(s.readNextReg(0x6a), "$6A").toBe(offset);
      const p = { ...PLAIN, offset };
      expect(mismatches(s, (x, y) => hex8(loresIndex(mem, p, x, y)))).toEqual([]);
      expect(border(s), "border").toBe(`${hex8(17)} ${hex8(17)}`);
    });
  }

  it("LOR-001: LoRes reads bank 5 even while the 128K shadow screen (bank 7) is displayed", async () => {
    const { s, mem } = await loresScreen(core);
    // --- bank 7 at $C000 gets different contents, then is displayed
    s.out(0x7ffd, 0x07).poke(0xc000, new Array(0x4000).fill(0x77)).out(0x7ffd, 0x0f);
    s.setNextReg(0x15, 0x80).runFrames(2);
    expect(s.readNextReg(0x69) & 0x40, "shadow screen on").toBe(0x40);
    expect(mismatches(s, (x, y) => hex8(loresIndex(mem, PLAIN, x, y)))).toEqual([]);
  });

  it("LOR-002: LoRes uses the second ULA palette with $43 bit 1, and ignores ULANext", async () => {
    const { s, mem } = await loresScreen(core);
    writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i ^ 0x5a] as [number, number]), 0x40); // --- second ULA palette
    s.setNextReg(0x42, 0x07).setNextReg(0x43, 0x03).setNextReg(0x15, 0x80).runFrames(2);
    expect(mismatches(s, (x, y) => {
      const i = loresIndex(mem, PLAIN, x, y);
      return hex8((i ^ 0x5a) === 0xe3 ? 0xe3 : i ^ 0x5a);
    })).toEqual([]);
  });

  for (const [sx, sy] of [[1, 0], [2, 0], [3, 0], [7, 0], [128, 0], [255, 0], [0, 1], [0, 95], [0, 96], [0, 191], [0, 200], [37, 150]]) {
    it(`LOR-003: scroll $32 = ${sx}, $33 = ${sy}`, async () => {
      const { s, mem } = await loresScreen(core);
      s.setNextReg(0x32, sx).setNextReg(0x33, sy).setNextReg(0x15, 0x80).runFrames(2);
      expect([s.readNextReg(0x32), s.readNextReg(0x33)], "readback").toEqual([sx, sy]);
      const p = { ...PLAIN, sx, sy };
      expect(mismatches(s, (x, y) => hex8(loresIndex(mem, p, x, y)))).toEqual([]);
    });
  }

  it("LOR-004: the ULA clip window clips LoRes; outside it the fallback shows, the border stays", async () => {
    const { s, mem } = await loresScreen(core);
    s.setNextReg(0x4a, 0x00); // --- the fallback is colour $00 (also index $00's colour: rare in the pattern)
    s.setNextReg(0x1c, 0x04).setNextReg(0x1a, 16).setNextReg(0x1a, 47).setNextReg(0x1a, 8).setNextReg(0x1a, 23);
    s.setNextReg(0x15, 0x80).runFrames(2);
    const inside = (x: number, y: number) => x >= 16 && x <= 47 && y >= 8 && y <= 23;
    expect(mismatches(s, (x, y) => (inside(x, y) ? hex8(loresIndex(mem, PLAIN, x, y)) : hex8(0x00)))).toEqual([]);
    expect(border(s), "border").toBe(`${hex8(17)} ${hex8(17)}`);
  });

  it("LOR-005: a LoRes colour equal to $14 is transparent; $68 bit 7 hides LoRes with the ULA", async () => {
    const s = await parkedSession(core);
    // --- top half all $12, bottom half all $34
    s.poke(0x4000, new Array(0x1800).fill(0x12)).poke(0x6000, new Array(0x1800).fill(0x34));
    writePalette(s, [[0x12, 0x1c], [0x34, 0x6d], [17, 0xe0]]);
    s.setNextReg(0x14, 0x6d).setNextReg(0x4a, 0x03).out(0xfe, 1).setNextReg(0x15, 0x80).runFrames(2);
    const top = colours(s, [PAPER_LEFT, PAPER_LEFT + 511], [PAPER_TOP, PAPER_TOP + 95]);
    const bottom = colours(s, [PAPER_LEFT, PAPER_LEFT + 511], [PAPER_TOP + 96, PAPER_TOP + 191]);
    expect({ top, bottom }).toEqual({ top: hex8(0x1c), bottom: hex8(0x03) });
    s.setNextReg(0x68, 0x80).runFrames(1);
    expect(colours(s, [PAPER_LEFT, PAPER_LEFT + 511], [PAPER_TOP, PAPER_TOP + 191]), "ULA off").toBe(hex8(0x03));
  });

  for (const [offset, ulaPlus] of [[0, false], [3, false], [0x0e, false], [0x0e, true]] as const) {
    it(`LOR-006: Radastan, offset ${offset}${ulaPlus ? ", ULA+ on" : ""}`, async () => {
      const { s, mem } = await loresScreen(core);
      if (ulaPlus) s.out(0xbf3b, 0x40).out(0xff3b, 0x01);
      s.setNextReg(0x6a, 0x20 | offset).setNextReg(0x15, 0x80).runFrames(2);
      expect(s.readNextReg(0x6a), "$6A").toBe(0x20 | offset);
      const p = { ...PLAIN, radastan: true, offset, ulaPlus };
      expect(mismatches(s, (x, y) => hex8(loresIndex(mem, p, x, y)))).toEqual([]);
    });
  }

  // --- zxnext.vhd ~4226: Radastan's ULA+ input is ulap_en AND NOT ulanext_en
  it("LOR-006: Radastan with ULA+ and ULANext both on uses the plain offset", async () => {
    const { s, mem } = await loresScreen(core);
    s.out(0xbf3b, 0x40).out(0xff3b, 0x01).setNextReg(0x43, 0x01);
    s.setNextReg(0x6a, 0x20 | 0x0e).setNextReg(0x15, 0x80).runFrames(2);
    const p = { ...PLAIN, radastan: true, offset: 0x0e, ulaPlus: false };
    expect(mismatches(s, (x, y) => hex8(loresIndex(mem, p, x, y)))).toEqual([]);
  });

  for (const [timex, xor] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    it(`LOR-007: Radastan display file = port $FF bit 0 (${timex}) XOR $6A bit 4 (${xor})`, async () => {
      const { s, mem } = await loresScreen(core);
      s.out(0x00ff, timex).setNextReg(0x6a, 0x20 | (xor << 4) | 2).setNextReg(0x15, 0x80).runFrames(2);
      expect(s.readNextReg(0x6a), "$6A").toBe(0x20 | (xor << 4) | 2);
      const p = { ...PLAIN, radastan: true, dfile: timex ^ xor, offset: 2 };
      expect(mismatches(s, (x, y) => hex8(loresIndex(mem, p, x, y)))).toEqual([]);
    });
  }

  for (const timex of [1, 2, 6]) {
    it(`LOR-008: plain LoRes ignores the Timex screen mode (port $FF = ${timex})`, async () => {
      const { s, mem } = await loresScreen(core);
      s.out(0x00ff, timex).setNextReg(0x15, 0x80).runFrames(2);
      expect(mismatches(s, (x, y) => hex8(loresIndex(mem, PLAIN, x, y)))).toEqual([]);
    });
  }

  /*
   * LOR-009: the program enables LoRes at line 96 and disables it at line 250, every frame. The ULA
   * shows PAPER 7 (bitmap blank); LoRes shows $A5 in its bottom half ($6000). Rows 0-95 are ULA, rows
   * 97-191 LoRes; row 96 (the switch line) is not checked.
   */
  it("LOR-009: LoRes enabled in mid-frame covers the rows drawn after it", async () => {
    const s = await parkedSession(core);
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
        nextreg $15,$00
        ld a,96
        call WaitLine
        nextreg $15,$80
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
    s.poke(0x4000, new Array(0x1800).fill(0x00)).poke(0x5800, new Array(768).fill(0x38)).poke(0x6000, new Array(0x1800).fill(0xa5));
    writePalette(s, [[23, 0x1c], [0xa5, 0xe0], [0x00, 0x03]]);
    s.setNextReg(0x14, 0xe3).runUntilReady().runFrames(3);
    expect({
      ula: colours(s, [PAPER_LEFT, PAPER_LEFT + 511], [PAPER_TOP, PAPER_TOP + 95]),
      lores: colours(s, [PAPER_LEFT, PAPER_LEFT + 511], [PAPER_TOP + 97, PAPER_TOP + 191])
    }).toEqual({ ula: hex8(0x1c), lores: hex8(0xe0) });
  });
});
