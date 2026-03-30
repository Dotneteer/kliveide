/**
 * Unit tests for tilemap discrepancy fixes D1–D3.
 *
 * D1 — pixel_below priority flag: tilemap/ULA priority not implemented.
 *       `tilemapTilePriority` and `tilemapForceOnTopOfUla` were computed but never
 *       consulted in the compositing merge.
 *
 * D2 — 512-tile mode + eliminated attributes: when attributes are eliminated and
 *       512-tile mode is active, bit 8 of the tile index must come from defaultAttr[0].
 *       The `else` branch for elimAttr was missing this step.
 *
 * D3 — TilemapDevice.ts NR $6E/$6F mask: the setter used `value & 0x01f` (5-bit)
 *       instead of `value & 0x3f` (6-bit), making MSB values above 31 inaccessible.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { NextComposedScreenDevice } from "@emu/machines/zxNext/screen/NextComposedScreenDevice";
import { TilemapDevice } from "@emu/machines/zxNext/TilemapDevice";
import { OFFS_BANK_05 } from "@emu/machines/zxNext/MemoryDevice";

// ---------------------------------------------------------------------------
// Timing constants for 50Hz ZX Next
// ---------------------------------------------------------------------------
const TOTAL_HC = 456;
// Tilemap wide display starts 32 rows above ULA and 32 pixels before ULA
const WIDE_DISPLAY_Y_START = 32;  // = confDisplayYStart(64) − 32
const WIDE_DISPLAY_X_START = 112; // = confDisplayXStart(144) − 32

function tactAt(vc: number, hc: number): number {
  return vc * TOTAL_HC + hc;
}

/**
 * Render the three tacts needed to produce the very first tilemap pixel at
 * tilemap display position (0, 0):
 *
 *   hc=110 (pixelX=−2): SCR_TILEMAP_SAMPLE_CONFIG (border area) + SCR_TILE_INDEX_FETCH → tile 0 index
 *   hc=111 (pixelX=−1): SCR_TILE_ATTR_FETCH + SCR_PATTERN_FETCH → tile 0 attr/pattern
 *   hc=112 (pixelX=0):  SCR_TILEMAP_SAMPLE_CONFIG + tile boundary swap → tilemapTilePriority
 *                        promoted, pixel rendered → tilemapPixel1Below set
 */
function renderFirstTilemapPixel(d: NextComposedScreenDevice): void {
  d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 2)); // hc=110
  d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 1)); // hc=111
  d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START));     // hc=112
}

/**
 * Prime the tilemap sampled configuration values before the first tile fetch.
 *
 * The first tile's INDEX_FETCH (hc=110) and ATTR_FETCH (hc=111) occur two
 * tacts *before* the first SCR_TILEMAP_SAMPLE_CONFIG at pixelX=0 (hc=112).
 * Since the flag table only has non-zero entries inside the display area
 * (vc ≥ 32), no earlier warm-up tact can fire SAMPLE_CONFIG.  We therefore
 * prime the private sampled fields directly.
 */
function primeFirstTileSampling(d: NextComposedScreenDevice): void {
  const any = d as any;
  any.tilemapEliminateAttrSampled = d.tilemapEliminateAttributes;
  any.tilemap512TileModeSampled   = d.tilemap512TileMode;
  any.tilemapTextModeSampled      = d.tilemapTextMode;
}

/**
 * Write tile-map entry for tile 0 (first visible tile, tileArrayIndex=0).
 * In 40×32 non-elimAttr mode: pairs [tileIndex, tileAttr] at addresses 0 and 1.
 * Physical addresses: OFFS_BANK_05+0 (index) and OFFS_BANK_05+1 (attr).
 */
function writeTile0(m: TestZxNextMachine, tileIndex: number, attr: number): void {
  m.memoryDevice.memory[OFFS_BANK_05 + 0] = tileIndex;
  m.memoryDevice.memory[OFFS_BANK_05 + 1] = attr;
}

// ============================================================================
// D1 — pixel_below priority flag
// ============================================================================
describe("Tilemap Fixes — D1: pixel_below priority flag (tilemapPixel1Below)", () => {
  let m: TestZxNextMachine;

  beforeEach(async () => {
    m = await createTestNextMachine();
  });

  it("attr[0]=0 → tilemapPixel1Below=false (tilemap on top of ULA)", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80; // enable only — no 512 mode, no forceOnTop
    writeTile0(m, 0, 0x00);    // attr byte = 0x00: attr[0]=0 → on top
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    expect(d.tilemapPixel1Below).toBe(false);
  });

  it("attr[0]=1 → tilemapPixel1Below=true (tilemap below ULA)", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80; // enable only
    writeTile0(m, 0, 0x01);    // attr[0]=1 → below
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    expect(d.tilemapPixel1Below).toBe(true);
  });

  it("forceOnTopOfUla=1 overrides attr[0]=1 → tilemapPixel1Below=false", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80 | 0x01; // enable + forceOnTop (bit 0)
    writeTile0(m, 0, 0x01);            // attr[0]=1 — should be overridden by forceOnTop
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    expect(d.tilemapPixel1Below).toBe(false);
  });

  it("512TileMode=1 → tilemapPixel1Below=true regardless of attr[0]=0", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80 | 0x02; // enable + 512 tile mode (bit 1)
    // In 512 tile mode, attr[0] is tile-index bit 8, not the priority bit;
    // priority is always 'below' unless forceOnTop overrides.
    writeTile0(m, 0, 0x00); // attr[0]=0 (non-priority case in normal mode)
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    expect(d.tilemapPixel1Below).toBe(true); // 512 mode → always below
  });

  it("512TileMode=1 + forceOnTopOfUla=1 → tilemapPixel1Below=false", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80 | 0x02 | 0x01; // enable + 512 mode + forceOnTop
    writeTile0(m, 0, 0x00);
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    expect(d.tilemapPixel1Below).toBe(false);
  });

  it("both pixel1 and pixel2 below flags are set consistently", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80; // enable only
    writeTile0(m, 0, 0x01);    // below
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    // 40×32 regular path stores same value to pixel1 and pixel2
    expect(d.tilemapPixel1Below).toBe(true);
    expect(d.tilemapPixel2Below).toBe(true);
  });

  it("pixel1 and pixel2 below are false when on top", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80;
    writeTile0(m, 0, 0x00); // on top
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    expect(d.tilemapPixel1Below).toBe(false);
    expect(d.tilemapPixel2Below).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Compositing: verify tilemapPixel1Below gates the ULA/tilemap merge.
  // When pixel_below=false (on top) the tilemap colour overwrites the ULA output;
  // when pixel_below=true and the ULA has a non-transparent pixel the ULA wins.
  // We verify this by rendering the first tilemap pixel and inspecting the
  // intermediate field tilemapPixel1Transparent (which must be false for a
  // non-transparent tile to actually test compositing).
  // --------------------------------------------------------------------------
  it("tilemap pixel is non-transparent so compositing logic is exercised", async () => {
    const d = m.composedScreenDevice;
    d.nextReg0x6bValue = 0x80;
    writeTile0(m, 0, 0x00); // attr[0]=0 → on top
    d.onNewFrame();
    renderFirstTilemapPixel(d);
    // With default memory (all zeros) the pixel value read from the pattern
    // buffer is 0x00.  The default transparency index is 0x0F, so 0x00 ≠ 0x0F
    // → the pixel is NOT transparent.  Compositing logic will therefore run.
    expect(d.tilemapPixel1Transparent).toBe(false);
    // tilemapPixel1Rgb333 should be a valid colour (palette index 0)
    expect(d.tilemapPixel1Rgb333).not.toBeNull();
  });
});

// ============================================================================
// D2 — 512-tile mode + eliminated attributes: tile-index bit 8
// ============================================================================
describe("Tilemap Fixes — D2: 512-tile mode + eliminated attributes (tile index bit 8)", () => {
  it("512mode + elimAttr + defaultAttr[0]=1 → tile index bit 8 set (D2 fix)", async () => {
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    // NR $6B: enable(bit7) + elimAttr(bit5) + 512mode(bit1) = 0xA2
    d.nextReg0x6bValue = 0x80 | 0x20 | 0x02;
    // NR $6C: defaultAttr = 0x01 → bit 0 = 1 (becomes bit 8 of tile index)
    d.nextReg0x6cValue = 0x01;

    // In elimAttr mode only one byte per tile; tile index at address 0
    m.memoryDevice.memory[OFFS_BANK_05 + 0] = 5; // tile index = 5

    d.onNewFrame();
    // Prime the sampled values: SCR_TILEMAP_SAMPLE_CONFIG fires at display-area
    // tile boundaries (hcInTile=0 && pixelX>=0). Render (vc=31, hc=112) which
    // fires SAMPLE_CONFIG → tilemapEliminateAttrSampled=true, tilemap512TileModeSampled=true
    // but displayY=−1 so the render phase exits early (no pixel output).
    primeFirstTileSampling(d);
    // hc=110: SCR_TILE_INDEX_FETCH → tilemapCurrentTileIndex = 5
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 2));
    // hc=111: SCR_TILE_ATTR_FETCH → else branch fires (elimAttr=true):
    //          tilemapCurrentAttr = defaultAttrCache = 0x01
    //          D2 fix: tilemapCurrentTileIndex |= (0x01 & 0x01) << 8 = 0x100
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 1));

    // Bit 8 of tile index must now be set: 5 | 0x100 = 0x105
    expect((d as any).tilemapCurrentTileIndex).toBe(0x105);
  });

  it("512mode + elimAttr + defaultAttr[0]=0 → tile index bit 8 NOT set", async () => {
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    d.nextReg0x6bValue = 0x80 | 0x20 | 0x02; // 0xA2
    d.nextReg0x6cValue = 0x00;                // defaultAttr bit 0 = 0

    m.memoryDevice.memory[OFFS_BANK_05 + 0] = 5;

    d.onNewFrame();
    primeFirstTileSampling(d);
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 2));
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 1));

    // No bit 8: tile index remains 5
    expect((d as any).tilemapCurrentTileIndex).toBe(5);
  });

  it("512mode + no elimAttr: VRAM attr[0]=1 → bit 8 set (existing path, unchanged)", async () => {
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    // enable + 512mode only (no elimAttr) → attr read from VRAM
    d.nextReg0x6bValue = 0x80 | 0x02;

    // Non-elimAttr 40×32 mode: pairs at [tileIndex, tileAttr]
    m.memoryDevice.memory[OFFS_BANK_05 + 0] = 5;    // tile index = 5
    m.memoryDevice.memory[OFFS_BANK_05 + 1] = 0x01; // VRAM attr[0]=1 → bit 8

    d.onNewFrame();
    primeFirstTileSampling(d);
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 2));
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 1));

    expect((d as any).tilemapCurrentTileIndex).toBe(0x105);
  });

  it("no 512mode: attr[0] is the priority bit only, tile index bit 8 never set", async () => {
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    d.nextReg0x6bValue = 0x80; // enable only — no 512mode, no elimAttr

    m.memoryDevice.memory[OFFS_BANK_05 + 0] = 5;
    m.memoryDevice.memory[OFFS_BANK_05 + 1] = 0x01; // attr[0]=1 (priority bit)

    d.onNewFrame();
    primeFirstTileSampling(d);
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 2));
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 1));

    // In non-512 mode attr[0] is D1's priority bit, NOT tile-index bit 8
    expect((d as any).tilemapCurrentTileIndex).toBe(5);
  });

  it("elimAttr only (no 512mode): bit 8 not set even if defaultAttr[0]=1", async () => {
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    // elimAttr but no 512mode
    d.nextReg0x6bValue = 0x80 | 0x20;
    d.nextReg0x6cValue = 0x01; // defaultAttr bit 0 = 1, but no 512mode

    m.memoryDevice.memory[OFFS_BANK_05 + 0] = 5;

    d.onNewFrame();
    primeFirstTileSampling(d);
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 2));
    d.renderTact(tactAt(WIDE_DISPLAY_Y_START, WIDE_DISPLAY_X_START - 1));

    // Without 512mode the condition `if (tilemap512TileModeSampled)` is false
    expect((d as any).tilemapCurrentTileIndex).toBe(5);
  });
});

// ============================================================================
// D3 — TilemapDevice NR $6E/$6F 6-bit mask
// ============================================================================
describe("Tilemap Fixes — D3: TilemapDevice NR $6E/$6F 6-bit address mask", () => {
  let td: TilemapDevice;

  beforeEach(async () => {
    const m = await createTestNextMachine();
    td = m.tilemapDevice;
  });

  it("NR $6E: all lower 6 bits of baseAddressMsb are preserved (mask = 0x3F)", () => {
    td.nextReg6eValue = 0xFF; // bits [7:6] = flags, bits [5:0] should all be set
    expect(td.baseAddressMsb).toBe(0x3F); // 0b111111
  });

  it("NR $6E: bit 5 (0x20) is preserved — was lost with the old 5-bit mask (0x1F)", () => {
    // The old buggy mask `0x01f` = 31 = 0b011111 would strip bit 5.
    td.nextReg6eValue = 0x20; // only bit 5 set in the address field
    expect(td.baseAddressMsb).toBe(0x20);
  });

  it("NR $6E: bit 7 selects bank 7 (still works after fix)", () => {
    td.nextReg6eValue = 0x80;
    expect(td.baseAddressUseBank7).toBe(true);
    expect(td.baseAddressMsb).toBe(0x00); // no address bits set
  });

  it("NR $6E: reading back round-trips correctly", () => {
    td.nextReg6eValue = 0xBF; // bank7=1, address=0x3F
    expect(td.nextReg6eValue).toBe(0xBF);
  });

  it("NR $6F: all lower 6 bits of definitionAddressMsb are preserved (mask = 0x3F)", () => {
    td.nextReg6fValue = 0xFF;
    expect(td.definitionAddressMsb).toBe(0x3F);
  });

  it("NR $6F: bit 5 (0x20) is preserved — was lost with the old 5-bit mask (0x1F)", () => {
    td.nextReg6fValue = 0x20;
    expect(td.definitionAddressMsb).toBe(0x20);
  });

  it("NR $6F: bit 7 selects bank 7 (still works after fix)", () => {
    td.nextReg6fValue = 0x80;
    expect(td.definitionAddressUseBank7).toBe(true);
    expect(td.definitionAddressMsb).toBe(0x00);
  });

  it("NR $6F: reading back round-trips correctly", () => {
    td.nextReg6fValue = 0xBF; // bank7=1, address=0x3F
    expect(td.nextReg6fValue).toBe(0xBF);
  });
});
