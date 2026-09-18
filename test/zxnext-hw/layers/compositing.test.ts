import { describe, expect, it } from "vitest";

import { ALL_CORES, rgb333ToHex, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { pokeBank } from "../layer2/_layer2-helpers";
import { parkedSession } from "../ula/_ula-helpers";
import { mixPixel, type MixerConfig, type MixerPixel } from "./_mixer-model";

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

const hex9 = (v: number) => rgb333ToHex((v >> 6) & 7, (v >> 3) & 7, v & 7);
const COLS = 40;
const ROWS = 32;
const inPaper = (cx: number, cy: number) => cx >= 4 && cx < 36 && cy >= 4 && cy < 28;

function rng(seed: number): () => number {
  let v = (seed * 2654435761) >>> 0 || 1;
  return () => {
    v ^= v << 13;
    v >>>= 0;
    v ^= v >>> 17;
    v ^= v << 5;
    v >>>= 0;
    return v / 4294967296;
  };
}

type Scene = {
  transparent: number;
  fallback: number;
  border: number;
  /** 9-bit colours; L2 entries carry priority in bit 9. */
  ulaPal: number[];
  l2Pal: number[];
  sprPal: number[];
  tmPal: number[];
  /** Per paper cell (32 x 24): attribute; LoRes byte. */
  attr: number[];
  lores: number[];
  /** Per cell (40 x 32). */
  tile: number[];
  tileAttr: number[];
  l2: number[];
  /** 64 patterns: 16 blocks (row-major 4 x 4), index or -1; the pattern of each of the 80 sprites. */
  patterns: number[][];
  spritePattern: number[];
};

function makeScene(seed: number): Scene {
  const r = rng(seed);
  const int = (n: number) => Math.floor(r() * n);
  const transparent = int(256);
  const t9 = () => (transparent << 1) | int(2);
  const colour = () => {
    let c: number;
    do c = int(512);
    while (c >> 1 === transparent);
    return c;
  };
  const fill = (maybe: () => number) => Array.from({ length: 256 }, maybe);
  return {
    transparent,
    fallback: int(256),
    border: int(8),
    ulaPal: fill(() => (r() < 0.3 ? t9() : colour())),
    l2Pal: fill(() => (r() < 0.3 ? t9() : colour()) | (r() < 0.3 ? 0x200 : 0)),
    sprPal: fill(() => (r() < 0.1 ? t9() : colour())),
    tmPal: fill(() => (r() < 0.1 ? t9() : colour())),
    attr: Array.from({ length: 32 * 24 }, () => int(16) << 3),
    lores: Array.from({ length: 32 * 24 }, () => int(256)),
    tile: Array.from({ length: COLS * ROWS }, () => (r() < 0.35 ? 15 : int(15))),
    tileAttr: Array.from({ length: COLS * ROWS }, () => (int(16) << 4) | int(2)),
    l2: Array.from({ length: COLS * ROWS }, () => int(256)),
    patterns: Array.from({ length: 64 }, () =>
      Array.from({ length: 16 }, () => {
        if (r() < 0.5) return -1;
        let i: number;
        do i = int(256);
        while (i === 0xe3);
        return i;
      })
    ),
    spritePattern: Array.from({ length: 80 }, () => int(64))
  };
}

/** Palette entries through $40/$44 (9 bits; bit 9 -> priority). */
function writePal(s: NextTestSession, select: number, pal: number[]): void {
  s.setNextReg(0x43, select << 4).setNextReg(0x40, 0);
  for (const v of pal) s.setNextReg(0x44, (v >> 1) & 0xff).setNextReg(0x44, (v & 1) | (v & 0x200 ? 0x80 : 0));
}

async function sceneSession(core: CoreName, sc: Scene): Promise<NextTestSession> {
  const s = await parkedSession(core);
  writePal(s, 0, sc.ulaPal);
  writePal(s, 1, sc.l2Pal);
  writePal(s, 2, sc.sprPal);
  writePal(s, 3, sc.tmPal);
  s.setNextReg(0x43, 0x00).setNextReg(0x14, sc.transparent).setNextReg(0x4a, sc.fallback);
  s.setNextReg(0x4b, 0xe3).setNextReg(0x4c, 0x0f);

  // --- ULA: bitmap 0, attributes per paper cell; border
  s.poke(0x4000, new Array(0x1800).fill(0)).poke(0x5800, sc.attr).out(0xfe, sc.border);

  // --- tilemap in bank 7: map at $0000 (tile, attribute), tile k = all nibble k at $1000 + 32k
  const bank7 = new Uint8Array(0x4000);
  for (let i = 0; i < COLS * ROWS; i++) {
    bank7[2 * i] = sc.tile[i];
    bank7[2 * i + 1] = sc.tileAttr[i];
  }
  for (let k = 0; k < 16; k++) bank7.fill(k * 0x11, 0x1000 + 32 * k, 0x1000 + 32 * k + 32);
  pokeBank(s, 7, bank7);
  s.setNextReg(0x6e, 0x80).setNextReg(0x6f, 0x90).setNextReg(0x6c, 0x00);

  // --- Layer 2 320 x 256: address x * 256 + y from bank 8
  const l2 = new Uint8Array(5 * 0x4000);
  for (let x = 0; x < 320; x++) for (let y = 0; y < 256; y++) l2[x * 256 + y] = sc.l2[(y >> 3) * COLS + (x >> 3)];
  for (let b = 0; b < 5; b++) pokeBank(s, 8 + b, l2.subarray(b * 0x4000, (b + 1) * 0x4000));
  s.setNextReg(0x12, 8).setNextReg(0x70, 0x10);
  s.setNextReg(0x1c, 0x01).setNextReg(0x18, 0).setNextReg(0x18, 159).setNextReg(0x18, 0).setNextReg(0x18, 255);
  s.out(0x123b, 0x02);

  // --- sprites: 64 patterns, 80 sprites scaled x2 on a 32-pixel grid
  s.out(0x303b, 0x00);
  for (const pat of sc.patterns) {
    for (let py = 0; py < 16; py++) {
      for (let px = 0; px < 16; px++) {
        const i = pat[(py >> 2) * 4 + (px >> 2)];
        s.out(0x5b, i < 0 ? 0xe3 : i);
      }
    }
  }
  s.out(0x303b, 0x00);
  for (let n = 0; n < 80; n++) {
    const x = (n % 10) * 32;
    const y = Math.floor(n / 10) * 32;
    for (const b of [x & 0xff, y, (x >> 8) & 1, 0xc0 | sc.spritePattern[n], 0x0a]) s.out(0x57, b);
  }
  // --- the remaining 48 sprites invisible
  for (let n = 80; n < 128; n++) for (const b of [0, 0, 0, 0x40, 0]) s.out(0x57, b);
  return s;
}

type Config = Omit<MixerConfig, "transparent" | "fallback"> & { lores: boolean };

function pixelInputs(sc: Scene, cfg: Config, cx: number, cy: number): MixerPixel {
  const paper = inPaper(cx, cy);
  const pi = (cy - 4) * 32 + (cx - 4);
  const a = paper ? sc.attr[pi] : 0;
  const ulaIndex = !paper ? 16 + sc.border : cfg.lores ? sc.lores[pi] : 16 + ((a >> 3) & 15);
  const ci = cy * COLS + cx;
  const n = (cy >> 2) * 10 + (cx >> 2);
  const block = sc.patterns[sc.spritePattern[n]][(cy & 3) * 4 + (cx & 3)];
  const l2 = sc.l2Pal[sc.l2[ci]];
  return {
    ula: sc.ulaPal[ulaIndex] & 0x1ff,
    ulaBorder: !paper,
    tm: sc.tmPal[(sc.tileAttr[ci] & 0xf0) | sc.tile[ci]],
    tmPixelEn: sc.tile[ci] !== 15,
    tmAttrBelow: (sc.tileAttr[ci] & 1) !== 0,
    sprite: block < 0 ? 0 : sc.sprPal[block],
    spritePixelEn: block >= 0,
    layer2: l2 & 0x1ff,
    layer2PriorityBit: (l2 & 0x200) !== 0,
    layer2PixelEn: true
  };
}

/** Programs the configuration: LoRes / order / sprites ($15), $68, $6B. */
function apply(s: NextTestSession, cfg: Config): NextTestSession {
  s.setNextReg(0x15, (cfg.lores ? 0x80 : 0) | (cfg.order << 2) | 0x02 | (cfg.spritesEn ? 0x01 : 0));
  s.setNextReg(0x68, (cfg.ulaEn ? 0 : 0x80) | (cfg.blend << 5) | (cfg.stencil ? 0x01 : 0));
  s.setNextReg(0x6b, (cfg.tmEn ? 0x80 : 0) | (cfg.tmOnTop ? 0x01 : 0));
  return s;
}

/** The cells that differ from the model (at most 6), sampled at 2 x 2 buffer pixels in the middle. */
function mismatches(s: NextTestSession, sc: Scene, cfg: Config, rows: [number, number] = [0, ROWS - 1]): string[] {
  const full: MixerConfig = { ...cfg, transparent: sc.transparent, fallback: sc.fallback };
  const bad: string[] = [];
  for (let cy = rows[0]; cy <= rows[1] && bad.length < 6; cy++) {
    for (let cx = 0; cx < COLS && bad.length < 6; cx++) {
      const want = hex9(mixPixel(full, pixelInputs(sc, cfg, cx, cy)));
      const bx = 32 + cx * 16 + 6;
      const by = 16 + cy * 8 + 3;
      const got = [s.pixel(bx, by), s.pixel(bx + 3, by), s.pixel(bx, by + 2), s.pixel(bx + 3, by + 2)];
      if (got.some((g) => g !== want)) {
        const p = pixelInputs(sc, cfg, cx, cy);
        bad.push(
          `cell (${cx},${cy}): ${[...new Set(got)].join("/")} != ${want} ` +
            `[U ${hex9(p.ula)}${p.ulaBorder ? " border" : ""} T ${p.tmPixelEn ? hex9(p.tm) : "-"}${p.tmAttrBelow ? " below" : ""} ` +
            `S ${p.spritePixelEn ? hex9(p.sprite) : "-"} L ${hex9(p.layer2)}${p.layer2PriorityBit ? " prio" : ""} $14 ${sc.transparent.toString(16)}]`
        );
      }
    }
  }
  return bad;
}

const ORDER_NAMES = ["SLU", "LSU", "SUL", "LUS", "USL", "ULS", "blend add", "blend add-5"];

function configs(order: number, lores = false): Config[] {
  const out: Config[] = [];
  const blends = order >= 6 ? [0, 1, 2, 3] : [0];
  for (const blend of blends) {
    for (let bits = 0; bits < 16; bits++) {
      out.push({
        order,
        blend,
        stencil: (bits & 1) !== 0,
        ulaEn: (bits & 2) === 0,
        tmEn: (bits & 4) === 0,
        tmOnTop: (bits & 8) !== 0,
        spritesEn: true,
        lores
      });
    }
  }
  return out;
}

const describeConfig = (c: Config) =>
  `$15 ${ORDER_NAMES[c.order]}${c.lores ? " LoRes" : ""}, blend source ${c.blend}, stencil ${+c.stencil}, ULA ${c.ulaEn ? "on" : "off"}, ` +
  `tilemap ${c.tmEn ? "on" : "off"}${c.tmOnTop ? " on top" : ""}`;

function runConfigs(s: NextTestSession, sc: Scene, list: Config[]): string[] {
  const bad: string[] = [];
  for (const cfg of list) {
    apply(s, cfg).runFrames(2);
    const m = mismatches(s, sc, cfg);
    if (m.length) bad.push(`${describeConfig(cfg)}:\n  ${m.join("\n  ")}`);
    if (bad.length >= 4) break;
  }
  return bad;
}

describe.each(ALL_CORES)("layer compositing - %s core", (core: CoreName) => {
  for (let order = 0; order < 8; order++) {
    const ids =
      order < 6
        ? "CMP-001 / CMP-007 / CMP-008 / CMP-009 / CMP-010 / CMP-012"
        : `${order === 6 ? "CMP-002" : "CMP-003"} / CMP-004 / CMP-005 / CMP-008 - CMP-010 / CMP-012`;
    it(`${ids}: $15 ${ORDER_NAMES[order]} - every cell matches the mixer, with and without stencil, ULA, tilemap`, async () => {
      const sc = makeScene(100 + order);
      const s = await sceneSession(core, sc);
      expect(runConfigs(s, sc, configs(order))).toEqual([]);
    });
  }

  it("CMP-011: LoRes takes the ULA's place in every order and blend", async () => {
    const sc = makeScene(200);
    const s = await sceneSession(core, sc);
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
      const s = await parkedSession(core);
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
    const s = await sceneSession(core, sc);
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
