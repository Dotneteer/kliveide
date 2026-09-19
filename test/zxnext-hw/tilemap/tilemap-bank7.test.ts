import { describe, expect, it } from "vitest";

import { type NextTestSession } from "../../harness/zxnext";
import { hex8 } from "../ula/_ula-helpers";
import { control6B, randomBank5, TM_DEFAULT, tilemapMismatches, tilemapScreen, type TM } from "./_tilemap-helpers";

/*
 * The tilemap in bank 7 ($6E / $6F bit 7) - ported from test/zxnext/TilemapDevice-d1d2.test.ts (D2),
 * which only checked that a render completed.
 *
 * Hardware:
 * - video/tilemap.vhd ~400-403: the fetch address is (address(13:8) + base(5:0)) & address(7:0), 14 bits,
 *   and base bit 6 ($6E / $6F bit 7, zxnext.vhd ~4387-4388) picks bank 7 (`tm_mem_bank7_o`).
 * - zxnext.vhd ~6609-6632: bank 7 is an 8K BRAM ("8k only due to limited bram resources") addressed with
 *   `vram_bank_a1(12 downto 0)`: address bit 13 is dropped. So in bank 7 a base offset of $20-$3F is the
 *   same as $00-$1F, and a map or tile table that runs past 8K wraps to the start of bank 7. The CPU
 *   writes this BRAM through page $0E (~2918 `mem_active_bank7`); page $0F is ordinary SRAM the tilemap
 *   never sees.
 *
 * The model (`_tilemap-helpers.ts`) reads a 16K image with a 6-bit page offset; giving it page $0E twice
 * over is exactly the 13-bit wrap.
 */

/** Page $0E: random, except that the 40 x 32 map at its start (tile, attribute) uses tiles 0-127 only. */
const P0E = randomBank5(71).slice(0, 0x2000);
for (let i = 0; i < 40 * 32 * 2; i += 2) P0E[i] &= 0x7f;
/** Page $0F (the SRAM half of bank 7): different bytes, which the tilemap must never show. */
const P0F = randomBank5(72).slice(0, 0x2000);
/** Bank 7 as the tilemap sees it: 8K, so the 16K model image is page $0E twice. */
const IMAGE = new Uint8Array(0x4000);
IMAGE.set(P0E, 0);
IMAGE.set(P0E, 0x2000);
const NONE = hex8(0xe3);

async function bank7Screen(): Promise<NextTestSession> {
  const s = await tilemapScreen(randomBank5(70)); // --- bank 5 holds different bytes
  s.setNextReg(0x56, 0x0e).poke(0xc000, P0E).setNextReg(0x56, 0x0f).poke(0xc000, P0F).setNextReg(0x56, 0x00);
  return s;
}

function show(s: NextTestSession, p: TM, map: number, tiles: number): NextTestSession {
  s.setNextReg(0x6e, map).setNextReg(0x6f, tiles).setNextReg(0x6c, 0).setNextReg(0x4c, p.transparentIndex);
  s.setNextReg(0x2f, 0).setNextReg(0x30, 0).setNextReg(0x31, 0);
  return s.setNextReg(0x6b, control6B(p)).runFrames(2);
}

describe("tilemap in bank 7", () => {
  it("bank 7 map and tiles come from page $0E; offsets $20-$3F are the same as $00-$1F", async () => {
    // --- tiles 0-127 from $10 or $30 stay inside the first 8K: this checks only the offset aliasing
    for (const [map, tiles] of [[0x00, 0x10], [0x20, 0x30]]) {
      const s = await bank7Screen();
      const p: TM = { ...TM_DEFAULT, mapBase: map, tileBase: tiles };
      expect(tilemapMismatches(show(s, p, 0x80 | map, 0x80 | tiles), IMAGE, p, NONE), `$6E = $${(0x80 | map).toString(16)}`).toEqual([]);
    }
  });

  /*
   * Parity finding, fixed 2026-09-19: both cores read the tilemap from a 16K bank 7 (pages $0E and $0F), so a tile table
   * or map that runs past 8K shows page $0F. The hardware has only the 8K BRAM (zxnext.vhd ~6609-6632,
   * address bits 12-0; tilemap.vhd ~403): the fetch wraps to the start of page $0E. Here tiles 128-255
   * from offset $10 lie at $2000-$2FFF and must show the bytes of $0000-$0FFF.
   */
  for (const map of [0x00, 0x20]) {
    it(`a tile table in bank 7 that runs past 8K wraps to the start of bank 7 ($6E = $${(0x80 | map).toString(16)})`, async () => {
      const s = await bank7Screen();
      // --- tiles 128-255: set bit 7 of every map tile byte
      const map0e = P0E.slice(0, 40 * 32 * 2);
      for (let i = 0; i < map0e.length; i += 2) map0e[i] |= 0x80;
      s.setNextReg(0x56, 0x0e).poke(0xc000, map0e).setNextReg(0x56, 0x00);
      const image = IMAGE.slice();
      image.set(map0e, 0);
      image.set(map0e, 0x2000);
      const p: TM = { ...TM_DEFAULT, mapBase: map, tileBase: 0x10 };
      expect(tilemapMismatches(show(s, p, 0x80 | map, 0x90), image, p, NONE)).toEqual([]);
    });
  }

  it("the same offsets without bit 7 read bank 5", async () => {
    const bank5 = randomBank5(70);
    const s = await bank7Screen();
    const p: TM = { ...TM_DEFAULT, mapBase: 0x20, tileBase: 0x30 };
    expect(tilemapMismatches(show(s, p, 0x20, 0x30), bank5, p, NONE)).toEqual([]);
  });
});
