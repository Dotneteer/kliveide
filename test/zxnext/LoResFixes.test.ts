import { describe, it, expect } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { OFFS_BANK_05, OFFS_BANK_07 } from "@emu/machines/zxNext/MemoryDevice";

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
 * Set a ULA palette entry using NR 0x43/0x44 two-write protocol.
 * paletteSelect: 0 = ULA first, 4 = ULA second
 */
function setUlaPaletteEntry(
  m: TestZxNextMachine,
  index: number,
  rgb333: number,
  paletteSelect: number = 0
): void {
  const nrDevice = m.nextRegDevice;
  // Select palette for writing
  nrDevice.directSetRegValue(0x43, (paletteSelect & 0x07) << 4);
  // Set palette index via NR 0x40
  nrDevice.directSetRegValue(0x40, index);
  // First write: upper 8 bits of 9-bit color (RRRGGGBB)
  const firstByte = (rgb333 >> 1) & 0xff;
  nrDevice.directSetRegValue(0x44, firstByte);
  // Second write: bit 0 = B LSB
  const secondByte = rgb333 & 0x01;
  nrDevice.directSetRegValue(0x44, secondByte);
}

/**
 * Enable LoRes mode in standard (8bpp) or Radastan (4bpp) mode.
 */
function enableLoRes(
  m: TestZxNextMachine,
  radastan: boolean = false,
  paletteOffset: number = 0,
  radastanTimexXor: boolean = false
): void {
  const d = m.composedScreenDevice;
  const nr = m.nextRegDevice;
  // Enable LoRes via NR 0x15 bit 7
  nr.directSetRegValue(0x15, 0x80);
  // Set NR 0x6A: radastan[5], radastanXor[4], paletteOffset[3:0]
  const reg6a =
    (radastan ? 0x20 : 0) |
    (radastanTimexXor ? 0x10 : 0) |
    (paletteOffset & 0x0f);
  nr.directSetRegValue(0x6a, reg6a);
  // Reset scroll
  nr.directSetRegValue(0x32, 0); // X scroll
  nr.directSetRegValue(0x33, 0); // Y scroll
  // Ensure clip window fully open
  d.ulaClipWindowX1 = 0;
  d.ulaClipWindowX2 = 255;
  d.ulaClipWindowY1 = 0;
  d.ulaClipWindowY2 = 191;
}

/**
 * Write a byte into bank 5 SRAM at the given offset.
 * This is what LoRes should always read from (not bank 7/shadow screen).
 */
function writeBank5(m: TestZxNextMachine, offset: number, value: number): void {
  m.memoryDevice.memory[OFFS_BANK_05 + (offset & 0x3fff)] = value;
}

/**
 * Write a byte into bank 7 (shadow screen) SRAM at the given offset.
 */
function writeBank7(m: TestZxNextMachine, offset: number, value: number): void {
  m.memoryDevice.memory[OFFS_BANK_07 + (offset & 0x3fff)] = value;
}

/**
 * Compute LoRes standard mode address for (x, y) in display coordinates.
 * x: 0–127 (LoRes pixel column), y: 0–95 (LoRes pixel row)
 */
function loResStdAddr(x: number, y: number): number {
  const addr_pre = (y << 7) | x;
  return y >= 48 ? addr_pre + 0x0800 : addr_pre;
}

/**
 * Compute LoRes Radastan mode address for (x, y) with a given dfile bit.
 * x: 0–63 (byte column), y: 0–95 (LoRes pixel row)
 */
function loResRadAddr(x: number, y: number, dfile: boolean): number {
  return (dfile ? 0x2000 : 0) | (y << 6) | x;
}

/**
 * Render a range of tacts and return the ulaPixel1Rgb333 at the target tact.
 *
 * We manually initialize the sampled rendering state after onNewFrame() because:
 * - sampleNextRegistersForUlaMode() sets loResEnabledSampled but NOT the LoRes-specific
 *   sampled properties (loResRadastanModeSampled, loResScrollXSampled, loResScrollYSampled).
 * - Those are only set inside renderLoResPixel() at SCR_NREG_SAMPLE positions.
 * - On the first rendered line, the ULA Standard renderer claims the NREG_SAMPLE tact
 *   (because loResEnabledSampled is initially false), so LoRes never gets to sample its state.
 */
function renderAndGetUlaPixelRgb333(
  m: TestZxNextMachine,
  displayX: number,
  displayY: number
): number {
  const d = m.composedScreenDevice;
  d.onNewFrame();

  // Bootstrap sampled state that is normally set by the rendering pipeline
  (d as any).sampleNextRegistersForUlaMode();
  (d as any).loResRadastanModeSampled = (d as any).loResRadastanMode;
  (d as any).loResScrollXSampled = (d as any).loResScrollX;
  (d as any).loResScrollYSampled = (d as any).loResScrollY;

  // Render from start of the target scanline to cover pre-display fetch positions
  const targetTact = tactFor(displayX, displayY);
  const lineStart = (DISPLAY_Y_START + displayY) * TOTAL_HC;
  for (let t = lineStart; t <= targetTact; t++) {
    d.renderTact(t);
  }
  return (d as any).ulaPixel1Rgb333 as number;
}

// =========================================================================================
// Tests
// =========================================================================================

describe("LoRes Fixes", function () {
  // =====================================================================================
  // D1 — Radastan ULA+ Palette Index: << 4 (not << 2)
  // =====================================================================================
  describe("D1 - Radastan ULA+ palette index shift", () => {
    it("offset=3, nibble=5 should produce palette index 0xF5 (not 0xCD)", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;

      // Enable ULA+ (NR 0x68 bit 3)
      d.ulaPlusEnabled = true;
      // Enable LoRes Radastan with palette offset = 3
      enableLoRes(m, true, 3);

      // Write test byte to bank 5 at radastan address for display (0,0)
      // dfile = timexPort bit0 (0) XOR radastanTimexXor (false) = false → dfile=0
      // y=0 → addr_byte = 0*64 + 0 = 0x0000
      // Byte: upper nibble=5, lower nibble=0xA → 0x5A
      writeBank5(m, 0x0000, 0x5a);

      // Palette index should be: 0xC0 | ((3 & 0x03) << 4) | 5 = 0xC0 | 0x30 | 0x05 = 0xF5
      // Set palette entry 0xF5 to a known color
      const testColor = 0b111_000_111; // R=7, G=0, B=7 = 0x1C7
      setUlaPaletteEntry(m, 0xf5, testColor);

      // Also set the WRONG (old buggy) index 0xCD to a different color
      const wrongColor = 0b000_111_000; // R=0, G=7, B=0 = 0x038
      setUlaPaletteEntry(m, 0xcd, wrongColor);

      // Render pixel at display (0, 0) — upper nibble = 5
      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(testColor);
    });

    it("offset=0, nibble=0xF should produce index 0xCF", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;

      d.ulaPlusEnabled = true;
      enableLoRes(m, true, 0);

      // Byte: upper nibble=0xF, lower nibble=0 → 0xF0
      writeBank5(m, 0x0000, 0xf0);

      // paletteIndex = 0xC0 | (0 << 4) | 0xF = 0xCF
      const testColor = 0b101_010_101; // 0x155
      setUlaPaletteEntry(m, 0xcf, testColor);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(testColor);
    });
  });

  // =====================================================================================
  // D2 — Radastan dfile: XOR of port FF bit 0 and NR 0x6A bit 4
  // =====================================================================================
  describe("D2 - Radastan Timex dfile XOR", () => {
    it("timexPort=0, radastanXor=false → dfile=0 (reads from base)", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0, false);

      // Write distinct bytes to both halves
      writeBank5(m, loResRadAddr(0, 0, false), 0x12); // dfile=0
      writeBank5(m, loResRadAddr(0, 0, true), 0x34); // dfile=1

      // Set palette for index (0 << 4) | 1 = 0x01 (upper nibble of 0x12)
      setUlaPaletteEntry(m, 0x01, 0b010_010_010); // R=2, G=2, B=2
      // Set palette for index (0 << 4) | 3 = 0x03 (upper nibble of 0x34)
      setUlaPaletteEntry(m, 0x03, 0b110_110_110); // R=6, G=6, B=6

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b010_010_010); // from dfile=0
    });

    it("timexPort=1, radastanXor=false → dfile=1 (XOR flips)", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0, false);

      // Set Timex port bit 0 = 1
      m.composedScreenDevice.timexPortValue = 0x01;

      writeBank5(m, loResRadAddr(0, 0, false), 0x12);
      writeBank5(m, loResRadAddr(0, 0, true), 0x34);

      setUlaPaletteEntry(m, 0x01, 0b010_010_010);
      setUlaPaletteEntry(m, 0x03, 0b110_110_110);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b110_110_110); // from dfile=1
    });

    it("timexPort=1, radastanXor=true → dfile=0 (XOR cancels)", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0, true);

      // Set Timex port bit 0 = 1
      m.composedScreenDevice.timexPortValue = 0x01;

      writeBank5(m, loResRadAddr(0, 0, false), 0x12);
      writeBank5(m, loResRadAddr(0, 0, true), 0x34);

      setUlaPaletteEntry(m, 0x01, 0b010_010_010);
      setUlaPaletteEntry(m, 0x03, 0b110_110_110);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b010_010_010); // back to dfile=0
    });

    it("timexPort=0, radastanXor=true → dfile=1", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0, true);

      writeBank5(m, loResRadAddr(0, 0, false), 0x12);
      writeBank5(m, loResRadAddr(0, 0, true), 0x34);

      setUlaPaletteEntry(m, 0x01, 0b010_010_010);
      setUlaPaletteEntry(m, 0x03, 0b110_110_110);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b110_110_110); // dfile=1
    });
  });

  // =====================================================================================
  // D3 — LoRes always reads from bank 5, not shadow screen
  // =====================================================================================
  describe("D3 - LoRes always reads bank 5", () => {
    it("standard LoRes reads bank 5 even when shadow screen is active", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, false, 0);

      // Write test data to bank 5 and bank 7 at the same offset
      const addr = loResStdAddr(0, 0);
      writeBank5(m, addr, 0x42);
      writeBank7(m, addr, 0x99);

      // Set known palette colors for both indices
      setUlaPaletteEntry(m, 0x42, 0b001_001_001);
      setUlaPaletteEntry(m, 0x99, 0b110_110_110);

      // Enable shadow screen
      m.memoryDevice.useShadowScreen = true;

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      // Should read 0x42 from bank 5, not 0x99 from bank 7
      expect(rgb).toBe(0b001_001_001);
    });

    it("standard LoRes reads bank 5 when shadow screen is inactive", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, false, 0);

      const addr = loResStdAddr(0, 0);
      writeBank5(m, addr, 0x42);
      writeBank7(m, addr, 0x99);

      setUlaPaletteEntry(m, 0x42, 0b001_001_001);
      setUlaPaletteEntry(m, 0x99, 0b110_110_110);

      m.memoryDevice.useShadowScreen = false;

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b001_001_001);
    });

    it("Radastan LoRes reads bank 5 even with shadow screen active", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0);

      const addr = loResRadAddr(0, 0, false);
      // Byte 0x50 → upper nibble = 5
      writeBank5(m, addr, 0x50);
      writeBank7(m, addr, 0xa0);

      setUlaPaletteEntry(m, 0x05, 0b011_011_011);
      setUlaPaletteEntry(m, 0x0a, 0b100_100_100);

      m.memoryDevice.useShadowScreen = true;

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b011_011_011); // from bank 5
    });
  });

  // =====================================================================================
  // D4 — Radastan ULA+ guard: must also check !ulaNextEnabled
  // =====================================================================================
  describe("D4 - ULANext disables ULA+ path for Radastan", () => {
    it("ULA+ enabled + ULANext disabled → ULA+ palette path used", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;

      d.ulaPlusEnabled = true;
      d.ulaNextEnabled = false;
      enableLoRes(m, true, 2); // offset=2

      // Byte at addr 0: upper nibble = 7
      writeBank5(m, 0x0000, 0x70);

      // ULA+ path: index = 0xC0 | (2 << 4) | 7 = 0xC0 | 0x20 | 0x07 = 0xE7
      setUlaPaletteEntry(m, 0xe7, 0b111_111_000);

      // Standard path would use (2 << 4) | 7 = 0x27
      setUlaPaletteEntry(m, 0x27, 0b000_000_111);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b111_111_000); // ULA+ path
    });

    it("ULA+ enabled + ULANext enabled → standard palette path used (ULA+ suppressed)", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;

      d.ulaPlusEnabled = true;
      enableLoRes(m, true, 2);

      writeBank5(m, 0x0000, 0x70);

      // ULA+ path (should NOT be used): index = 0xE7
      setUlaPaletteEntry(m, 0xe7, 0b111_111_000);

      // Standard path (SHOULD be used): index = (2 << 4) | 7 = 0x27
      setUlaPaletteEntry(m, 0x27, 0b000_000_111);

      // Set ulaNextEnabled AFTER palette writes (NR 0x43 write clears bit 0)
      d.ulaNextEnabled = true;

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b000_000_111); // Standard path, not ULA+
    });

    it("ULA+ disabled → always standard path regardless of ULANext", async () => {
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;

      d.ulaPlusEnabled = false;
      d.ulaNextEnabled = false;
      enableLoRes(m, true, 2);

      writeBank5(m, 0x0000, 0x70);

      setUlaPaletteEntry(m, 0xe7, 0b111_111_000);
      setUlaPaletteEntry(m, 0x27, 0b000_000_111);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b000_000_111); // Standard path
    });
  });

  // =====================================================================================
  // D5 — Radastan pre-fetch: always fetch at pre-display position
  // =====================================================================================
  describe("D5 - Radastan pre-fetch for odd scroll offsets", () => {
    it("scrollX=0 (aligned) → first pixel correct", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0);
      m.nextRegDevice.directSetRegValue(0x32, 0); // scrollX = 0

      // At scrollX=0, displayHC=0 → x = 0 → byte at offset 0, upper nibble
      writeBank5(m, 0x0000, 0x30); // upper nibble = 3

      setUlaPaletteEntry(m, 0x03, 0b001_010_011);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b001_010_011);
    });

    it("scrollX=2 → first pixel still correct (was buggy pre-fix)", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0);
      m.nextRegDevice.directSetRegValue(0x32, 2); // scrollX = 2

      // At scrollX=2, displayHC=0 → x = 2 → x[1]=1 → lower nibble
      // x & 3 = 2, so on old code, first pixel fetch was skipped
      // Block byte: need the byte at addr for x=2, y=0
      // x >> 2 = 0, so addr = 0x0000 still
      writeBank5(m, 0x0000, 0xa6); // upper=0xA, lower=6

      // x=2 → x[1]=1 → lower nibble = 6 → index = (0 << 4) | 6 = 0x06
      setUlaPaletteEntry(m, 0x06, 0b100_101_110);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b100_101_110);
    });

    it("scrollX=3 → first pixel still correct (was buggy pre-fix)", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0);
      m.nextRegDevice.directSetRegValue(0x32, 3); // scrollX = 3

      // At scrollX=3, displayHC=0 → x = 3 → x[1]=1 → lower nibble
      // x >> 2 = 0, addr = 0x0000
      writeBank5(m, 0x0000, 0xb9); // upper=0xB, lower=9

      // x=3 → x[1]=1 → lower nibble = 9 → index = 0x09
      setUlaPaletteEntry(m, 0x09, 0b010_011_100);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b010_011_100);
    });

    it("scrollX=1 → first pixel correct (already worked)", async () => {
      const m = await createTestNextMachine();
      enableLoRes(m, true, 0);
      m.nextRegDevice.directSetRegValue(0x32, 1); // scrollX = 1

      // At scrollX=1, displayHC=0 → x = 1 → x[1]=0 → upper nibble
      writeBank5(m, 0x0000, 0x7e); // upper=7, lower=0xE

      // x=1 → x[1]=0 → upper nibble = 7 → index = 0x07
      setUlaPaletteEntry(m, 0x07, 0b110_101_100);

      const rgb = renderAndGetUlaPixelRgb333(m, 0, 0);
      expect(rgb).toBe(0b110_101_100);
    });
  });
});
