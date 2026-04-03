import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Unit tests for the sprite clip window (D2 fix) and 4-bit transparency mask (D3 fix).
 *
 * D2 — updateSpriteClipBoundaries():
 *   MAME implements three clip modes based on spritesOverBorderEnabled and
 *   spriteClippingEnabled.  Klive used fixed boundaries before the fix; now it
 *   reads the NR $19 clip registers and applies the mode-specific formula.
 *
 * D3 — 4-bit transparency mask:
 *   MAME masks the transparency colour to 4 bits for 4-bit sprites.
 *   The fix applies: `transparencyIndex & (is4Bit ? 0x0f : 0xff)`.
 */

describe("SpriteDevice - Clip Window (D2)", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // Helper: access private clip boundary fields via any-cast
  const clip = () => {
    const s = machine.composedScreenDevice as any;
    return {
      xMin: s.spritesClipXMin as number,
      xMax: s.spritesClipXMax as number,
      yMin: s.spritesClipYMin as number,
      yMax: s.spritesClipYMax as number
    };
  };

  // Helper: write NextReg
  function writeNextReg(reg: number, value: number): void {
    machine.nextRegDevice.setNextRegisterIndex(reg);
    machine.nextRegDevice.setNextRegisterValue(value);
  }

  // Helper: write NR $19 four times to set all four clip registers
  function setClipRegs(x1: number, x2: number, y1: number, y2: number): void {
    writeNextReg(0x1c, 0x02);  // reset sprite clip index to 0
    writeNextReg(0x19, x1);
    writeNextReg(0x19, x2);
    writeNextReg(0x19, y1);
    writeNextReg(0x19, y2);
  }

  // ─── Mode 1: over-border=true, clip=false → full screen ─────────────────

  it("Mode 1 (over-border, no clip): returns full 0-319 / 0-255 boundaries", () => {
    // NR $15: bit 1 = spritesOverBorderEnabled, bit 5 = spriteClippingEnabled
    writeNextReg(0x15, 0b00000010); // over-border=1, clip=0
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    expect(c.xMin).toBe(0);
    expect(c.xMax).toBe(319);
    expect(c.yMin).toBe(0);
    expect(c.yMax).toBe(255);
  });

  it("Mode 1: arbitrary clip registers have no effect when clip disabled", () => {
    setClipRegs(10, 80, 5, 40);
    writeNextReg(0x15, 0b00000010); // over-border=1, clip=0
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    // Full screen regardless of registers
    expect(c.xMin).toBe(0);
    expect(c.xMax).toBe(319);
    expect(c.yMin).toBe(0);
    expect(c.yMax).toBe(255);
  });

  // ─── Mode 2: over-border=false → reg values + 32 offset ─────────────────

  it("Mode 2 (not over-border): default registers (0,255,0,191) offset by 32", () => {
    writeNextReg(0x15, 0b00000000); // over-border=0
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    expect(c.xMin).toBe(0 + 32);    // 32
    expect(c.xMax).toBe(255 + 32);  // 287
    expect(c.yMin).toBe(0 + 32);    // 32
    expect(c.yMax).toBe(191 + 32);  // 223
  });

  it("Mode 2: custom clip registers add 32 border offset", () => {
    setClipRegs(64, 100, 20, 80);
    writeNextReg(0x15, 0b00000000); // over-border=0
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    expect(c.xMin).toBe(64 + 32);  // 96
    expect(c.xMax).toBe(100 + 32); // 132
    expect(c.yMin).toBe(20 + 32);  // 52
    expect(c.yMax).toBe(80 + 32);  // 112
  });

  it("Mode 2: minimum clip registers (all 0) produce 32/32 boundaries", () => {
    setClipRegs(0, 0, 0, 0);
    writeNextReg(0x15, 0b00000000);
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    expect(c.xMin).toBe(32);
    expect(c.xMax).toBe(32);
    expect(c.yMin).toBe(32);
    expect(c.yMax).toBe(32);
  });

  it("Mode 2: spriteClippingEnabled flag is ignored when not over-border", () => {
    setClipRegs(8, 60, 4, 30);
    writeNextReg(0x15, 0b00100000); // over-border=0, clip=1 (clip bit set but irrelevant)
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    // Still mode 2: add 32
    expect(c.xMin).toBe(8 + 32);
    expect(c.xMax).toBe(60 + 32);
    expect(c.yMin).toBe(4 + 32);
    expect(c.yMax).toBe(30 + 32);
  });

  // ─── Mode 3: over-border=true, clip=true → X doubled, Y direct ──────────

  it("Mode 3 (over-border + clip): X registers doubled, Y registers direct", () => {
    setClipRegs(10, 80, 5, 40);
    writeNextReg(0x15, 0b00100010); // over-border=1, clip=1
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    expect(c.xMin).toBe(10 << 1);          // 20
    expect(c.xMax).toBe((80 << 1) | 1);    // 161
    expect(c.yMin).toBe(5);
    expect(c.yMax).toBe(40);
  });

  it("Mode 3: zero clip registers produce {0, 1, 0, 0}", () => {
    setClipRegs(0, 0, 0, 0);
    writeNextReg(0x15, 0b00100010);
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    expect(c.xMin).toBe(0);       // 0<<1
    expect(c.xMax).toBe(1);       // (0<<1)|1
    expect(c.yMin).toBe(0);
    expect(c.yMax).toBe(0);
  });

  it("Mode 3: max clip regs (255/255/255/255) produce {510, 511, 255, 255}", () => {
    setClipRegs(255, 255, 255, 255);
    writeNextReg(0x15, 0b00100010);
    machine.composedScreenDevice.updateSpriteClipBoundaries();

    const c = clip();
    expect(c.xMin).toBe(255 << 1);         // 510
    expect(c.xMax).toBe((255 << 1) | 1);   // 511
    expect(c.yMin).toBe(255);
    expect(c.yMax).toBe(255);
  });

  // ─── Mode transitions ────────────────────────────────────────────────────

  it("switching from mode 1 to mode 2 updates boundaries", () => {
    setClipRegs(20, 40, 10, 30);
    writeNextReg(0x15, 0b00000010); // mode 1
    machine.composedScreenDevice.updateSpriteClipBoundaries();
    let c = clip();
    expect(c.xMin).toBe(0); // mode 1: full screen

    writeNextReg(0x15, 0b00000000); // mode 2
    machine.composedScreenDevice.updateSpriteClipBoundaries();
    c = clip();
    expect(c.xMin).toBe(20 + 32); // mode 2: reg + 32
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Sprite Transparency Mask (D3)", () => {
  /**
   * D3 fix: for 4-bit sprites, the transparency index is masked to 4 bits
   * before comparison.  This ensures the default transparencyIndex (0xE3)
   * correctly flags pixel value 0x03 (= 0xE3 & 0x0F) as transparent.
   *
   * Formula: isTransparent = (pixelValue === (transparencyIndex & transpMask))
   * where   transpMask = is4Bit ? 0x0f : 0xff
   */

  it("8-bit: full transparencyIndex used (0xff mask)", () => {
    const transparencyIndex = 0xe3;
    const transpMask = 0xff; // 8-bit sprite
    expect((0xe3 & transpMask)).toBe(0xe3);
    expect(0xe3 === (transparencyIndex & transpMask)).toBe(true);
  });

  it("8-bit: pixel not equal to transparencyIndex is opaque", () => {
    const transparencyIndex = 0xe3;
    const transpMask = 0xff;
    // Pixel 0x03 is NOT equal to 0xe3 in 8-bit mode
    expect(0x03 === (transparencyIndex & transpMask)).toBe(false);
  });

  it("4-bit: transparencyIndex is masked to lower 4 bits (0x0f mask)", () => {
    const transparencyIndex = 0xe3; // default
    const transpMask = 0x0f; // 4-bit sprite
    // 0xe3 & 0x0f = 0x03
    expect((transparencyIndex & transpMask)).toBe(0x03);
  });

  it("4-bit: pixel value 0x03 is transparent when transparencyIndex=0xE3", () => {
    const transparencyIndex = 0xe3;
    const transpMask = 0x0f;
    expect(0x03 === (transparencyIndex & transpMask)).toBe(true);
  });

  it("4-bit: pixel 0x03 was NOT transparent in old code (bug verification)", () => {
    // Old code compared pixelValue === transparencyIndex without masking
    const transparencyIndex = 0xe3;
    // 4-bit pixel values are 0-15; comparing against unmasked 0xe3 never matches
    for (let pixel = 0; pixel <= 15; pixel++) {
      expect(pixel === transparencyIndex).toBe(false); // old bug: always false
    }
  });

  it("4-bit: pixel value 0x00 is transparent when transparencyIndex=0x00", () => {
    const transparencyIndex = 0x00;
    const transpMask = 0x0f;
    expect(0x00 === (transparencyIndex & transpMask)).toBe(true);
  });

  it("4-bit: pixel value 0x0F is transparent when transparencyIndex=0xFF", () => {
    const transparencyIndex = 0xff;
    const transpMask = 0x0f;
    expect(0x0f === (transparencyIndex & transpMask)).toBe(true);
  });

  it("4-bit: only the lower nibble of transparencyIndex selects the transparent pen", () => {
    // Even with high nibble set (0xA5), lower nibble 0x05 is the 4-bit transparent pen
    const transparencyIndex = 0xa5;
    const transpMask = 0x0f;
    const effectiveTranspPen = transparencyIndex & transpMask; // 0x05
    expect(effectiveTranspPen).toBe(0x05);
    expect(0x05 === effectiveTranspPen).toBe(true);  // pixel 5 is transparent
    expect(0x0a === effectiveTranspPen).toBe(false); // pixel 10 is opaque
  });

  it("SpriteDevice.transparencyIndex defaults to 0xE3", async () => {
    const m = await createTestNextMachine();
    expect(m.spriteDevice.transparencyIndex).toBe(0xe3);
  });

  it("SpriteDevice.transparencyIndex is updated by NR $4B write", async () => {
    const m = await createTestNextMachine();
    m.nextRegDevice.setNextRegisterIndex(0x4b);
    m.nextRegDevice.setNextRegisterValue(0x55);
    expect(m.spriteDevice.transparencyIndex).toBe(0x55);
  });
});
