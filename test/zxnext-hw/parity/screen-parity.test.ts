import { describe, expect, it } from "vitest";

import { onEachCore, type NextTestSession } from "../../harness/zxnext";
import { hex, pick, seededRandom } from "./_parity-helpers";

/*
 * PAR-002: screen parity for random layer setups - fixed picture content in every layer, then a seeded
 * random combination of the layer registers; the displayed frames of the two cores must be equal pixel
 * for pixel. The expectation is the other core; the ULA, L2, TM, SPR, LOR, PAL and CMP tests hold the
 * VHDL pictures.
 *
 * Scripted rather than a declarative screen case: the setups are generated per seed, and a failure
 * lists the registers of that seed and the first differing pixels. Content (same on both cores, from
 * a fixed seed): all eight palettes written in full (palette RAM has no reset contents), the ULA
 * screen, Layer 2 banks 8-12 (enough for 640x256), the tilemap and its tile definitions (bank 5, the
 * default bases), 64 sprite patterns and 128 sprite attributes.
 */

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const MIN_COLOURS = 4;

async function fillContent(s: NextTestSession) {
  const rnd = seededRandom(0x5eed);
  const bytes = (n: number) => Uint8Array.from({ length: n }, () => pick(rnd, 256));

  // --- All eight palettes, 256 entries each, through $41 with auto-increment
  for (let palette = 0; palette < 8; palette++) {
    s.setNextReg(0x43, palette << 4).setNextReg(0x40, 0x00);
    for (let i = 0; i < 256; i++) s.setNextReg(0x41, pick(rnd, 256));
  }
  s.setNextReg(0x43, 0x00);

  // --- The ULA screen (pixels and attributes) and the rest of bank 5 (tilemap, tile definitions)
  s.poke(0x4000, bytes(0x4000));

  // --- Layer 2: 8K pages 16-25 (16K banks 8-12) through MMU6
  for (let page = 16; page < 26; page++) {
    s.setNextReg(0x56, page).poke(0xc000, bytes(0x2000));
  }
  s.setNextReg(0x56, 0x00);

  // --- Sprites: 64 8-bit patterns, then 128 attribute sets (5 bytes: visible, 4-bit / 8-bit mixed)
  s.out(0x303b, 0x00);
  for (const b of bytes(64 * 256)) s.out(0x5b, b);
  s.out(0x303b, 0x00);
  for (let i = 0; i < 128; i++) {
    s.out(0x57, pick(rnd, 256)); // --- X
    s.out(0x57, pick(rnd, 256)); // --- Y
    s.out(0x57, pick(rnd, 256)); // --- palette offset, mirror, rotate, X8
    s.out(0x57, 0xc0 | pick(rnd, 64)); // --- visible, 5th byte follows, pattern
    s.out(0x57, pick(rnd, 256)); // --- 4-bit / relative / scale / Y8
  }
}

type Setup = Array<[reg: number, value: number]>;

/**
 * A random layer setup: the register writes in order. Biased so the layers usually show - a fully
 * random setup clips most of them away (x1 > x2) and the comparison would be of a blank screen: each
 * layer is on three times in four, and every clip window is at least 32 pixels each way.
 */
function randomSetup(seed: number): { setup: Setup; layer2Port: number } {
  const rnd = seededRandom(seed);
  const r = () => pick(rnd, 256);
  const often = () => pick(rnd, 4) !== 0;
  const clip = (maxX: number, maxY: number): number[] => {
    const x1 = pick(rnd, maxX >> 1);
    const x2 = x1 + 32 + pick(rnd, maxX - x1 - 31);
    const y1 = pick(rnd, maxY >> 1);
    const y2 = y1 + 32 + pick(rnd, maxY - y1 - 31);
    return [x1, x2, y1, y2];
  };
  const setup: Setup = [
    // --- sprites on (bit 0), over border, clipping, layer priority (bits 4-2), LoRes (bit 7)
    [0x15, (r() & 0xfe) | (often() ? 0x01 : 0x00)],
    // --- ULA on (bit 7 = 0), blending, ULA+ off (bit 3 would need ULA+ palette setup), fine scroll, stencil
    [0x68, (r() & 0x77) | (often() ? 0x00 : 0x80)],
    // --- tilemap on (bit 7), 80x32, no attributes, palette, text, 512 tiles, on top
    [0x6b, (r() & 0x7f) | (often() ? 0x80 : 0x00)],
    [0x6c, r()], // --- default tile attribute
    [0x70, r() & 0x3f], // --- Layer 2 resolution and palette offset
    [0x14, r()], // --- global transparency
    [0x4a, r()], // --- fallback colour
    [0x4b, r()], // --- sprite transparency index
    [0x4c, r() & 0x0f], // --- tilemap transparency index
    [0x16, r()], [0x17, r()], [0x71, r() & 1], // --- Layer 2 scroll
    [0x26, r()], [0x27, r()], // --- ULA scroll
    [0x2f, r() & 3], [0x30, r()], [0x31, r()], // --- tilemap scroll
    [0x32, r()], [0x33, r()], // --- LoRes scroll
    [0x42, [0x07, 0x0f, 0x1f, 0x3f, 0x7f, 0xff][pick(rnd, 6)]], // --- ULANext ink mask
    [0x43, r() & 0x0f], // --- palette selects (bits 3-1) and ULANext (bit 0); writes stay on ULA 1st
    [0x1c, 0x0f]
  ];
  // --- Clip windows: Layer 2, sprites, ULA / LoRes, tilemap (x in 2-pixel units, 0-159)
  for (const [reg, maxX, maxY] of [[0x18, 255, 191], [0x19, 255, 191], [0x1a, 255, 191], [0x1b, 159, 191]]) {
    for (const v of clip(maxX, maxY)) setup.push([reg, v]);
  }
  return { setup, layer2Port: often() ? 0x02 : 0x00 };
}

function describeSetup(setup: Setup, layer2Port: number): string {
  return setup.map(([reg, v]) => `${hex(reg)}=${hex(v)}`).join(" ") + ` port $123B=${hex(layer2Port)}`;
}

describe("PAR-002: screen parity for random layer setups", () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: the same picture on both cores`, { timeout: 60_000 }, async () => {
      const { setup, layer2Port } = randomSetup(seed);
      const r = await onEachCore(async (s) => {
        await s.loadCode(" .org $8000\n di\n jr $");
        s.runFrames(1);
        await fillContent(s);
        for (const [reg, value] of setup) s.setNextReg(reg, value);
        s.out(0x123b, layer2Port);
        s.runFrames(2);
        return s.screen();
      });
      const { width } = r.ts;
      const wrong: string[] = [];
      let count = 0;
      for (let i = 0; i < r.ts.rgba.length; i += 4) {
        if (r.ts.rgba[i] !== r.wasm.rgba[i] || r.ts.rgba[i + 1] !== r.wasm.rgba[i + 1] || r.ts.rgba[i + 2] !== r.wasm.rgba[i + 2]) {
          count++;
          if (wrong.length < 8) {
            const p = i / 4;
            const rgb = (f: Uint8Array) => [f[i], f[i + 1], f[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
            wrong.push(`(${p % width},${Math.floor(p / width)}) ts #${rgb(r.ts.rgba)} wasm #${rgb(r.wasm.rgba)}`);
          }
        }
      }
      expect({ differingPixels: count, first: wrong }, describeSetup(setup, layer2Port)).toEqual({ differingPixels: 0, first: [] });
      // --- The comparison means something only on a busy picture: the layers show, not just a fallback
      const colours = new Set<number>();
      for (let i = 0; i < r.ts.rgba.length; i += 4) colours.add((r.ts.rgba[i] << 16) | (r.ts.rgba[i + 1] << 8) | r.ts.rgba[i + 2]);
      expect(colours.size, "colours on screen").toBeGreaterThan(MIN_COLOURS);
    });
  }
});
