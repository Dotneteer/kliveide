/**
 * Common timing and region information for all rendering cells.
 * This type represents the base state that applies regardless of active layers.
 *
 * SPARSE MATRIX OPTIMIZATION:
 * Matrices only store visible regions (excluding horizontal and vertical blanking).
 * - Vertical range: firstBitmapVC to lastBitmapVC (50Hz: 16-303, 60Hz: 16-255)
 * - Horizontal range: firstVisibleHC to maxHC (both modes: 96-455)
 * - Access: matrix[vc - firstBitmapVC][hc - firstVisibleHC]
 * - Memory savings: ~25% per matrix (blanking regions excluded)
 *
 * Note: Border area and interrupt position can be computed from (HC, VC) coordinates
 * rather than stored in each cell, further reducing memory footprint.
 */
type RenderingCellBase = {
  // Timing state (blanking cells not stored in matrix)

  // Region classification
  displayArea: boolean; // Active display area where layers render

  // Contention simulation (if displayArea && enabled)
  contentionWindow: boolean; // In contention window (affects CPU timing)
};

/**
 * ULA Standard rendering cell extends the base cell with ULA-specific activities.
 * Activities occur at specific HC subcycle positions during the display area.
 */
export type ULAStandardCell = RenderingCellBase & {
  // Sample scroll registers (hc[3:0] = 0x3, 0xB)
  scrollSample: boolean;
  // Read pixel byte from VRAM (hc[3:0] = 0x0, 0x4, 0x8, 0xC)
  pixelRead: boolean;
  // Read attribute byte (hc[3:0] = 0x2, 0x6, 0xA, 0xE)
  attrRead: boolean;
  // Load shift register (hc[3:0] = 0xC, 0x4). Marks the precise timing moments
  // when 8 pixels worth of data should be loaded into this shift register.
  shiftRegLoad: boolean;
  // Update floating bus (hc[3:0] = 0x9, 0xB, 0xD, 0xF)
  floatingBusUpdate: boolean;
};

/**
 * ULA Timex Hi-Res rendering cell (512×192 mode)
 */
export type ULAHiResCell = RenderingCellBase & {
  // First pixel byte read
  pixelRead0: boolean;
  // Second pixel byte read (for high resolution)
  pixelRead1: boolean;
  // Marks the precise timing moments when 8 pixels worth of data should be loaded
  // into this shift register.
  shiftRegLoad: boolean;
};

/**
 * ULA Timex Hi-Color rendering cell (256×192 with per-pixel color)
 */
export type ULAHiColorCell = RenderingCellBase & {
  // Pixel data read
  pixelRead: boolean;
  // Color data read (replaces attribute)
  colorRead: boolean;
  // Marks the precise timing moments when 8 pixels worth of data should be loaded
  // into this shift register.
  shiftRegLoad: boolean;
};

/**
 * Layer 2 rendering cell (all resolutions share common structure)
 */
export type Layer2Cell = RenderingCellBase & {
  // Fetch pixel from SRAM
  pixelFetch: boolean;
  // Generate palette index from pixel data
  paletteIndex: boolean;
};

/**
 * Sprites rendering cell extends the base cell with sprite-specific activities.
 */
export type SpritesCell = RenderingCellBase & {
  // Read from sprite line buffer
  lineBufferRead: boolean;
  // Check sprite visibility
  visibilityCheck: boolean;
};

/**
 * Tilemap rendering cell (both resolutions share common structure)
 */
export type TilemapCell = RenderingCellBase & {
  // Fetch tile index from tilemap
  tileIndexFetch: boolean;
  // Fetch tile pattern data
  patternFetch: boolean;
};

/**
 * LoRes rendering cell (both resolutions share common structure)
 */
export type LoResCell = RenderingCellBase & {
  blockFetch: boolean; // Fetch 4×4 or 4×8 block data
  pixelReplicate: boolean; // Replicate pixel across block
};

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
 * Type alias for a 2D matrix of rendering cells that represents the rendering information
 * for a specific layer across the visible screen area.
 */
export type LayerMatrix = RenderingCell[][];

/**
 * Layer output structure from Stage 1 (Pixel Generation + Palette Lookup).
 * Each rendering layer returns this structure for composition.
 */
export type LayerOutput = {
  // RGB333 color (9 bits: bits[8:6]=R, bits[5:3]=G, bits[2:0]=B)
  rgb: number;
  // True if pixel should be treated as transparent
  transparent: boolean;
  // True if pixel is outside layer's clip window
  clipped: boolean;
  // Optional: Layer 2 priority bit (overrides priority order)
  priority?: boolean;
};

/**
 * Fixed 5-layer tuple type for composition.
 * Null indicates layer is disabled or inactive.
 */
export type LayersOutput = [
  ula: LayerOutput | null,
  layer2: LayerOutput | null,
  sprites: LayerOutput | null,
  tilemap: LayerOutput | null,
  lores: LayerOutput | null
];
