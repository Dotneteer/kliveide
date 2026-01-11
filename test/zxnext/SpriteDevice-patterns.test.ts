import { describe, it, expect, beforeEach } from "vitest";
import { SpriteDevice } from "@emu/machines/zxNext/SpriteDevice";
import { createTestNextMachine } from "./TestNextMachine";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Unit tests for SpriteDevice pattern memory with pre-transformed variants
 * 
 * Tests cover:
 * - Pattern memory structure (64 patterns × 8 variants)
 * - Incremental write updates to all 8 variants
 * - Transformation correctness for each variant (0-7)
 * - Pattern index wrapping at 64
 * - Pattern subindex wrapping at 256
 */

describe("SpriteDevice - Pattern Memory Structure", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = new SpriteDevice(machine);
  });

  it("should allocate 512 8-bit pattern variant arrays (64 patterns × 8 variants)", () => {
    expect(spriteDevice.patternMemory8bit).toBeDefined();
    expect(spriteDevice.patternMemory8bit.length).toBe(512);
  });

  it("should allocate 1024 4-bit pattern variant arrays (128 patterns × 8 variants)", () => {
    expect(spriteDevice.patternMemory4bit).toBeDefined();
    expect(spriteDevice.patternMemory4bit.length).toBe(1024);
  });

  it("should allocate 256 bytes for each 8-bit pattern variant", () => {
    for (let i = 0; i < 512; i++) {
      expect(spriteDevice.patternMemory8bit[i]).toBeInstanceOf(Uint8Array);
      expect(spriteDevice.patternMemory8bit[i].length).toBe(256);
    }
  });

  it("should allocate 256 bytes for each 4-bit pattern variant", () => {
    for (let i = 0; i < 1024; i++) {
      expect(spriteDevice.patternMemory4bit[i]).toBeInstanceOf(Uint8Array);
      expect(spriteDevice.patternMemory4bit[i].length).toBe(256);
    }
  });

  it("should initialize all 8-bit pattern memory to zero", () => {
    for (let i = 0; i < 512; i++) {
      for (let j = 0; j < 256; j++) {
        expect(spriteDevice.patternMemory8bit[i][j]).toBe(0);
      }
    }
  });

  it("should initialize all 4-bit pattern memory to zero", () => {
    for (let i = 0; i < 1024; i++) {
      for (let j = 0; j < 256; j++) {
        expect(spriteDevice.patternMemory4bit[i][j]).toBe(0);
      }
    }
  });

  it("should initialize pattern index to 0", () => {
    expect(spriteDevice.patternIndex).toBe(0);
  });

  it("should initialize pattern subindex to 0", () => {
    expect(spriteDevice.patternSubIndex).toBe(0);
  });
});

describe("SpriteDevice - Pattern Write Incremental Updates", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = new SpriteDevice(machine);
  });

  it("should write single byte to all 8 variants of both 8-bit and 4-bit patterns", () => {
    // Write value 0x42 at position [0][0] (top-left corner)
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0x42);

    // Check 8-bit pattern memory (full byte)
    const baseIdx8bit = 0; // Pattern 0
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 0][0]).toBe(0x42);
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 1][(15 << 4) | 0]).toBe(0x42);
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 2][(0 << 4) | 15]).toBe(0x42);

    // Check 4-bit pattern memory (lower nibble only)
    const baseIdx4bit = 0; // Pattern 0
    expect(spriteDevice.patternMemory4bit[baseIdx4bit + 0][0]).toBe(0x02); // 0x42 & 0x0f
    expect(spriteDevice.patternMemory4bit[baseIdx4bit + 1][(15 << 4) | 0]).toBe(0x02);
    expect(spriteDevice.patternMemory4bit[baseIdx4bit + 2][(0 << 4) | 15]).toBe(0x02);

    // Variant 3: [0][0] → [15][15] (mirrorXY)
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 3][(15 << 4) | 15]).toBe(0x42);

    // Variant 4: [0][0] → [0][15] (rotate)
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 4][(0 << 4) | 15]).toBe(0x42);

    // Variant 5: [0][0] → [0][0] (rotate + mirrorY)
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 5][(0 << 4) | 0]).toBe(0x42);

    // Variant 6: [0][0] → [15][15] (rotate + mirrorX)
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 6][(15 << 4) | 15]).toBe(0x42);

    // Variant 7: [0][0] → [15][0] (rotate + mirrorXY)
    expect(spriteDevice.patternMemory8bit[baseIdx8bit + 7][(15 << 4) | 0]).toBe(0x42);
  });

  it("should write byte at center position to all variants correctly", () => {
    // Write value 0x99 at position [7][8] (center-ish)
    const srcY = 7, srcX = 8;
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = (srcY << 4) | srcX;
    spriteDevice.writeSpritePattern(0x99);

    const baseIdx = 0;

    // Variant 0: [7][8] → [7][8]
    expect(spriteDevice.patternMemory8bit[baseIdx + 0][(7 << 4) | 8]).toBe(0x99);

    // Variant 1: [7][8] → [8][8] (mirrorY: 15-7=8)
    expect(spriteDevice.patternMemory8bit[baseIdx + 1][(8 << 4) | 8]).toBe(0x99);

    // Variant 2: [7][8] → [7][7] (mirrorX: 15-8=7)
    expect(spriteDevice.patternMemory8bit[baseIdx + 2][(7 << 4) | 7]).toBe(0x99);

    // Variant 3: [7][8] → [8][7] (mirrorXY)
    expect(spriteDevice.patternMemory8bit[baseIdx + 3][(8 << 4) | 7]).toBe(0x99);

    // Variant 4: [7][8] → [8][8] (rotate: [x][15-y] = [8][8])
    expect(spriteDevice.patternMemory8bit[baseIdx + 4][(8 << 4) | 8]).toBe(0x99);

    // Variant 5: [7][8] → [8][7] (rotate + mirrorY: [x][y])
    expect(spriteDevice.patternMemory8bit[baseIdx + 5][(8 << 4) | 7]).toBe(0x99);

    // Variant 6: [7][8] → [7][8] (rotate + mirrorX: [15-x][15-y])
    expect(spriteDevice.patternMemory8bit[baseIdx + 6][(7 << 4) | 8]).toBe(0x99);

    // Variant 7: [7][8] → [7][7] (rotate + mirrorXY: [15-x][y])
    expect(spriteDevice.patternMemory8bit[baseIdx + 7][(7 << 4) | 7]).toBe(0x99);
  });

  it("should write multiple bytes sequentially to all variants", () => {
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = 0;

    // Write first row: 16 bytes
    for (let x = 0; x < 16; x++) {
      spriteDevice.writeSpritePattern(0x10 + x);
    }

    const baseIdx = 0;

    // Check variant 0 (no transform) has first row intact
    for (let x = 0; x < 16; x++) {
      expect(spriteDevice.patternMemory8bit[baseIdx + 0][x]).toBe(0x10 + x);
    }

    // Check variant 1 (mirrorY) has first row in last row position
    for (let x = 0; x < 16; x++) {
      expect(spriteDevice.patternMemory8bit[baseIdx + 1][(15 << 4) | x]).toBe(0x10 + x);
    }

    // Check variant 2 (mirrorX) has first row reversed
    for (let x = 0; x < 16; x++) {
      expect(spriteDevice.patternMemory8bit[baseIdx + 2][15 - x]).toBe(0x10 + x);
    }
  });

  it("should increment pattern subindex after each write", () => {
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = 0;

    spriteDevice.writeSpritePattern(0x01);
    expect(spriteDevice.patternSubIndex).toBe(1);

    spriteDevice.writeSpritePattern(0x02);
    expect(spriteDevice.patternSubIndex).toBe(2);

    spriteDevice.writeSpritePattern(0x03);
    expect(spriteDevice.patternSubIndex).toBe(3);
  });

  it("should wrap pattern subindex at 256 and increment pattern index", () => {
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = 255;

    spriteDevice.writeSpritePattern(0xFF);

    expect(spriteDevice.patternSubIndex).toBe(0);
    expect(spriteDevice.patternIndex).toBe(1);
  });

  it("should wrap pattern index at 64", () => {
    spriteDevice.patternIndex = 63;
    spriteDevice.patternSubIndex = 255;

    spriteDevice.writeSpritePattern(0xFF);

    expect(spriteDevice.patternIndex).toBe(0);
    expect(spriteDevice.patternSubIndex).toBe(0);
  });
});

describe("SpriteDevice - Pattern Transformation Correctness", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = new SpriteDevice(machine);
  });

  /**
   * Helper to write a simple test pattern:
   * Row 0: 0x00, 0x01, 0x02, ..., 0x0F
   * Row 1: 0x10, 0x11, 0x12, ..., 0x1F
   * ...
   * Row 15: 0xF0, 0xF1, 0xF2, ..., 0xFF
   */
  function writeTestPattern(patternIdx: number): void {
    spriteDevice.patternIndex = patternIdx;
    spriteDevice.patternSubIndex = 0;

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        spriteDevice.writeSpritePattern((y << 4) | x);
      }
    }
  }

  it("Variant 0: No transformation (identity)", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[0]; // Pattern 0, variant 0

    // Check that pattern is identical: [y][x] = (y << 4) | x
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const expected = (y << 4) | x;
        const actual = variant[(y << 4) | x];
        expect(actual).toBe(expected);
      }
    }
  });

  it("Variant 1: Mirror Y (vertical flip)", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[1]; // Pattern 0, variant 1

    // Check mirrorY: src[y][x] → dst[15-y][x]
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const srcValue = (y << 4) | x; // Value written to src[y][x]
        const dstY = 15 - y;
        const actual = variant[(dstY << 4) | x];
        expect(actual).toBe(srcValue);
      }
    }
  });

  it("Variant 2: Mirror X (horizontal flip)", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[2]; // Pattern 0, variant 2

    // Check mirrorX: src[y][x] → dst[y][15-x]
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const srcValue = (y << 4) | x;
        const dstX = 15 - x;
        const actual = variant[(y << 4) | dstX];
        expect(actual).toBe(srcValue);
      }
    }
  });

  it("Variant 3: Mirror XY (180° rotation)", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[3]; // Pattern 0, variant 3

    // Check mirrorXY: src[y][x] → dst[15-y][15-x]
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const srcValue = (y << 4) | x;
        const dstY = 15 - y;
        const dstX = 15 - x;
        const actual = variant[(dstY << 4) | dstX];
        expect(actual).toBe(srcValue);
      }
    }
  });

  it("Variant 4: Rotate 90° clockwise", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[4]; // Pattern 0, variant 4

    // Check rotate: src[y][x] → dst[x][15-y]
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const srcValue = (y << 4) | x;
        const dstY = x;
        const dstX = 15 - y;
        const actual = variant[(dstY << 4) | dstX];
        expect(actual).toBe(srcValue);
      }
    }
  });

  it("Variant 5: Rotate + Mirror Y (transpose)", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[5]; // Pattern 0, variant 5

    // Check rotate+mirrorY: src[y][x] → dst[x][y]
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const srcValue = (y << 4) | x;
        const dstY = x;
        const dstX = y;
        const actual = variant[(dstY << 4) | dstX];
        expect(actual).toBe(srcValue);
      }
    }
  });

  it("Variant 6: Rotate + Mirror X (270° rotation)", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[6]; // Pattern 0, variant 6

    // Check rotate+mirrorX: src[y][x] → dst[15-x][15-y]
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const srcValue = (y << 4) | x;
        const dstY = 15 - x;
        const dstX = 15 - y;
        const actual = variant[(dstY << 4) | dstX];
        expect(actual).toBe(srcValue);
      }
    }
  });

  it("Variant 7: Rotate + Mirror XY", () => {
    writeTestPattern(0);
    const variant = spriteDevice.patternMemory8bit[7]; // Pattern 0, variant 7

    // Check rotate+mirrorXY: src[y][x] → dst[15-x][y]
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const srcValue = (y << 4) | x;
        const dstY = 15 - x;
        const dstX = y;
        const actual = variant[(dstY << 4) | dstX];
        expect(actual).toBe(srcValue);
      }
    }
  });
});

describe("SpriteDevice - Pattern Variant Indexing", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = new SpriteDevice(machine);
  });

  it("should write to correct variant indices for pattern 0", () => {
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0xAA);

    // Pattern 0, all 8 variants should exist at indices 0-7
    for (let v = 0; v < 8; v++) {
      const variantArray = spriteDevice.patternMemory8bit[v];
      expect(variantArray).toBeDefined();
      // At least one byte should be 0xAA (at transformed position)
      const hasValue = Array.from(variantArray).some(b => b === 0xAA);
      expect(hasValue).toBe(true);
    }
  });

  it("should write to correct variant indices for pattern 5", () => {
    spriteDevice.patternIndex = 5;
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0xBB);

    // Pattern 5, variants should exist at indices 40-47 (5 * 8 = 40)
    const baseIdx = 5 << 3; // 40
    for (let v = 0; v < 8; v++) {
      const variantArray = spriteDevice.patternMemory8bit[baseIdx + v];
      expect(variantArray).toBeDefined();
      const hasValue = Array.from(variantArray).some(b => b === 0xBB);
      expect(hasValue).toBe(true);
    }
  });

  it("should write to correct variant indices for pattern 63 (last pattern)", () => {
    spriteDevice.patternIndex = 63;
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0xCC);

    // Pattern 63, variants should exist at indices 504-511 (63 * 8 = 504)
    const baseIdx = 63 << 3; // 504
    for (let v = 0; v < 8; v++) {
      const variantArray = spriteDevice.patternMemory8bit[baseIdx + v];
      expect(variantArray).toBeDefined();
      const hasValue = Array.from(variantArray).some(b => b === 0xCC);
      expect(hasValue).toBe(true);
    }
  });

  it("should isolate patterns from each other", () => {
    // Write different values to pattern 0 and pattern 1
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0x11);

    spriteDevice.patternIndex = 1;
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0x22);

    // Pattern 0 variants should have 0x11
    for (let v = 0; v < 8; v++) {
      const hasValue = Array.from(spriteDevice.patternMemory8bit[v]).some(b => b === 0x11);
      expect(hasValue).toBe(true);
    }

    // Pattern 1 variants should have 0x22
    const baseIdx1 = 1 << 3; // 8
    for (let v = 0; v < 8; v++) {
      const hasValue = Array.from(spriteDevice.patternMemory8bit[baseIdx1 + v]).some(b => b === 0x22);
      expect(hasValue).toBe(true);
    }

    // Pattern 0 should NOT have 0x22
    for (let v = 0; v < 8; v++) {
      const hasValue = Array.from(spriteDevice.patternMemory8bit[v]).some(b => b === 0x22);
      expect(hasValue).toBe(false);
    }
  });
});

describe("SpriteDevice - Pattern Memory Integration with Port 0x303B", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = new SpriteDevice(machine);
  });

  it("should set pattern index via port 0x303B", () => {
    spriteDevice.writePort303bValue(0x05); // Pattern 5
    expect(spriteDevice.patternIndex).toBe(0x05);
  });

  it("should set pattern subindex bit 7 via port 0x303B", () => {
    spriteDevice.writePort303bValue(0x80); // Subindex = 0x80
    expect(spriteDevice.patternSubIndex).toBe(0x80);
  });

  it("should write pattern starting at index set by port", () => {
    spriteDevice.writePort303bValue(0x03); // Pattern 3
    spriteDevice.writeSpritePattern(0xDD);

    const baseIdx = 3 << 3; // 24
    const variant0 = spriteDevice.patternMemory8bit[baseIdx];
    expect(variant0[0]).toBe(0xDD); // First byte of pattern 3, variant 0
  });

  it("should write 256 bytes to complete one pattern", () => {
    spriteDevice.writePort303bValue(0x00); // Pattern 0

    // Write 256 bytes
    for (let i = 0; i < 256; i++) {
      spriteDevice.writeSpritePattern(i & 0xFF);
    }

    // Should wrap to pattern 1
    expect(spriteDevice.patternIndex).toBe(1);
    expect(spriteDevice.patternSubIndex).toBe(0);
  });
});

describe("SpriteDevice - Edge Cases and Boundary Conditions", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = new SpriteDevice(machine);
  });

  it("should handle writing to all 4 corners correctly", () => {
    spriteDevice.patternIndex = 0;

    // Top-left [0][0]
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0x11);

    // Top-right [0][15]
    spriteDevice.patternSubIndex = 15;
    spriteDevice.writeSpritePattern(0x22);

    // Bottom-left [15][0]
    spriteDevice.patternSubIndex = (15 << 4) | 0;
    spriteDevice.writeSpritePattern(0x33);

    // Bottom-right [15][15]
    spriteDevice.patternSubIndex = (15 << 4) | 15;
    spriteDevice.writeSpritePattern(0x44);

    const variant0 = spriteDevice.patternMemory8bit[0];
    expect(variant0[0]).toBe(0x11);           // [0][0]
    expect(variant0[15]).toBe(0x22);          // [0][15]
    expect(variant0[240]).toBe(0x33);         // [15][0]
    expect(variant0[255]).toBe(0x44);         // [15][15]
  });

  it("should handle pattern index overflow correctly", () => {
    // Pattern index is masked to 6 bits (0-63) in writePort303bValue
    // Set to 64, which should wrap to 0
    spriteDevice.writePort303bValue(64); // Should mask to 0
    expect(spriteDevice.patternIndex).toBe(0); // Masked to 6 bits
    
    spriteDevice.patternSubIndex = 0;
    spriteDevice.writeSpritePattern(0xFF);

    // Should have written to pattern 0
    const baseIdx = 0;
    expect(spriteDevice.patternMemory8bit[baseIdx][0]).toBe(0xFF);
  });

  it("should handle maximum pattern writes (all 64 patterns)", () => {
    spriteDevice.patternIndex = 0;
    spriteDevice.patternSubIndex = 0;

    // Write 64 complete patterns (64 * 256 = 16,384 bytes)
    for (let p = 0; p < 64; p++) {
      for (let b = 0; b < 256; b++) {
        spriteDevice.writeSpritePattern((p << 4) | (b & 0x0F));
      }
    }

    // Should wrap back to pattern 0
    expect(spriteDevice.patternIndex).toBe(0);
    expect(spriteDevice.patternSubIndex).toBe(0);

    // Verify some patterns were written correctly
    const pattern0Variant0 = spriteDevice.patternMemory8bit[0];
    const pattern63Variant0 = spriteDevice.patternMemory8bit[63 << 3];

    expect(pattern0Variant0[0]).toBe(0x00); // Pattern 0, byte 0
    expect(pattern63Variant0[0]).toBe(0xF0); // Pattern 63, byte 0
  });
});
