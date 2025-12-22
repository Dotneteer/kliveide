import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import {
  LayerOutput,
  ULAStandardCell,
  ULAStandardMatrix,
  ULA_DISPLAY_AREA,
  ULA_SCROLL_SAMPLE,
  ULA_PIXEL_READ,
  ULA_ATTR_READ,
  ULA_SHIFT_REG_LOAD,
  ULA_FLOATING_BUS_UPDATE
} from "./RenderingCell";
import { Plus3_50Hz, Plus3_60Hz, TimingConfig } from "./TimingConfig";
import { generateULAHiColorCell, generateULAHiResCell, generateULAStandardCell } from "./UlaMatrix";
import {
  generateLayer2_256x192Cell,
  generateLayer2_320x256Cell,
  generateLayer2_640x256Cell
} from "./Layer2Matrix";
import { generateSpritesCell } from "./SpritesMatrix";
import { generateTilemap40x32Cell, generateTilemap80x32Cell } from "./TilemapMatrix";
import { generateLoResCell } from "./LoResMatrix";
import { zxNextBgra } from "../PaletteDevice";

/**
 * For emulation purposes, a **fixed-size bitmap** represents the visible portion of the display across all timing modes and rendering modes.
 *
 * **Bitmap size**: **720 × 288 pixels** (fixed for all modes)
 *
 * **Horizontal Resolution Scaling**:
 *
 * The bitmap uses 720 pixels horizontally to transparently support all resolution modes:
 * - **HiRes** (512 pixels): Each source pixel rendered once (1:1 mapping)
 * - **Standard** (256 pixels): Each source pixel rendered twice (1:2 mapping)
 * - **LoRes** (128 pixels): Each source pixel rendered four times (1:4 mapping)
 *
 * This allows seamless switching between resolution modes without bitmap reallocation. The visible area (HC 96-455) maps to bitmap X 0-719 with appropriate pixel replication per mode.
 *
 * **Vertical Resolution**:
 * - **50Hz**: 288 lines (VC 16-303 mapped to Y 0-287) — fills entire bitmap height
 * - **60Hz**: 240 lines (VC 16-255 mapped to Y 24-263) — top 24 and bottom 24 lines rendered as transparent pixels
 */

// --- Horizontal pixels (doubled to support HiRes/Standard/LoRes)
const BITMAP_WIDTH = 720;

// --- Vertical pixels (50Hz: Y 0-287 full, 60Hz: Y 24-263 centered)
const BITMAP_HEIGHT = 288;

// --- Total bitmap size in pixels: 207,360
const BITMAP_SIZE = BITMAP_WIDTH * BITMAP_HEIGHT;

// ============================================================================
// Rendering Flags Dimensions (1D Uint16Array with full scanline storage)
// ============================================================================
// Full scanline including blanking (both 50Hz and 60Hz use HC 0-455)
const RENDERING_FLAGS_HC_COUNT = 456; // 0 to maxHC (455)

/**
 * ZX Spectrum Next Rendering Device
 *
 * Manages the entire rendering pipeline including all layers and all rendering matrices
 * for both timing modes (50Hz and 60Hz). The machine operates on a tact-by-tact basis,
 * where each tact corresponds to one CLK_7 cycle at a specific (VC, HC) position.
 */
export class NextComposedScreenDevice implements IGenericDevice<IZxNextMachine> {
  // Current timing configuration (50Hz or 60Hz)
  config: TimingConfig;

  // Flattened config properties (eliminates property access overhead in hot path)
  confIntStartTact: number;
  confIntEndTact: number;
  confTotalVC: number;
  confTotalHC: number;
  confDisplayXStart: number;
  confDisplayYStart: number;
  confFirstBitmapVC: number;
  confFirstVisibleHC: number;

  // --- The number of rendering tacts for the screen frame
  renderingTacts: number;

  // --- Interrupt state
  // --- INT signal (active: true, inactive: false)
  private _pulseIntActive: boolean;

  // Flash counter (0-31, cycles ~16 frames per state)
  private _flashCounter: number = 0;
  private _flashFlag: boolean = false;

  // ZX Next register flags
  // === Reg 0x03 - Machine type and display timing
  displayTiming: number;
  userLockOnDisplayTiming: boolean;
  machineType: number;

  // === Reg 0x05 - Screen timing mode
  is60HzMode: boolean;
  scandoublerEnabled: boolean;

  // === Reg 0x09 - Peripheral 4 Setting
  scanlineWeight: number;

  // === Reg 0x11 - Video Timing Mode
  videoTimingMode: number;

  // === Reg 0x12 - Layer 2 active RAM bank
  layer2ActiveRamBank: number;

  // === Reg 0x13 - Layer 2 shadow RAM bank
  layer2ShadowRamBank: number;

  // === Reg 0x14 - Global Transparent Color
  globalTransparencyColor: number;

  // === Reg 0x15 - LoRes mode (128x48 or 128x96)
  loResEnabled: boolean;
  sprites0OnTop: boolean;
  spritesEnableClipping: boolean;
  layerPriority: number;
  spritesEnableOverBorder: boolean;
  spritesEnabled: boolean;

  // === Reg 0x1A - Clip Window ULA/LoRes
  ulaClipWindowX1: number;
  ulaClipWindowX2: number;
  ulaClipWindowY1: number;
  ulaClipWindowY2: number;
  ulaClipIndex: number;

  // === Reg 0x1E - Active video line MSB
  activeVideoLine: number;

  // === Reg 0x26 - ULA X Scroll
  ulaScrollX: number;

  // === Reg 0x27 - ULA Y Scroll
  ulaScrollY: number;

  // === Reg 0x4A - Fallback color
  // The 8-bit color used if all layers are transparent
  fallbackColor: number;

  // === Reg 0x68 - ULA Control
  // When true, ULA output is disabled (ULA layer goes transparent)
  disableUlaOutput: boolean;
  // Blending in SLU modes 6 & 7
  // 00 = For ULA as blend color
  // 01 = For no blending
  // 10 = For ULA/Tilemap mix result as blend color
  // 11 = For tilemap as blend color
  blendingInSLUModes6And7: number;
  // When true, ULA+ features are enabled
  enableUlaPlus: boolean;
  // Not used yet
  ulaHalfPixelScroll: boolean;
  // Enable stencil mode when both the ULA and tilemap are enabled
  // (If either are transparent the result is transparent otherwise the result is a
  // logical AND of both colors)
  enableStencilMode: boolean;

  // === Reg 0x6B - Tilemap control
  tilemapEnabled: boolean;
  tilemap80x32Resolution: boolean;
  tilemapEliminateAttributes: boolean;
  tilemapTextMode: boolean;
  tilemap512TileMode: boolean;
  tilemapForceOnTopOfUla: boolean;

  // === Reg 0x70 - Layer 2 control
  // 0 = 256x192, 1 = 320x256, 2 = 640x256
  layer2Resolution: number;
  // This value is added to the upper nibble of the Layer 2 pixel value before palette lookup.
  layer2PaletteOffset: number;

  // === Standard 0xFE port border value
  private _borderColor: number;
  private _borderRgbCache: number;

  // === Timex port (0xff) ULA flags
  // The last 6 bit of the Timex port
  timexPortBits: number;
  // The start of the standard screen memory (true = 0x4000, false = 0x6000)
  standardScreenAt0x4000: boolean;
  // Is in ULA HiRes mode? true = HiRes mode, 512×192 monochrome, even columns
  // at 0x4000, odd at 0x6000
  ulaHiResMode: boolean;

  // In ULA HiRes mode,specify the ink color with paper being the contrasting color:
  // 0 = black ink on white paper
  // 1 = blue ink on yellow paper
  // 2 = red ink on cyan paper
  // 3 = magenta ink on green paper
  // 4 = green ink on magenta paper
  // 5 = cyan ink on red paper
  // 6 = yellow ink on blue paper
  // 7 = white ink on black paper
  ulaHiResColor: number;

  // Is in ULA HiColor mode? true = HiColor mode, 256×192 pixels at 0x4000,
  // 32×192 attributes at 0x6000
  ulaHiColorMode: boolean;

  // === Layer 2 port (0x123b) flags
  layer2Enabled: boolean;
  layer2Bank: number;
  layer2UseShadowBank: boolean;
  layer2EnableMappingForReads: boolean;
  layer2EnableMappingForWrites: boolean;

  // Rendering flags for all layers and modes
  private _renderingFlagsULAStandard: ULAStandardMatrix;
  private _renderingFlagsULAStandard50Hz: ULAStandardMatrix;
  private _renderingFlagsULAStandard60Hz: ULAStandardMatrix;

  private _renderingFlagsULAHiRes: Uint16Array;
  private _renderingFlagsULAHiRes50Hz: Uint16Array;
  private _renderingFlagsULAHiRes60Hz: Uint16Array;

  private _renderingFlagsULAHiColor: Uint16Array;
  private _renderingFlagsULAHiColor50Hz: Uint16Array;
  private _renderingFlagsULAHiColor60Hz: Uint16Array;

  private _renderingFlagsLayer2_256x192: Uint16Array;
  private _renderingFlagsLayer2_256x192_50Hz: Uint16Array;
  private _renderingFlagsLayer2_256x192_60Hz: Uint16Array;

  private _renderingFlagsLayer2_320x256: Uint16Array;
  private _renderingFlagsLayer2_320x256_50Hz: Uint16Array;
  private _renderingFlagsLayer2_320x256_60Hz: Uint16Array;

  private _renderingFlagsLayer2_640x256: Uint16Array;
  private _renderingFlagsLayer2_640x256_50Hz: Uint16Array;
  private _renderingFlagsLayer2_640x256_60Hz: Uint16Array;

  private _renderingFlagsSprites: Uint16Array;
  private _renderingFlagsSprites50Hz: Uint16Array;
  private _renderingFlagsSprites60Hz: Uint16Array;

  private _renderingFlagsTilemap_40x32: Uint16Array;
  private _renderingFlagsTilemap_40x32_50Hz: Uint16Array;
  private _renderingFlagsTilemap_40x32_60Hz: Uint16Array;

  private _renderingFlagsTilemap_80x32: Uint16Array;
  private _renderingFlagsTilemap_80x32_50Hz: Uint16Array;
  private _renderingFlagsTilemap_80x32_60Hz: Uint16Array;

  private _renderingFlagsLoRes: Uint16Array;
  private _renderingFlagsLoRes50Hz: Uint16Array;
  private _renderingFlagsLoRes60Hz: Uint16Array;

  // HC/VC lookup tables (pre-calculated to avoid modulo/division in renderTact)
  private _tactToHC: Uint16Array; // [tact] -> HC value
  private _tactToVC: Uint16Array; // [tact] -> VC value
  private _tactToHC50Hz: Uint16Array;
  private _tactToVC50Hz: Uint16Array;
  private _tactToHC60Hz: Uint16Array;
  private _tactToVC60Hz: Uint16Array;

  // Bitmap offset lookup tables (pre-calculated to eliminate arithmetic in renderTact)
  private _tactToBitmapOffset: Int32Array; // [tact] -> bitmap offset (-1 if out of bounds)
  private _tactToBitmapOffset50Hz: Int32Array;
  private _tactToBitmapOffset60Hz: Int32Array;

  /**
   * This buffer stores the bitmap of the screen being rendered. Each 32-bit value represents an ARGB pixel.
   */
  private _pixelBuffer: Uint32Array;

  // Pre-calculated ULA address lookup tables (192 entries for Y coordinates 0-191)
  // Stores base addresses before X coordinate is added
  private _ulaPixelLineBaseAddr: Uint16Array; // Pixel base address for each Y
  private _ulaAttrLineBaseAddr: Uint16Array; // Attribute base address for each Y

  // ULA rendering state
  ulaScrolledX: number;
  ulaScrolledY: number;
  ulaPixelByte1: number;
  ulaPixelByte2: number;
  floatingBusValue: number;
  ulaAttrByte1: number;
  ulaAttrByte2: number;
  ulaShiftReg: number;
  ulaShiftAttr: number;
  ulaShiftAttr2: number;
  ulaShiftAttrCount: number;

  // Pre-calculated attribute decode lookup tables (256 entries for all attribute byte values)
  // Two sets: one for flash off, one for flash on
  // Values are final palette indices (0-15) with BRIGHT already applied
  private _attrToInkFlashOff: Uint8Array; // [attr] -> ink palette index (0-15)
  private _attrToPaperFlashOff: Uint8Array; // [attr] -> paper palette index (0-15)
  private _attrToInkFlashOn: Uint8Array; // [attr] -> ink palette index (0-15) with flash swap
  private _attrToPaperFlashOn: Uint8Array; // [attr] -> paper palette index (0-15) with flash swap

  // Active lookup tables (switch based on _flashFlag)
  private _activeAttrToInk: Uint8Array;
  private _activeAttrToPaper: Uint8Array;

  constructor(public readonly machine: IZxNextMachine) {
    // Screen dimensions
    this.screenWidth = BITMAP_WIDTH;
    this.screenLines = BITMAP_HEIGHT;

    // Initialize ULA address lookup tables (192 Y coordinates)
    // Pre-calculate the Y-dependent part of pixel and attribute addresses
    this._ulaPixelLineBaseAddr = new Uint16Array(192);
    this._ulaAttrLineBaseAddr = new Uint16Array(192);

    for (let y = 0; y < 192; y++) {
      // Pixel address calculation: y[7:6] | y[2:0] | y[5:3] | x[7:3]
      // Pre-calculate everything except x[7:3]
      const y76 = (y >> 6) & 0x03; // Bits 7-6: thirds (0-2)
      const y20 = y & 0x07; // Bits 2-0: scan line within char (0-7)
      const y53 = (y >> 3) & 0x07; // Bits 5-3: char row (0-23)
      this._ulaPixelLineBaseAddr[y] = (y76 << 11) | (y20 << 8) | (y53 << 5);

      // Attribute address calculation: 0x1800 + (y/8)*32 + x/8
      // Pre-calculate 0x1800 + (y/8)*32
      const attrY = y >> 3; // Character row (0-23)
      this._ulaAttrLineBaseAddr[y] = 0x1800 + (attrY << 5);
    }

    // Generate attribute decode lookup tables (256 entries for all attribute byte values)
    // This eliminates bit operations during rendering
    // Store final palette indices (0-15) with BRIGHT already applied
    this._attrToInkFlashOff = new Uint8Array(256);
    this._attrToPaperFlashOff = new Uint8Array(256);
    this._attrToInkFlashOn = new Uint8Array(256);
    this._attrToPaperFlashOn = new Uint8Array(256);

    for (let attr = 0; attr < 256; attr++) {
      const flash = (attr >> 7) & 0x01;
      const bright = (attr >> 6) & 0x01;
      const paperColor = (attr >> 3) & 0x07;
      const inkColor = attr & 0x07;

      // Apply BRIGHT: adds 8 to color index (0-7 -> 0-15)
      const brightOffset = bright << 3;
      const inkPaletteIndex = inkColor + brightOffset;
      const paperPaletteIndex = paperColor + brightOffset;

      if (flash) {
        // Flash enabled: swap ink and paper when flash is active
        this._attrToInkFlashOff[attr] = inkPaletteIndex;
        this._attrToPaperFlashOff[attr] = paperPaletteIndex;
        this._attrToInkFlashOn[attr] = paperPaletteIndex; // Swapped
        this._attrToPaperFlashOn[attr] = inkPaletteIndex; // Swapped
      } else {
        // Flash disabled: same values for both states
        this._attrToInkFlashOff[attr] = inkPaletteIndex;
        this._attrToPaperFlashOff[attr] = paperPaletteIndex;
        this._attrToInkFlashOn[attr] = inkPaletteIndex;
        this._attrToPaperFlashOn[attr] = paperPaletteIndex;
      }
    }

    // Initialize active lookup tables
    this._activeAttrToInk = this._attrToInkFlashOff;
    this._activeAttrToPaper = this._attrToPaperFlashOff;

    // Generate rendering flags for all layers and modes
    this._renderingFlagsULAStandard50Hz = this.generateULAStandardRenderingFlags(Plus3_50Hz);
    this._renderingFlagsULAStandard60Hz = this.generateULAStandardRenderingFlags(Plus3_60Hz);
    this._renderingFlagsULAHiRes50Hz = this.generateULAHiResRenderingFlags(Plus3_50Hz);
    this._renderingFlagsULAHiRes60Hz = this.generateULAHiResRenderingFlags(Plus3_60Hz);
    this._renderingFlagsULAHiColor50Hz = this.generateULAHiColorRenderingFlags(Plus3_50Hz);
    this._renderingFlagsULAHiColor60Hz = this.generateULAHiColorRenderingFlags(Plus3_60Hz);
    this._renderingFlagsLayer2_256x192_50Hz = this.generateLayer2_256x192RenderingFlags(Plus3_50Hz);
    this._renderingFlagsLayer2_256x192_60Hz = this.generateLayer2_256x192RenderingFlags(Plus3_60Hz);
    this._renderingFlagsLayer2_320x256_50Hz = this.generateLayer2_320x256RenderingFlags(Plus3_50Hz);
    this._renderingFlagsLayer2_320x256_60Hz = this.generateLayer2_320x256RenderingFlags(Plus3_60Hz);
    this._renderingFlagsLayer2_640x256_50Hz = this.generateLayer2_640x256RenderingFlags(Plus3_50Hz);
    this._renderingFlagsLayer2_640x256_60Hz = this.generateLayer2_640x256RenderingFlags(Plus3_60Hz);
    this._renderingFlagsSprites50Hz = this.generateSpritesRenderingFlags(Plus3_50Hz);
    this._renderingFlagsSprites60Hz = this.generateSpritesRenderingFlags(Plus3_60Hz);
    this._renderingFlagsTilemap_40x32_50Hz = this.generateTilemap40x32RenderingFlags(Plus3_50Hz);
    this._renderingFlagsTilemap_40x32_60Hz = this.generateTilemap40x32RenderingFlags(Plus3_60Hz);
    this._renderingFlagsTilemap_80x32_50Hz = this.generateTilemap80x32RenderingFlags(Plus3_50Hz);
    this._renderingFlagsTilemap_80x32_60Hz = this.generateTilemap80x32RenderingFlags(Plus3_60Hz);
    this._renderingFlagsLoRes50Hz = this.generateLoResRenderingFlags(Plus3_50Hz);
    this._renderingFlagsLoRes60Hz = this.generateLoResRenderingFlags(Plus3_60Hz);

    // Generate HC/VC lookup tables for both timing modes
    this.generateTactLookupTables(Plus3_50Hz);
    this.generateTactLookupTables(Plus3_60Hz);

    // Generate bitmap offset lookup tables for both timing modes
    this.generateBitmapOffsetTable(Plus3_50Hz);
    this.generateBitmapOffsetTable(Plus3_60Hz);

    this.reset();
  }

  reset(): void {
    // --- No timing config yet
    this.config = undefined;

    // --- Create the pixel buffer
    this._pixelBuffer = new Uint32Array(BITMAP_SIZE);

    // --- Initialize ULA state values
    this.ulaClipIndex = 0;
    this.ulaClipWindowX1 = 0;
    this.ulaClipWindowX2 = 255;
    this.ulaClipWindowY1 = 0;
    this.ulaClipWindowY2 = 191;
    this.ulaScrollX = 0;
    this.ulaScrollY = 0;
    this.ulaScrolledX = 0;
    this.ulaScrolledY = 0;
    this.ulaPixelByte1 = 0;
    this.ulaPixelByte2 = 0;
    this.floatingBusValue = 0;
    this.ulaAttrByte1 = 0;
    this.ulaAttrByte2 = 0;
    this.ulaShiftReg = 0;

    // --- Initialize border color (use setter to update cache)
    this.borderColor = 7; // Default white border

    // --- Initialize timing mode, matrices, and the pixel bitmap
    this.onNewFrame();

    // --- Rendering state
    this._pulseIntActive = false;
    this._flashCounter = 0;
  }

  /**
   * Get the width of the rendered screen.
   * TODO: Implement this property
   */
  screenWidth: number;

  /**
   * Get the number of visible screen lines.
   * TODO: Implement this property
   */
  screenLines: number;

  /**
   * Use canvas size multipliers
   * @returns The aspect ratio of the screen
   */
  getAspectRatio(): [number, number] {
    return [0.5, 1];
  }

  requestsIrq(): boolean {
    // TODO: Implement this method
    return false;
  }

  get pulseIntActive(): boolean {
    return this._pulseIntActive;
  }

  /**
   * Get the current border color value
   */
  get borderColor(): number {
    return this._borderColor;
  }

  /**
   * Set the border color and update the cached RGB value
   * This optimization eliminates method calls for border pixels (~30% of pixels)
   */
  set borderColor(value: number) {
    this._borderColor = value;
    this._borderRgbCache = this.machine.paletteDevice.getUlaRgb333(value);
  }

  /**
   * Update the cached border RGB value from the current palette
   * Called by PaletteDevice when:
   * - ULA palette colors change
   * - Active palette switches (first <-> second)
   */
  updateBorderRgbCache(): void {
    this._borderRgbCache = this.machine.paletteDevice.getUlaRgb333(this._borderColor);
  }

  /**
   * Render the pixel pair belonging to the specified frame tact.
   * @param tact Frame tact to render
   */
  renderTact(tact: number): boolean {
    // === LOCAL VARIABLE HOISTING (Performance Optimization) ===
    // Cache frequently accessed properties to reduce property dereferencing overhead
    const loResEnabled = this.loResEnabled;
    const disableUlaOutput = this.disableUlaOutput;
    const ulaHiResMode = this.ulaHiResMode;
    const ulaHiColorMode = this.ulaHiColorMode;
    const layer2Enabled = this.layer2Enabled;
    const layer2Resolution = this.layer2Resolution;
    const spritesEnabled = this.spritesEnabled;
    const tilemapEnabled = this.tilemapEnabled;
    const tilemap80x32Resolution = this.tilemap80x32Resolution;

    // Check if interrupt signal is active (simple range check)
    this._pulseIntActive = tact >= this.confIntStartTact && tact < this.confIntEndTact;

    // === BLANKING CHECK ===
    // All rendering flags have identical blanking regions (cell value 0) for a given frequency mode.
    // We can use _renderingFlagsULAStandard as the blanking mask for all layers.
    // If the cell is 0 in this flags array, it's 0 in all other flags arrays (blanking region).
    // Since totalHC == RENDERING_FLAGS_HC_COUNT, tact directly equals the 1D array index.
    if (this._renderingFlagsULAStandard[tact] === 0) {
      return false; // Skip blanking tact - no visible content in any layer
    }

    // --- Get pre-calculated (HC, VC) position from lookup tables
    const hc = this._tactToHC[tact];
    const vc = this._tactToVC[tact];

    // === LAYER RENDERING ===
    // Render ULA layer pixel(s) if enabled
    let ulaOutput1: LayerOutput | null = null;
    let ulaOutput2: LayerOutput | null = null;

    if (loResEnabled) {
      // LoRes mode (128×96, replaces ULA output)
      const loresCell = this._renderingFlagsLoRes[tact];
      ulaOutput1 = this.renderLoResPixel(vc, hc, loresCell);
      ulaOutput2 = ulaOutput1; // Standard resolution base (4x replication handled by caller)
    } else if (!disableUlaOutput) {
      if (ulaHiResMode || ulaHiColorMode) {
        // ULA Hi-Res and Hi-Color modes
        if (ulaHiResMode) {
          // ULA Hi-Res mode (512×192, 2 pixels per HC)
          const ulaCell = this._renderingFlagsULAHiRes[tact];
          ulaOutput1 = this.renderULAHiResPixel(vc, hc, ulaCell, 0);
          ulaOutput2 = this.renderULAHiResPixel(vc, hc, ulaCell, 1);
        } else {
          // ULA Hi-Color mode (256×192)
          const ulaCell = this._renderingFlagsULAHiColor[tact];
          ulaOutput1 = this.renderULAHiColorPixel(vc, hc, ulaCell);
          ulaOutput2 = ulaOutput1; // Standard resolution: duplicate pixel
        }
      } else {
        // ULA Standard mode (256×192)
        const ulaCell = this._renderingFlagsULAStandard[tact];
        ulaOutput1 = this.renderULAStandardPixel(vc, hc, ulaCell);
        ulaOutput2 = ulaOutput1; // Standard resolution: duplicate pixel
      }
    }

    // Render Layer 2 pixel(s) if enabled
    let layer2Output1: LayerOutput | null = null;
    let layer2Output2: LayerOutput | null = null;

    if (layer2Enabled) {
      if (layer2Resolution === 0) {
        // Layer 2 256×192 mode
        const layer2Cell = this._renderingFlagsLayer2_256x192[tact];
        layer2Output1 = this.renderLayer2_256x192Pixel(vc, hc, layer2Cell);
        layer2Output2 = layer2Output1; // Standard resolution: duplicate pixel
      } else if (layer2Resolution === 1) {
        // Layer 2 320×256 mode
        const layer2Cell = this._renderingFlagsLayer2_320x256[tact];
        layer2Output1 = this.renderLayer2_320x256Pixel(vc, hc, layer2Cell);
        layer2Output2 = layer2Output1; // Standard resolution: duplicate pixel
      } else if (layer2Resolution === 2) {
        // Layer 2 640×256 mode (Hi-Res, 2 pixels per HC)
        const layer2Cell = this._renderingFlagsLayer2_640x256[tact];
        layer2Output1 = this.renderLayer2_640x256Pixel(vc, hc, layer2Cell, 0);
        layer2Output2 = this.renderLayer2_640x256Pixel(vc, hc, layer2Cell, 1);
      }
    }

    // Render Sprites pixel(s) if enabled
    let spritesOutput1: LayerOutput | null = null;
    let spritesOutput2: LayerOutput | null = null;

    if (spritesEnabled) {
      const spritesCell = this._renderingFlagsSprites[tact];
      spritesOutput1 = this.renderSpritesPixel(vc, hc, spritesCell);
      spritesOutput2 = spritesOutput1; // Standard resolution: duplicate pixel
    }

    // Render Tilemap pixel(s) if enabled
    let tilemapOutput1: LayerOutput | null = null;
    let tilemapOutput2: LayerOutput | null = null;

    if (tilemapEnabled) {
      if (tilemap80x32Resolution) {
        // Tilemap 80×32 mode (Hi-Res, 2 pixels per HC)
        const tilemapCell = this._renderingFlagsTilemap_80x32[tact];
        tilemapOutput1 = this.renderTilemap_80x32Pixel(vc, hc, tilemapCell, 0);
        tilemapOutput2 = this.renderTilemap_80x32Pixel(vc, hc, tilemapCell, 1);
      } else {
        // Tilemap 40×32 mode
        const tilemapCell = this._renderingFlagsTilemap_40x32[tact];
        tilemapOutput1 = this.renderTilemap_40x32Pixel(vc, hc, tilemapCell);
        tilemapOutput2 = tilemapOutput1; // Standard resolution: duplicate pixel
      }
    }

    // Stage 2: Merge ULA+Tilemap, then compose all layers and write to bitmap
    // Apply the ULA/Tilemap merging process from Section 4.2.1
    // LoRes is already integrated into ulaOutput (not kept separate)

    // TODO: Apply the complete merging logic from Section 4.2.1 here:
    // 1. Calculate ula_transparent, tm_transparent
    // 2. If stencil mode: ula_final = ula & tilemap (bitwise AND)
    // 3. Else: ula_final = tm_pixel_below ? (ula or tm) : (tm or ula)
    // 4. Calculate mix_rgb, mix_top_rgb, mix_bot_rgb based on blend mode
    // For now, using simplified approach (incomplete implementation)

    // Merge tilemap into ULA if both enabled (simplified version)
    if (tilemapEnabled && tilemapOutput1) {
      if (ulaOutput1 && !ulaOutput1.transparent && !tilemapOutput1.transparent) {
        // Both non-transparent: apply tm_pixel_below logic
        // TODO: Read tm_pixel_below from tilemap attributes
        // For now, tilemap on top (simplified)
        ulaOutput1 = tilemapOutput1;
      } else if (!tilemapOutput1.transparent) {
        // Only tilemap non-transparent
        ulaOutput1 = tilemapOutput1;
      }
      // If only ULA non-transparent, keep ulaOutput1 as-is
    }

    if (tilemapEnabled && tilemapOutput2) {
      if (ulaOutput2 && !ulaOutput2.transparent && !tilemapOutput2.transparent) {
        ulaOutput2 = tilemapOutput2;
      } else if (!tilemapOutput2.transparent) {
        ulaOutput2 = tilemapOutput2;
      }
    }

    // Use pre-calculated bitmap offset to write pixels
    const bitmapOffset = this._tactToBitmapOffset[tact];
    if (bitmapOffset >= 0) {
      // Compose and write first pixel
      const pixelRGBA1 = this.composeSinglePixel(ulaOutput1, layer2Output1, spritesOutput1);
      this._pixelBuffer[bitmapOffset] = pixelRGBA1;

      // Compose and write second pixel
      const pixelRGBA2 = this.composeSinglePixel(ulaOutput2, layer2Output2, spritesOutput2);
      this._pixelBuffer[bitmapOffset + 1] = pixelRGBA2;
    }

    // --- Visible pixel rendered
    return true;
  }

  /**
   * This method renders the entire screen frame as the shadow screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const pixelBuffer = new Uint32Array(this._pixelBuffer);
    if (savedPixelBuffer) {
      this._pixelBuffer = new Uint32Array(savedPixelBuffer);
    } else {
      for (let tact = 0; tact < this.renderingTacts; tact++) {
        this.renderTact(tact);
      }
    }
    return pixelBuffer;
  }

  /**
   * This method renders the full screen frame into the pixel buffer
   * @returns The pixel buffer containing the rendered screen
   */
  renderFullScreen(): Uint32Array {
    this.onNewFrame();
    for (let tact = 0; tact < this.renderingTacts; tact++) {
      this.renderTact(tact);
    }
    return this._pixelBuffer;
  }

  // --- Current paper colors
  currentPaperColors: number[] = [];

  // --- Current ink colors
  currentInkColors: number[] = [];

  /**
   * Set the current colors from the palette.
   * @param palette Palette to set the colors from
   * @param _ulaNextEnabled ULA Next is enabled
   * @param _ulaInkColorMask ULA ink color mask
   */
  setCurrentUlaColorsFromPalette(
    palette: number[],
    _ulaNextEnabled: boolean,
    _ulaInkColorMask: number
  ): void {
    this.currentInkColors.length = 0x100;
    this.currentPaperColors.length = 0x100;
    for (let i = 0; i < 0x100; i++) {
      const bright = !!(i & 0x40);
      const ink = i & 0x07;
      const paper = (i & 0x38) >> 3;
      let color = zxNextRgb333Codes[palette[bright ? ink | 0x08 : ink]];
      this.currentInkColors[i] =
        0xff000000 | ((color & 0xff) << 16) | (color & 0xff00) | ((color & 0xff0000) >> 16);
      color = zxNextRgb333Codes[palette[bright ? paper | 0x08 : paper]];
      this.currentPaperColors[i] =
        0xff000000 | ((color & 0xff) << 16) | (color & 0xff00) | ((color & 0xff0000) >> 16);
    }
    // TODO: Implement this method for ULA Next
  }

  /**
   * Gets the buffer that stores the rendered pixels
   */
  getPixelBuffer(): Uint32Array {
    return this._pixelBuffer;
  }

  /**
   * This method signs that a new screen frame has been started
   */
  onNewFrame(): void {
    // --- Set up the timing mode and rendering matrices accord to the current frequency mode
    const is60Hz = this.is60HzMode;
    const oldConfig = this.config;
    this.config = is60Hz ? Plus3_60Hz : Plus3_50Hz;

    // Copy config properties to flattened fields (eliminates property access overhead)
    this.confIntStartTact = this.config.intStartTact;
    this.confIntEndTact = this.config.intEndTact;
    this.confTotalVC = this.config.totalVC;
    this.confTotalHC = this.config.totalHC;
    this.confDisplayXStart = this.config.displayXStart;
    this.confDisplayYStart = this.config.displayYStart;
    this.confFirstBitmapVC = this.config.firstBitmapVC;
    this.confFirstVisibleHC = this.config.firstVisibleHC;

    this.renderingTacts = this.confTotalVC * this.confTotalHC;

    // --- Update all layer rendering flags references based on timing mode
    this._renderingFlagsULAStandard = is60Hz
      ? this._renderingFlagsULAStandard60Hz
      : this._renderingFlagsULAStandard50Hz;
    this._renderingFlagsULAHiRes = is60Hz
      ? this._renderingFlagsULAHiRes60Hz
      : this._renderingFlagsULAHiRes50Hz;
    this._renderingFlagsULAHiColor = is60Hz
      ? this._renderingFlagsULAHiColor60Hz
      : this._renderingFlagsULAHiColor50Hz;
    this._renderingFlagsLayer2_256x192 = is60Hz
      ? this._renderingFlagsLayer2_256x192_60Hz
      : this._renderingFlagsLayer2_256x192_50Hz;
    this._renderingFlagsLayer2_320x256 = is60Hz
      ? this._renderingFlagsLayer2_320x256_60Hz
      : this._renderingFlagsLayer2_320x256_50Hz;
    this._renderingFlagsLayer2_640x256 = is60Hz
      ? this._renderingFlagsLayer2_640x256_60Hz
      : this._renderingFlagsLayer2_640x256_50Hz;
    this._renderingFlagsSprites = is60Hz
      ? this._renderingFlagsSprites60Hz
      : this._renderingFlagsSprites50Hz;
    this._renderingFlagsTilemap_40x32 = is60Hz
      ? this._renderingFlagsTilemap_40x32_60Hz
      : this._renderingFlagsTilemap_40x32_50Hz;
    this._renderingFlagsTilemap_80x32 = is60Hz
      ? this._renderingFlagsTilemap_80x32_60Hz
      : this._renderingFlagsTilemap_80x32_50Hz;
    this._renderingFlagsLoRes = is60Hz
      ? this._renderingFlagsLoRes60Hz
      : this._renderingFlagsLoRes50Hz;

    // --- Update HC/VC lookup tables based on timing mode
    this._tactToHC = is60Hz ? this._tactToHC60Hz : this._tactToHC50Hz;
    this._tactToVC = is60Hz ? this._tactToVC60Hz : this._tactToVC50Hz;
    this._tactToBitmapOffset = is60Hz ? this._tactToBitmapOffset60Hz : this._tactToBitmapOffset50Hz;

    // Increment flash counter (cycles 0-31 for ~1 Hz flash rate at 50Hz)
    // Flash period: ~16 frames ON, ~16 frames OFF
    // Full cycle: ~32 frames (~0.64s at 50Hz, ~0.55s at 60Hz)
    this._flashCounter = (this._flashCounter + 1) & 0x1f;
    const newFlashFlag = this._flashCounter >= 16;

    // Switch active attribute lookup tables when flash state changes
    if (newFlashFlag !== this._flashFlag) {
      this._flashFlag = newFlashFlag;
      if (this._flashFlag) {
        this._activeAttrToInk = this._attrToInkFlashOn;
        this._activeAttrToPaper = this._attrToPaperFlashOn;
      } else {
        this._activeAttrToInk = this._attrToInkFlashOff;
        this._activeAttrToPaper = this._attrToPaperFlashOff;
      }
    }

    if (oldConfig !== this.config) {
      // Re-initialize bitmap when switching between 50Hz and 60Hz
      // This ensures proper centering of 60Hz content
      this.initializeBitmap();
    }
  }

  // ==============================================================================================
  // Port updates
  set timexPortValue(value: number) {
    this.timexPortBits = value & 0x3f;
    this.ulaHiResColor = (value >> 3) & 0x07;
    const mode = value & 0x07;
    switch (mode) {
      case 0:
        this.standardScreenAt0x4000 = true;
        this.ulaHiColorMode = false;
        this.ulaHiResMode = false;
        break;
      case 1:
        this.standardScreenAt0x4000 = false;
        this.ulaHiColorMode = false;
        this.ulaHiResMode = false;
        break;
      case 2:
        this.ulaHiColorMode = true;
        this.ulaHiResMode = false;
        break;
      case 3:
        this.ulaHiColorMode = true;
        this.ulaHiResMode = false;
        break;
      default:
        this.ulaHiResMode = true;
        this.ulaHiColorMode = false;
        break;
    }
  }

  /**
   * Gets the value of the 0x123b port
   */
  get port0x123bValue(): number {
    return (
      (this.layer2Bank << 6) |
      (this.layer2UseShadowBank ? 0x08 : 0x00) |
      (this.layer2EnableMappingForReads ? 0x04 : 0x00) |
      (this.layer2Enabled ? 0x02 : 0x00) |
      (this.layer2EnableMappingForWrites ? 0x01 : 0x00)
    );
  }

  /**
   * Updates the memory configuration based on the new 0x123b port value
   */
  set port0x123bValue(value: number) {
    this.layer2Bank = (value & 0xc0) >> 6;
    this.layer2UseShadowBank = (value & 0x08) !== 0;
    this.layer2EnableMappingForReads = (value & 0x04) !== 0;
    this.layer2Enabled = (value & 0x02) !== 0;
    this.layer2EnableMappingForWrites = (value & 0x01) !== 0;
  }

  // ==============================================================================================
  // Next register updates

  set nextReg0x05Value(value: number) {
    this.is60HzMode = (value & 0x04) !== 0;
    this.scandoublerEnabled = (value & 0x01) !== 0;
  }

  /**
   * Gets the clip window coordinate according to the current clip index
   */
  get nextReg0x1aValue(): number {
    switch (this.ulaClipIndex) {
      case 0:
        return this.ulaClipWindowX1;
      case 1:
        return this.ulaClipWindowX2;
      case 2:
        return this.ulaClipWindowY1;
      default:
        return this.ulaClipWindowY2;
    }
  }

  /**
   * Sets the clip window cordinate according to the current clip index
   */
  set nextReg0x1aValue(value: number) {
    switch (this.ulaClipIndex) {
      case 0:
        this.ulaClipWindowX1 = value;
        break;
      case 1:
        this.ulaClipWindowX2 = value;
        break;
      case 2:
        this.ulaClipWindowY1 = value;
        break;
      default:
        this.ulaClipWindowY2 = value;
        break;
    }
    this.ulaClipIndex = (this.ulaClipIndex + 1) & 0x03;
  }

  // ==============================================================================================
  // Lookup table generation

  /**
   * Generate HC/VC lookup tables to eliminate expensive modulo/division operations in renderTact.
   * Pre-calculates HC and VC values for every tact position.
   *
   * Memory cost: ~483 KB per timing mode (~967 KB total for 50Hz + 60Hz)
   * Performance gain: Eliminates modulo and division operations in hot path
   *
   * @param config - Timing configuration (50Hz or 60Hz)
   */
  private generateTactLookupTables(config: TimingConfig): void {
    const totalTacts = config.totalVC * config.totalHC;
    const tactToHC = new Uint16Array(totalTacts);
    const tactToVC = new Uint16Array(totalTacts);

    for (let tact = 0; tact < totalTacts; tact++) {
      tactToHC[tact] = tact % config.totalHC;
      tactToVC[tact] = (tact / config.totalHC) | 0; // Bitwise OR for integer division
    }

    // Store in appropriate 50Hz or 60Hz fields
    if (config === Plus3_50Hz) {
      this._tactToHC50Hz = tactToHC;
      this._tactToVC50Hz = tactToVC;
    } else {
      this._tactToHC60Hz = tactToHC;
      this._tactToVC60Hz = tactToVC;
    }
  }

  /**
   * Pre-calculate bitmap coordinate lookup table for each tact.
   *
   * This eliminates the need to calculate bitmap Y, bitmap X, and perform bounds checking
   * on every visible tact. The table stores the final bitmap buffer offset, or -1 if the
   * tact is outside the visible bitmap area.
   *
   * Memory cost: ~483 KB per timing mode (~967 KB total for 50Hz + 60Hz)
   * Performance gain: Eliminates 2 subtractions, 1 multiplication, and 2 comparisons per tact
   *
   * @param config - Timing configuration (50Hz or 60Hz)
   */
  private generateBitmapOffsetTable(config: TimingConfig): void {
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
        tactToBitmapOffset[tact] = -1; // Out of visible bitmap area
      }
    }

    // Store in appropriate 50Hz or 60Hz fields
    if (config === Plus3_50Hz) {
      this._tactToBitmapOffset50Hz = tactToBitmapOffset;
    } else {
      this._tactToBitmapOffset60Hz = tactToBitmapOffset;
    }
  }

  // Rendering flags generation

  /**
   * Generate ULA Standard rendering flags as 1D Uint16Array with bit flags.
   * Includes full scanline storage (blanking regions included for simplified addressing).
   *
   * Dimensions:
   * - 50Hz: 311 × 456 = ~141,816 elements (~284 KB)
   * - 60Hz: 264 × 456 = ~120,384 elements (~241 KB)
   *
   * Access: renderingFlags[vc * RENDERING_FLAGS_HC_COUNT + hc]
   *
   * @param config - Timing configuration (50Hz or 60Hz)
   * @returns 1D Uint16Array with bit flags for each cell
   */
  private generateULAStandardRenderingFlags(config: TimingConfig): ULAStandardMatrix {
    const vcCount = config.totalVC; // Total scanlines (including blanking)
    const hcCount = RENDERING_FLAGS_HC_COUNT; // Total horizontal positions (456)
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    // Generate all cells including blanking regions
    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateULAStandardCell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateULAHiResRenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateULAHiResCell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateULAHiColorRenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateULAHiColorCell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateLayer2_256x192RenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateLayer2_256x192Cell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateLayer2_320x256RenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateLayer2_320x256Cell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateLayer2_640x256RenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateLayer2_640x256Cell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateSpritesRenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateSpritesCell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateTilemap40x32RenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateTilemap40x32Cell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateTilemap80x32RenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateTilemap80x32Cell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  private generateLoResRenderingFlags(config: TimingConfig): Uint16Array {
    const vcCount = config.totalVC;
    const hcCount = RENDERING_FLAGS_HC_COUNT;
    const renderingFlags = new Uint16Array(vcCount * hcCount);

    for (let vc = 0; vc < vcCount; vc++) {
      for (let hc = 0; hc < hcCount; hc++) {
        const index = vc * hcCount + hc;
        renderingFlags[index] = generateLoResCell(config, vc, hc);
      }
    }

    return renderingFlags;
  }

  // ==============================================================================================
  // Rendering helpers

  /**
   * Initialize or clear the display bitmap based on current timing mode.
   *
   * For 50Hz mode: Clear entire bitmap (all pixels set to transparent)
   * For 60Hz mode: Clear entire bitmap, but visible content will be centered:
   *   - Top 24 lines (Y 0-23): transparent
   *   - Middle 240 lines (Y 24-263): rendering area
   *   - Bottom 24 lines (Y 264-287): transparent
   *
   * Note: For 60Hz mode, the top 24 and bottom 24 lines remain transparent.
   * The rendering logic in renderTact() will only update Y 24-263 for 60Hz,
   * leaving the transparent borders in place.
   * For 50Hz mode, all lines Y 0-287 will be rendered.
   */
  private initializeBitmap(): void {
    // Clear entire bitmap to transparent to fully transparent black
    this._pixelBuffer.fill(0x00000000);
  }

  /**
   * Render ULA Standard pixel for the current tact position (Stage 1: Pixel Generation).
   *
   * This method executes Stage 1 of the rendering pipeline as described in Section 1.
   * It generates the ULA pixel color and flags but does NOT write to the bitmap.
   * The returned output will be combined with other layers in the composition stage.
   *
   * Activities performed:
   * - Scroll register sampling (at HC subcycles 0x3, 0xB)
   * - VRAM pixel/attribute reads (at specific HC subcycles)
   * - Shift register operations
   * - Pixel generation from shift register
   * - Palette lookup (RGB output)
   * - Clipping test
   * - Transparency determination
   * - Contention and floating bus simulation
   *
   * @param vc - Vertical counter position
   * @param hc - Horizontal counter position
   * @param cell - ULA Standard rendering cell flags (Uint16 bit flags)
   * @returns Layer output (RGB + flags) for composition stage
   */
  private renderULAStandardPixel(vc: number, hc: number, cell: ULAStandardCell): LayerOutput {
    // === Display Area: ULA Standard Rendering ===
    // --- Scroll Sampling ---
    if ((cell & ULA_SCROLL_SAMPLE) !== 0) {
      // Sample hardware scroll registers at specific HC subcycle positions (0x3, 0xB)
      // This happens at HC[3:0] = 0x3 or 0xB (falling edge of CLK_7 in hardware)
      this.ulaScrolledX = this.ulaScrollX;
      this.ulaScrolledY = vc - this.confDisplayYStart + this.ulaScrollY;
      if (this.ulaScrolledY >= 0xc0) {
        this.ulaScrolledY -= 0xc0; // Wrap Y at 192 for vertical scrolling
      }
    }

    // --- Shift Register Load ---
    if ((cell & ULA_SHIFT_REG_LOAD) !== 0) {
      // Load pixel and attribute data into shift register
      // This prepares the next 8 pixels for output
      this.ulaShiftReg =
        ((((this.ulaPixelByte1 << 8) | this.ulaPixelByte2) << (this.ulaScrolledX & 0x07)) >> 8) &
        0xff;
      this.ulaShiftAttr = this.ulaAttrByte1; // Load attribute byte 1
      this.ulaShiftAttr2 = this.ulaAttrByte2; // Load attribute byte 2
      this.ulaShiftAttrCount = 8 - (this.ulaScrolledX & 0x07); // Reset attribute shift counter
    }

    // // --- Memory Read Activities ---
    if ((cell & ULA_PIXEL_READ) !== 0) {
      // Calculate pixel address using pre-computed Y-dependent base + X component
      // Full address: y[7:6] | y[2:0] | y[5:3] | x[7:3]
      // Base (Y part) already computed in _ulaPixelLineBaseAddr[this.ulaScrolledY]
      // X part: ulaScrolledX[7:3] gives byte column (0-31)
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrolledX >> 3)) & 0x1f;
      const pixelAddr = this._ulaPixelLineBaseAddr[this.ulaScrolledY] | shiftCols;
      // Read pixel byte from Bank 5 or Bank 7
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);
      if (hc & 0x04) {
        this.ulaPixelByte2 = pixelByte;
      } else {
        this.ulaPixelByte1 = pixelByte;
      }

      // Update floating bus with pixel data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    if ((cell & ULA_ATTR_READ) !== 0) {
      // Calculate attribute address using pre-computed Y-dependent base + X component
      // Full address: 0x1800 + (scrolledY / 8) * 32 + (scrolledX / 8)
      // Base (Y part) already computed in _ulaAttrLineBaseAddr[scrolledY]
      // X part: scrolledX[7:3] gives character column (0-31)
      const baseCol = (hc + 0x0a - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrolledX >> 3)) & 0x1f;
      const attrAddr = this._ulaAttrLineBaseAddr[this.ulaScrolledY] | shiftCols;

      // Read attribute byte from Bank 5 or Bank 7
      const ulaAttrByte = this.machine.memoryDevice.readScreenMemory(attrAddr);
      if (hc & 0x04) {
        this.ulaAttrByte2 = ulaAttrByte;
      } else {
        this.ulaAttrByte1 = ulaAttrByte;
      }

      // Update floating bus with attribute data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = ulaAttrByte;
      }
    }

    // --- Contention Simulation ---
    // if (cell.contentionWindow && this.contentionEnabled) {
    //   // Delay CPU memory access by one cycle (simulation only)
    //   // In real hardware, this delays Z80 access to contended RAM ($4000-$7FFF)
    //   // This would be handled by the CPU emulation module
    //   this.signalMemoryContention();
    // }

    // === Border Area ===
    if ((cell & ULA_DISPLAY_AREA) === 0) {
      // Use cached border RGB value (updated when borderColor changes)
      // This eliminates method call overhead for ~30% of pixels
      return {
        rgb333: this._borderRgbCache,
        transparent: false,
        clipped: false
      };
    }

    // // --- Pixel Generation ---
    // Generate pixel from shift register (happens every HC position)
    // Extract current pixel bit from shift register
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;
    const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
    const pixelBit = (this.ulaShiftReg >> (7 - pixelWithinByte)) & 0x01;

    // Use pre-calculated lookup tables with BRIGHT already applied
    // Direct palette index lookup (0-15) - no bit operations needed
    const paletteIndex = pixelBit
      ? this._activeAttrToInk[this.ulaShiftAttr]
      : this._activeAttrToPaper[this.ulaShiftAttr];

    this.ulaShiftAttrCount--;
    if (this.ulaShiftAttrCount === 0) {
      this.ulaShiftAttrCount = 8;
      this.ulaShiftAttr = this.ulaShiftAttr2; // Load attribute byte 2
    }

    // Lookup color in ULA palette (16 entries for standard + bright colors)
    const pixelRGB = this.machine.paletteDevice.getUlaRgb333(paletteIndex);

    // --- Clipping Test ---
    // Check if pixel is within ULA clip window (NextReg 0x1C, 0x1D)
    const clipped =
      displayHC < this.ulaClipWindowX1 ||
      displayHC > this.ulaClipWindowX2 ||
      displayVC < this.ulaClipWindowY1 ||
      displayVC > this.ulaClipWindowY2;

    // --- Transparency Check ---
    const transparent = pixelRGB >> 1 === this.globalTransparencyColor;

    // Return layer output for composition stage
    return {
      rgb333: pixelRGB,
      transparent: transparent || clipped, // Treat clipped pixels as transparent
      clipped: clipped
    };
  }

  /**
   * Render ULA Hi-Res mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   * @param _pixelIndex - Which pixel of the pair (0 or 1)
   */
  private renderULAHiResPixel(
    _vc: number,
    _hc: number,
    _cell: number,
    _pixelIndex: number
  ): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render ULA Hi-Color mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderULAHiColorPixel(_vc: number, _hc: number, _cell: number): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render Layer 2 256×192 mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderLayer2_256x192Pixel(_vc: number, _hc: number, _cell: number): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render Layer 2 320×256 mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderLayer2_320x256Pixel(_vc: number, _hc: number, _cell: number): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render Layer 2 640×256 mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   * @param _pixelIndex - Which pixel of the pair (0 or 1)
   */
  private renderLayer2_640x256Pixel(
    _vc: number,
    _hc: number,
    _cell: number,
    _pixelIndex: number
  ): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render Sprites layer pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderSpritesPixel(_vc: number, _hc: number, _cell: number): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render Tilemap 80×32 mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   * @param _pixelIndex - Which pixel of the pair (0 or 1)
   */
  private renderTilemap_80x32Pixel(
    _vc: number,
    _hc: number,
    _cell: number,
    _pixelIndex: number
  ): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render Tilemap 40×32 mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderTilemap_40x32Pixel(_vc: number, _hc: number, _cell: number): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Render LoRes pixel (Stage 1).
   * Handles 128×96 mode with 4×4 pixel scaling.
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderLoResPixel(_vc: number, _hc: number, _cell: number): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb333: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Compose a single pixel from layer outputs.
   *
   * Helper method that performs the composition logic for one pixel.
   * Evaluates priority, transparency, and fallback color to select the final RGB value,
   * then converts it to RGBA format for the bitmap.
   *
   * @param layerOutputs - Fixed 5-layer tuple [ULA, Layer2, Sprites, Tilemap, LoRes]
   * @returns RGBA pixel value (format: 0xAABBGGRR)
   */
  private composeSinglePixel(
    ulaOutput: LayerOutput,
    layer2Output: LayerOutput,
    spritesOutput: LayerOutput
  ): number {
    // --- Combine sprites, Layer 2, and ULA outputs
    let selectedOutput: LayerOutput | null = null;
    // === Layer 2 Priority Override ===
    // If Layer 2 priority bit is set, it renders on top regardless of priority setting
    if (layer2Output && layer2Output.priority && !layer2Output.transparent) {
      selectedOutput = layer2Output;
    } else {
      // Select first non-transparent, non-null layer in priority order
      switch (this.layerPriority) {
        case 0: // SLU
          if (spritesOutput && !spritesOutput.transparent) {
            selectedOutput = spritesOutput;
          } else if (layer2Output && !layer2Output.transparent) {
            selectedOutput = layer2Output;
          } else {
            selectedOutput = ulaOutput;
          }
          break;

        case 1: // LSU
          if (layer2Output && !layer2Output.transparent) {
            selectedOutput = layer2Output;
          } else if (spritesOutput && !spritesOutput.transparent) {
            selectedOutput = spritesOutput;
          } else {
            selectedOutput = ulaOutput;
          }
          break;

        case 2: // SUL
          if (spritesOutput && !spritesOutput.transparent) {
            selectedOutput = spritesOutput;
          } else if (ulaOutput && !ulaOutput.transparent) {
            selectedOutput = ulaOutput;
          } else {
            selectedOutput = layer2Output;
          }
          break;

        case 3: // LUS
          if (layer2Output && !layer2Output.transparent) {
            selectedOutput = layer2Output;
          } else if (ulaOutput && !ulaOutput.transparent) {
            selectedOutput = ulaOutput;
          } else {
            selectedOutput = spritesOutput;
          }
          break;

        case 4: // USL
          if (ulaOutput && !ulaOutput.transparent) {
            selectedOutput = ulaOutput;
          } else if (spritesOutput && !spritesOutput.transparent) {
            selectedOutput = spritesOutput;
          } else {
            selectedOutput = layer2Output;
          }
          break;

        default:
          if (ulaOutput && !ulaOutput.transparent) {
            selectedOutput = ulaOutput;
          } else if (layer2Output && !layer2Output.transparent) {
            selectedOutput = layer2Output;
          } else {
            selectedOutput = spritesOutput;
          }
          break;
      }
    }

    // === Fallback/Backdrop Color ===
    let finalRGB333: number;
    if (selectedOutput === null) {
      // All layers transparent: use fallback color (NextReg 0x4A)
      // NextReg 0x4A is 8-bit RRRGGGBB, convert to 9-bit RGB
      const blueLSB = (this.fallbackColor & 0x02) | (this.fallbackColor & 0x01); // OR of blue bits
      finalRGB333 = (this.fallbackColor << 1) | blueLSB;
    } else {
      finalRGB333 = selectedOutput.rgb333;
    }

    return zxNextBgra[finalRGB333 & 0x1ff]; // Convert to RGBA format
  }
}
