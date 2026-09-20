import { beforeEach, describe, expect, it } from "vitest";

import { zxNextBgra } from "@emu/machines/zxNext/nextColorTables";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";

/*
 * ZX Spectrum Next sprites against the FPGA (`_input/next-fpga/src/video/sprites.vhd`), as scenarios
 * a sprite engine can be run through: the WASM engine in `test/wasm/zxNext/wasm-next-sprites-fpga`.
 * (A TypeScript engine was the second consumer until that backend was removed, which is why the
 * scenarios are still written against an engine abstraction.)
 *
 * The expected pixels are computed here from the VHDL's *read* path — the pattern address a screen
 * pixel fetches — rather than from the engine's precomputed-variant tables, which are its inverse.
 * A mistake in the engine does not then hide in the test.
 */

const STANDARD_SCREEN_HEIGHT = 192;
const STANDARD_SCREEN_Y = (ZXNEXT_WASM_V2_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;
const LAYER2_WIDE_SCREEN_HEIGHT = 256;
const LAYER2_WIDE_SCREEN_X = 32;
const LAYER2_WIDE_SCREEN_Y = STANDARD_SCREEN_Y - (LAYER2_WIDE_SCREEN_HEIGHT - STANDARD_SCREEN_HEIGHT) / 2;
const TRANSPARENT = 0xe3;

// ─── Reference model, from the VHDL ──────────────────────────────────────────

/**
 * The 8-bit pattern-cell address a screen pixel of the 16×16 cell reads (`spr_pattern_addr_start`,
 * `spr_pattern_addr_delta`, `spr_x_mirr_eff`, `spr_y_index`).
 */
function fpgaCellAddress(sx: number, sy: number, xmirror: boolean, ymirror: boolean, rotate: boolean) {
  const yIndex = ymirror ? 15 - sy : sy;
  const xMirrorEffective = xmirror !== rotate;
  const xIndex = xMirrorEffective ? 15 - sx : sx;
  return rotate ? (xIndex << 4) | yIndex : (yIndex << 4) | xIndex;
}

/** The 16K pattern memory address and nibble a 4-bit sprite pixel reads (`spr_pat_addr`). */
function fpga4BitRead(memory: Uint8Array, pattern7: number, cellAddress: number): number {
  const byte = memory[pattern7 * 128 + (cellAddress >> 1)];
  return (cellAddress & 1) === 0 ? byte >> 4 : byte & 0x0f;
}

/** The colour a sprite palette index is drawn in with the reset palette. */
function spriteBgra(index: number): number {
  return zxNextBgra[((index << 1) | (index & 0x02 ? 0x01 : 0x00)) & 0x1ff];
}

// ─── Driving the machine ─────────────────────────────────────────────────────

/** What the scenarios need from an engine: a fresh machine, and a direct Next register write. */
export type SpriteFpgaEngine = {
  name: string;
  createMachine: () => Promise<SpriteFpgaMachine>;
  setNextReg: (machine: SpriteFpgaMachine, reg: number, value: number) => void;
  /** 4-bit pattern memory, variant/cell addressed, when the engine exposes it. */
  patternByte4: (machine: SpriteFpgaMachine, variant: number, cell: number) => number;
  patternByte8: (machine: SpriteFpgaMachine, variant: number, cell: number) => number;
};

export type SpriteFpgaMachine = {
  hardReset(): void;
  doWritePort(address: number, value: number): void;
  renderInstantScreen(): Uint32Array;
  getPixelBuffer(): Uint32Array;
};

export function defineSpriteFpgaTests(engine: SpriteFpgaEngine) {
  let machine: SpriteFpgaMachine;

  beforeEach(async () => {
    machine = await engine.createMachine();
    machine.hardReset();
    // --- Sprites on, over the border, no clipping: the whole 320×256 area is sprite space.
    setReg(0x15, 0x03);
  });

  function setReg(reg: number, value: number) {
    engine.setNextReg(machine, reg, value);
  }

  /** Upload the whole 16K pattern memory through port $5B, starting at pattern 0. */
  function uploadPatternMemory(memory: Uint8Array) {
    machine.doWritePort(0x303b, 0x00);
    for (const value of memory) machine.doWritePort(0x005b, value);
  }

  /** Write one sprite's attributes through port $57: four bytes, or five when attr3 bit 6 is set. */
  function setSprite(index: number, attrs: number[]) {
    machine.doWritePort(0x303b, index);
    for (const value of attrs) machine.doWritePort(0x0057, value);
  }

  function render(): Uint32Array {
    machine.renderInstantScreen();
    return machine.getPixelBuffer();
  }

  /** The pixel-buffer index of a sprite-space pixel (each is drawn two buffer pixels wide). */
  function screenIndex(x: number, y: number): number {
    return (LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_WASM_V2_SCREEN_WIDTH + LAYER2_WIDE_SCREEN_X + x * 2;
  }

  /**
   * Assert every pixel of a 16×16 sprite drawn at (x, y): each either the expected palette index or,
   * when `null`, not drawn (checked by comparing against a render with the sprite hidden).
   */
  function expectCell(
    x: number,
    y: number,
    expected: (sx: number, sy: number) => number | null,
    withSprite: Uint32Array,
    withoutSprite: Uint32Array
  ) {
    const mismatches: string[] = [];
    for (let sy = 0; sy < 16; sy++) {
      for (let sx = 0; sx < 16; sx++) {
        const at = screenIndex(x + sx, y + sy);
        const index = expected(sx, sy);
        const want = index === null ? withoutSprite[at] : spriteBgra(index);
        if (withSprite[at] !== want || withSprite[at + 1] !== want) {
          mismatches.push(`(${sx},${sy}) expected ${index === null ? "background" : `$${index.toString(16)}`}`);
        }
      }
    }
    expect(mismatches.slice(0, 8)).toEqual([]);
  }

  /** A pattern memory whose every byte is distinct from its neighbours in both nibbles. */
  function patternMemory(): Uint8Array {
    const memory = new Uint8Array(0x4000);
    for (let i = 0; i < memory.length; i++) {
      // --- Keep 0xE3 out so an 8-bit read is never transparent by accident.
      let value = (i * 37 + (i >> 8) * 11 + 5) & 0xff;
      if (value === TRANSPARENT) value = 0x42;
      memory[i] = value;
    }
    return memory;
  }

  // ─── Pattern memory ──────────────────────────────────────────────────────────

  describe(`${engine.name}: sprite pattern memory`, () => {
    it("reads a 4-bit pattern as 128 bytes, two pixels per byte, high nibble first", () => {
      const memory = patternMemory();
      uploadPatternMemory(memory);

      for (const pattern7 of [0, 1, 2, 63, 127]) {
        for (const cell of [0, 1, 2, 3, 0x10, 0x11, 0x7e, 0xff]) {
          // --- Variant 0 (no transform): screen cell == pattern cell.
          expect(engine.patternByte4(machine, pattern7 << 3, cell)).toBe(
            fpga4BitRead(memory, pattern7, cell)
          );
        }
      }
    });

    it("still reads an 8-bit pattern as 256 bytes, one per pixel", () => {
      const memory = patternMemory();
      uploadPatternMemory(memory);
      for (const pattern of [0, 1, 63]) {
        for (const cell of [0, 1, 0x80, 0xff]) {
          expect(engine.patternByte8(machine, pattern << 3, cell)).toBe(memory[pattern * 256 + cell]);
        }
      }
    });
  });

  // ─── Rendering ───────────────────────────────────────────────────────────────

  const TRANSFORMS = Array.from({ length: 8 }, (_, variant) => ({
    rotate: (variant & 4) !== 0,
    xmirror: (variant & 2) !== 0,
    ymirror: (variant & 1) !== 0
  }));

  const attr2Of = (t: { rotate: boolean; xmirror: boolean; ymirror: boolean }, paletteOffset = 0) =>
    (paletteOffset << 4) | (t.xmirror ? 0x08 : 0) | (t.ymirror ? 0x04 : 0) | (t.rotate ? 0x02 : 0);

  describe(`${engine.name}: 8-bit sprites`, () => {
    it.each(TRANSFORMS)(
      "draw every pixel where the FPGA reads it (rotate $rotate, x mirror $xmirror, y mirror $ymirror)",
      (t) => {
        const memory = patternMemory();
        uploadPatternMemory(memory);
        const x = 40;
        const y = 40;
        const pattern = 5;
        setSprite(0, [x, y, attr2Of(t), 0x40 | pattern, 0x00]);
        const without = render().slice();
        setSprite(0, [x, y, attr2Of(t), 0xc0 | pattern, 0x00]);
        const withSprite = render();

        expectCell(
          x,
          y,
          (sx, sy) => memory[pattern * 256 + fpgaCellAddress(sx, sy, t.xmirror, t.ymirror, t.rotate)],
          withSprite,
          without
        );
      }
    );

    it("adds the palette offset to the high nibble", () => {
      const memory = new Uint8Array(0x4000).fill(TRANSPARENT);
      memory[0] = 0xe5;
      uploadPatternMemory(memory);
      setSprite(0, [10, 10, 0x30, 0x80]);
      const pixels = render();
      // --- ($E + 3) & $F = $1, low nibble kept.
      expect(pixels[screenIndex(10, 10)]).toBe(spriteBgra(0x15));
    });
  });

  describe(`${engine.name}: 4-bit sprites`, () => {
    it.each(TRANSFORMS)(
      "draw both nibbles of every byte where the FPGA reads them (rotate $rotate, x mirror $xmirror, y mirror $ymirror)",
      (t) => {
        const memory = patternMemory();
        uploadPatternMemory(memory);
        const x = 60;
        const y = 50;
        const pattern6 = 9;
        const paletteOffset = 0x7;
        // --- attr4 bit 7 = 4-bit, bit 6 = N6: 4-bit pattern (9 << 1) | 1 = 19.
        const attr4 = 0x80 | 0x40;
        setSprite(0, [x, y, attr2Of(t, paletteOffset), 0x40 | pattern6, attr4]);
        const without = render().slice();
        setSprite(0, [x, y, attr2Of(t, paletteOffset), 0xc0 | pattern6, attr4]);
        const withSprite = render();

        expectCell(
          x,
          y,
          (sx, sy) => {
            const nibble = fpga4BitRead(
              memory,
              (pattern6 << 1) | 1,
              fpgaCellAddress(sx, sy, t.xmirror, t.ymirror, t.rotate)
            );
            return nibble === (TRANSPARENT & 0x0f) ? null : (paletteOffset << 4) | nibble;
          },
          withSprite,
          without
        );
      }
    );

    it("takes N6 from attr4 bit 6, not bit 5", () => {
      const memory = new Uint8Array(0x4000).fill(0x33); // --- all transparent nibbles
      memory[2 * 128] = 0x11; // --- 4-bit pattern 2 (N=1, N6=0): pixel 0 nibble 1
      memory[3 * 128] = 0x22; // --- 4-bit pattern 3 (N=1, N6=1): pixel 0 nibble 2
      uploadPatternMemory(memory);

      setSprite(0, [20, 20, 0x00, 0xc1, 0x80 | 0x40]);
      expect(render()[screenIndex(20, 20)]).toBe(spriteBgra(0x02));

      // --- Bit 5 is the anchor's relative type, and must not select the pattern.
      setSprite(0, [20, 20, 0x00, 0xc1, 0x80 | 0x20]);
      expect(render()[screenIndex(20, 20)]).toBe(spriteBgra(0x01));
    });
  });

  describe(`${engine.name}: sprite position and scale`, () => {
    it("takes X's ninth bit from attr2 bit 0 and Y's from attr4 bit 0", () => {
      const memory = new Uint8Array(0x4000).fill(TRANSPARENT);
      memory[0] = 0x1c;
      uploadPatternMemory(memory);

      // --- X = $110 = 272 from a four-byte sprite.
      setSprite(0, [0x10, 30, 0x01, 0x80]);
      let pixels = render();
      expect(pixels[screenIndex(272, 30)]).toBe(spriteBgra(0x1c));

      // --- Y = $1F8 = -8: row 8 of the pattern lands on screen row 0.
      memory.fill(TRANSPARENT);
      memory[8 * 16] = 0x1c;
      uploadPatternMemory(memory);
      setSprite(0, [30, 0xf8, 0x00, 0xc0, 0x01]);
      pixels = render();
      expect(pixels[screenIndex(30, 0)]).toBe(spriteBgra(0x1c));
    });

    it("clips per pixel, so a sprite straddling the clip window is cut at its edge", () => {
      const memory = new Uint8Array(0x4000).fill(0x1c); // --- pattern 0 fully opaque
      uploadPatternMemory(memory);
      const blank = render().slice();
      // --- Over the border with clipping: X clip registers are in 2-pixel units, so X1 = 25 is 50.
      setReg(0x1c, 0x02); // --- reset the sprite clip index
      for (const value of [25, 255, 0, 255]) setReg(0x19, value);
      setReg(0x15, 0x23);
      setSprite(0, [40, 40, 0x00, 0x80]); // --- covers x 40..55
      const pixels = render();
      expect(pixels[screenIndex(49, 40)]).toBe(blank[screenIndex(49, 40)]);
      expect(pixels[screenIndex(50, 40)]).toBe(spriteBgra(0x1c));
      expect(pixels[screenIndex(55, 40)]).toBe(spriteBgra(0x1c));
    });

    it("draws every pixel of several wide sprites sharing scanlines", () => {
      const memory = new Uint8Array(0x4000);
      for (let pattern = 0; pattern < 4; pattern++) memory.fill(0x10 + pattern, pattern * 256, (pattern + 1) * 256);
      uploadPatternMemory(memory);
      // --- Four 64-pixel-wide sprites (X scale 4x) on the same rows: 256 pixels of work per line.
      for (let i = 0; i < 4; i++) setSprite(i, [i * 64, 60, 0x00, 0xc0 | i, 0x10]);
      const pixels = render();
      const missing: string[] = [];
      for (let i = 0; i < 4; i++) {
        for (let x = i * 64; x < (i + 1) * 64; x++) {
          for (const y of [60, 67, 75]) {
            if (pixels[screenIndex(x, y)] !== spriteBgra(0x10 + i)) missing.push(`sprite ${i} at ${x},${y}`);
          }
        }
      }
      expect(missing.slice(0, 5)).toEqual([]);
    });

    it("scales in screen space, without swapping the scales when rotated", () => {
      const memory = new Uint8Array(0x4000).fill(0x1c);
      uploadPatternMemory(memory);
      const blank = render().slice();
      // --- XX = 1 (32 wide), YY = 0 (16 high), rotated.
      setSprite(0, [100, 100, 0x02, 0xc0, 0x08]);
      const pixels = render();
      expect(pixels[screenIndex(131, 100)]).toBe(spriteBgra(0x1c));
      expect(pixels[screenIndex(100, 115)]).toBe(spriteBgra(0x1c));
      expect(pixels[screenIndex(100, 116)]).toBe(blank[screenIndex(100, 116)]);
      expect(pixels[screenIndex(132, 100)]).toBe(blank[screenIndex(132, 100)]);
    });
  });

  describe(`${engine.name}: relative sprites`, () => {
    /** A pattern memory with one opaque colour per 8-bit pattern and per 4-bit pattern pixel 0. */
    function markerMemory(): Uint8Array {
      const memory = new Uint8Array(0x4000).fill(TRANSPARENT);
      for (let pattern = 0; pattern < 64; pattern++) memory[pattern * 256] = 0x10 + pattern;
      return memory;
    }

    it("positions a relative sprite by signed offsets from its anchor", () => {
      uploadPatternMemory(markerMemory());
      setSprite(0, [100, 80, 0x00, 0xc0 | 2, 0x00]); // --- anchor: pattern 2 at (100, 80)
      setSprite(1, [20, 0xfc, 0x00, 0xc0 | 5, 0x40]); // --- relative: pattern 5 at +20, -4
      const pixels = render();
      expect(pixels[screenIndex(100, 80)]).toBe(spriteBgra(0x12));
      expect(pixels[screenIndex(120, 76)]).toBe(spriteBgra(0x15));
    });

    it("hides a relative sprite whose anchor is not visible", () => {
      uploadPatternMemory(markerMemory());
      setSprite(0, [100, 80, 0x00, 0x40 | 2, 0x00]); // --- anchor hidden
      setSprite(1, [20, 0, 0x00, 0xc0 | 5, 0x40]);
      // --- A later visible sprite keeps rendering on, so the hidden pair is really skipped.
      setSprite(2, [10, 10, 0x00, 0xc0 | 7, 0x00]);
      const pixels = render();
      expect(pixels[screenIndex(120, 80)]).not.toBe(spriteBgra(0x15));
      expect(pixels[screenIndex(10, 10)]).toBe(spriteBgra(0x17));
    });

    it("adds the anchor's pattern and palette offset when asked", () => {
      uploadPatternMemory(markerMemory());
      setSprite(0, [50, 50, 0x20, 0xc0 | 3, 0x00]); // --- anchor: pattern 3, palette offset 2
      // --- relative: pattern 1 + anchor pattern 3 = 4 (attr4 bit 0), palette 1 + 2 = 3 (attr2 bit 0)
      setSprite(1, [0, 16, 0x11, 0xc0 | 1, 0x41]);
      const pixels = render();
      // --- Pattern 4's marker is $14; offset 3 on the high nibble makes $44.
      expect(pixels[screenIndex(50, 66)]).toBe(spriteBgra(0x44));
    });

    it("inherits 4-bit patterns from the anchor, taking N6 from its own attr4 bit 5", () => {
      const memory = new Uint8Array(0x4000).fill(0x33);
      memory[6 * 128] = 0x5f; // --- 4-bit pattern 6 (N=3, N6=0)
      memory[7 * 128] = 0x6f; // --- 4-bit pattern 7 (N=3, N6=1)
      uploadPatternMemory(memory);
      setSprite(0, [30, 30, 0x00, 0xc0 | 3, 0x80]); // --- 4-bit anchor, pattern 6
      setSprite(1, [0, 20, 0x00, 0xc0 | 3, 0x40 | 0x20]); // --- relative, N6 from bit 5
      const pixels = render();
      expect(pixels[screenIndex(30, 30)]).toBe(spriteBgra(0x05));
      expect(pixels[screenIndex(30, 50)]).toBe(spriteBgra(0x06));
    });

    it("composes a relative sprite drawn on its anchor's own scanlines", () => {
      uploadPatternMemory(markerMemory());
      // --- Anchor rotated, X scale 2x, relative type T: both sprites are 32 pixels wide on shared rows.
      setSprite(0, [100, 100, 0x02, 0xc0 | 2, 0x20 | 0x08]);
      // --- Offset (+8, 0) is swapped by the rotation to (0, +8): the relative sits at (100, 108).
      setSprite(1, [8, 0, 0x00, 0xc0 | 5, 0x40]);
      const pixels = render();
      // --- Rotated, so pattern cell (0,0) is screen cell (15,0); doubled by the X scale.
      expect(pixels[screenIndex(130, 108)]).toBe(spriteBgra(0x15));
      expect(pixels[screenIndex(130, 100)]).toBe(spriteBgra(0x12)); // --- and the anchor's own marker
    });

    it("rotates, mirrors and scales offsets with a composite anchor (relative type set)", () => {
      uploadPatternMemory(markerMemory());
      // --- Anchor rotated, X scale 2x, relative type T = attr4 bit 5.
      setSprite(0, [100, 100, 0x02, 0xc0 | 2, 0x20 | 0x08]);
      // --- Offset (+40, +4): rotation swaps it to (4, 40), negates X (rotate xor xmirror) to -4, and
      // --- the anchor's X scale doubles that to -8: the relative sits at (92, 140).
      setSprite(1, [40, 4, 0x00, 0xc0 | 5, 0x40]);
      const pixels = render();
      // --- The relative inherits the rotation and the 2x X scale, so its pattern cell (0,0) is drawn
      // --- at screen cell (15,0), doubled: (92 + 30, 140).
      expect(pixels[screenIndex(122, 140)]).toBe(spriteBgra(0x15));
      expect(pixels[screenIndex(123, 140)]).toBe(spriteBgra(0x15));
    });
  });
}
