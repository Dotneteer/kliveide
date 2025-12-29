// ============================================================================
// Rendering Cell Bit Flags (for Uint16Array representation)
// ============================================================================

// ULA Standard Cell (8 flags)
export const ULA_DISPLAY_AREA = 0b00000001; // bit 0
export const ULA_CONTENTION_WINDOW = 0b00000010; // bit 1
export const ULA_NREG_SAMPLE = 0b00000100; // bit 2
export const ULA_BYTE1_READ = 0b00001000; // bit 3
export const ULA_BYTE2_READ = 0b00010000; // bit 4
export const ULA_SHIFT_REG_LOAD = 0b00100000; // bit 5
export const ULA_FLOATING_BUS_UPDATE = 0b01000000; // bit 6
export const ULA_BORDER_AREA = 0b10000000; // bit 7

// ULA Hi-Res Cell (6 flags)
export const ULA_HIRES_DISPLAY_AREA = 0b000001; // bit 0
export const ULA_HIRES_CONTENTION_WINDOW = 0b000010; // bit 1
export const ULA_HIRES_PIXEL_READ_0 = 0b000100; // bit 2
export const ULA_HIRES_PIXEL_READ_1 = 0b001000; // bit 3
export const ULA_HIRES_SHIFT_REG_LOAD = 0b010000; // bit 4
export const ULA_HIRES_BORDER_AREA = 0b100000; // bit 5

// ULA Hi-Color Cell (6 flags)
export const ULA_HICOLOR_DISPLAY_AREA = 0b000001; // bit 0
export const ULA_HICOLOR_CONTENTION_WINDOW = 0b000010; // bit 1
export const ULA_HICOLOR_PIXEL_READ = 0b000100; // bit 2
export const ULA_HICOLOR_COLOR_READ = 0b001000; // bit 3
export const ULA_HICOLOR_SHIFT_REG_LOAD = 0b010000; // bit 4
export const ULA_HICOLOR_BORDER_AREA = 0b100000; // bit 5

// Layer 2 Cell (4 flags - same for all 3 resolutions)
export const LAYER2_DISPLAY_AREA = 0b0001; // bit 0
export const LAYER2_CONTENTION_WINDOW = 0b0010; // bit 1
export const LAYER2_PIXEL_FETCH = 0b0100; // bit 2
export const LAYER2_PALETTE_INDEX = 0b1000; // bit 3

// Sprites Cell (4 flags)
export const SPRITES_DISPLAY_AREA = 0b0001; // bit 0
export const SPRITES_CONTENTION_WINDOW = 0b0010; // bit 1
export const SPRITES_LINE_BUFFER_READ = 0b0100; // bit 2
export const SPRITES_VISIBILITY_CHECK = 0b1000; // bit 3

// Tilemap Cell (4 flags - same for both resolutions)
export const TILEMAP_DISPLAY_AREA = 0b0001; // bit 0
export const TILEMAP_CONTENTION_WINDOW = 0b0010; // bit 1
export const TILEMAP_TILE_INDEX_FETCH = 0b0100; // bit 2
export const TILEMAP_PATTERN_FETCH = 0b1000; // bit 3

// LoRes Cell (5 flags)
export const LORES_DISPLAY_AREA = 0b00001; // bit 0
export const LORES_CONTENTION_WINDOW = 0b00010; // bit 1
export const LORES_NREG_SAMPLE = 0b00100; // bit 2
export const LORES_BLOCK_FETCH = 0b01000; // bit 3
export const LORES_PIXEL_REPLICATE = 0b10000; // bit 4

/**
 * Common timing and region information for all rendering cells.
 * This type represents the base state that applies regardless of active layers.
 *
 * 1D MATRIX OPTIMIZATION:
 * Matrices use 1D Uint16Array with full scanline storage (including blanking).
 * - Access: matrix[vc * totalHC + hc]
 * - 50Hz: 311 × 448 = ~139K cells (279 KB)
 * - 60Hz: 263 × 448 = ~118K cells (236 KB)
 * - Memory savings: ~15-25x vs object arrays
 * - Performance: 20-40% faster access (contiguous memory, no double-dereference)
 *
 * Note: Border area and interrupt position can be computed from (HC, VC) coordinates
 * rather than stored in each cell, further reducing memory footprint.
 */

// Old object-based rendering cell structure (replaced by bit flags):
// type RenderingCellBase = {
//   displayArea: boolean;
//   contentionWindow: boolean;
// };

/**
 * ULA Standard rendering cell represented as Uint16 bit flags.
 * Activities occur at specific HC subcycle positions during the display area.
 *
 * Bit flags (use bitwise operations for access):
 * - ULA_DISPLAY_AREA: Active display area where layers render
 * - ULA_CONTENTION_WINDOW: In contention window (affects CPU timing)
 * - ULA_SCROLL_SAMPLE: Sample scroll registers (hc[3:0] = 0x3, 0xB)
 * - ULA_PIXEL_READ: Read pixel byte from VRAM (hc[3:0] = 0x0, 0x4, 0x8, 0xC)
 * - ULA_ATTR_READ: Read attribute byte (hc[3:0] = 0x2, 0x6, 0xA, 0xE)
 * - ULA_SHIFT_REG_LOAD: Load shift register (hc[3:0] = 0xC, 0x4)
 * - ULA_FLOATING_BUS_UPDATE: Update floating bus (hc[3:0] = 0x9, 0xB, 0xD, 0xF)
 */
export type ULAStandardCell = number;

/**
 * Type alias for 1D ULA Standard matrix (Uint16Array)
 */
export type ULAStandardMatrix = Uint16Array;

/**
 * ULA Timex Hi-Res rendering cell (512×192 mode)
 */
/**
 * ULA Timex Hi-Res rendering cell (512×192 mode) represented as Uint16 bit flags.
 *
 * Bit flags:
 * - ULA_HIRES_DISPLAY_AREA: Active display area
 * - ULA_HIRES_CONTENTION_WINDOW: In contention window
 * - ULA_HIRES_PIXEL_READ_0: First pixel byte read
 * - ULA_HIRES_PIXEL_READ_1: Second pixel byte read (for high resolution)
 * - ULA_HIRES_SHIFT_REG_LOAD: Load shift register
 */
export type ULAHiResCell = number;
export type ULAHiResMatrix = Uint16Array;

/**
 * ULA Timex Hi-Color rendering cell (256×192 with per-pixel color) represented as Uint16 bit flags.
 *
 * Bit flags:
 * - ULA_HICOLOR_DISPLAY_AREA: Active display area
 * - ULA_HICOLOR_CONTENTION_WINDOW: In contention window
 * - ULA_HICOLOR_PIXEL_READ: Pixel data read
 * - ULA_HICOLOR_COLOR_READ: Color data read (replaces attribute)
 * - ULA_HICOLOR_SHIFT_REG_LOAD: Load shift register
 */
export type ULAHiColorCell = number;
export type ULAHiColorMatrix = Uint16Array;

/**
 * Layer 2 rendering cell (all resolutions share common structure) represented as Uint16 bit flags.
 *
 * Bit flags:
 * - LAYER2_DISPLAY_AREA: Active display area
 * - LAYER2_CONTENTION_WINDOW: In contention window
 * - LAYER2_PIXEL_FETCH: Fetch pixel from SRAM
 * - LAYER2_PALETTE_INDEX: Generate palette index from pixel data
 */
export type Layer2Cell = number;
export type Layer2Matrix = Uint16Array;

/**
 * Sprites rendering cell represented as Uint16 bit flags.
 *
 * Bit flags:
 * - SPRITES_DISPLAY_AREA: Active display area
 * - SPRITES_CONTENTION_WINDOW: In contention window
 * - SPRITES_LINE_BUFFER_READ: Read from sprite line buffer
 * - SPRITES_VISIBILITY_CHECK: Check sprite visibility
 */
export type SpritesCell = number;
export type SpritesMatrix = Uint16Array;

/**
 * Tilemap rendering cell (both resolutions share common structure) represented as Uint16 bit flags.
 *
 * Bit flags:
 * - TILEMAP_DISPLAY_AREA: Active display area
 * - TILEMAP_CONTENTION_WINDOW: In contention window
 * - TILEMAP_TILE_INDEX_FETCH: Fetch tile index from tilemap
 * - TILEMAP_PATTERN_FETCH: Fetch tile pattern data
 */
export type TilemapCell = number;
export type TilemapMatrix = Uint16Array;

/**
 * LoRes rendering cell (both resolutions share common structure) represented as Uint16 bit flags.
 *
 * Bit flags:
 * - LORES_DISPLAY_AREA: Active display area
 * - LORES_CONTENTION_WINDOW: In contention window
 * - LORES_BLOCK_FETCH: Fetch 4×4 or 4×8 block data
 * - LORES_PIXEL_REPLICATE: Replicate pixel across block
 */
export type LoResCell = number;
export type LoResMatrix = Uint16Array;

/**
 * The union type for all rendering cell types used in ZX Next screen rendering.
 */
export type RenderingCell =
  | ULAStandardCell
  | ULAHiResCell
  | ULAHiColorCell
  | Layer2Cell
  | SpritesCell
  | TilemapCell
  | LoResCell;

/**
 * Scanline state for Layer 2 320×256 mode rendering.
 * Precomputed per scanline to avoid redundant per-pixel calculations.
 */
export interface Layer2ScanlineState320x256 {
  vc: number;
  displayVC: number;
  displayVC_wide: number;
  vc_valid: boolean;
  clippedByVertical: boolean;
  y: number; // Final Y coordinate after scrolling
  bank: number; // Active memory bank
}

/**
 * Scanline state for Layer 2 256×192 mode rendering.
 * Precomputed per scanline to avoid redundant per-pixel calculations.
 */
export interface Layer2ScanlineState192 {
  vc: number;
  displayVC: number;
  vc_valid: boolean;
  clippedByVertical: boolean;
  y: number; // Pre-calculated: (displayVC + scrollY) % 192
  bank: number; // Pre-selected: shadow vs active
}

/**
 * Bank cache for Layer 2 memory access optimization.
 * Priority 2E: Cache bank calculations for sequential pixel access.
 */
export interface BankCache {
  lastOffset: number;
  lastBank16K: number;
  lastBank8K: number;
  lastMemoryBase: number;
}
