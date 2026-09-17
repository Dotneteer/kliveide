import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, displayFileAddress, type NextTestSession } from "../../harness/zxnext";

/*
 * B6 - layer mixing cases from zxnext.vhd stage 2 (~7060-7124 and the SLU ordering after it).
 *
 * 1. Blend modes ($15 layer priority 110/111): `$68` bits 6-5 pick what is blended with Layer 2 and
 *    where the tilemap goes (`case ula_blend_mode_2`):
 *      00  mix = ULA (as blended);  tilemap above (top) or below (bot) the result
 *      10  mix = ULA and tilemap merged (ula_final); tilemap not drawn separately
 *      11  mix = tilemap;           ULA above or below the result
 *      01  nothing blended (mix transparent); tilemap and ULA drawn above/below by tm_pixel_below
 *    and the output order is: Layer 2 priority -> top -> sprite -> bot -> Layer 2 blended.
 * 2. `$68` bit 7 (ULA disabled) removes the ULA as a *layer* (`ula_transparent ... or ula_en_2 = '0'`)
 *    but not as the blend operand: `ula_mix_rgb`/`ula_mix_transparent` ignore `ula_en`.
 * 3. In LUS/USL/ULS the ULA wins over sprites except on an opaque ULA *border* pixel where the tilemap is
 *    transparent and a sprite is opaque: `not (ula_border_2 = '1' and tm_transparent = '1' and
 *    sprite_transparent = '0')`.
 *
 * Colours: ULA paper red ($E0), tilemap green ($1C), Layer 2 blue ($03), sprite yellow ($FC), border
 * white (ULA entry 23 = $B6), fallback purple ($A2). Blend mode 6 adds per channel and saturates.
 */

type Scene = {
  priority: number; // --- $15 bits 4-2
  nextReg68?: number;
  tilemap?: boolean;
  layer2?: boolean;
  sprites?: Array<[x: number, y: number]>;
};

async function scene(core: "ts" | "wasm", sc: Scene): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(` .org $8000\n jr $`);
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xa2).setNextReg(0x4b, 0xe3).setNextReg(0x4c, 0x00);
  // --- ULA: PAPER 2 red everywhere, bitmap clear, white border
  s.setNextReg(0x43, 0x00).setNextReg(0x40, 18).setNextReg(0x41, 0xe0).setNextReg(0x40, 23).setNextReg(0x41, 0xb6);
  for (let row = 0; row < 192; row++) for (let col = 0; col < 32; col++) s.poke(displayFileAddress(row, col), 0);
  for (let i = 0; i < 768; i++) s.poke(0x5800 + i, 0x10);
  s.out(0xfe, 7);

  if (sc.tilemap) {
    // --- 40x32, no attribute byte (tile above the ULA: $6C bit 0 = 0), 4-bit tile 1 = all pixel 1
    s.setNextReg(0x43, 0x30).setNextReg(0x40, 1).setNextReg(0x41, 0x1c).setNextReg(0x43, 0x00);
    for (let i = 0; i < 32; i++) s.poke(0x7000 + i, 0x00).poke(0x7020 + i, 0x11);
    for (let i = 0; i < 40 * 32; i++) s.poke(0x6000 + i, 1);
    s.setNextReg(0x6c, 0x00).setNextReg(0x6e, 0x20).setNextReg(0x6f, 0x30).setNextReg(0x6b, 0xa0);
  }
  if (sc.layer2) {
    // --- 256x192, bank 9 (8K pages 18-23), every pixel index 3 = blue
    s.setNextReg(0x43, 0x10).setNextReg(0x40, 3).setNextReg(0x41, 0x03).setNextReg(0x43, 0x00);
    s.setNextReg(0x12, 9);
    for (let page = 18; page < 24; page++) {
      s.setNextReg(0x56, page);
      for (let i = 0; i < 0x2000; i++) s.poke(0xc000 + i, 3);
    }
    s.setNextReg(0x56, 0).out(0x123b, 0x02);
  }
  let spriteControl = 0;
  if (sc.sprites?.length) {
    // --- pattern 0: 16x16 index $FC = yellow (sprite palette entry $FC written explicitly)
    s.setNextReg(0x43, 0x20).setNextReg(0x40, 0xfc).setNextReg(0x41, 0xfc).setNextReg(0x43, 0x00);
    s.out(0x303b, 0);
    for (let i = 0; i < 256; i++) s.out(0x5b, 0xfc);
    s.out(0x303b, 0);
    for (const [x, y] of sc.sprites) for (const b of [x, y, 0x00, 0x80]) s.out(0x57, b);
    spriteControl = 0x03; // --- visible, over the border
  }
  s.setNextReg(0x15, (sc.priority << 2) | spriteControl);
  s.setNextReg(0x68, sc.nextReg68 ?? 0x00);
  return s.runFrames(2);
}

/** A paper-area block well inside every layer. */
const PAPER = { x: [300, 331], y: [120, 135] } as const;
const colourAt = (s: NextTestSession, region: { x: readonly [number, number]; y: readonly [number, number] }) => {
  const colours = new Set<string>();
  for (let y = region.y[0]; y <= region.y[1]; y++) for (let x = region.x[0]; x <= region.x[1]; x++) colours.add(s.pixel(x, y));
  return [...colours].join(",");
};

describe.each(ALL_CORES)("layer mixing (B6) - %s core", (core) => {
  describe("blend mode 6 with a tilemap above the ULA", () => {
    const cases: Array<[mode: number, expected: string, why: string]> = [
      [0x00, "#00FF00", "00: tilemap is the top layer"],
      [0x40, "#00FFFF", "10: ULA+tilemap merged is blended with Layer 2"],
      [0x60, "#FF0000", "11: tilemap is blended, the ULA below it is the bottom layer and wins over the blend"],
      [0x20, "#00FF00", "01: no blend; tilemap above"]
    ];
    for (const [mode, expected, why] of cases) {
      it(`$68 = $${mode.toString(16).padStart(2, "0")} - ${why}`, async () => {
        const s = await scene(core, { priority: 6, nextReg68: mode, tilemap: true, layer2: true });
        expect(colourAt(s, PAPER)).toBe(expected);
      });
    }
  });

  it("blend mode 6: a ULA disabled by $68 bit 7 is still the blend operand", async () => {
    const s = await scene(core, { priority: 6, nextReg68: 0x80, layer2: true });
    expect(colourAt(s, PAPER)).toBe("#FF00FF"); // --- red + blue
  });

  for (const [priority, name] of [[3, "LUS"], [4, "USL"], [5, "ULS"]] as const) {
    it(`${name}: a sprite shows over the ULA border, not over the ULA paper`, async () => {
      // --- sprite x 16 -> buffer x 64-95 (left border); sprite x 64 -> buffer x 160-191 (paper);
      // --- sprite y 60 -> paper row 28 -> buffer rows 76-91
      const s = await scene(core, { priority, sprites: [[16, 60], [64, 60]] });
      expect({
        border: colourAt(s, { x: [66, 93], y: [78, 89] }),
        paper: colourAt(s, { x: [162, 189], y: [78, 89] })
      }).toEqual({ border: "#FFFF00", paper: "#FF0000" });
    });
  }
});
