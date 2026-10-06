import { describe, expect, it } from "vitest";

import { rgb333ToHex } from "../../harness/zxnext";
import { pokeBank } from "../layer2/_layer2-helpers";
import { parkedSession } from "../ula/_ula-helpers";
import {
  apply,
  configs,
  makeScene,
  mismatches,
  ORDER_NAMES,
  runConfigs,
  sceneSession,
  writePal,
  type Config
} from "./_scene";

/*
 * Layer compositing (catalogue CMP-001 - CMP-003, CMP-007 - CMP-014).
 *
 * Every 8 x 8 cell of the 320 x 256 display gets its own random state of each layer, and every cell is
 * compared with `mixPixel`, a transcription of zxnext.vhd stage 2 (see _mixer-model.ts), under each $15
 * order, $68 blend source / stencil / ULA enable and $6B enable / on-top setting.
 *
 * - ULA: paper cells (display x 32-287, y 32-223) show PAPER (attribute paper + bright = entry 16-31,
 *   bitmap 0); the rest is border, entry 16 + border colour (zxula.vhd). With $15 bit 7, LoRes instead:
 *   one byte = one palette index per 4 x 4 LoRes pixels of the cell (lores.vhd). Entries whose colour has
 *   $14 in bits 8-1 are transparent.
 * - Tilemap: 40 x 32 with attributes in bank 7 (map at $0000, tiles at $1000; $6E/$6F bit 7); tile k is
 *   all nibble k, nibble 15 = $4C is transparent; attribute: palette offset and the below bit (bit 0).
 * - Layer 2: 320 x 256 (column-major, banks 8-12), one index per cell; its palette has transparent
 *   colours and priority bits.
 * - Sprites: 80 sprites scaled x2 (32 x 32) tile the display; each shows one of 64 patterns whose 4 x 4
 *   blocks of pattern pixels (= one cell each) are opaque or $4B. Over the border ($15 bit 1), no clip.
 *
 * Cells are sampled away from their edges, so a one-pixel pipeline difference between layers does not
 * matter here (the layer tests check exact edges).
 */

describe("layer compositing", () => {
  for (let order = 0; order < 8; order++) {
    const ids =
      order < 6
        ? "CMP-001 / CMP-007 / CMP-008 / CMP-009 / CMP-010 / CMP-012"
        : `${order === 6 ? "CMP-002" : "CMP-003"} / CMP-004 / CMP-005 / CMP-008 - CMP-010 / CMP-012`;
    it(`${ids}: $15 ${ORDER_NAMES[order]} - every cell matches the mixer, with and without stencil, ULA, tilemap`, async () => {
      const sc = makeScene(100 + order);
      const s = await sceneSession(sc);
      expect(runConfigs(s, sc, configs(order))).toEqual([]);
    });
  }

  it("CMP-011: LoRes takes the ULA's place in every order and blend", async () => {
    const sc = makeScene(200);
    const s = await sceneSession(sc);
    const list: Config[] = [];
    for (let order = 0; order < 8; order++) {
      for (const cfg of configs(order, true)) if (!cfg.tmOnTop && (order < 6 || cfg.blend === 0 || cfg.blend === 2)) list.push(cfg);
    }
    // --- LoRes pixels at $4000 / $6000: 128 bytes a row, 4 x 4 per paper cell
    for (let ly = 0; ly < 96; ly++) {
      const row = Array.from({ length: 128 }, (_, lx) => sc.lores[(ly >> 2) * 32 + (lx >> 2)]);
      s.poke(ly < 48 ? 0x4000 + ly * 128 : 0x6000 + (ly - 48) * 128, row);
    }
    s.setNextReg(0x6a, 0x00);
    expect(runConfigs(s, sc, list)).toEqual([]);
  });

  /*
   * CMP-013: ULA paper colours rgb(j, 7 - j, j) (paper j, entries 16-23) against Layer 2 colours
   * rgb(i, i, 7 - i) (index i): the 64 red and 64 green sums in one picture. Mode 6 saturates at 7; mode 7
   * gives 0 up to 4, 7 from 12, else sum - 5. The table is written out here, not taken from the model.
   */
  for (const mode of [6, 7] as const) {
    it(`CMP-013: blend ${mode === 6 ? "add" : "add - 5"}: all 64 channel sums`, async () => {
      const s = await parkedSession();
      const f = (v: number) => (mode === 6 ? Math.min(v, 7) : v <= 4 ? 0 : v >= 12 ? 7 : v - 5);
      const ula = (j: number) => (j << 6) | ((7 - j) << 3) | j;
      const l2 = (i: number) => (i << 6) | (i << 3) | (7 - i);
      writePal(s, 0, Array.from({ length: 256 }, (_, k) => (k >= 16 && k < 24 ? ula(k - 16) : 0)));
      writePal(s, 1, Array.from({ length: 256 }, (_, k) => (k < 8 ? l2(k) : 0)));
      // --- $14 = $FF: rgb(7, 7, 7) is not used by either
      s.setNextReg(0x43, 0x00).setNextReg(0x14, 0xff).setNextReg(0x4a, 0x00).setNextReg(0x68, 0x00);
      // --- paper cell (col, row): paper row & 7; Layer 2 256 x 192 pixel: index col & 7
      s.poke(0x4000, new Array(0x1800).fill(0));
      s.poke(0x5800, Array.from({ length: 768 }, (_, a) => ((a >> 5) & 7) << 3));
      const bank = new Uint8Array(0x4000).map((_, a) => (a >> 3) & 7);
      for (const b of [8, 9, 10]) pokeBank(s, b, bank);
      s.setNextReg(0x12, 8).setNextReg(0x70, 0x00).out(0x123b, 0x02).setNextReg(0x15, mode << 2).runFrames(2);
      const bad: string[] = [];
      for (let j = 0; j < 8; j++) {
        for (let i = 0; i < 8; i++) {
          const want = rgb333ToHex(f(i + j), f(i + 7 - j), f(7 - i + j));
          const got = s.pixel(96 + i * 16 + 7, 48 + j * 8 + 3);
          if (got !== want) bad.push(`L2 ${i} + ULA ${j}: ${got} != ${want}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it("CMP-014: a $15 order change from the CPU at line 96 applies to the rows drawn after it", async () => {
    const sc = makeScene(300);
    const s = await sceneSession(sc);
    const [a, b] = [configs(0)[0], configs(5)[0]];
    apply(s, a);
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
        nextreg $15,${0x03 | (a.order << 2)}
        ld a,96
        call WaitLine
        nextreg $15,${0x03 | (b.order << 2)}
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
      `,
      { entry: "Start" }
    );
    s.runUntilReady().runFrames(3);
    // --- line 96 is paper row 96 = display row 128 = cell row 16
    expect(mismatches(s, sc, a, [0, 15]), `${ORDER_NAMES[a.order]} above`).toEqual([]);
    expect(mismatches(s, sc, b, [17, 31]), `${ORDER_NAMES[b.order]} below`).toEqual([]);
  });
});
