import {
  LAYER2_DISPLAY_AREA,
  Layer2Cell,
  LORES_BLOCK_FETCH,
  LORES_DISPLAY_AREA,
  LORES_NREG_SAMPLE,
  LORES_PIXEL_REPLICATE,
  LoResCell,
  SPRITES_DISPLAY_AREA,
  SPRITES_LINE_BUFFER_READ,
  SPRITES_VISIBILITY_CHECK,
  SpritesCell,
  TILEMAP_DISPLAY_AREA,
  TILEMAP_PATTERN_FETCH,
  TILEMAP_TILE_INDEX_FETCH,
  TilemapCell,
  ULA_BORDER_AREA,
  ULA_BYTE1_READ,
  ULA_BYTE2_READ,
  ULA_CONTENTION_WINDOW,
  ULA_DISPLAY_AREA,
  ULA_FLOATING_BUS_UPDATE,
  ULA_NREG_SAMPLE,
  ULA_SHIFT_REG_LOAD,
  ULAStandardCell,
  ULAStandardMatrix
} from "./RenderingCell";
import { Plus3_50Hz, Plus3_60Hz, TimingConfig } from "./TimingConfig";
import { isContentionWindow, isDisplayArea, isVisibleArea } from "./matrix-helpers";

// ============================================================================
// Rendering Flags Dimensions (Uint16Array with full scanline storage)
// ============================================================================
// Full scanline including blanking (both 50Hz and 60Hz use HC 0-455)
const RENDERING_FLAGS_HC_COUNT = 456; // 0 to maxHC (455)

// ============================================================================
// Module-level pre-calculated tables
// ============================================================================
// ULA rendering flags for both timing modes
let _renderingFlagsULA50Hz: ULAStandardMatrix | undefined;
let _renderingFlagsULA60Hz: ULAStandardMatrix | undefined;

// Layer2 rendering flags for both timing modes and all resolutions
let _renderingFlagsLayer2_256x192_50Hz: Uint16Array | undefined;
let _renderingFlagsLayer2_256x192_60Hz: Uint16Array | undefined;
let _renderingFlagsLayer2_320x256_50Hz: Uint16Array | undefined;
let _renderingFlagsLayer2_320x256_60Hz: Uint16Array | undefined;
let _renderingFlagsLayer2_640x256_50Hz: Uint16Array | undefined;
let _renderingFlagsLayer2_640x256_60Hz: Uint16Array | undefined;

// Sprites rendering flags for both timing modes
let _renderingFlagsSprites50Hz: Uint16Array | undefined;
let _renderingFlagsSprites60Hz: Uint16Array | undefined;

// Tilemap rendering flags for both timing modes and resolutions
let _renderingFlagsTilemap_40x32_50Hz: Uint16Array | undefined;
let _renderingFlagsTilemap_40x32_60Hz: Uint16Array | undefined;
let _renderingFlagsTilemap_80x32_50Hz: Uint16Array | undefined;
let _renderingFlagsTilemap_80x32_60Hz: Uint16Array | undefined;

// LoRes rendering flags for both timing modes
let _renderingFlagsLoRes50Hz: Uint16Array | undefined;
let _renderingFlagsLoRes60Hz: Uint16Array | undefined;

/**
 * Initialize all module-level rendering flags tables (lazy initialization).
 * Called once on first instance construction.
 */
export function initializeAllRenderingFlags(): void {
  if (_renderingFlagsULA50Hz) {
    return; // Already initialized
  }

  // Generate ULA rendering flags for both timing modes
  _renderingFlagsULA50Hz = generateULAStandardRenderingFlags(Plus3_50Hz);
  _renderingFlagsULA60Hz = generateULAStandardRenderingFlags(Plus3_60Hz);

  // Generate Layer2 rendering flags for all resolutions and timing modes
  _renderingFlagsLayer2_256x192_50Hz = generateLayer2_256x192x8RenderingFlags(Plus3_50Hz);
  _renderingFlagsLayer2_256x192_60Hz = generateLayer2_256x192x8RenderingFlags(Plus3_60Hz);
  _renderingFlagsLayer2_320x256_50Hz = generateLayer2_320x256x8RenderingFlags(Plus3_50Hz);
  _renderingFlagsLayer2_320x256_60Hz = generateLayer2_320x256x8RenderingFlags(Plus3_60Hz);
  _renderingFlagsLayer2_640x256_50Hz = generateLayer2_640x256x4RenderingFlags(Plus3_50Hz);
  _renderingFlagsLayer2_640x256_60Hz = generateLayer2_640x256x4RenderingFlags(Plus3_60Hz);

  // Generate Sprites rendering flags for both timing modes
  _renderingFlagsSprites50Hz = generateSpritesRenderingFlagsStatic(Plus3_50Hz);
  _renderingFlagsSprites60Hz = generateSpritesRenderingFlagsStatic(Plus3_60Hz);

  // Generate Tilemap rendering flags for both resolutions and timing modes
  _renderingFlagsTilemap_40x32_50Hz = generateTilemap40x32RenderingFlagsStatic(Plus3_50Hz);
  _renderingFlagsTilemap_40x32_60Hz = generateTilemap40x32RenderingFlagsStatic(Plus3_60Hz);
  _renderingFlagsTilemap_80x32_50Hz = generateTilemap80x32RenderingFlagsStatic(Plus3_50Hz);
  _renderingFlagsTilemap_80x32_60Hz = generateTilemap80x32RenderingFlagsStatic(Plus3_60Hz);

  // Generate LoRes rendering flags for both timing modes
  _renderingFlagsLoRes50Hz = generateLoResRenderingFlagsStatic(Plus3_50Hz);
  _renderingFlagsLoRes60Hz = generateLoResRenderingFlagsStatic(Plus3_60Hz);
}

/**
 * Generate ULA Standard rendering flags
 * @param config - Timing configuration (50Hz or 60Hz)
 * @returns Uint16Array with bit flags for each cell
 */
function generateULAStandardRenderingFlags(config: TimingConfig): ULAStandardMatrix {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateULARenderingFlag(vc, hc);
    }
  }

  return renderingFlags;

  function generateULARenderingFlag(vc: number, hc: number): ULAStandardCell {
    // === Base Timing State ===
    // --- Check if we're in blanking area (not visible).
    // --- If so return 0, indicating no rendering activity.
    if (!isVisibleArea(config, vc, hc)) {
      return 0;
    }

    // --- Initialize bit flags
    let flags: number = 0;

    // --- Display area: where ULA layer renders (256×192 in ULA coordinates)
    // --- ULA internally uses HC 0-255 for the 256-pixel-wide display
    // --- In our coordinate system, this maps to HC 144-399
    const displayArea = isDisplayArea(config, vc, hc);
    if (displayArea) {
      flags |= ULA_DISPLAY_AREA;
    } else {
      // --- Border area (outside display area but within visible area)
      flags |= ULA_BORDER_AREA;
    }

    // --- Contention window calculation (for +3 timing)
    if (isContentionWindow(hc, displayArea)) {
      flags |= ULA_CONTENTION_WINDOW;
    }

    // === ULA-Specific Activities ===
    // HARDWARE BEHAVIOR: ULA memory fetch activities occur throughout the ENTIRE frame,
    // not just in the display area. The hardware continuously samples scroll values,
    // generates addresses, and performs VRAM reads even during border periods.
    //
    // This is an intentional design choice enabled by the FPGA's dual-port BRAM architecture.
    // From zxula.vhd lines 48-51:
    //   "Because display memory is held in dual port bram, there is no real contention in
    //   the zx next... And because there is no shortage of memory bandwidth to bram, this
    //   implementation may continually access bram even outside the display area with no
    //   detrimental impact on the system."
    //
    // EMULATOR OPTIMIZATION: However, in software emulation, these border reads waste CPU
    // cycles without affecting observable behavior. We optimize by gating memory operations:
    //
    // 1. Vertical gating: Skip top/bottom borders (rows outside 0-191)
    // 2. Horizontal gating:
    //    - Skip right border (after display area ends)
    //    - Skip left border >16 tacts before display (one full shift register cycle)
    //
    // The shift register loads every 8 HC tacts (16 pixels) at HC[3:0]=0xC and 0x4.
    // Data for each load comes from fetches in the preceding ~8-16 tacts.
    // Starting fetches 16 tacts before display ensures all data for the first visible
    // pixels is available. This optimization has no impact on accuracy.
    //

    // --- Combined optimization gate:
    // --- Vertical display area check (emulator optimization gate)
    // --- Horizontal optimization window: fetch from 16 tacts before display through display end
    // --- 16 tacts = one complete shift register load cycle (HC[3:0]=0xC to next 0xC)
    const fetchActive =
      vc >= config.displayYStart &&
      vc <= config.displayYEnd &&
      hc >= config.displayXStart - 16 &&
      hc <= config.displayXEnd;

    // --- Extract HC subcycle position (hc[3:0])
    const hcSub = hc & 0x0f;

    // --- Scroll sample: capture scroll register values at HC subcycle positions 0x3 and 0xB
    if (fetchActive && (hcSub === 0x07 || hcSub === 0x0f)) {
      flags |= ULA_NREG_SAMPLE;
    }

    // --- Pixel read: read pixel byte from VRAM at HC subcycle positions 0x1, 0x5, 0x9, 0xD
    // --- The memory read occurs at HC subcycle 0x0, 0x4, 0x8, 0xC.
    if (fetchActive && (hcSub === 0x00 || hcSub === 0x04 || hcSub === 0x08 || hcSub === 0x0c)) {
      flags |= ULA_BYTE1_READ;
    }

    // --- Attribute read: read attribute byte from VRAM at HC subcycle positions 0x2, 0x6, 0xA, 0xE
    if (fetchActive && (hcSub === 0x02 || hcSub === 0x06 || hcSub === 0x0a || hcSub === 0x0e)) {
      flags |= ULA_BYTE2_READ;
    }

    // --- Shift register load: load pixel/attribute data into shift register
    // --- at HC subcycle positions 0xC and 0x4
    if (fetchActive && (hcSub === 0x00 || hcSub === 0x08)) {
      flags |= ULA_SHIFT_REG_LOAD;
    }

    // --- Floating bus update at HC subcycle positions 0x9, 0xB, 0xD, 0xF
    if (displayArea && (hcSub === 0x05 || hcSub === 0x07 || hcSub === 0x09 || hcSub === 0x0b)) {
      flags |= ULA_FLOATING_BUS_UPDATE;
    }

    // --- Done
    return flags;
  }
}

/**
 * Generate Layer 2 256x192x8 rendering flags
 * @param config - Timing configuration (50Hz or 60Hz)
 * @returns Uint16Array with bit flags for each cell
 */
function generateLayer2_256x192x8RenderingFlags(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateLayer2_256x192x8Cell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate a single Layer 2 rendering cell for the 256×192 mode at the given (vc, hc) position.
   * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
   * @param hc Horizontal counter position (firstVisibleHC to maxHC)
   * @returns Layer 2 rendering cell with all activity flags
   */
  function generateLayer2_256x192x8Cell(vc: number, hc: number): Layer2Cell {
    // Check if we're in the display area
    const displayArea = isDisplayArea(config, vc, hc);
    if (!displayArea) {
      return 0; // No Layer 2 activity outside display area
    }

    // Layer 2 renders during the entire display area.
    // In Option B rendering (no cycle-exact timing), pixel fetch, coordinate transformation,
    // clipping, and palette lookup all happen atomically in the rendering pipeline.
    return LAYER2_DISPLAY_AREA;
  }
}

/**
 * Generate Layer 2 320x256x8 rendering flags
 * @param config - Timing configuration (50Hz or 60Hz)
 * @returns Uint16Array with bit flags for each cell
 */
function generateLayer2_320x256x8RenderingFlags(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateLayer2_320x256x8Cell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate a single Layer 2 rendering cell for the 320×256 mode at the given (vc, hc) position.
   *
   * For 320×256 mode, the display area is wider and taller than the standard 256×192 area:
   * - Standard mode: HC 144-399 (256 pixels), VC 64-255 for 50Hz / VC 40-231 for 60Hz (192 lines)
   * - Wide mode (320×256): HC 104-423 (320 pixels), VC 30-285 for 50Hz / VC 6-261 for 60Hz (256 lines)
   *
   * From VHDL timing:
   * Horizontal:
   * - wide_min_hactive = c_min_hactive - 48 = 136 - 48 = 88
   * - At HC=88, whc resets to -16
   * - whc=0 at HC=104 (start of 320-pixel area)
   * - whc=319 at HC=423 (end of 320-pixel area)
   *
   * Vertical:
   * - wide_min_vactive = c_min_vactive - 34
   * - For 50Hz +3: c_min_vactive=64, so wide_min_vactive=30, wvc starts at -2
   * - For 60Hz +3: c_min_vactive=40, so wide_min_vactive=6, wvc starts at -2
   * - wvc=0 at VC=32 (50Hz) or VC=8 (60Hz)
   * - wvc=255 at VC=287 (50Hz) or VC=263 (60Hz)
   * - But visible 256 lines: wvc=-2 to 253, so VC=30-285 (50Hz) or VC=6-261 (60Hz)
   *
   * @param config Timing configuration (50Hz or 60Hz)
   * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
   * @param hc Horizontal counter position (firstVisibleHC to maxHC)
   * @returns Layer 2 rendering cell with all activity flags
   */
  function generateLayer2_320x256x8Cell(vc: number, hc: number): Layer2Cell {
    // For 320×256 mode, we need a wider horizontal display area
    // Wide display starts 32 pixels earlier: displayXStart - 32 = 144 - 32 = 112
    // Wide display is 320 pixels wide: 112 + 320 - 1 = 431
    const wideDisplayXStart = config.displayXStart - 32;
    const wideDisplayXEnd = wideDisplayXStart + 319;

    // Vertical display area is also extended for 320×256 mode
    // wide_min_vactive = c_min_vactive - 34
    // For 50Hz: displayYStart=64, so wide starts at 64-34=30, wvc=-2 to 253 covers 256 lines
    // For 60Hz: displayYStart=40, so wide starts at 40-34=6, wvc=-2 to 253 covers 256 lines
    // The 256 lines span from wide_min_vactive to wide_min_vactive + 255
    const wideDisplayYStart = config.displayYStart - 34;
    const wideDisplayYEnd = wideDisplayYStart + 255;

    // Check if we're in the wide display area
    if (
      hc < wideDisplayXStart ||
      hc > wideDisplayXEnd ||
      vc < wideDisplayYStart ||
      vc > wideDisplayYEnd
    ) {
      return 0;
    }

    // Layer 2 renders during the entire wide display area.
    // Coordinate transformation and validity checks happen in the rendering pipeline.
    return LAYER2_DISPLAY_AREA;
  }
}

/**
 * Generate Layer 2 640x256x4 rendering flags
 * @param config - Timing configuration (50Hz or 60Hz)
 * @returns Uint16Array with bit flags for each cell
 */
function generateLayer2_640x256x4RenderingFlags(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateLayer2_640x256Cell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate a single Layer 2 rendering cell for the 640×256 mode at the given (vc, hc) position.
   * @param config Timing configuration (50Hz or 60Hz)
   * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
   * @param hc Horizontal counter position (firstVisibleHC to maxHC)
   * @returns Layer 2 rendering cell with all activity flags
   */
  function generateLayer2_640x256Cell(vc: number, hc: number): Layer2Cell {
    // Check if we're in the display area
    const displayArea = isDisplayArea(config, vc, hc);
    if (!displayArea) {
      return 0;
    }

    // In 640×256 mode, we render 2 pixels per CLK_7 cycle.
    // Coordinate transformation and validity checks happen in the rendering pipeline.
    return LAYER2_DISPLAY_AREA;
  }
}

// Sprites generation function
function generateSpritesRenderingFlagsStatic(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateSpritesCell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate a single Sprite layer rendering cell for the given (vc, hc) position.
   * @param config Timing configuration (50Hz or 60Hz)
   * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
   * @param hc Horizontal counter position (firstVisibleHC to maxHC)
   * @returns Sprite layer rendering cell with all activity flags
   */
  function generateSpritesCell(vc: number, hc: number): SpritesCell {
    const displayArea = isDisplayArea(config, vc, hc);

    let flags = 0;
    if (displayArea) {
      flags |= SPRITES_DISPLAY_AREA | SPRITES_LINE_BUFFER_READ | SPRITES_VISIBILITY_CHECK;
    }
    // Sprites use internal memory, no contention window
    return flags;
  }
}

// Tilemap generation functions
function generateTilemap40x32RenderingFlagsStatic(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateTilemap40x32Cell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate a single Tilemap rendering cell for the 40x32 tilemap mode at the given (vc, hc) position.
   * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
   * @param hc Horizontal counter position (firstVisibleHC to maxHC)
   * @returns ULA Standard rendering cell with all activity flags
   */
  function generateTilemap40x32Cell(vc: number, hc: number): TilemapCell {
    const displayArea = isDisplayArea(config, vc, hc);

    let flags = 0;
    if (displayArea) {
      flags |= TILEMAP_DISPLAY_AREA | TILEMAP_TILE_INDEX_FETCH | TILEMAP_PATTERN_FETCH;
    }
    // Tilemap uses internal memory, no contention window
    return flags;
  }
}

function generateTilemap80x32RenderingFlagsStatic(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateTilemap80x32Cell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate a single Tilemap rendering cell for the 80x32 tilemap mode at the given (vc, hc) position.
   * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
   * @param hc Horizontal counter position (firstVisibleHC to maxHC)
   * @returns ULA Standard rendering cell with all activity flags
   */
  function generateTilemap80x32Cell(vc: number, hc: number): TilemapCell {
    const displayArea = isDisplayArea(config, vc, hc);

    let flags = 0;
    if (displayArea) {
      flags |= TILEMAP_DISPLAY_AREA | TILEMAP_TILE_INDEX_FETCH | TILEMAP_PATTERN_FETCH;
    }
    // Tilemap uses internal memory, no contention window
    return flags;
  }
}

// LoRes generation function
function generateLoResRenderingFlagsStatic(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint16Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateLoResCell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate a single LoRes rendering cell for the 128x96 mode at the given (vc, hc) position.
   * @param config Timing configuration (50Hz or 60Hz)
   * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
   * @param hc Horizontal counter position (firstVisibleHC to maxHC)
   * @returns LoRes rendering cell with all activity flags
   */
  function generateLoResCell(vc: number, hc: number): LoResCell {
    // Check if we're in visible area
    if (!isVisibleArea(config, vc, hc)) {
      return 0;
    }

    const displayArea = isDisplayArea(config, vc, hc);
    let flags = 0;

    if (displayArea) {
      flags |= LORES_DISPLAY_AREA;

      // Extract HC subcycle position (hc[3:0])
      const hcSub = hc & 0x0f;

      // Scroll/mode sample at HC subcycle positions 0x7 and 0xF (like ULA)
      if (hcSub === 0x07 || hcSub === 0x0f) {
        flags |= LORES_NREG_SAMPLE;
      }

      // Block fetch and pixel replicate on every HC position in display area
      flags |= LORES_BLOCK_FETCH | LORES_PIXEL_REPLICATE;
    }

    return flags;
  }
}

// ============================================================================
// HC/VC Lookup Tables (shared across all instances)
// ============================================================================
const BITMAP_WIDTH = 720;
const BITMAP_HEIGHT = 288;

let _tactToHC50Hz: Uint16Array | undefined;
let _tactToVC50Hz: Uint16Array | undefined;
let _tactToHC60Hz: Uint16Array | undefined;
let _tactToVC60Hz: Uint16Array | undefined;

/**
 * Generate HC/VC lookup tables to eliminate expensive modulo/division operations.
 * Pre-calculates HC and VC values for every tact position.
 */
function generateTactLookupTables(config: TimingConfig): [Uint16Array, Uint16Array] {
  const totalTacts = config.totalVC * config.totalHC;
  const tactToHC = new Uint16Array(totalTacts);
  const tactToVC = new Uint16Array(totalTacts);

  for (let tact = 0; tact < totalTacts; tact++) {
    tactToHC[tact] = tact % config.totalHC;
    tactToVC[tact] = (tact / config.totalHC) | 0;
  }

  return [tactToHC, tactToVC];
}

/**
 * Initialize HC/VC lookup tables for both timing modes.
 */
function initializeTactLookupTables(): void {
  if (_tactToHC50Hz) {
    return; // Already initialized
  }

  const [hc50, vc50] = generateTactLookupTables(Plus3_50Hz);
  _tactToHC50Hz = hc50;
  _tactToVC50Hz = vc50;

  const [hc60, vc60] = generateTactLookupTables(Plus3_60Hz);
  _tactToHC60Hz = hc60;
  _tactToVC60Hz = vc60;
}

function getTactToHC50Hz(): Uint16Array {
  if (!_tactToHC50Hz) {
    throw new Error("Tact lookup tables not initialized. Call initializeTactLookupTables() first.");
  }
  return _tactToHC50Hz;
}

function getTactToVC50Hz(): Uint16Array {
  if (!_tactToVC50Hz) {
    throw new Error("Tact lookup tables not initialized. Call initializeTactLookupTables() first.");
  }
  return _tactToVC50Hz;
}

function getTactToHC60Hz(): Uint16Array {
  if (!_tactToHC60Hz) {
    throw new Error("Tact lookup tables not initialized. Call initializeTactLookupTables() first.");
  }
  return _tactToHC60Hz;
}

function getTactToVC60Hz(): Uint16Array {
  if (!_tactToVC60Hz) {
    throw new Error("Tact lookup tables not initialized. Call initializeTactLookupTables() first.");
  }
  return _tactToVC60Hz;
}

// ============================================================================
// Bitmap Offset Lookup Tables (shared across all instances)
// ============================================================================
let _tactToBitmapOffset50Hz: Int32Array | undefined;
let _tactToBitmapOffset60Hz: Int32Array | undefined;

/**
 * Pre-calculate bitmap offset lookup table for each tact.
 * Stores the final bitmap buffer offset, or -1 if outside visible area.
 */
function generateBitmapOffsetTable(config: TimingConfig): Int32Array {
  const totalTacts = config.totalVC * config.totalHC;
  const tactToBitmapOffset = new Int32Array(totalTacts);

  for (let tact = 0; tact < totalTacts; tact++) {
    const hc = tact % config.totalHC;
    const vc = Math.floor(tact / config.totalHC) | 0;
    const bitmapY = vc - config.firstBitmapVC;

    if (bitmapY >= 0 && bitmapY < BITMAP_HEIGHT) {
      const bitmapXBase = (hc - config.firstVisibleHC) * 2;
      tactToBitmapOffset[tact] = bitmapY * BITMAP_WIDTH + bitmapXBase;
    } else {
      tactToBitmapOffset[tact] = -1;
    }
  }

  return tactToBitmapOffset;
}

/**
 * Initialize bitmap offset lookup tables for both timing modes.
 */
function initializeBitmapOffsetTables(): void {
  if (_tactToBitmapOffset50Hz) {
    return; // Already initialized
  }

  _tactToBitmapOffset50Hz = generateBitmapOffsetTable(Plus3_50Hz);
  _tactToBitmapOffset60Hz = generateBitmapOffsetTable(Plus3_60Hz);
}

function getTactToBitmapOffset50Hz(): Int32Array {
  if (!_tactToBitmapOffset50Hz) {
    throw new Error(
      "Bitmap offset tables not initialized. Call initializeBitmapOffsetTables() first."
    );
  }
  return _tactToBitmapOffset50Hz;
}

function getTactToBitmapOffset60Hz(): Int32Array {
  if (!_tactToBitmapOffset60Hz) {
    throw new Error(
      "Bitmap offset tables not initialized. Call initializeBitmapOffsetTables() first."
    );
  }
  return _tactToBitmapOffset60Hz;
}

// ============================================================================
// ULA Address Lookup Tables (shared across all instances)
// ============================================================================
let _ulaPixelLineBaseAddr: Uint16Array | undefined;
let _ulaAttrLineBaseAddr: Uint16Array | undefined;

/**
 * Generate ULA address lookup tables (192 entries for Y coordinates 0-191).
 * Pre-calculates base addresses before X coordinate is added.
 */
function generateULAAddressTables(): [Uint16Array, Uint16Array] {
  const ulaPixelLineBaseAddr = new Uint16Array(192);
  const ulaAttrLineBaseAddr = new Uint16Array(192);

  for (let y = 0; y < 192; y++) {
    // Pixel address calculation: y[7:6] | y[2:0] | y[5:3] | x[7:3]
    const y76 = (y >> 6) & 0x03;
    const y20 = y & 0x07;
    const y53 = (y >> 3) & 0x07;
    ulaPixelLineBaseAddr[y] = (y76 << 11) | (y20 << 8) | (y53 << 5);

    // Attribute address calculation: 0x1800 + (y/8)*32 + x/8
    const attrY = y >> 3;
    ulaAttrLineBaseAddr[y] = 0x1800 + (attrY << 5);
  }

  return [ulaPixelLineBaseAddr, ulaAttrLineBaseAddr];
}

/**
 * Initialize ULA address lookup tables.
 */
function initializeULAAddressTables(): void {
  if (_ulaPixelLineBaseAddr) {
    return; // Already initialized
  }

  const [pixel, attr] = generateULAAddressTables();
  _ulaPixelLineBaseAddr = pixel;
  _ulaAttrLineBaseAddr = attr;
}

export function getUlaPixelLineBaseAddr(): Uint16Array {
  return _ulaPixelLineBaseAddr;
}

export function getUlaAttrLineBaseAddr(): Uint16Array {
  return _ulaAttrLineBaseAddr;
}

// ============================================================================
// Attribute Decode Lookup Tables (shared across all instances)
// ============================================================================
let _attrToInkFlashOff: Uint8Array | undefined;
let _attrToPaperFlashOff: Uint8Array | undefined;
let _attrToInkFlashOn: Uint8Array | undefined;
let _attrToPaperFlashOn: Uint8Array | undefined;
let _ulaPlusAttrToInk: Uint8Array | undefined;
let _ulaPlusAttrToPaper: Uint8Array | undefined;

/**
 * Generate attribute decode lookup tables (256 entries for all attribute byte values).
 * Eliminates bit operations during rendering by pre-calculating palette indices.
 */
function generateAttributeDecodeTables(): {
  attrToInkFlashOff: Uint8Array;
  attrToPaperFlashOff: Uint8Array;
  attrToInkFlashOn: Uint8Array;
  attrToPaperFlashOn: Uint8Array;
  ulaPlusAttrToInk: Uint8Array;
  ulaPlusAttrToPaper: Uint8Array;
} {
  const attrToInkFlashOff = new Uint8Array(256);
  const attrToPaperFlashOff = new Uint8Array(256);
  const attrToInkFlashOn = new Uint8Array(256);
  const attrToPaperFlashOn = new Uint8Array(256);

  for (let attr = 0; attr < 256; attr++) {
    const flash = (attr >> 7) & 0x01;
    const bright = (attr >> 6) & 0x01;
    const paperColor = (attr >> 3) & 0x07;
    const inkColor = attr & 0x07;

    const brightOffset = bright << 3;
    const inkPaletteIndex = inkColor + brightOffset;
    const paperPaletteIndex = paperColor + brightOffset;

    if (flash) {
      attrToInkFlashOff[attr] = inkPaletteIndex;
      attrToPaperFlashOff[attr] = paperPaletteIndex;
      attrToInkFlashOn[attr] = paperPaletteIndex;
      attrToPaperFlashOn[attr] = inkPaletteIndex;
    } else {
      attrToInkFlashOff[attr] = inkPaletteIndex;
      attrToPaperFlashOff[attr] = paperPaletteIndex;
      attrToInkFlashOn[attr] = inkPaletteIndex;
      attrToPaperFlashOn[attr] = paperPaletteIndex;
    }
  }

  // ULA+ attribute decode (64-color palette, indices 192-255)
  const ulaPlusAttrToInk = new Uint8Array(256);
  const ulaPlusAttrToPaper = new Uint8Array(256);

  for (let attr = 0; attr < 256; attr++) {
    const inkIndex6bit = ((attr & 0b11000000) >> 2) | (attr & 0b00000111);
    ulaPlusAttrToInk[attr] = 192 + inkIndex6bit;

    const paperIndex6bit = ((attr & 0b11000000) >> 2) | 0b1000 | ((attr >> 3) & 0b111);
    ulaPlusAttrToPaper[attr] = 192 + paperIndex6bit;
  }

  return {
    attrToInkFlashOff,
    attrToPaperFlashOff,
    attrToInkFlashOn,
    attrToPaperFlashOn,
    ulaPlusAttrToInk,
    ulaPlusAttrToPaper
  };
}

/**
 * Initialize attribute decode lookup tables.
 */
export function initializeAttributeDecodeTables(): void {
  if (_attrToInkFlashOff) {
    return; // Already initialized
  }

  const tables = generateAttributeDecodeTables();
  _attrToInkFlashOff = tables.attrToInkFlashOff;
  _attrToPaperFlashOff = tables.attrToPaperFlashOff;
  _attrToInkFlashOn = tables.attrToInkFlashOn;
  _attrToPaperFlashOn = tables.attrToPaperFlashOn;
  _ulaPlusAttrToInk = tables.ulaPlusAttrToInk;
  _ulaPlusAttrToPaper = tables.ulaPlusAttrToPaper;
}

export function getAttrToInkFlashOff(): Uint8Array {
  return _attrToInkFlashOff;
}

export function getAttrToPaperFlashOff(): Uint8Array {
  return _attrToPaperFlashOff;
}

export function getAttrToInkFlashOn(): Uint8Array {
  return _attrToInkFlashOn;
}

export function getAttrToPaperFlashOn(): Uint8Array {
  return _attrToPaperFlashOn;
}

export function getUlaPlusAttrToInk(): Uint8Array {
  return _ulaPlusAttrToInk;
}

export function getUlaPlusAttrToPaper(): Uint8Array {
  return _ulaPlusAttrToPaper;
}

/**
 * Initialize all lookup tables (rendering flags + HC/VC + bitmap offsets + ULA addresses + attribute decode + ULANext).
 */
export function initializeAllLookupTables(): void {
  initializeAllRenderingFlags();
  initializeTactLookupTables();
  initializeBitmapOffsetTables();
  initializeULAAddressTables();
  initializeAttributeDecodeTables();
  initializeULANextTables();
  initializeLayer2HelperTables();
}

// ============================================================================
// Active Timing Mode Cache (module-level, updated on mode switch)
// ============================================================================
// These module-level variables cache the currently active timing mode tables
// to avoid repeated conditional checks and function calls in hot path (renderTact).
// Updated via setActiveTimingMode() when switching between 50Hz and 60Hz.

let _activeRenderingFlagsULA: ULAStandardMatrix;
let _activeRenderingFlagsLayer2_256x192: Uint16Array;
let _activeRenderingFlagsLayer2_320x256: Uint16Array;
let _activeRenderingFlagsLayer2_640x256: Uint16Array;
let _activeRenderingFlagsSprites: Uint16Array;
let _activeRenderingFlagsTilemap_40x32: Uint16Array;
let _activeRenderingFlagsTilemap_80x32: Uint16Array;
let _activeRenderingFlagsLoRes: Uint16Array;
let _activeTactToHC: Uint16Array;
let _activeTactToVC: Uint16Array;
let _activeTactToBitmapOffset: Int32Array;

/**
 * Set the active timing mode and update all cache references.
 * Call this when switching between 50Hz and 60Hz mode.
 * @param is60Hz - true for 60Hz mode, false for 50Hz mode
 */
export function setActiveTimingMode(is60Hz: boolean): void {
  _activeRenderingFlagsULA = is60Hz ? _renderingFlagsULA60Hz : _renderingFlagsULA50Hz;
  _activeRenderingFlagsLayer2_256x192 = is60Hz
    ? _renderingFlagsLayer2_256x192_60Hz
    : _renderingFlagsLayer2_256x192_50Hz;
  _activeRenderingFlagsLayer2_320x256 = is60Hz
    ? _renderingFlagsLayer2_320x256_60Hz
    : _renderingFlagsLayer2_320x256_50Hz;
  _activeRenderingFlagsLayer2_640x256 = is60Hz
    ? _renderingFlagsLayer2_640x256_60Hz
    : _renderingFlagsLayer2_640x256_50Hz;
  _activeRenderingFlagsSprites = is60Hz ? _renderingFlagsSprites60Hz : _renderingFlagsSprites50Hz;
  _activeRenderingFlagsTilemap_40x32 = is60Hz
    ? _renderingFlagsTilemap_40x32_60Hz
    : _renderingFlagsTilemap_40x32_50Hz;
  _activeRenderingFlagsTilemap_80x32 = is60Hz
    ? _renderingFlagsTilemap_80x32_60Hz
    : _renderingFlagsTilemap_80x32_50Hz;
  _activeRenderingFlagsLoRes = is60Hz ? _renderingFlagsLoRes60Hz : _renderingFlagsLoRes50Hz;
  _activeTactToHC = is60Hz ? getTactToHC60Hz() : getTactToHC50Hz();
  _activeTactToVC = is60Hz ? getTactToVC60Hz() : getTactToVC50Hz();
  _activeTactToBitmapOffset = is60Hz ? getTactToBitmapOffset60Hz() : getTactToBitmapOffset50Hz();
}

/**
 * Get the active ULA rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsULA(): ULAStandardMatrix {
  return _activeRenderingFlagsULA;
}

/**
 * Get the active Layer2 256x192 rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsLayer2_256x192(): Uint16Array {
  return _activeRenderingFlagsLayer2_256x192;
}

/**
 * Get the active Layer2 320x256 rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsLayer2_320x256(): Uint16Array {
  return _activeRenderingFlagsLayer2_320x256;
}

/**
 * Get the active Layer2 640x256 rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsLayer2_640x256(): Uint16Array {
  return _activeRenderingFlagsLayer2_640x256;
}

/**
 * Get the active Sprites rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsSprites(): Uint16Array {
  return _activeRenderingFlagsSprites;
}

/**
 * Get the active Tilemap 40x32 rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsTilemap_40x32(): Uint16Array {
  return _activeRenderingFlagsTilemap_40x32;
}

/**
 * Get the active Tilemap 80x32 rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsTilemap_80x32(): Uint16Array {
  return _activeRenderingFlagsTilemap_80x32;
}

/**
 * Get the active LoRes rendering flags for current timing mode.
 */
export function getActiveRenderingFlagsLoRes(): Uint16Array {
  return _activeRenderingFlagsLoRes;
}

/**
 * Get the active tact-to-HC lookup table for current timing mode.
 */
export function getActiveTactToHC(): Uint16Array {
  return _activeTactToHC;
}

/**
 * Get the active tact-to-VC lookup table for current timing mode.
 */
export function getActiveTactToVC(): Uint16Array {
  return _activeTactToVC;
}

/**
 * Get the active tact-to-bitmap-offset lookup table for current timing mode.
 */
export function getActiveTactToBitmapOffset(): Int32Array {
  return _activeTactToBitmapOffset;
}

// ============================================================================
// ULANext Attribute Decode Lookup Tables (256×256, shared across all instances)
// ============================================================================
let _ulaNextInkLookup: Uint8Array | undefined; // [format][attr] -> ink palette index (0-127)
let _ulaNextPaperLookup: Uint8Array | undefined; // [format][attr] -> paper palette index (128-255) or 255 for fallback

/**
 * Generate ULANext attribute decode lookup tables.
 * Creates 256×256 tables combining format mask (256) and attribute byte (256).
 * This eliminates all runtime computation for ULANext attribute decoding.
 */
function generateULANextAttributeTables(): [Uint8Array, Uint8Array] {
  // 256 format masks × 256 attribute values = 65536 entries each
  const inkLookup = new Uint8Array(256 * 256);
  const paperLookup = new Uint8Array(256 * 256);

  // Valid format masks (solid right-aligned bit sequences)
  const validMasks = [0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7f, 0xff];

  for (let formatMask = 0; formatMask < 256; formatMask++) {
    const isValidMask = validMasks.includes(formatMask);

    // Pre-calculate shift amount for valid masks
    let shift = 0;
    if (isValidMask && formatMask !== 0xff) {
      let mask = formatMask;
      while (mask & 1) {
        shift++;
        mask >>= 1;
      }
    }

    for (let attr = 0; attr < 256; attr++) {
      const index = formatMask * 256 + attr;

      // INK: Always attr AND format_mask (range 0-127)
      inkLookup[index] = attr & formatMask;

      // PAPER: Depends on mask validity
      if (formatMask === 0xff || !isValidMask) {
        // Invalid mask or 0xFF: Use sentinel value 255 to indicate fallback color
        paperLookup[index] = 255;
      } else {
        // Valid mask: Calculate PAPER index (128-255)
        const paperBits = attr & ~formatMask;
        paperLookup[index] = 128 + (paperBits >> shift);
      }
    }
  }

  return [inkLookup, paperLookup];
}

/**
 * Initialize ULANext attribute decode lookup tables.
 */
export function initializeULANextTables(): void {
  if (_ulaNextInkLookup) {
    return; // Already initialized
  }

  const [ink, paper] = generateULANextAttributeTables();
  _ulaNextInkLookup = ink;
  _ulaNextPaperLookup = paper;
}

/**
 * Get ULANext ink palette index for given format and attribute.
 * @param format ULANext format mask (NextReg 0x42)
 * @param attr Attribute byte value
 * @returns Ink palette index (0-127)
 */
export function getULANextInkIndex(format: number, attr: number): number {
  return _ulaNextInkLookup[format * 256 + attr];
}

/**
 * Get ULANext paper palette index for given format and attribute.
 * @param format ULANext format mask (NextReg 0x42)
 * @param attr Attribute byte value
 * @returns Paper palette index (128-255) or 255 if fallback color should be used
 */
export function getULANextPaperIndex(format: number, attr: number): number {
  return _ulaNextPaperLookup[format * 256 + attr];
}

// ============================================================================
// Layer 2 helper tables
// ============================================================================
let _layer2XWrappingTable320: Uint16Array | undefined;

function initializeLayer2HelperTables(): void {
  _layer2XWrappingTable320 = new Uint16Array(1024);

  for (let i = 0; i < 1024; i++) {
    let x = i;
    if (x >= 320 && x < 512) {
      const upper = ((x >> 6) & 0x7) + 3;
      x = (upper << 6) | (x & 0x3f);
    }
    _layer2XWrappingTable320[i] = x & 0x1ff;
  }
}

/**
 * Gets the wrapping table for Layer 2 320px mode.
 */
export function getLayer2XWrappingTable320(): Uint16Array {
  return _layer2XWrappingTable320;
}
