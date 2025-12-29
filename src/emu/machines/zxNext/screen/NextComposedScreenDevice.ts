import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import {
  BankCache,
  LAYER2_DISPLAY_AREA,
  Layer2ScanlineState192,
  Layer2ScanlineState320x256,
  LORES_BLOCK_FETCH,
  LORES_DISPLAY_AREA,
  LORES_NREG_SAMPLE,
  LoResCell,
  ULA_BORDER_AREA,
  ULA_BYTE1_READ,
  ULA_BYTE2_READ,
  ULA_DISPLAY_AREA,
  ULA_FLOATING_BUS_UPDATE,
  ULA_NREG_SAMPLE,
  ULA_SHIFT_REG_LOAD,
  ULAHiResCell,
  ULAStandardCell
} from "./RenderingCell";
import { Plus3_50Hz, Plus3_60Hz, TimingConfig } from "./TimingConfig";
import { zxNextBgra } from "../PaletteDevice";
import {
  initializeAllLookupTables,
  getUlaPixelLineBaseAddr,
  getUlaAttrLineBaseAddr,
  getAttrToInkFlashOff,
  getAttrToPaperFlashOff,
  getAttrToInkFlashOn,
  getAttrToPaperFlashOn,
  getUlaPlusAttrToInk,
  getUlaPlusAttrToPaper,
  setActiveTimingMode,
  getActiveRenderingFlagsULA,
  getActiveRenderingFlagsLayer2_256x192,
  getActiveRenderingFlagsLayer2_320x256,
  getActiveRenderingFlagsLayer2_640x256,
  getActiveRenderingFlagsSprites,
  getActiveRenderingFlagsTilemap_40x32,
  getActiveRenderingFlagsTilemap_80x32,
  getActiveRenderingFlagsLoRes,
  getActiveTactToHC,
  getActiveTactToVC,
  getActiveTactToBitmapOffset,
  getULANextInkIndex,
  getULANextPaperIndex,
  getLayer2XWrappingTable320
} from "./rendering-tables";

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
  flashFlag: boolean = false;

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
  loResEnabledSampled: boolean;
  loResModeSampled: number;
  loResBlockByte: number; // Current block data byte
  loResScrollXSampled: number; // Sampled X scroll for LoRes
  loResScrollYSampled: number; // Sampled Y scroll for LoRes
  sprites0OnTop: boolean;
  spritesEnableClipping: boolean;
  layerPriority: number;
  spritesEnableOverBorder: boolean;
  spritesEnabled: boolean;

  // === Reg 0x16 - Layer 2 X Scroll LSB
  layer2ScrollX: number;

  // === Reg 0x17 - Layer 2 Y Scroll
  layer2ScrollY: number;

  // === Reg 0x18 - Layer 2 Clip Window
  layer2ClipWindowX1: number;
  layer2ClipWindowX2: number;
  layer2ClipWindowY1: number;
  layer2ClipWindowY2: number;
  layer2ClipIndex: number;

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
  private _fallbackColor: number;

  get fallbackColor(): number {
    return this._fallbackColor;
  }

  set fallbackColor(value: number) {
    this._fallbackColor = value;
    this.updateFallbackRgb333Cache();
  }

  // === Reg 0x68 - ULA Control
  // When true, ULA output is disabled (ULA layer goes transparent)
  disableUlaOutput: boolean;
  disableUlaOutputSampled: boolean;
  // Blending in SLU modes 6 & 7
  // 00 = For ULA as blend color
  // 01 = For no blending
  // 10 = For ULA/Tilemap mix result as blend color
  // 11 = For tilemap as blend color
  blendingInSLUModes6And7: number;
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
  borderRgbCache: number;

  // Cached fallback RGB333 (NextReg 0x4A expanded from RGB332 to RGB333)
  // Updated when fallbackColor, ulaNextEnabled, or ulaNextFormat change
  fallbackRgb333Cache: number;

  // === Timex port (0xff) ULA flags
  // The last 6 bit of the Timex port
  timexPortBits: number;
  // The start of the standard screen memory (true = 0x4000, false = 0x6000)
  standardScreenAt0x4000: boolean;
  // Is in ULA HiRes mode? true = HiRes mode, 512×192 monochrome, even columns
  // at 0x4000, odd at 0x6000
  ulaHiResMode: boolean;
  ulaHiResModeSampled: boolean;

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
  ulaHiResColorSampled: number;

  // Is in ULA HiColor mode? true = HiColor mode, 256×192 pixels at 0x4000,
  // 32×192 attributes at 0x6000
  ulaHiColorMode: boolean;
  ulaHiColorModeSampled: boolean;

  // === Layer 2 port (0x123b) flags
  layer2Enabled: boolean;
  layer2Bank: number;
  layer2BankOffset: number; // 3-bit offset applied to bank address (bits 2:0 when port bit 4=1)
  layer2UseShadowBank: boolean;
  layer2EnableMappingForReads: boolean;
  layer2EnableMappingForWrites: boolean;

  // === Layer 2 bank properties (interface compatibility)
  // These are aliases for layer2ActiveRamBank and layer2ShadowRamBank
  get layer2ActiveBank(): number {
    return this.layer2ActiveRamBank;
  }

  set layer2ActiveBank(value: number) {
    this.layer2ActiveRamBank = value;
  }

  get layer2ShadowBank(): number {
    return this.layer2ShadowRamBank;
  }

  set layer2ShadowBank(value: number) {
    this.layer2ShadowRamBank = value;
  }

  // === ULA+ Mode/Index register port (0xbf3b)
  private _ulaPlusEnabled: boolean;
  ulaPlusMode: number;
  ulaPlusPaletteIndex: number;

  get ulaPlusEnabled(): boolean {
    return this._ulaPlusEnabled;
  }

  set ulaPlusEnabled(value: boolean) {
    this._ulaPlusEnabled = value;
    // Border palette index changes when ULA+ mode is toggled
    this.updateBorderRgbCache();
  }

  // === ULANext mode (NextReg 0x42, 0x43)
  private _ulaNextEnabled: boolean;
  ulaNextFormat: number; // Attribute byte format mask (NextReg 0x42)

  get ulaNextEnabled(): boolean {
    return this._ulaNextEnabled;
  }

  set ulaNextEnabled(value: boolean) {
    this._ulaNextEnabled = value;
    // Border palette index changes when ULANext mode is toggled
    this.updateBorderRgbCache();
    // Fallback color may be used in ULANext mode
    this.updateFallbackRgb333Cache();
  }

  /**
   * This buffer stores the bitmap of the screen being rendered. Each 32-bit value represents an ARGB pixel.
   */
  private _pixelBuffer: Uint32Array;

  // ULA address lookup tables (references to module-level shared tables)
  ulaPixelLineBaseAddr: Uint16Array;
  ulaAttrLineBaseAddr: Uint16Array;

  // ULA rendering state
  ulaScrollXSampled: number;
  ulaScrollYSampled: number;
  ulaPixelByte1: number;
  ulaPixelByte2: number;
  ulaPixelByte3: number;
  ulaPixelByte4: number;
  floatingBusValue: number;
  ulaAttrByte1: number;
  ulaAttrByte2: number;
  ulaShiftReg: number;
  ulaShiftAttr: number;
  ulaShiftAttr2: number;
  ulaShiftAttrCount: number;

  // ULA Hi-Res rendering state
  ulaHiResInkRgb333: number;
  ulaHiResPaperRgb333: number;

  // Active attribute lookup tables (references to module-level tables, switch based on flash state)
  activeAttrToInk: Uint8Array;
  activeAttrToPaper: Uint8Array;

  // ULA+ attribute decode lookup tables (references to module-level shared tables)
  ulaPlusAttrToInk: Uint8Array;
  ulaPlusAttrToPaper: Uint8Array;

  // renderTact internal state
  private ulaPixel1Rgb333: number | null;
  private ulaPixel1Transparent: boolean;
  private ulaPixel2Rgb333: number | null;
  private ulaPixel2Transparent: boolean;
  private layer2Pixel1Rgb333: number | null;
  private layer2Pixel1Transparent: boolean;
  private layer2Pixel1Priority: boolean;
  private layer2Pixel2Rgb333: number | null;
  private layer2Pixel2Transparent: boolean;
  private layer2Pixel2Priority: boolean;
  private tilemapPixel1Rgb333: number | null;
  private tilemapPixel1Transparent: boolean;
  private tilemapPixel2Rgb333: number | null;
  private tilemapPixel2Transparent: boolean;
  private spritesPixel1Rgb333: number | null;
  private spritesPixel1Transparent: boolean;
  private spritesPixel2Rgb333: number | null;
  private spritesPixel2Transparent: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    // Screen dimensions
    this.screenWidth = BITMAP_WIDTH;
    this.screenLines = BITMAP_HEIGHT;

    // Initialize all module-level lookup tables (lazy initialization)
    initializeAllLookupTables();

    // Get references to module-level ULA address lookup tables
    this.ulaPixelLineBaseAddr = getUlaPixelLineBaseAddr();
    this.ulaAttrLineBaseAddr = getUlaAttrLineBaseAddr();

    // Initialize active attribute lookup tables (default to flash off)
    this.activeAttrToInk = getAttrToInkFlashOff();
    this.activeAttrToPaper = getAttrToPaperFlashOff();

    // Get references to module-level ULA+ attribute tables
    this.ulaPlusAttrToInk = getUlaPlusAttrToInk();
    this.ulaPlusAttrToPaper = getUlaPlusAttrToPaper();

    this.reset();
  }

  // Delegate LoRes properties to loResDevice (NextReg 0x6A)
  get loResMode(): number {
    return this.machine.loResDevice.isRadastanMode ? 1 : 0;
  }

  get loresPaletteOffset(): number {
    return this.machine.loResDevice.paletteOffset;
  }

  get timexDFile(): number {
    return this.machine.loResDevice.radastanTimexXor ? 1 : 0;
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
    this.ulaScrollXSampled = 0;
    this.ulaScrollYSampled = 0;
    this.ulaPixelByte1 = 0;
    this.ulaPixelByte2 = 0;
    this.floatingBusValue = 0;
    this.ulaAttrByte1 = 0;
    this.ulaAttrByte2 = 0;
    this.ulaShiftReg = 0;

    this.timexPortBits = 0;
    this.standardScreenAt0x4000 = true;
    this.ulaHiResMode = false;
    this.ulaHiResModeSampled = false;
    this.ulaHiResColor = 0;
    this.ulaHiResColorSampled = 0;
    this.ulaHiColorMode = false;
    this.ulaHiColorModeSampled = false;

    // --- Initialize LoRes state
    this.loResEnabled = false;
    this.loResEnabledSampled = false;
    this.loResModeSampled = 0;
    this.loResBlockByte = 0;
    this.loResScrollXSampled = 0;
    this.loResScrollYSampled = 0;

    // --- Initialize ULA+ state
    this._ulaPlusEnabled = false;
    this.ulaPlusMode = 0;
    this.ulaPlusPaletteIndex = 0;

    // --- Initialize ULANext state
    this._ulaNextEnabled = false;
    this.ulaNextFormat = 0x0f; // Default: 4-bit INK, 4-bit PAPER

    // --- Initialize Layer 2 state
    this.layer2Enabled = false; // Port 0x123B bit 1: disabled by default
    this.layer2Resolution = 0; // NextReg 0x70 bits [5:4]: 256x192 by default
    this.layer2PaletteOffset = 0; // NextReg 0x70 bits [3:0]: no offset by default
    this.layer2ScrollX = 0; // NextReg 0x16 + 0x71 bit 0: no scroll
    this.layer2ScrollY = 0; // NextReg 0x17: no scroll
    this.layer2ClipWindowX1 = 0; // NextReg 0x18 write 1: left edge
    this.layer2ClipWindowX2 = 255; // NextReg 0x18 write 2: right edge (255 for 256x192)
    this.layer2ClipWindowY1 = 0; // NextReg 0x18 write 3: top edge
    this.layer2ClipWindowY2 = 191; // NextReg 0x18 write 4: bottom edge (191 for 256x192)
    this.layer2ClipIndex = 0; // Clip window write index
    this.layer2ActiveRamBank = 8; // NextReg 0x12: default to bank 8 (soft reset value)
    this.layer2ShadowRamBank = 11; // NextReg 0x13: default to bank 11 (soft reset value)
    this.layer2UseShadowBank = false; // Port 0x123B bit 3: use active bank by default
    this.layer2Bank = 0; // Port 0x123B bits [7:6] + bit 3: mapping bank selector
    this.layer2EnableMappingForReads = false; // Port 0x123B bit 2: memory mapping disabled
    this.layer2EnableMappingForWrites = false; // Port 0x123B bit 0: memory mapping disabled
    this.machine.memoryDevice.updateFastPathFlags();

    // --- Initialize renderTact internal state
    this.ulaPixel1Rgb333 = null;
    this.ulaPixel1Transparent = false;
    this.ulaPixel2Rgb333 = null;
    this.ulaPixel2Transparent = false;
    this.layer2Pixel1Rgb333 = null;
    this.layer2Pixel1Transparent = false;
    this.layer2Pixel1Priority = false;
    this.layer2Pixel2Rgb333 = null;
    this.layer2Pixel2Transparent = false;
    this.layer2Pixel2Priority = false;
    this.tilemapPixel1Rgb333 = null;
    this.tilemapPixel1Transparent = false;
    this.tilemapPixel2Rgb333 = null;
    this.tilemapPixel2Transparent = false;
    this.spritesPixel1Rgb333 = null;
    this.spritesPixel1Transparent = false;
    this.spritesPixel2Rgb333 = null;
    this.spritesPixel2Transparent = false;

    this.displayTiming = 0;
    this.userLockOnDisplayTiming = false;
    this.machineType = 0;
    this.videoTimingMode = 0;

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

  getIntSignal(): boolean {
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
    this.updateBorderRgbCache();
  }

  /**
   * Update the cached border RGB value from the current palette
   * Called by PaletteDevice when:
   * - ULA palette colors change
   * - Active palette switches (first <-> second)
   *
   * When ULA+ is enabled, border goes through ULA+ palette lookup.
   * VHDL: border_clr = "00" & border_color & border_color
   * ULA+ palette index = "11" & attr[7:6] & "1" & attr[5:3]
   *                    = "11" & "00" & "1" & border_color
   *                    = 192 + 8 + border_color = 200 + border_color
   */
  updateBorderRgbCache(): void {
    if (this._ulaPlusEnabled) {
      // ULA+: Border uses palette indices 200-207 (for border colors 0-7)
      const ulaPlusPaletteIndex = 200 + this._borderColor;
      this.borderRgbCache = this.machine.paletteDevice.getUlaRgb333(ulaPlusPaletteIndex);
    } else {
      // Standard: Border uses palette indices 0-7
      this.borderRgbCache = this.machine.paletteDevice.getUlaRgb333(this._borderColor);
    }
  }

  /**
   * Updates the cached fallback RGB333 value when fallback color changes.
   * The fallback color (NextReg 0x4A) is stored as 8-bit RGB332 and needs
   * to be expanded to 9-bit RGB333 for rendering.
   * This cache is used in ULANext mode when format mask is 0xFF.
   */
  private updateFallbackRgb333Cache(): void {
    const fallbackRgb332 = this._fallbackColor;
    const blueLSB = (fallbackRgb332 & 0x02) | (fallbackRgb332 & 0x01);
    this.fallbackRgb333Cache = (fallbackRgb332 << 1) | blueLSB;
  }

  maxTacts: number;

  /**
   * Render the pixel pair belonging to the specified frame tact.
   * @param tact Frame tact to render
   */
  renderTact(tact: number): boolean {
    // Check if interrupt signal is active (simple range check)
    if (tact > this.maxTacts) {
      this.maxTacts = tact;
    }

    this._pulseIntActive = tact >= this.confIntStartTact && tact < this.confIntEndTact;

    // === BLANKING CHECK ===
    // All rendering flags have identical blanking regions (cell value 0) for a given frequency mode.
    // We can use active ULA rendering flags as the blanking mask for all layers.
    // If the cell is 0 in this flags array, it's 0 in all other flags arrays (blanking region).
    // Since totalHC == RENDERING_FLAGS_HC_COUNT, tact directly equals the 1D array index.
    if (getActiveRenderingFlagsULA()[tact] === 0) {
      return false; // Skip blanking tact - no visible content in any layer
    }

    // --- Get pre-calculated (HC, VC) position from lookup tables
    const hc = getActiveTactToHC()[tact];
    const vc = getActiveTactToVC()[tact];

    // === ULA rendering
    if (this.loResEnabledSampled) {
      // LoRes mode (128×96, replaces ULA output)
      const loresCell = getActiveRenderingFlagsLoRes()[tact];
      this.renderLoResPixel(vc, hc, loresCell);
    } else if (!this.disableUlaOutputSampled) {
      if (this.ulaHiResModeSampled || this.ulaHiColorModeSampled) {
        // ULA Hi-Res and Hi-Color modes
        if (this.ulaHiResModeSampled) {
          // ULA Hi-Res mode (512×192, 2 pixels per HC)
          const ulaCell = getActiveRenderingFlagsULA()[tact];
          this.renderULAHiResPixel(vc, hc, ulaCell);
        } else {
          // ULA Hi-Color mode (256×192)
          const ulaCell = getActiveRenderingFlagsULA()[tact];
          this.renderULAHiColorPixel(vc, hc, ulaCell);
        }
      } else {
        // ULA Standard mode (256×192)
        const ulaCell = getActiveRenderingFlagsULA()[tact];
        this.renderULAStandardPixel(vc, hc, ulaCell);
      }
    }

    // Render Layer 2 pixel(s) if enabled
    if (this.layer2Enabled) {
      if (this.layer2Resolution === 0) {
        // Layer 2 256×192 mode
        const layer2Cell = getActiveRenderingFlagsLayer2_256x192()[tact];
        this.renderLayer2_256x192Pixel(vc, hc, layer2Cell);
      } else if (this.layer2Resolution === 1) {
        // Layer 2 320×256 mode
        const layer2Cell = getActiveRenderingFlagsLayer2_320x256()[tact];
        this.renderLayer2_320x256Pixel(vc, hc, layer2Cell);
      } else if (this.layer2Resolution === 2) {
        // Layer 2 640×256 mode (Hi-Res, 2 pixels per HC)
        const layer2Cell = getActiveRenderingFlagsLayer2_640x256()[tact];
        this.renderLayer2_640x256Pixel(vc, hc, layer2Cell);
      }
    }

    // Render Sprites pixel(s) if enabled
    if (this.spritesEnabled) {
      const spritesCell = getActiveRenderingFlagsSprites()[tact];
      this.renderSpritesPixel(vc, hc, spritesCell);
    }

    // Render Tilemap pixel(s) if enabled
    if (this.tilemapEnabled) {
      if (this.tilemap80x32Resolution) {
        // Tilemap 80×32 mode (Hi-Res, 2 pixels per HC)
        const tilemapCell = getActiveRenderingFlagsTilemap_80x32()[tact];
        this.renderTilemap_80x32Pixel(vc, hc, tilemapCell);
      } else {
        // Tilemap 40×32 mode
        const tilemapCell = getActiveRenderingFlagsTilemap_40x32()[tact];
        this.renderTilemap_40x32Pixel(vc, hc, tilemapCell);
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
    if (this.tilemapEnabled && this.tilemapPixel1Rgb333 !== null) {
      if (
        this.ulaPixel1Rgb333 != null &&
        !this.ulaPixel1Transparent &&
        !this.tilemapPixel1Transparent
      ) {
        // Both non-transparent: apply tm_pixel_below logic
        // TODO: Read tm_pixel_below from tilemap attributes
        // For now, tilemap on top (simplified)
        this.ulaPixel1Rgb333 = this.tilemapPixel1Rgb333;
        this.ulaPixel1Transparent = this.tilemapPixel1Transparent;
      } else if (!this.tilemapPixel1Transparent) {
        // Only tilemap non-transparent
        this.ulaPixel1Rgb333 = this.tilemapPixel1Rgb333;
        this.ulaPixel1Transparent = this.tilemapPixel1Transparent;
      }
      // If only ULA non-transparent, keep ulaOutput1 as-is
    }

    if (this.tilemapEnabled && this.tilemapPixel2Rgb333 !== null) {
      if (
        this.ulaPixel2Rgb333 != null &&
        !this.ulaPixel2Transparent &&
        !this.tilemapPixel2Transparent
      ) {
        this.ulaPixel2Rgb333 = this.tilemapPixel2Rgb333;
        this.ulaPixel2Transparent = this.tilemapPixel2Transparent;
      } else if (!this.tilemapPixel2Transparent) {
        this.ulaPixel2Rgb333 = this.tilemapPixel2Rgb333;
        this.ulaPixel2Transparent = this.tilemapPixel2Transparent;
      }
    }

    // Use pre-calculated bitmap offset to write pixels
    const bitmapOffset = getActiveTactToBitmapOffset()[tact];
    if (bitmapOffset >= 0) {
      // Compose and write first pixel
      const pixelRGBA1 = this.composeSinglePixel(
        this.ulaPixel1Rgb333,
        this.ulaPixel1Transparent,
        this.layer2Pixel1Rgb333,
        this.layer2Pixel1Transparent,
        this.layer2Pixel1Priority,
        this.spritesPixel1Rgb333,
        this.spritesPixel1Transparent
      );
      this._pixelBuffer[bitmapOffset] = pixelRGBA1;

      // Compose and write second pixel
      const pixelRGBA2 = this.composeSinglePixel(
        this.ulaPixel2Rgb333,
        this.ulaPixel2Transparent,
        this.layer2Pixel2Rgb333,
        this.layer2Pixel2Transparent,
        this.layer2Pixel2Priority,
        this.spritesPixel2Rgb333,
        this.spritesPixel2Transparent
      );
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
    this.sampleNextRegistersForUlaMode();
    for (let tact = 0; tact < this.renderingTacts; tact++) {
      this.renderTact(tact);
    }
    return this._pixelBuffer;
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
    this.machine.setTactsInFrame(this.renderingTacts);

    // --- Update module-level active timing mode cache
    setActiveTimingMode(is60Hz);

    // Increment flash counter (cycles 0-31 for ~1 Hz flash rate at 50Hz)
    // Flash period: ~16 frames ON, ~16 frames OFF
    // Full cycle: ~32 frames (~0.64s at 50Hz, ~0.55s at 60Hz)
    this._flashCounter = (this._flashCounter + 1) & 0x1f;
    const newFlashFlag = this._flashCounter >= 16;

    // Switch active attribute lookup tables when flash state changes
    if (newFlashFlag !== this.flashFlag) {
      this.flashFlag = newFlashFlag;
      if (this.flashFlag) {
        this.activeAttrToInk = getAttrToInkFlashOn();
        this.activeAttrToPaper = getAttrToPaperFlashOn();
      } else {
        this.activeAttrToInk = getAttrToInkFlashOff();
        this.activeAttrToPaper = getAttrToPaperFlashOff();
      }
    }

    if (oldConfig !== this.config) {
      // Re-initialize bitmap when switching between 50Hz and 60Hz
      // This ensures proper centering of 60Hz content
      this.initializeBitmap();
    }

    // --- Initialize renderTact internal state
    this.ulaPixel1Rgb333 = null;
    this.ulaPixel1Transparent = false;
    this.ulaPixel2Rgb333 = null;
    this.ulaPixel2Transparent = false;
    this.layer2Pixel1Rgb333 = null;
    this.layer2Pixel1Transparent = false;
    this.layer2Pixel1Priority = false;
    this.layer2Pixel2Rgb333 = null;
    this.layer2Pixel2Transparent = false;
    this.layer2Pixel2Priority = false;
    this.tilemapPixel1Rgb333 = null;
    this.tilemapPixel1Transparent = false;
    this.tilemapPixel2Rgb333 = null;
    this.tilemapPixel2Transparent = false;
    this.spritesPixel1Rgb333 = null;
    this.spritesPixel1Transparent = false;
    this.spritesPixel2Rgb333 = null;
    this.spritesPixel2Transparent = false;
  }

  // ==============================================================================================
  // Port updates
  set timexPortValue(value: number) {
    this.timexPortBits = value & 0x3f;
    this.ulaHiResColor = (value >> 3) & 0x07;
    this.ulaHiResInkRgb333 = this.machine.paletteDevice.getUlaRgb333(this.ulaHiResColor);
    this.ulaHiResPaperRgb333 = this.machine.paletteDevice.getUlaRgb333(7 - this.ulaHiResColor);
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
   * Note: Reading always returns the mode 0 format (bit 4 = 0), the offset is write-only
   */
  get port0x123bValue(): number {
    const value =
      (this.layer2Bank << 6) |
      (this.layer2UseShadowBank ? 0x08 : 0x00) |
      (this.layer2EnableMappingForReads ? 0x04 : 0x00) |
      (this.layer2Enabled ? 0x02 : 0x00) |
      (this.layer2EnableMappingForWrites ? 0x01 : 0x00);
    return value;
  }

  /**
   * Updates the memory configuration based on the new 0x123b port value
   * Bit 4 determines the mode:
   *   - If bit 4 = 0: Normal mode - sets segment, shadow, read/write enables
   *   - If bit 4 = 1: Offset mode - sets 3-bit bank offset (bits 2:0)
   */
  set port0x123bValue(value: number) {
    if ((value & 0x10) === 0) {
      // Mode 0 (bit 4 = 0): Normal configuration mode
      this.layer2Bank = (value & 0xc0) >> 6;
      this.layer2UseShadowBank = (value & 0x08) !== 0;
      this.layer2EnableMappingForReads = (value & 0x04) !== 0;
      this.layer2Enabled = (value & 0x02) !== 0;
      this.layer2EnableMappingForWrites = (value & 0x01) !== 0;
    } else {
      // Mode 1 (bit 4 = 1): Bank offset mode
      this.layer2BankOffset = value & 0x07;
    }
    this.machine.memoryDevice.updateFastPathFlags();
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
  get nextReg0x18Value(): number {
    switch (this.layer2ClipIndex) {
      case 0:
        return this.layer2ClipWindowX1;
      case 1:
        return this.layer2ClipWindowX2;
      case 2:
        return this.layer2ClipWindowY1;
      default:
        return this.layer2ClipWindowY2;
    }
  }

  /**
   * Sets the clip window cordinate according to the current clip index
   */
  set nextReg0x18Value(value: number) {
    switch (this.layer2ClipIndex) {
      case 0:
        this.layer2ClipWindowX1 = value;
        break;
      case 1:
        this.layer2ClipWindowX2 = value;
        break;
      case 2:
        this.layer2ClipWindowY1 = value;
        break;
      default:
        this.layer2ClipWindowY2 = value;
        break;
    }
    this.layer2ClipIndex = (this.layer2ClipIndex + 1) & 0x03;
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

  /**
   * NextReg 0x42 - ULANext Attribute Byte Format
   * Sets the mask indicating which bits of an attribute byte represent INK.
   * Other bits represent PAPER.
   */
  set nextReg0x42Value(value: number) {
    this.ulaNextFormat = value;
    this.updateFallbackRgb333Cache();
  }

  get nextReg0x42Value(): number {
    return this.ulaNextFormat;
  }

  /**
   * NextReg 0x43 - Palette Control
   * bit 0 = Enable ULANext mode
   */
  set nextReg0x43Value(value: number) {
    this.ulaNextEnabled = (value & 0x01) !== 0;
  }

  get nextReg0x43Value(): number {
    return this.ulaNextEnabled ? 0x01 : 0x00;
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
   * Render Sprites layer pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderSpritesPixel(_vc: number, _hc: number, _cell: number): void {
    // TODO: Implementation to be documented in a future section
    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
  }

  /**
   * Render Tilemap 80×32 mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderTilemap_80x32Pixel(_vc: number, _hc: number, _cell: number): void {
    // TODO: Implementation to be documented in a future section
    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
  }

  /**
   * Render Tilemap 40×32 mode pixel (Stage 1).
   * @param _vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param _cell - ULA Standard rendering cell with activity flags
   */
  private renderTilemap_40x32Pixel(_vc: number, _hc: number, _cell: number): void {
    // TODO: Implementation to be documented in a future section
    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
  }

  /**
   * Compose final pixel from layer outputs (Stage 2: Layer Composition).
   *
   * This method implements the layer composition logic as described in Section 4 of
   * the screen_rendering.md document. It combines up to three active layer outputs
   * (ULA, Layer 2, Sprites) into a single final RGB pixel based on priority settings,
   * transparency, and blend modes.
   *
   * **Process Flow** (based on VHDL analysis from zxnext.vhd lines 7040-7310):
   *
   * 1. **Pre-Composition Processing**:
   *    - ULA/Tilemap/LoRes transparency resolution (color comparison + clipped flag)
   *    - Stencil mode: Bitwise AND of ULA and Tilemap when both enabled
   *    - Blend mode setup: Prepare ULA/Tilemap mix layers for priority evaluation
   *
   * 2. **Priority Evaluation** (NextReg 0x15 bits [4:2]):
   *    Six standard priority modes (SLU, LSU, SUL, LUS, USL, ULS):
   *    - Evaluate layers in configured order
   *    - Layer 2 priority bit can override order (forces Layer 2 on top)
   *    - Select first non-transparent layer
   *    - Special case: ULA border doesn't cover sprites if tilemap transparent
   *
   * 3. **Color Mixing Modes** (NextReg 0x68 bits [7:6], modes 110 and 111):
   *    - Mode 110: Add Layer 2 and ULA/Tilemap blend, saturate at 7
   *    - Mode 111: Add Layer 2 and ULA/Tilemap blend, subtract 5 (darken), clamp 0-7
   *    - Mixed result used if Layer 2 has priority bit OR is only opaque layer
   *
   * 4. **Fallback Color**:
   *    - If all layers transparent: Use fallback/backdrop color (NextReg 0x4A)
   *    - Fallback looked up in ULA palette, expanded from 8 to 9 bits
   *
   * **Implementation Notes**:
   * - Clock domain: CLK_14 (14 MHz)
   * - Type: Purely combinational logic (no state between pixels)
   * - Latency: 0 additional cycles beyond palette lookup
   * - Total pipeline: ~3 CLK_14 cycles from counter to final RGB
   *
   * **Layer 2 Priority Bit**:
   * Layer 2 pixels carry extra priority bit (9th bit from palette):
   * - When set: Layer 2 overrides all priority rules (appears on top)
   * - In blend modes: Affects whether blend result is used
   * - Cleared when Layer 2 pixel is transparent
   *
   * @param ulaOutput - ULA layer output (RGB + transparency + clipped flags)
   * @param layer2Output - Layer 2 output (RGB + transparency + priority bit)
   * @param spritesOutput - Sprites output (RGB + transparency flags)
   * @returns Final RGBA pixel value (format: 0xAABBGGRR)
   */
  private composeSinglePixel(
    ulaPixelRgb333: number | null,
    ulaTransparent: boolean,
    layer2PixelRgb333: number | null,
    layer2Transparent: boolean,
    layer2Priority: boolean,
    spritesPixelRgb333: number | null,
    spritesTransparent: boolean
  ): number {
    // --- Combine sprites, Layer 2, and ULA outputs
    let selectedPixel: number | null = null;
    let selectedTransparent: boolean = false;

    // === Layer 2 Priority Override ===
    // If Layer 2 priority bit is set, it renders on top regardless of priority setting
    if (layer2PixelRgb333 != null && layer2Priority && !layer2Transparent) {
      selectedPixel = layer2PixelRgb333;
      selectedTransparent = layer2Transparent;
    } else {
      // Select first non-transparent layer in priority order
      switch (this.layerPriority) {
        case 0: // SLU
          if (spritesPixelRgb333 != null && !spritesTransparent) {
            selectedPixel = spritesPixelRgb333;
            selectedTransparent = spritesTransparent;
          } else if (layer2PixelRgb333 != null && !layer2Transparent) {
            selectedPixel = layer2PixelRgb333;
            selectedTransparent = layer2Transparent;
          } else {
            selectedPixel = ulaPixelRgb333;
            selectedTransparent = ulaTransparent;
          }
          break;

        case 1: // LSU
          if (layer2PixelRgb333 != null && !layer2Transparent) {
            selectedPixel = layer2PixelRgb333;
            selectedTransparent = layer2Transparent;
          } else if (spritesPixelRgb333 != null && !spritesTransparent) {
            selectedPixel = spritesPixelRgb333;
            selectedTransparent = spritesTransparent;
          } else {
            selectedPixel = ulaPixelRgb333;
            selectedTransparent = ulaTransparent;
          }
          break;

        case 2: // SUL
          if (spritesPixelRgb333 != null && !spritesTransparent) {
            selectedPixel = spritesPixelRgb333;
            selectedTransparent = spritesTransparent;
          } else if (ulaPixelRgb333 != null && !ulaTransparent) {
            selectedPixel = ulaPixelRgb333;
            selectedTransparent = ulaTransparent;
          } else {
            selectedPixel = layer2PixelRgb333;
            selectedTransparent = layer2Transparent;
          }
          break;

        case 3: // LUS
          if (layer2PixelRgb333 != null && !layer2Transparent) {
            selectedPixel = layer2PixelRgb333;
            selectedTransparent = layer2Transparent;
          } else if (ulaPixelRgb333 != null && !ulaTransparent) {
            selectedPixel = ulaPixelRgb333;
            selectedTransparent = ulaTransparent;
          } else {
            selectedPixel = spritesPixelRgb333;
            selectedTransparent = spritesTransparent;
          }
          break;

        case 4: // USL
          if (ulaPixelRgb333 != null && !ulaTransparent) {
            selectedPixel = ulaPixelRgb333;
            selectedTransparent = ulaTransparent;
          } else if (spritesPixelRgb333 != null && !spritesTransparent) {
            selectedPixel = spritesPixelRgb333;
            selectedTransparent = spritesTransparent;
          } else {
            selectedPixel = layer2PixelRgb333;
            selectedTransparent = layer2Transparent;
          }
          break;

        default:
          if (ulaPixelRgb333 != null && !ulaTransparent) {
            selectedPixel = ulaPixelRgb333;
            selectedTransparent = ulaTransparent;
          } else if (layer2PixelRgb333 != null && !layer2Transparent) {
            selectedPixel = layer2PixelRgb333;
            selectedTransparent = layer2Transparent;
          } else {
            selectedPixel = spritesPixelRgb333;
            selectedTransparent = spritesTransparent;
          }
          break;
      }
    }

    // === Fallback/Backdrop Color ===
    let finalRGB333: number;
    // If selected output is null or transparent, use fallback color
    if (selectedPixel === null || selectedTransparent) {
      // All layers transparent: use fallback color (NextReg 0x4A)
      // NextReg 0x4A is 8-bit RRRGGGBB, convert to 9-bit RGB
      const blueLSB = (this.fallbackColor & 0x02) | (this.fallbackColor & 0x01); // OR of blue bits
      finalRGB333 = (this.fallbackColor << 1) | blueLSB;
    } else {
      finalRGB333 = selectedPixel;
    }

    return zxNextBgra[finalRGB333 & 0x1ff]; // Convert to RGBA format
  }

  // ======================================================================================
  // ULA Helpers
  // ======================================================================================

  /**
   * Render ULA Standard pixel for the current tact position (Stage 1: Pixel Generation).
   *
   * This function executes Stage 1 of the rendering pipeline as described in Section 1.
   * It generates the ULA pixel color and flags but does NOT write to the bitmap.
   * The returned output will be combined with other layers in the composition stage.
   *
   * @param vc - Vertical counter position (ULA coordinate system)
   * @param hc - Horizontal counter position (ULA coordinate system)
   * @param cell - ULA Standard rendering cell flags (Uint16 bit flags)
   * @returns Layer output (RGB333 + flags) for composition stage
   */
  private renderULAStandardPixel(vc: number, hc: number, cell: ULAStandardCell): void {
    // === Display Area: ULA Standard Rendering ===
    // --- Scroll & mode sampling ---
    if ((cell & ULA_NREG_SAMPLE) !== 0) {
      this.sampleNextRegistersForUlaMode();

      // Calculate scrolled Y position with vertical scroll offset
      this.ulaScrollYSampled = vc - this.confDisplayYStart + this.ulaScrollYSampled;
      if (this.ulaScrollYSampled >= 0xc0) {
        this.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
      }
    }

    // --- Shift Register Load ---
    if ((cell & ULA_SHIFT_REG_LOAD) !== 0) {
      // Load pixel and attribute data into shift register
      // This prepares the next 8 pixels for output
      this.ulaShiftReg =
        ((((this.ulaPixelByte1 << 8) | this.ulaPixelByte2) << (this.ulaScrollXSampled & 0x07)) >>
          8) &
        0xff;
      this.ulaShiftAttr = this.ulaAttrByte1; // Load attribute byte 1
      this.ulaShiftAttr2 = this.ulaAttrByte2; // Load attribute byte 2
      this.ulaShiftAttrCount = 8 - (this.ulaScrollXSampled & 0x07); // Reset attribute shift counter
    }

    // --- Memory Read Activities ---
    if ((cell & ULA_BYTE1_READ) !== 0) {
      // --- Calculate pixel address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = this.ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;
      // Read pixel byte from Bank 5 or Bank 7
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);
      if (hc & 0x04) {
        this.ulaPixelByte2 = pixelByte;
      } else {
        this.ulaPixelByte1 = pixelByte;
      }

      // --- Update floating bus with pixel data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    if ((cell & ULA_BYTE2_READ) !== 0) {
      // --- Calculate attribute address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0a - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const attrAddr = this.ulaAttrLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

      // --- Read attribute byte from Bank 5 or Bank 7
      const ulaAttrByte = this.machine.memoryDevice.readScreenMemory(attrAddr);
      if (hc & 0x04) {
        this.ulaAttrByte2 = ulaAttrByte;
      } else {
        this.ulaAttrByte1 = ulaAttrByte;
      }

      // --- Update floating bus with attribute data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = ulaAttrByte;
      }
    }

    // === Border Area ===
    if ((cell & ULA_DISPLAY_AREA) === 0) {
      // Check if ULANext is enabled with mask 0xFF - if so, use fallback color
      if (this.ulaNextEnabled && this.ulaNextFormat === 0xff) {
        this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 =
          this.machine.composedScreenDevice.fallbackRgb333Cache;
        this.ulaPixel1Transparent = this.ulaPixel2Transparent = false;
        return;
      }

      // --- Use cached border RGB value (updated when borderColor changes)
      // --- This eliminates method call overhead for ~30% of pixels
      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = this.borderRgbCache;
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = false;
      return;
    }

    // // --- Pixel Generation ---
    // Generate pixel from shift register (happens every HC position)
    // Extract current pixel bit from shift register
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;
    const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
    const pixelBit = (this.ulaShiftReg >> (7 - pixelWithinByte)) & 0x01;

    let pixelRgb333: number;

    if (this.ulaNextEnabled) {
      // ULANext Mode: Use pre-calculated lookup tables
      // Eliminates all runtime computation (mask validation, bit shifting, etc.)
      const attr = this.ulaShiftAttr;
      const formatMask = this.ulaNextFormat;
      let paletteIndex: number;

      if (pixelBit) {
        // INK pixel: Direct lookup (range 0-127)
        paletteIndex = getULANextInkIndex(formatMask, attr);
      } else {
        // PAPER pixel: Lookup returns 128-255 or 255 for fallback
        paletteIndex = getULANextPaperIndex(formatMask, attr);

        if (paletteIndex === 255) {
          // Invalid mask or 0xFF: Use cached fallback color
          pixelRgb333 = this.machine.composedScreenDevice.fallbackRgb333Cache;
          paletteIndex = -1; // Skip palette lookup
        }
      }

      if (paletteIndex !== -1) {
        pixelRgb333 = this.machine.paletteDevice.getUlaRgb333(paletteIndex);
      }
    } else if (this.ulaPlusEnabled) {
      // ULA+ Mode: Use 64-color palette (indices 192-255 in ULA palette)
      // Use pre-calculated lookup tables - no bit operations needed
      const ulaPaletteIndex = pixelBit
        ? this.ulaPlusAttrToInk[this.ulaShiftAttr]
        : this.ulaPlusAttrToPaper[this.ulaShiftAttr];
      pixelRgb333 = this.machine.paletteDevice.getUlaRgb333(ulaPaletteIndex);
    } else {
      // Standard Mode: Use pre-calculated lookup tables with BRIGHT already applied
      // Direct palette index lookup (0-15) - no bit operations needed
      const paletteIndex = pixelBit
        ? this.activeAttrToInk[this.ulaShiftAttr]
        : this.activeAttrToPaper[this.ulaShiftAttr];
      pixelRgb333 = this.machine.paletteDevice.getUlaRgb333(paletteIndex);
    }

    this.ulaShiftAttrCount--;
    if (this.ulaShiftAttrCount === 0) {
      this.ulaShiftAttrCount = 8;
      this.ulaShiftAttr = this.ulaShiftAttr2; // Load attribute byte 2
    }

    // --- Clipping Test ---
    // Check if pixel is within ULA clip window (NextReg 0x1C, 0x1D)
    const clipped =
      displayHC < this.ulaClipWindowX1 ||
      displayHC > this.ulaClipWindowX2 ||
      displayVC < this.ulaClipWindowY1 ||
      displayVC > this.ulaClipWindowY2;

    // Return layer output for composition stage
    this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = pixelRgb333;
    this.ulaPixel1Transparent = this.ulaPixel2Transparent =
      pixelRgb333 >> 1 === this.globalTransparencyColor || clipped;
  }

  /**
   * Render ULA Hi-Res pixel for the current tact position (Stage 1: Pixel Generation).
   *
   * ULA Hi-Res mode (Timex Hi-Res mode):
   * - 512×192 monochrome display (double horizontal resolution)
   * - Uses BOTH memory read cycles for pixel data (not pixel + attribute like Standard mode)
   * - Bank 0 reads (HC 0x0/0x4/0x8/0xC): pixel data from 0x4000-0x57FF
   * - Bank 1 reads (HC 0x2/0x6/0xA/0xE): pixel data from 0x6000-0x77FF (via 0x2000 offset)
   * - Both reads use PIXEL addresses (not attribute addresses)
   * - Uses same 16-bit shift register as Standard mode
   * - 32-bit pre-shift value constructed with byte interleaving: [pbyte_hi][abyte_hi][pbyte_lo][abyte_lo]
   * - Color determined by ulaHiResColor register (0-7 for 8 ink/paper pairs from Timex port 0xFF)
   *
   * **ULA+ Compatibility**: ULA+ does NOT work correctly in Hi-Res mode. The hardware forces
   * palette index bit 3 to 1 (PAPER selection) when screen_mode[2]=1, making attribute-based
   * palette selection incompatible with Hi-Res mode. This function does not implement ULA+ logic.
   *
   * @param vc - Vertical counter position (ULA coordinate system)
   * @param hc - Horizontal counter position (ULA coordinate system)
   * @param cell - ULA Hi-Res rendering cell flags (Uint16 bit flags)
   * @returns Layer output (RGB333 + flags) for composition stage
   */
  private renderULAHiResPixel(vc: number, hc: number, cell: ULAHiResCell): void {
    // === Display Area: ULA Standard Rendering ===
    // --- Scroll & mode sampling ---
    if ((cell & ULA_NREG_SAMPLE) !== 0) {
      this.sampleNextRegistersForUlaMode();

      // Calculate scrolled Y position with vertical scroll offset
      this.ulaScrollYSampled = vc - this.confDisplayYStart + this.ulaScrollYSampled;
      if (this.ulaScrollYSampled >= 0xc0) {
        this.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
      }
    }

    // --- Shift Register Load ---
    if ((cell & ULA_SHIFT_REG_LOAD) !== 0) {
      // Load pixel and attribute data into shift register
      // This prepares the next 8 pixels for output
      this.ulaShiftReg =
        ((((this.ulaPixelByte1 << 24) |
          (this.ulaPixelByte2 << 16) |
          (this.ulaPixelByte3 << 8) |
          this.ulaPixelByte4) <<
          ((this.ulaScrollXSampled & 0x07) * 2)) >>
          16) &
        0xffff;
    }

    // --- Read pixel data from Bank 0
    if ((cell & ULA_BYTE1_READ) !== 0) {
      // Calculate pixel address (same Y-dependent address as Standard mode)
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = this.ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

      // Read from Bank 0 (0x4000-0x57FF range)
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);

      // Store in byte buffer based on which 8-HC group we're in
      // Pattern: HC 0x0→byte1, HC 0x4→byte2, HC 0x8→byte1, HC 0xC→byte2
      if (hc & 0x04) {
        this.ulaPixelByte3 = pixelByte; // Bank 0, second byte
      } else {
        this.ulaPixelByte1 = pixelByte; // Bank 0, first byte
      }

      // --- Update floating bus with pixel data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    // --- Read pixel data from Bank 1 at HC subcycles 0x2, 0x6, 0xA, 0xE
    if ((cell & ULA_BYTE2_READ) !== 0) {
      // Calculate pixel address with 0x2000 offset for Bank 1
      const baseCol = (hc + 0x0a - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = 0x2000 | this.ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

      // Read from Bank 1 (0x6000-0x77FF range via 0x2000 offset)
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);

      // Store in byte buffer based on which 8-HC group we're in
      if (hc & 0x04) {
        this.ulaPixelByte4 = pixelByte; // Bank 1, second byte
      } else {
        this.ulaPixelByte2 = pixelByte; // Bank 1, first byte
      }

      // --- Update floating bus with pixel data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    // === Border Area ===
    if ((cell & ULA_BORDER_AREA) !== 0) {
      let borderRgb333: number;

      // Check if ULANext is enabled with mask 0xFF - if so, use fallback color
      if (this.ulaNextEnabled && this.ulaNextFormat === 0xff) {
        // ULANext with 0xFF mask: Border uses fallback color
        borderRgb333 = this.machine.composedScreenDevice.fallbackRgb333Cache;
      } else {
        // Standard border: use paper color from HiRes mode
        borderRgb333 = this.ulaHiResPaperRgb333;
      }

      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = borderRgb333;
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = false;
      return;
    }

    // --- Pixel Generation ---
    // Generate pixel from shift register (happens every HC position)
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;
    const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
    const pixelBit1 = (this.ulaShiftReg >> (2 * (7 - pixelWithinByte) + 1)) & 0x01;
    const pixelBit2 = (this.ulaShiftReg >> (2 * (7 - pixelWithinByte))) & 0x01;

    let pixel1Rgb333: number;
    let pixel2Rgb333: number;

    // Note: ULANext in HiRes mode is not practical but supported by hardware
    // HiRes mode doesn't use standard attributes, so ULANext produces unpredictable results
    if (this.ulaNextEnabled) {
      // ULANext mode: Use pre-calculated lookup tables (simplified for HiRes)
      // Hardware-accurate but produces unpredictable colors in HiRes mode
      const attr = this.ulaShiftAttr;
      const formatMask = this.ulaNextFormat;

      // For each pixel bit, use lookup table (INK for 1, PAPER for 0)
      const index1 = pixelBit1
        ? getULANextInkIndex(formatMask, attr)
        : getULANextPaperIndex(formatMask, attr);
      const index2 = pixelBit2
        ? getULANextInkIndex(formatMask, attr)
        : getULANextPaperIndex(formatMask, attr);

      // Handle fallback color if needed (index 255)
      pixel1Rgb333 =
        index1 === 255
          ? this.machine.composedScreenDevice.fallbackRgb333Cache
          : this.machine.paletteDevice.getUlaRgb333(index1);
      pixel2Rgb333 =
        index2 === 255
          ? this.machine.composedScreenDevice.fallbackRgb333Cache
          : this.machine.paletteDevice.getUlaRgb333(index2);
    } else {
      // Standard HiRes mode: use predefined ink/paper colors
      pixel1Rgb333 = pixelBit1 ? this.ulaHiResInkRgb333 : this.ulaHiResPaperRgb333;
      pixel2Rgb333 = pixelBit2 ? this.ulaHiResInkRgb333 : this.ulaHiResPaperRgb333;
    }

    // --- Clipping Test ---
    const clipped =
      displayHC < this.ulaClipWindowX1 ||
      displayHC > this.ulaClipWindowX2 ||
      displayVC < this.ulaClipWindowY1 ||
      displayVC > this.ulaClipWindowY2;

    this.ulaPixel1Rgb333 = pixel1Rgb333;
    this.ulaPixel1Transparent = pixel1Rgb333 >> 1 === this.globalTransparencyColor || clipped;
    this.ulaPixel2Rgb333 = pixel2Rgb333;
    this.ulaPixel2Transparent = pixel2Rgb333 >> 1 === this.globalTransparencyColor || clipped;
  }

  /**
   * Render ULA Hi-Color pixel for the current tact position (Stage 1: Pixel Generation).
   *
   * ULA Hi-Color mode (Timex Hi-Color mode):
   * - 256×192 color display (standard horizontal resolution)
   * - Uses BOTH memory read cycles: pixel data from one bank, color attributes from another
   * - Bank 0 reads (HC 0x0/0x4/0x8/0xC): pixel data from 0x4000-0x57FF (8×8 pixel blocks)
   * - Bank 1 reads (HC 0x2/0x6/0xA/0xE): color data from 0x6000-0x77FF (32×192 attributes via 0x2000 offset)
   * - Each pixel byte defines 8 pixels (like standard mode)
   * - Color data: 8 bits per pixel column (not per 8×8 block like standard attributes)
   * - Uses 8-bit shift register for pixels (standard resolution)
   * - Color format: same as standard attributes (FLASH, BRIGHT, PAPER, INK)
   *
   * **ULA+ Compatibility**: ULA+ does NOT work correctly in Hi-Color mode. The hardware forces
   * palette index bit 3 to 1 (PAPER selection) when screen_mode[2]=1, making attribute-based
   * palette selection incompatible with Hi-Color mode. This function does not implement ULA+ logic.
   *
   * @param vc - Vertical counter position (ULA coordinate system)
   * @param hc - Horizontal counter position (ULA coordinate system)
   * @param cell - ULA Hi-Color rendering cell flags (Uint16 bit flags)
   * @returns Pair of layer outputs (RGB333 + flags) for composition stage
   */
  private renderULAHiColorPixel(vc: number, hc: number, cell: ULAHiResCell): void {
    // === Display Area: ULA Standard Rendering ===
    // --- Scroll & mode sampling ---
    if ((cell & ULA_NREG_SAMPLE) !== 0) {
      this.sampleNextRegistersForUlaMode();

      // Calculate scrolled Y position with vertical scroll offset
      this.ulaScrollYSampled = vc - this.confDisplayYStart + this.ulaScrollYSampled;
      if (this.ulaScrollYSampled >= 0xc0) {
        this.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
      }
    }

    // --- Shift Register Load ---
    if ((cell & ULA_SHIFT_REG_LOAD) !== 0) {
      // Load pixel and attribute data into shift register
      // This prepares the next 8 pixels for output
      this.ulaShiftReg =
        ((((this.ulaPixelByte1 << 8) | this.ulaPixelByte2) << (this.ulaScrollXSampled & 0x07)) >>
          8) &
        0xff;
      this.ulaShiftAttr = this.ulaAttrByte1; // Load attribute byte 1
      this.ulaShiftAttr2 = this.ulaAttrByte2; // Load attribute byte 2
      this.ulaShiftAttrCount = 8 - (this.ulaScrollXSampled & 0x07); // Reset attribute shift counter
    }

    // --- Memory Read Activities ---
    if ((cell & ULA_BYTE1_READ) !== 0) {
      // --- Calculate pixel address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = this.ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;
      // Read pixel byte from Bank 5 or Bank 7
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);
      if (hc & 0x04) {
        this.ulaPixelByte2 = pixelByte;
      } else {
        this.ulaPixelByte1 = pixelByte;
      }

      // --- Update floating bus with pixel data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    if ((cell & ULA_BYTE2_READ) !== 0) {
      // --- Calculate attribute address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0a - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const attrAddr = 0x2000 | this.ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

      // --- Read attribute byte from Bank 5 or Bank 7
      const ulaAttrByte = this.machine.memoryDevice.readScreenMemory(attrAddr);
      if (hc & 0x04) {
        this.ulaAttrByte2 = ulaAttrByte;
      } else {
        this.ulaAttrByte1 = ulaAttrByte;
      }

      // --- Update floating bus with attribute data
      if ((cell & ULA_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = ulaAttrByte;
      }
    }

    // === Border Area ===
    if ((cell & ULA_DISPLAY_AREA) === 0) {
      // Check if ULANext is enabled with mask 0xFF - if so, use fallback color
      if (this.ulaNextEnabled && this.ulaNextFormat === 0xff) {
        this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 =
          this.machine.composedScreenDevice.fallbackRgb333Cache;
        this.ulaPixel1Transparent = this.ulaPixel2Transparent = false;
        return;
      }

      // --- Use cached border RGB value (updated when borderColor changes)
      // --- This eliminates method call overhead for ~30% of pixels
      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = this.borderRgbCache;
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = false;
      return;
    }

    // // --- Pixel Generation ---
    // Generate pixel from shift register (happens every HC position)
    // Extract current pixel bit from shift register
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;
    const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
    const pixelBit = (this.ulaShiftReg >> (7 - pixelWithinByte)) & 0x01;

    let pixelRgb333: number;

    // Note: ULANext in HiColor mode is not practical but supported by hardware
    // HiColor uses different attribute format (per-column colors), so ULANext produces unpredictable results
    if (this.ulaNextEnabled) {
      // ULANext mode: Use pre-calculated lookup tables
      // Hardware-accurate but produces unpredictable colors in HiColor mode
      const attr = this.ulaShiftAttr;
      const formatMask = this.ulaNextFormat;
      let paletteIndex: number;

      if (pixelBit) {
        // INK pixel: Direct lookup
        paletteIndex = getULANextInkIndex(formatMask, attr);
      } else {
        // PAPER pixel: Direct lookup (may return 255 for fallback)
        paletteIndex = getULANextPaperIndex(formatMask, attr);

        if (paletteIndex === 255) {
          // Use cached fallback color
          pixelRgb333 = this.machine.composedScreenDevice.fallbackRgb333Cache;
          paletteIndex = -1; // Skip palette lookup
        }
      }

      if (paletteIndex !== -1) {
        pixelRgb333 = this.machine.paletteDevice.getUlaRgb333(paletteIndex);
      }
    } else {
      // Standard HiColor mode: Use pre-calculated lookup tables with BRIGHT already applied
      // Direct palette index lookup (0-15) - no bit operations needed
      const paletteIndex = pixelBit
        ? this.activeAttrToInk[this.ulaShiftAttr]
        : this.activeAttrToPaper[this.ulaShiftAttr];
      pixelRgb333 = this.machine.paletteDevice.getUlaRgb333(paletteIndex);
    }

    this.ulaShiftAttrCount--;
    if (this.ulaShiftAttrCount === 0) {
      this.ulaShiftAttrCount = 8;
      this.ulaShiftAttr = this.ulaShiftAttr2; // Load attribute byte 2
    }

    // --- Clipping Test ---
    // Check if pixel is within ULA clip window (NextReg 0x1C, 0x1D)
    const clipped =
      displayHC < this.ulaClipWindowX1 ||
      displayHC > this.ulaClipWindowX2 ||
      displayVC < this.ulaClipWindowY1 ||
      displayVC > this.ulaClipWindowY2;

    // Return layer output for composition stage
    this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = pixelRgb333;
    this.ulaPixel1Transparent = this.ulaPixel2Transparent =
      pixelRgb333 >> 1 === this.globalTransparencyColor || clipped;
  }

  /**
   * Render LoRes pixel for the current tact position (Stage 1: Pixel Generation).
   *
   * LoRes mode (Radastan mode from ZX Uno):
   * - 128×96 resolution in standard 256×192 display area (each LoRes pixel = 2×2 ULA pixels)
   * - Two sub-modes:
   *   * Standard LoRes: 8-bit color (256 colors), $4000-$57FF top, $6000-$77FF bottom
   *   * Radastan LoRes: 4-bit color (16 colors), uses Timex dfile selector
   * - Each memory byte covers a 2×2 pixel block (standard) or 2×4 block (radastan, 2 nibbles)
   * - Simpler addressing than ULA: y(7:1) & x(7:1) for standard, linear with y/2
   * - No shift register needed: pixels replicated directly from block byte
   * - Scrolling wraps at 192 lines (like ULA), not 96
   *
   * @param vc - Vertical counter position (ULA coordinate system)
   * @param hc - Horizontal counter position (ULA coordinate system)
   * @param cell - LoRes rendering cell flags (Uint16 bit flags)
   * @returns Layer output (RGB333 + flags) for composition stage
   */
  private renderLoResPixel(vc: number, hc: number, cell: LoResCell): void {
    // === STAGE 1: Scroll & Mode Sampling ===
    if ((cell & LORES_NREG_SAMPLE) !== 0) {
      // Sample scroll registers and mode flags
      this.loResScrollXSampled = this.ulaScrollX;
      this.loResScrollYSampled = this.ulaScrollY;
      this.loResEnabledSampled = this.loResEnabled;
      this.loResModeSampled = this.loResMode;
    }

    // === STAGE 2: Block Memory Fetch ===
    // Fetch every 2 HC positions (one LoRes block = 2×2 pixels in 256×192 space)
    // Standard mode: each byte = 2×2 pixels, Radastan: each byte = 2 nibbles for 2×4 pixels
    if ((cell & LORES_BLOCK_FETCH) !== 0) {
      // Calculate display coordinates
      const displayHC = hc - this.confDisplayXStart;
      const displayVC = vc - this.confDisplayYStart;

      // Apply scroll (matching VHDL: x <= hc_i(7 downto 0) + scroll_x_i)
      const x = (displayHC + this.loResScrollXSampled) & 0xff;

      // Apply Y scroll with 192-line wrap (matching VHDL logic)
      let y_pre = displayVC + this.loResScrollYSampled;
      let y: number;
      if (y_pre >= 192) {
        // Wrap: y(7 downto 6) <= (y_pre(7 downto 6) + 1)
        const upperBits = ((y_pre >> 6) + 1) & 0x03;
        y = (upperBits << 6) | (y_pre & 0x3f);
      } else {
        y = y_pre & 0xff;
      }

      // Fetch when entering new block horizontally
      // Standard mode: fetch when x[0]=0 (every 2 pixels)
      // Radastan mode: fetch when x[1:0]=0 (every 4 pixels)
      // Note: Y coordinate is already used in address calculation - we fetch on every scanline
      const shouldFetch = this.loResModeSampled === 0 ? (x & 0x01) === 0 : (x & 0x03) === 0;

      if (shouldFetch) {
        let blockAddr: number;

        if (this.loResModeSampled === 0) {
          // Standard LoRes: 8-bit color, 128×96 blocks
          // Address: y(7 downto 1) & x(7 downto 1) - from VHDL
          const lores_addr_pre = ((y >> 1) << 7) | (x >> 1);

          // Top/bottom half split: when y >= 96, increment bits 13:11 (adds 0x0800)
          // VHDL: lores_addr(13 downto 11) <= (lores_addr_pre(13 downto 11) + 1)
          blockAddr = y >= 96 ? lores_addr_pre + 0x0800 : lores_addr_pre;
        } else {
          // Radastan LoRes: 4-bit color, uses Timex display file selector
          // Address: timexDFile bit + y(7 downto 1) * 64 + x(7 downto 2)
          // VHDL: lores_addr_rad <= dfile_i & y(7 downto 1) & x(7 downto 2)
          // Bit layout: [dfile(1)][y(7:1)(7)][x(7:2)(6)] = 14 bits
          blockAddr = (this.timexDFile << 13) | ((y >> 1) << 6) | (x >> 2);
        }

        // Read from Bank 5 memory (ULA memory space)
        this.loResBlockByte = this.machine.memoryDevice.readScreenMemory(blockAddr);
      }
    }

    // === STAGE 3: Border Area ===
    if ((cell & LORES_DISPLAY_AREA) === 0) {
      // Border uses cached border RGB value (same as ULA)
      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = this.borderRgbCache;
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = false;
      return;
    }

    // === STAGE 4: Pixel Generation ===
    // Generate pixel from block byte (happens every HC position)
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;

    // Apply scroll to get pixel position (matching VHDL)
    const x = (displayHC + this.loResScrollXSampled) & 0xff;
    let pixelRgb333: number;

    if (this.loResModeSampled === 0) {
      // Standard LoRes: 8-bit color with palette offset on high nibble
      // VHDL: pixel_lores_nib_H <= lores_data_i(7 downto 4) + lores_palette_offset_i
      //       lores_pixel_o <= pixel_lores_nib_H & lores_data_i(3 downto 0)
      // High nibble gets palette offset added, low nibble used directly
      const highNibble = ((this.loResBlockByte >> 4) + this.loresPaletteOffset) & 0x0f;
      const lowNibble = this.loResBlockByte & 0x0f;
      const paletteIndex = (highNibble << 4) | lowNibble;
      pixelRgb333 = this.machine.paletteDevice.getUlaRgb333(paletteIndex);
    } else {
      // Radastan LoRes: 4-bit color with palette offset
      // Each byte has 2 nibbles: high nibble for left pixels, low nibble for right pixels
      // Bit 1 of X position selects nibble (matching VHDL: x(1) = '0')
      const nibble =
        x & 0x02
          ? this.loResBlockByte & 0x0f // Right nibble (when x[1]=1)
          : (this.loResBlockByte >> 4) & 0x0f; // Left nibble (when x[1]=0)

      // Palette index construction follows VHDL implementation (lores.vhd lines 110-112)
      let paletteIndex: number;
      if (this.ulaPlusEnabled) {
        // ULA+ mode: use group 3 (bits 7:6 = 11) with palette offset in bits 3:2
        paletteIndex = 0xc0 | ((this.loresPaletteOffset & 0x03) << 2) | nibble;
      } else {
        // Standard mode: palette offset in upper nibble
        paletteIndex = ((this.loresPaletteOffset & 0x0f) << 4) | nibble;
      }

      pixelRgb333 = this.machine.paletteDevice.getUlaRgb333(paletteIndex);
    }

    // === STAGE 5: Clipping Test ===
    // Check if pixel is within ULA clip window (LoRes uses ULA clip window)
    const clipped =
      displayHC < this.ulaClipWindowX1 ||
      displayHC > this.ulaClipWindowX2 ||
      displayVC < this.ulaClipWindowY1 ||
      displayVC > this.ulaClipWindowY2;

    // === STAGE 6: Return Layer Output ===
    this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = pixelRgb333;
    this.ulaPixel1Transparent = this.ulaPixel2Transparent;
    pixelRgb333 >> 1 === this.globalTransparencyColor || clipped;
  }

  /**
   * Samples Next registers for ULA mode.
   */
  private sampleNextRegistersForUlaMode(): void {
    // --- Scroll
    this.ulaScrollXSampled = this.ulaScrollX;
    this.ulaScrollYSampled = this.ulaScrollY;

    // --- ULA Standard mode
    this.disableUlaOutputSampled = this.disableUlaOutput;

    // --- ULA Hi-Res mode
    this.ulaHiResModeSampled = this.ulaHiResMode;
    this.ulaHiResColorSampled = this.ulaHiResColor;
    // --- ULA Hi-Color mode
    this.ulaHiColorModeSampled = this.ulaHiColorMode;

    // --- Lo-Res mode
    this.loResEnabledSampled = this.loResEnabled;
  }

  // ======================================================================================
  // Layer 2 Helpers
  // ======================================================================================
  /**
   * Render Layer 2 256×192 mode pixel (optimized version).
   * @param vc Vertical counter position
   * @param hc Horizontal counter position
   * @param cell Layer 2 rendering cell with activity flags
   */
  private renderLayer2_256x192Pixel(vc: number, hc: number, cell: number): void {
    if ((cell & LAYER2_DISPLAY_AREA) === 0) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Phase 1: Prepare scanline state (would be cached per scanline in real implementation)
    const scanline = this.prepareScanlineState192(vc);

    // Phase 1: Early rejection for clipped/invalid scanlines
    if (!scanline) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Phase 2: Fast path for unscrolled, unclipped content
    if (
      this.layer2ScrollX === 0 &&
      this.layer2ScrollY === 0 &&
      this.layer2ClipWindowX1 === 0 &&
      this.layer2ClipWindowX2 === 255 &&
      this.layer2ClipWindowY1 === 0 &&
      this.layer2ClipWindowY2 === 191
    ) {
      this.renderLayer2_256x192Pixel_FastPath(scanline, hc);
      return;
    }

    // General path with full feature support
    const displayHC = hc - this.confDisplayXStart;

    const hc_valid = displayHC >= 0 && displayHC < 256;

    if (!hc_valid || displayHC < this.layer2ClipWindowX1 || displayHC > this.layer2ClipWindowX2) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const x = (displayHC + this.layer2ScrollX) & 0xff;

    const offset = (scanline.y << 8) | x;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(scanline.bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.machine.paletteDevice.getLayer2Rgb333(paletteIndex);
    const priority = (rgb333 & 0x100) !== 0;

    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = rgb333 & 0x1ff;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = false;
    this.layer2Pixel1Priority = this.layer2Pixel2Priority = priority;
  }

  /**
   * Prepare scanline state for 256×192 mode rendering.
   * Precomputes all per-scanline constants to avoid redundant calculations.
   * Phase 1: Scanline-based state precomputation for 256×192 mode.
   */
  private prepareScanlineState192(vc: number): Layer2ScanlineState192 | null {
    const displayVC = vc - this.confDisplayYStart;

    // Early rejection: outside display area
    if (displayVC < 0 || displayVC >= 192) {
      return null;
    }

    // Early rejection: clipped by Y bounds
    if (displayVC < this.layer2ClipWindowY1 || displayVC > this.layer2ClipWindowY2) {
      return null;
    }

    // Pre-calculate Y coordinate with modulo
    const y = (displayVC + this.layer2ScrollY) % 192;

    // Pre-select bank
    const bank = this.layer2UseShadowBank ? this.layer2ShadowRamBank : this.layer2ActiveRamBank;

    return {
      vc,
      displayVC,
      vc_valid: true,
      clippedByVertical: false,
      y,
      bank
    };
  }

  /**
   * Get a pixel byte from Layer 2 SRAM memory with bank caching.
   * Priority 2E: Caches bank calculations for sequential access.
   *
   * When accessing pixels sequentially (common in scanline rendering),
   * most accesses will be within the same 8K segment, allowing us to
   * skip the expensive bank calculation and reuse the cached memory base.
   *
   * @param bank16K Starting 16K bank number
   * @param offset Byte offset within the Layer 2 display buffer
   * @returns Pixel byte value (0-255)
   */

  private getLayer2PixelFromSRAM_Cached(bank16K: number, offset: number): number {
    // Check if we're in the same 8K segment and using the same bank16K
    // XOR with previous offset and check if result is less than 8K (0x2000)
    // This means we're within the same 8K segment
    if (bankCache.lastBank16K === bank16K && (offset ^ bankCache.lastOffset) < 0x2000) {
      // Fast path: reuse cached bank calculation
      const offsetWithin8K = offset & 0x1fff;
      return this.machine.memoryDevice.memory[bankCache.lastMemoryBase + offsetWithin8K] || 0;
    }

    // Slow path: recalculate and update cache
    const segment16K = (offset >> 14) & 0x07;
    const half8K = (offset >> 13) & 0x01;
    const bank8K = (bank16K + segment16K) * 2 + half8K;
    const memoryBase = 0x040000 + bank8K * 0x2000;

    // Update cache
    bankCache.lastOffset = offset;
    bankCache.lastBank16K = bank16K;
    bankCache.lastBank8K = bank8K;
    bankCache.lastMemoryBase = memoryBase;

    const offsetWithin8K = offset & 0x1fff;
    return this.machine.memoryDevice.memory[memoryBase + offsetWithin8K] || 0;
  }

  /**
   * Fast path for 256×192 mode with no scrolling and full clip window.
   * Phase 2: Optimized rendering for common unscrolled case.
   */
  private renderLayer2_256x192Pixel_FastPath(scanline: Layer2ScanlineState192, hc: number): void {
    const displayHC = hc - this.confDisplayXStart;

    // Fast bounds check (no clipping needed)
    if (displayHC < 0 || displayHC >= 256) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Direct memory access: offset = (y << 8) | x
    const offset = (scanline.y << 8) | displayHC;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(scanline.bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.machine.paletteDevice.getLayer2Rgb333(paletteIndex);
    const priority = (rgb333 & 0x100) !== 0;

    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = rgb333 & 0x1ff;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = false;
    this.layer2Pixel1Priority = this.layer2Pixel2Priority = priority;
  }

  /**
   * Render Layer 2 320×256 mode pixel (original implementation with optimizations).
   * @param vc Vertical counter position
   * @param hc Horizontal counter position
   * @param cell Layer 2 rendering cell with activity flags
   */
  private renderLayer2_320x256Pixel(vc: number, hc: number, cell: number): void {
    if ((cell & LAYER2_DISPLAY_AREA) === 0) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Priority 1A: Prepare scanline state (would be cached per scanline in real implementation)
    const scanline = this.prepareScanlineState320x256(vc);

    // Priority 1B: Early rejection for clipped/invalid scanlines
    if (!scanline) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Priority 3H: Fast path for unscrolled, unclipped content
    if (
      this.layer2ScrollX === 0 &&
      this.layer2ScrollY === 0 &&
      this.layer2ClipWindowX1 === 0 &&
      this.layer2ClipWindowX2 === 159 &&
      this.layer2ClipWindowY1 === 0 &&
      this.layer2ClipWindowY2 === 255
    ) {
      this.renderLayer2_320x256Pixel_FastPath(scanline, hc);
      return;
    }

    // General path with full feature support
    const displayHC_wide = hc - this.confDisplayXStart + 32;

    const clipX1 = this.layer2ClipWindowX1 << 1;
    const clipX2 = (this.layer2ClipWindowX2 << 1) | 1;

    const hc_valid = displayHC_wide < 320;

    if (!hc_valid || displayHC_wide < clipX1 || displayHC_wide > clipX2) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const x_pre = displayHC_wide + this.layer2ScrollX;

    // Priority 2D: Use lookup table for X-coordinate wrapping
    const x = getLayer2XWrappingTable320()[x_pre & 0x3ff];

    // Priority 2E: Use cached bank access
    const offset = (x << 8) | scanline.y;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(scanline.bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.machine.paletteDevice.getLayer2Rgb333(paletteIndex);
    const priority = (rgb333 & 0x100) !== 0;

    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = rgb333 & 0x1ff;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = false;
    this.layer2Pixel1Priority = this.layer2Pixel2Priority = priority;
  }

  /**
   * Prepare scanline state for 320×256 mode rendering.
   * Precomputes all per-scanline constants to avoid redundant calculations.
   * Priority 1A: Scanline-based state precomputation.
   */
  private prepareScanlineState320x256(vc: number): Layer2ScanlineState320x256 | null {
    const displayVC = vc - this.confDisplayYStart;
    const displayVC_wide = displayVC + 32;
    const vc_valid = displayVC_wide >= 0 && displayVC_wide < 256;

    // Priority 1B: Early scanline rejection
    if (!vc_valid) {
      return null;
    }

    const clipY1 = this.layer2ClipWindowY1;
    const clipY2 = this.layer2ClipWindowY2;
    const clippedByVertical = displayVC_wide < clipY1 || displayVC_wide > clipY2;

    // Priority 1B: Early scanline rejection for clipped scanlines
    if (clippedByVertical) {
      return null;
    }

    const y_pre = displayVC_wide + this.layer2ScrollY;
    const y = y_pre & 0xff;
    const bank = this.layer2UseShadowBank ? this.layer2ShadowRamBank : this.layer2ActiveRamBank;

    return {
      vc,
      displayVC,
      displayVC_wide,
      vc_valid,
      clippedByVertical,
      y,
      bank
    };
  }

  /**
   * Fast path for 320×256 mode with no scrolling and full clip window.
   * Priority 1C & 3H: Optimized memory access for common case.
   */
  private renderLayer2_320x256Pixel_FastPath(
    scanline: Layer2ScanlineState320x256,
    hc: number
  ): void {
    const displayHC_wide = hc - this.confDisplayXStart + 32;

    // Fast bounds check (no clipping needed)
    if (displayHC_wide >= 320) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Sequential memory access: offset = (x << 8) | y
    // Priority 2E: Use cached bank access for sequential pixels
    const offset = (displayHC_wide << 8) | scanline.y;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(scanline.bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.machine.paletteDevice.getLayer2Rgb333(paletteIndex);
    const priority = (rgb333 & 0x100) !== 0;

    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = rgb333 & 0x1ff;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = false;
    this.layer2Pixel1Priority = this.layer2Pixel2Priority = priority;
  }

  /**
   * Render Layer 2 640×256 mode pixel.
   * @param device Rendering device state
   * @param _vc Vertical counter position
   * @param _hc Horizontal counter position
   * @param _cell Layer 2 rendering cell with activity flags
   * @param _pixelIndex Which pixel of the pair (0 or 1)
   */
  private renderLayer2_640x256Pixel(_vc: number, _hc: number, _cell: number): void {
    // TODO: Implementation to be documented in a future section
    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
  }
}

/**
 * Module-level bank cache for sequential pixel access optimization.
 * Maintained across pixel fetches within the same rendering context.
 * Priority 2E: Reduces redundant bank calculations by ~20-25%.
 */
const bankCache: BankCache = {
  lastOffset: -1,
  lastBank16K: -1,
  lastBank8K: -1,
  lastMemoryBase: -1
};
