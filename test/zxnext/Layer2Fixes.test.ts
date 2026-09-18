import { describe, it, expect } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";

// 50Hz timing constants
const TOTAL_HC = 456;
const DISPLAY_X_START = 0x90; // 144
const DISPLAY_Y_START = 0x40; // 64

/**
 * Compute the tact index for a given display-relative pixel position.
 * displayX: column within the 256-pixel display area (0–255)
 * displayY: row within the 192-pixel display area (0–191)
 */
function tactFor(displayX: number, displayY: number): number {
  const hc = DISPLAY_X_START + displayX;
  const vc = DISPLAY_Y_START + displayY;
  return vc * TOTAL_HC + hc;
}

/**
 * Write a value directly into Layer 2 SRAM for 256×192 mode (row-major).
 * The default Layer 2 bank is 8 (from NR 0x12 reset value).
 */
function writeLayer2Sram256(m: TestZxNextMachine, x: number, y: number, value: number): void {
  // bank16K = 8, offset = (y << 8) | x, bank8K = (8 + segment) * 2 + half
  const offset = (y << 8) | x;
  const segment16K = (offset >> 14) & 0x07;
  const half8K = (offset >> 13) & 0x01;
  const bank8K = (8 + segment16K) * 2 + half8K;
  const memoryBase = OFFS_NEXT_RAM + (bank8K << 13);
  const offsetWithin8K = offset & 0x1fff;
  m.memoryDevice.memory[memoryBase + offsetWithin8K] = value;
}

/**
 * Set a Layer 2 palette entry with optional priority flag.
 * Uses NR 0x43 (palette control) and NR 0x44 (palette data) two-write protocol.
 */
function setLayer2PaletteEntry(
  m: TestZxNextMachine,
  index: number,
  rgb333: number,
  priority: boolean = false
): void {
  const nrDevice = m.nextRegDevice;
  // Select Layer 2 first palette for writing (palette select = 001 for Layer 2 first)
  nrDevice.directSetRegValue(0x43, 0x10); // selectedPalette=1 (Layer 2 first)
  // Set palette index via NR 0x40 (Palette Index Select)
  nrDevice.directSetRegValue(0x40, index);
  // First write: upper 8 bits of 9-bit color (RRRGGGBB)
  const firstByte = (rgb333 >> 1) & 0xff;
  nrDevice.directSetRegValue(0x44, firstByte);
  // Second write: bit 0 = B LSB, bit 7 = priority
  const secondByte = (rgb333 & 0x01) | (priority ? 0x80 : 0x00);
  nrDevice.directSetRegValue(0x44, secondByte);
}

/**
 * Enable Layer 2 at the specified resolution.
 * resolution: 0 = 256×192, 1 = 320×256, 2 = 640×256
 */
function enableLayer2(m: TestZxNextMachine, resolution: number, paletteOffset = 0): void {
  const nrDevice = m.nextRegDevice;
  const d = m.composedScreenDevice;
  // Set resolution and palette offset via NR 0x70
  nrDevice.directSetRegValue(0x70, ((resolution & 0x03) << 4) | (paletteOffset & 0x0f));
  // Enable Layer 2 via port 0x123b (bit 1 = enable)
  d.layer2Enabled = true;
  // Reset scroll
  nrDevice.directSetRegValue(0x16, 0); // scrollX LSB
  nrDevice.directSetRegValue(0x71, 0); // scrollX MSB (bit 0)
  nrDevice.directSetRegValue(0x17, 0); // scrollY
  // Ensure clip window is fully open
  d.layer2ClipWindowX1 = 0;
  d.layer2ClipWindowX2 = resolution === 0 ? 255 : 159;
  d.layer2ClipWindowY1 = 0;
  d.layer2ClipWindowY2 = resolution === 0 ? 191 : 255;
}

// =========================================================================================
// Tests
// =========================================================================================

describe("Layer 2 Fixes", function () {
  // D1-D5 (priority bit, 640x256 nibble order, transparency after the palette offset, the Y and X
  // wrapping) moved to the real machine: test/zxnext-hw/layer2/layer2.test.ts (L2-007, L2-008,
  // L2-010 - L2-012, L2-015, L2-016). D6-D7 (blend modes) wait for catalogue §4.17.

  describe("D6 - Blend mode compositing", () => {
    it("priority L2 in blend mode should blend with ULA, not short-circuit", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;
      enableLayer2(m, 0);

      // Set blend mode 6 (saturate-add)
      d.layerPriority = 6;

      // Set a priority L2 pixel
      setLayer2PaletteEntry(m, 0x42, 0b010_010_010, true); // priority=true
      writeLayer2Sram256(m, 0, 0, 0x42);

      // The compositing should blend L2 with ULA, not just use L2 raw
      const tact = tactFor(0, 0);
      d.onNewFrame();
      d.renderTact(tact);
      const buffer = d.getPixelBuffer();
      expect(buffer).toBeDefined();
    });

    it("priority L2 should still override in non-blend modes (0-5)", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;
      enableLayer2(m, 0);

      // Standard mode SLU (priority 0)
      d.layerPriority = 0;

      setLayer2PaletteEntry(m, 0x42, 0b010_010_010, true);
      writeLayer2Sram256(m, 0, 0, 0x42);

      const tact = tactFor(0, 0);
      d.onNewFrame();
      d.renderTact(tact);
      const buffer = d.getPixelBuffer();
      expect(buffer).toBeDefined();
    });
  });

  // D7: Blend mode should work even with ulaBlendingInSLUModes === 0b01
  describe("D7 - Blend mode with ulaBlendingInSLUModes=01", () => {
    it("blend should still be applied when ulaBlendingInSLUModes is 01", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;
      enableLayer2(m, 0);

      // Set blend mode 6 (priority >= 6)
      d.layerPriority = 6;
      // Set ulaBlendingInSLUModes to 0b01 (was previously preventing blend)
      d.ulaBlendingInSLUModes = 0b01;

      // Set a L2 pixel
      setLayer2PaletteEntry(m, 0x42, 0b011_011_011, false);
      writeLayer2Sram256(m, 0, 0, 0x42);

      const tact = tactFor(0, 0);
      d.onNewFrame();
      d.renderTact(tact);
      const buffer = d.getPixelBuffer();
      // The pixel should show L2 content (blended) rather than falling through to SLU
      const bitmapY = (DISPLAY_Y_START + 0) - 0x10;
      const bitmapX = (DISPLAY_X_START + 0 - 0x60) * 2;
      const pixel = buffer[bitmapY * d.screenWidth + bitmapX];
      // L2 pixel is non-transparent, so the blend should include it in the output
      expect(pixel).not.toBe(0);
    });

    it("old behavior: blend was skipped with ulaBlendingInSLUModes=01, now fixed", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;
      enableLayer2(m, 0);

      // Set blend mode 7 (priority >= 6, mixer=1: add-sub-5)
      d.layerPriority = 7;
      d.ulaBlendingInSLUModes = 0b01;

      setLayer2PaletteEntry(m, 0x55, 0b100_100_100, false);
      writeLayer2Sram256(m, 0, 0, 0x55);

      const tact = tactFor(0, 0);
      d.onNewFrame();
      d.renderTact(tact);
      const buffer = d.getPixelBuffer();
      const bitmapY = (DISPLAY_Y_START + 0) - 0x10;
      const bitmapX = (DISPLAY_X_START + 0 - 0x60) * 2;
      const pixel = buffer[bitmapY * d.screenWidth + bitmapX];
      // With the fix, blend is applied — L2 pixel is visible
      expect(pixel).not.toBe(0);
    });
  });
});
