import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import {
  Layer2Cell,
  LayerMatrix,
  LayerOutput,
  LayersOutput,
  LoResCell,
  RenderingCell,
  SpritesCell,
  TilemapCell,
  ULAHiColorCell,
  ULAHiResCell,
  ULAStandardCell
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

  // --- The number of rendering tacts for the screen frame
  renderingTacts: number;

  // --- Interrupt state
  // --- INT signal (active: true, inactive: false)
  private _pulseIntActive: boolean;
  private _pulseIntCount: number;

  // Flash counter (0-31, cycles ~16 frames per state)
  private _flashCounter: number = 0;
  private _flashFlag: boolean = false;

  // ZX Next register flags
  // === Reg 0x05 - Screen timing mode
  is60HzMode: boolean;
  scandoublerEnabled: boolean;

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

  // === Reg 0x26 - ULA X Scroll
  ulaScrollX: number;
  sampledUlaScrollX: number;

  // === Reg 0x27 - ULA Y Scroll
  ulaScrollY: number;
  sampledUlaScrollY: number;

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
  borderColor: number;

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

  // Rendering matrixes for all layers and modes
  private _matrixULAStandard: LayerMatrix;
  private _matrixULAStandard50Hz: LayerMatrix;
  private _matrixULAStandard60Hz: LayerMatrix;

  private _matrixULAHiRes: LayerMatrix;
  private _matrixULAHiRes50Hz: LayerMatrix;
  private _matrixULAHiRes60Hz: LayerMatrix;

  private _matrixULAHiColor: LayerMatrix;
  private _matrixULAHiColor50Hz: LayerMatrix;
  private _matrixULAHiColor60Hz: LayerMatrix;

  private _matrixLayer2_256x192: LayerMatrix;
  private _matrixLayer2_256x192_50Hz: LayerMatrix;
  private _matrixLayer2_256x192_60Hz: LayerMatrix;

  private _matrixLayer2_320x256: LayerMatrix;
  private _matrixLayer2_320x256_50Hz: LayerMatrix;
  private _matrixLayer2_320x256_60Hz: LayerMatrix;

  private _matrixLayer2_640x256: LayerMatrix;
  private _matrixLayer2_640x256_50Hz: LayerMatrix;
  private _matrixLayer2_640x256_60Hz: LayerMatrix;

  private _matrixSprites: LayerMatrix;
  private _matrixSprites50Hz: LayerMatrix;
  private _matrixSprites60Hz: LayerMatrix;

  private _matrixTilemap_40x32: LayerMatrix;
  private _matrixTilemap_40x32_50Hz: LayerMatrix;
  private _matrixTilemap_40x32_60Hz: LayerMatrix;

  private _matrixTilemap_80x32: LayerMatrix;
  private _matrixTilemap_80x32_50Hz: LayerMatrix;
  private _matrixTilemap_80x32_60Hz: LayerMatrix;

  private _matrixLoRes: LayerMatrix;
  private _matrixLoRes50Hz: LayerMatrix;
  private _matrixLoRes60Hz: LayerMatrix;

  /**
   * This buffer stores the bitmap of the screen being rendered. Each 32-bit value represents an ARGB pixel.
   */
  private _pixelBuffer: Uint32Array;

  // ULA rendering state
  ulaPixelByte: number;
  floatingBusValue: number;
  ulaAttrByte: number;
  ulaShiftReg: number;
  ulaShiftAttr: number;
  ulaShiftCount: number;

  constructor(public readonly machine: IZxNextMachine) {
    // Screen dimensions
    this.screenWidth = BITMAP_WIDTH;
    this.screenLines = BITMAP_HEIGHT;

    // Generate rendering matrixes for all layers and modes
    this._matrixULAStandard50Hz = this.generateRenderingMatrix(Plus3_50Hz, generateULAStandardCell);
    this._matrixULAStandard60Hz = this.generateRenderingMatrix(Plus3_60Hz, generateULAStandardCell);
    this._matrixULAHiRes50Hz = this.generateRenderingMatrix(Plus3_50Hz, generateULAHiResCell);
    this._matrixULAHiRes60Hz = this.generateRenderingMatrix(Plus3_60Hz, generateULAHiResCell);
    this._matrixULAHiColor50Hz = this.generateRenderingMatrix(Plus3_50Hz, generateULAHiColorCell);
    this._matrixULAHiColor60Hz = this.generateRenderingMatrix(Plus3_60Hz, generateULAHiColorCell);
    this._matrixLayer2_256x192_50Hz = this.generateRenderingMatrix(
      Plus3_50Hz,
      generateLayer2_256x192Cell
    );
    this._matrixLayer2_256x192_60Hz = this.generateRenderingMatrix(
      Plus3_60Hz,
      generateLayer2_256x192Cell
    );
    this._matrixLayer2_320x256_50Hz = this.generateRenderingMatrix(
      Plus3_50Hz,
      generateLayer2_320x256Cell
    );
    this._matrixLayer2_320x256_60Hz = this.generateRenderingMatrix(
      Plus3_60Hz,
      generateLayer2_320x256Cell
    );
    this._matrixLayer2_640x256_50Hz = this.generateRenderingMatrix(
      Plus3_50Hz,
      generateLayer2_640x256Cell
    );
    this._matrixLayer2_640x256_60Hz = this.generateRenderingMatrix(
      Plus3_60Hz,
      generateLayer2_640x256Cell
    );
    this._matrixSprites50Hz = this.generateRenderingMatrix(Plus3_50Hz, generateSpritesCell);
    this._matrixSprites60Hz = this.generateRenderingMatrix(Plus3_60Hz, generateSpritesCell);
    this._matrixTilemap_40x32_50Hz = this.generateRenderingMatrix(
      Plus3_50Hz,
      generateTilemap40x32Cell
    );
    this._matrixTilemap_40x32_60Hz = this.generateRenderingMatrix(
      Plus3_60Hz,
      generateTilemap40x32Cell
    );
    this._matrixTilemap_80x32_50Hz = this.generateRenderingMatrix(
      Plus3_50Hz,
      generateTilemap80x32Cell
    );
    this._matrixTilemap_80x32_60Hz = this.generateRenderingMatrix(
      Plus3_60Hz,
      generateTilemap80x32Cell
    );
    this._matrixLoRes50Hz = this.generateRenderingMatrix(Plus3_50Hz, generateLoResCell);
    this._matrixLoRes60Hz = this.generateRenderingMatrix(Plus3_60Hz, generateLoResCell);
    this.reset();
  }

  reset(): void {
    // --- Initialize ULA state values
    this.ulaClipIndex = 0;
    this.ulaClipWindowX1 = 0;
    this.ulaClipWindowX2 = 255;
    this.ulaClipWindowY1 = 0;
    this.ulaClipWindowY2 = 191;
    this.ulaScrollX = 0;
    this.ulaScrollY = 0;

    // --- Initialize pixel buffer
    this._pixelBuffer = new Uint32Array(BITMAP_SIZE);
    this.initializeBitmap();

    // --- Rendering state
    this._pulseIntActive = false;
    this._pulseIntCount = 0;
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
   * Render the pixel pair belonging to the specified frame tact.
   * @param tact Frame tact to render
   */
  renderTact(tact: number): boolean {
    // --- Calculate the (HC, VC) position for the given tact
    const hc = tact % this.config.totalHC;
    const vc = Math.floor(tact / this.config.totalHC);

    // Check for interrupt trigger at specific (HC, VC) position
    if (hc === this.config.intHC && vc === this.config.intVC && !this._pulseIntActive) {
      // ULA triggers interrupt pulse
      this._pulseIntActive = true; // Activate INT signal
      this._pulseIntCount = 0;
    }

    // Update interrupt pulse counter (in real hardware at CLK_CPU rate)
    if (this._pulseIntActive) {
      this._pulseIntCount++;
      if (this._pulseIntCount >= this.config.intPulseLength) {
        this._pulseIntActive = false; // Deactivate INT signal
        this._pulseIntCount = 0;
      }
    }

    // Early exit for blanking regions (horizontal and vertical blanking)
    // No visible pixel output during blanking - saves ~42% of rendering cycles
    const blanking =
      hc < this.config.firstVisibleHC ||
      vc < this.config.firstBitmapVC ||
      vc > this.config.lastBitmapVC;

    if (blanking) {
      return false; // Skip all rendering work during blanking
    }

    // SPARSE MATRIX: Translate absolute (VC, HC) to matrix indices
    // Matrices only store visible regions (exclude blanking)
    const mVC = vc - this.config.firstBitmapVC;
    const mHC = hc - this.config.firstVisibleHC;

    // Render ULA layer pixel(s) if enabled
    let ulaOutput1: LayerOutput | null = null;
    let ulaOutput2: LayerOutput | null = null;

    if (!this.disableUlaOutput) {
      if (this.ulaHiResMode) {
        // ULA Hi-Res mode (512×192, 2 pixels per HC)
        const ulaCell = this._matrixULAHiRes[mVC][mHC] as ULAHiResCell;
        ulaOutput1 = this.renderULAHiResPixel(vc, hc, ulaCell, 0);
        ulaOutput2 = this.renderULAHiResPixel(vc, hc, ulaCell, 1);
      } else if (this.ulaHiColorMode) {
        // ULA Hi-Color mode (256×192)
        const ulaCell = this._matrixULAHiColor[mVC][mHC] as ULAHiColorCell;
        ulaOutput1 = this.renderULAHiColorPixel(vc, hc, ulaCell);
        ulaOutput2 = ulaOutput1; // Standard resolution: duplicate pixel
      } else {
        // ULA Standard mode (256×192)
        try {
          const ulaCell = this._matrixULAStandard[mVC][mHC] as ULAStandardCell;
          ulaOutput1 = this.renderULAStandardPixel(vc, hc, ulaCell);
          ulaOutput2 = ulaOutput1; // Standard resolution: duplicate pixel
        } catch (e) {
          let a = 1;
        }
      }
    }

    // Render Layer 2 pixel(s) if enabled
    let layer2Output1: LayerOutput | null = null;
    let layer2Output2: LayerOutput | null = null;

    if (this.layer2Enabled) {
      if (this.layer2Resolution === 0) {
        // Layer 2 256×192 mode
        const layer2Cell = this._matrixLayer2_256x192[mVC][mHC] as Layer2Cell;
        layer2Output1 = this.renderLayer2_256x192Pixel(vc, hc, layer2Cell);
        layer2Output2 = layer2Output1; // Standard resolution: duplicate pixel
      } else if (this.layer2Resolution === 1) {
        // Layer 2 320×256 mode
        const layer2Cell = this._matrixLayer2_320x256[mVC][mHC] as Layer2Cell;
        layer2Output1 = this.renderLayer2_320x256Pixel(vc, hc, layer2Cell);
        layer2Output2 = layer2Output1; // Standard resolution: duplicate pixel
      } else if (this.layer2Resolution === 2) {
        // Layer 2 640×256 mode (Hi-Res, 2 pixels per HC)
        const layer2Cell = this._matrixLayer2_640x256[mVC][mHC] as Layer2Cell;
        layer2Output1 = this.renderLayer2_640x256Pixel(vc, hc, layer2Cell, 0);
        layer2Output2 = this.renderLayer2_640x256Pixel(vc, hc, layer2Cell, 1);
      }
    }

    // Render Sprites pixel(s) if enabled
    let spritesOutput1: LayerOutput | null = null;
    let spritesOutput2: LayerOutput | null = null;

    if (this.spritesEnabled) {
      const spritesCell = this._matrixSprites[mVC][mHC] as SpritesCell;
      spritesOutput1 = this.renderSpritesPixel(vc, hc, spritesCell);
      spritesOutput2 = spritesOutput1; // Standard resolution: duplicate pixel
    }

    // Render Tilemap pixel(s) if enabled
    let tilemapOutput1: LayerOutput | null = null;
    let tilemapOutput2: LayerOutput | null = null;

    if (this.tilemapEnabled) {
      if (this.tilemap80x32Resolution) {
        // Tilemap 80×32 mode (Hi-Res, 2 pixels per HC)
        const tilemapCell = this._matrixTilemap_80x32[mVC][mHC] as TilemapCell;
        tilemapOutput1 = this.renderTilemap_80x32Pixel(vc, hc, tilemapCell, 0);
        tilemapOutput2 = this.renderTilemap_80x32Pixel(vc, hc, tilemapCell, 1);
      } else {
        // Tilemap 40×32 mode
        const tilemapCell = this._matrixTilemap_40x32[mVC][mHC] as TilemapCell;
        tilemapOutput1 = this.renderTilemap_40x32Pixel(vc, hc, tilemapCell);
        tilemapOutput2 = tilemapOutput1; // Standard resolution: duplicate pixel
      }
    }

    // Render LoRes pixel(s) if enabled
    let loresOutput1: LayerOutput | null = null;
    let loresOutput2: LayerOutput | null = null;

    if (this.loResEnabled) {
      const loresCell = this._matrixLoRes[mVC][mHC] as LoResCell;
      loresOutput1 = this.renderLoResPixel(vc, hc, loresCell);
      loresOutput2 = loresOutput1; // Standard resolution base (4x replication handled by caller)
    }

    // Stage 2: Compose all layer outputs and write to bitmap
    // Always pass exactly 5 layers in fixed order: ULA, Layer2, Sprites, Tilemap, LoRes
    // Use null for disabled/inactive layers
    const layerOutputs1: LayersOutput = [
      ulaOutput1,
      layer2Output1,
      spritesOutput1,
      tilemapOutput1,
      loresOutput1
    ];

    const layerOutputs2: LayersOutput = [
      ulaOutput2,
      layer2Output2,
      spritesOutput2,
      tilemapOutput2,
      loresOutput2
    ];

    // Compose and output two pixels to bitmap
    this.composeAndOutputPixels(vc, hc, layerOutputs1, layerOutputs2);

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

    // --- Update all layer matrix references based on timing mode
    this._matrixULAStandard = is60Hz ? this._matrixULAStandard60Hz : this._matrixULAStandard50Hz;
    this._matrixULAHiRes = is60Hz ? this._matrixULAHiRes60Hz : this._matrixULAHiRes50Hz;
    this._matrixULAHiColor = is60Hz ? this._matrixULAHiColor60Hz : this._matrixULAHiColor50Hz;
    this._matrixLayer2_256x192 = is60Hz
      ? this._matrixLayer2_256x192_60Hz
      : this._matrixLayer2_256x192_50Hz;
    this._matrixLayer2_320x256 = is60Hz
      ? this._matrixLayer2_320x256_60Hz
      : this._matrixLayer2_320x256_50Hz;
    this._matrixLayer2_640x256 = is60Hz
      ? this._matrixLayer2_640x256_60Hz
      : this._matrixLayer2_640x256_50Hz;
    this._matrixSprites = is60Hz ? this._matrixSprites60Hz : this._matrixSprites50Hz;
    this._matrixTilemap_40x32 = is60Hz
      ? this._matrixTilemap_40x32_60Hz
      : this._matrixTilemap_40x32_50Hz;
    this._matrixTilemap_80x32 = is60Hz
      ? this._matrixTilemap_80x32_60Hz
      : this._matrixTilemap_80x32_50Hz;
    this._matrixLoRes = is60Hz ? this._matrixLoRes60Hz : this._matrixLoRes50Hz;

    // Increment flash counter (cycles 0-31 for ~1 Hz flash rate at 50Hz)
    // Flash period: ~16 frames ON, ~16 frames OFF
    // Full cycle: ~32 frames (~0.64s at 50Hz, ~0.55s at 60Hz)
    this._flashCounter = (this._flashCounter + 1) & 0x1f;
    this._flashFlag = this._flashCounter >= 16;

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
  // Rendering matrix generation

  /**
   * Generic helper to generate a rendering matrix by iterating through all (VC, HC) positions.
   *
   * SPARSE MATRIX OPTIMIZATION:
   * Only generates cells for visible regions (non-blanking positions).
   * - Vertical: firstBitmapVC to lastBitmapVC (50Hz: 16-303, 60Hz: 16-255)
   * - Horizontal: firstVisibleHC to maxHC (both: 96-455)
   * - Result: [verticalHeight][horizontalWidth] where dimensions are reduced by ~25%
   *
   * @param config - Timing configuration (50Hz or 60Hz)
   * @param generateCell - Cell generation function for specific layer type
   * @returns Complete sparse rendering matrix for the layer
   */
  private generateRenderingMatrix(
    config: TimingConfig,
    generateCell: (config: TimingConfig, vc: number, hc: number) => RenderingCell
  ): RenderingCell[][] {
    const renderingMatrix: RenderingCell[][] = [];

    // Only generate visible rows (exclude vertical blanking)
    for (let vc = config.firstBitmapVC; vc <= config.lastBitmapVC; vc++) {
      const matrixRow: RenderingCell[] = [];

      // Only generate visible columns (exclude horizontal blanking)
      for (let hc = config.firstVisibleHC; hc <= config.maxHC; hc++) {
        matrixRow.push(generateCell(config, vc, hc));
      }

      renderingMatrix.push(matrixRow);
    }

    return renderingMatrix;
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
   * - Palette lookup (RGB333 output)
   * - Clipping test
   * - Transparency determination
   * - Contention and floating bus simulation
   *
   * @param vc - Vertical counter position
   * @param hc - Horizontal counter position
   * @param cell - ULA Standard rendering cell with activity flags
   * @returns Layer output (RGB333 + flags) for composition stage
   */
  private renderULAStandardPixel(vc: number, hc: number, cell: ULAStandardCell): LayerOutput {
    // === Border Area ===
    if (!cell.displayArea) {
      // Lookup border color in ULA palette (first 8 entries)
      // TODO: Consider ULA+ border color modes
      const borderRGB333 = this.machine.paletteDevice.getUlaRgb333(this.borderColor);

      return {
        rgb: borderRGB333,
        transparent: false,
        clipped: false
      };
    }

    // === Display Area: ULA Standard Rendering ===
    // --- Scroll Sampling ---
    if (cell.scrollSample) {
      // Sample hardware scroll registers at specific HC subcycle positions (0x3, 0xB)
      this.sampledUlaScrollX = this.ulaScrollX;
      this.sampledUlaScrollY = this.ulaScrollY;
    }

    // // --- Memory Read Activities ---
    if (cell.pixelRead) {
      // Read pixel byte from VRAM
      // Bank selection: Bank 5 or Bank 7 (shadow screen)
      // Port 0x7FFD bit 3 / NextReg 0x69 bit 6 selects shadow screen
      // ULA hardware generates 14-bit bank-relative address (0x0000-0x3FFF)
      // NOT CPU addresses! Hardware reads directly from physical Bank 5/7 BRAM
      const displayVC = vc - this.config.displayYStart; // 0-191
      const displayHC = hc - this.config.displayXStart; // 0-255

      // Apply Y scroll
      const scrolledY = (displayVC + this.ulaScrollY) & 0xbf; // Wrap at 192

      // Calculate pixel address (standard ZX Spectrum interlaced format)
      // 14-bit bank offset: bit[13] (screen mode) | y[7:6] | y[2:0] | y[5:3] | x[7:3]
      const y76 = (scrolledY >> 6) & 0x03; // Bits 7-6: thirds
      const y20 = scrolledY & 0x07; // Bits 2-0: scan line within char
      const y53 = (scrolledY >> 3) & 0x07; // Bits 5-3: char row
      const x = (displayHC >> 3) & 0x1f; // Bits 7-3: char column

      // Generate 14-bit bank-relative address (0x0000-0x3FFF for Bank 5/7)
      // Standard ULA mode: bit[13] = 0, so address range is 0x0000-0x1FFF
      const pixelAddr = (y76 << 11) | (y20 << 8) | (y53 << 5) | x;

      // Read pixel byte from Bank 5 or Bank 7
      this.ulaPixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);

      // Update floating bus with pixel data
      if (cell.floatingBusUpdate) {
        this.floatingBusValue = this.ulaPixelByte;
      }
    }

    if (cell.attrRead) {
      // Read attribute byte from VRAM
      // Bank selection: Bank 5 or Bank 7 (shadow screen)
      const displayVC = vc - this.config.displayYStart;
      const displayHC = hc - this.config.displayXStart;

      // Apply Y scroll
      const scrolledY = (displayVC + this.ulaScrollY) & 0xbf;

      // Calculate attribute address (14-bit bank offset)
      // Attribute area starts at 0x1800 within Bank 5/7 (linear: 0x1800 + (y/8)*32 + (x/8))
      const attrY = scrolledY >> 3; // Character row (0-23)
      const attrX = (displayHC >> 3) & 0x1f; // Character column (0-31)

      // Generate 14-bit bank-relative address: 0x1800 + offset
      const attrAddr = 0x1800 + (attrY << 5) + attrX;

      // Read attribute byte from Bank 5 or Bank 7
      this.ulaAttrByte = this.machine.memoryDevice.readScreenMemory(attrAddr);

      // Update floating bus with attribute data
      if (cell.floatingBusUpdate) {
        this.floatingBusValue = this.ulaAttrByte;
      }
    }

    // // --- Shift Register Load ---
    if (cell.shiftRegLoad) {
      // Load pixel and attribute data into shift register
      // This prepares the next 8 pixels for output
      this.ulaShiftReg = this.ulaPixelByte;
      this.ulaShiftAttr = this.ulaAttrByte;
      this.ulaShiftCount = 0; // Reset pixel counter within byte
    }

    // // --- Pixel Generation ---
    // Generate pixel from shift register (happens every HC position)
    // Extract current pixel bit from shift register
    const displayHC = hc - this.config.displayXStart;
    const displayVC = vc - this.config.displayYStart;
    const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
    const pixelBit = (this.ulaShiftReg >> (7 - pixelWithinByte)) & 0x01;

    // Decode attribute byte
    const flash = (this.ulaShiftAttr >> 7) & 0x01;
    const bright = (this.ulaShiftAttr >> 6) & 0x01;
    const paperColor = (this.ulaShiftAttr >> 3) & 0x07;
    const inkColor = this.ulaShiftAttr & 0x07;

    // Apply flash effect if enabled
    let finalInk = inkColor;
    let finalPaper = paperColor;
    if (flash && this._flashFlag) {
      // Swap INK and PAPER when flash is active
      finalInk = paperColor;
      finalPaper = inkColor;
    }

    // Select INK or PAPER based on pixel bit
    const colorIndex = pixelBit ? finalInk : finalPaper;

    // Apply BRIGHT attribute (adds 8 to color index)
    const paletteIndex = colorIndex + (bright << 3);

    // Lookup color in ULA palette (16 entries for standard + bright colors)
    const pixelRGB333 = this.machine.paletteDevice.getUlaRgb333(paletteIndex);

    // --- Clipping Test ---
    // Check if pixel is within ULA clip window (NextReg 0x1C, 0x1D)
    const clipped =
      displayHC < this.ulaClipWindowX1 ||
      displayHC > this.ulaClipWindowX2 ||
      displayVC < this.ulaClipWindowY1 ||
      displayVC > this.ulaClipWindowY2;

    // --- Transparency Check ---
    const transparent = (pixelRGB333 >> 1) === this.globalTransparencyColor;

    // --- Contention Simulation ---
    // if (cell.contentionWindow && this.contentionEnabled) {
    //   // Delay CPU memory access by one cycle (simulation only)
    //   // In real hardware, this delays Z80 access to contended RAM ($4000-$7FFF)
    //   // This would be handled by the CPU emulation module
    //   this.signalMemoryContention();
    // }

    // Return layer output for composition stage
    return {
      rgb: pixelRGB333,
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
    _cell: ULAHiResCell,
    _pixelIndex: number
  ): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
  private renderULAHiColorPixel(_vc: number, _hc: number, _cell: ULAHiColorCell): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
  private renderLayer2_256x192Pixel(_vc: number, _hc: number, _cell: Layer2Cell): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
  private renderLayer2_320x256Pixel(_vc: number, _hc: number, _cell: Layer2Cell): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
    _cell: Layer2Cell,
    _pixelIndex: number
  ): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
  private renderSpritesPixel(_vc: number, _hc: number, _cell: SpritesCell): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
    _cell: TilemapCell,
    _pixelIndex: number
  ): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
  private renderTilemap_40x32Pixel(_vc: number, _hc: number, _cell: TilemapCell): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
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
  private renderLoResPixel(_vc: number, _hc: number, _cell: LoResCell): LayerOutput {
    // TODO: Implementation to be documented in a future section
    return {
      rgb: 0x00000000,
      transparent: true,
      clipped: false
    };
  }

  /**
   * Compose all layer outputs and write two final pixels to display bitmap (Stage 2: Composition).
   *
   * This method implements Stage 2 of the rendering pipeline as described in Section 1.3.
   * Since the bitmap width is doubled (720 pixels) to support HiRes mode, this method processes
   * TWO sets of layer outputs and writes TWO consecutive pixels per call.
   *
   * For each set of layer outputs, the method combines them based on:
   * - Transparency and clipping
   * - Stencil mode (optional ULA + Tilemap AND)
   * - Blend modes (color addition, darkening)
   * - Priority order (configurable via NextReg 0x15)
   * - Layer 2 priority bit override
   * - Fallback/backdrop color
   *
   * Resolution mode handling:
   * - HiRes: layerOutputs1 and layerOutputs2 contain different pixels
   * - Standard: layerOutputs1 and layerOutputs2 contain the same pixel (replicated)
   * - LoRes: Caller sends same pixel and calls this method multiple times for 4x replication
   *
   * @param vc - Vertical counter position
   * @param hc - Horizontal counter position
   * @param layerOutputs1 - First pixel: Fixed 5-layer tuple [ULA, Layer2, Sprites, Tilemap, LoRes]
   * @param layerOutputs2 - Second pixel: Fixed 5-layer tuple [ULA, Layer2, Sprites, Tilemap, LoRes]
   */
  private composeAndOutputPixels(
    vc: number,
    hc: number,
    layerOutputs1: LayersOutput,
    layerOutputs2: LayersOutput
  ): void {
    // Calculate bitmap Y coordinate
    const bitmapY = vc - this.config.firstBitmapVC;
    if (bitmapY < 0 || bitmapY >= BITMAP_HEIGHT) return;

    // Calculate base X position in 720-pixel bitmap (2 pixels per HC)
    const bitmapXBase = (hc - this.config.firstVisibleHC) * 2;

    // Compose and write first pixel
    const pixelRGBA1 = this.composeSinglePixel(layerOutputs1);
    this._pixelBuffer[bitmapY * BITMAP_WIDTH + bitmapXBase] = pixelRGBA1;

    // Compose and write second pixel
    const pixelRGBA2 = this.composeSinglePixel(layerOutputs2);
    this._pixelBuffer[bitmapY * BITMAP_WIDTH + bitmapXBase + 1] = pixelRGBA2;
  }

  /**
   * Compose a single pixel from layer outputs.
   *
   * Helper method that performs the composition logic for one pixel.
   * Evaluates priority, transparency, and fallback color to select the final RGB333 value,
   * then converts it to RGBA format for the bitmap.
   *
   * @param layerOutputs - Fixed 5-layer tuple [ULA, Layer2, Sprites, Tilemap, LoRes]
   * @returns RGBA pixel value (format: 0xAABBGGRR)
   */
  private composeSinglePixel(layerOutputs: LayersOutput): number {
    // Destructure layer outputs for clarity
    const [ulaOutput, layer2Output, spritesOutput, tilemapOutput, loresOutput] = layerOutputs;

    // === Priority Evaluation ===
    // Define priority orders (first non-transparent layer wins)
    // S=Sprites, L=Layer2, U=ULA, T=Tilemap (LoRes shares ULA priority)
    // Note: null layers are skipped during evaluation
    const priorityOrders = [
      [spritesOutput, layer2Output, ulaOutput], // 000: SLU
      [layer2Output, spritesOutput, ulaOutput], // 001: LSU
      [spritesOutput, ulaOutput, layer2Output], // 010: SUL
      [layer2Output, ulaOutput, spritesOutput], // 011: LUS
      [ulaOutput, spritesOutput, layer2Output], // 100: USL
      [ulaOutput, layer2Output, spritesOutput], // 101: ULS
      [ulaOutput, layer2Output, spritesOutput], // 110: (reserved)
      [ulaOutput, layer2Output, spritesOutput] // 111: (reserved)
    ];

    const priorityOrder = priorityOrders[this.layerPriority];

    // === Layer 2 Priority Override ===
    // If Layer 2 priority bit is set, it renders on top regardless of priority setting
    let selectedOutput: LayerOutput | null = null;
    if (layer2Output && layer2Output.priority && !layer2Output.transparent) {
      selectedOutput = layer2Output;
    } else {
      // Select first non-transparent, non-null layer in priority order
      for (const layerOutput of priorityOrder) {
        if (layerOutput && !layerOutput.transparent) {
          selectedOutput = layerOutput;
          break;
        }
      }
    }

    // === Fallback/Backdrop Color ===
    let finalRGB333: number;
    if (selectedOutput === null) {
      // All layers transparent: use fallback color (NextReg 0x4A)
      // NextReg 0x4A is 8-bit RRRGGGBB, convert to 9-bit RGB333
      const blueLSB = (this.fallbackColor & 0x02) | (this.fallbackColor & 0x01); // OR of blue bits
      finalRGB333 = (this.fallbackColor << 1) | blueLSB; // Extend to 9-bit RGB333
    } else {
      finalRGB333 = selectedOutput.rgb;
    }

    // === Convert RGB333 to RGBA ===
    // Convert 9-bit RGB333 to 32-bit RGBA (0xAABBGGRR format)
    const r3 = (finalRGB333 >> 6) & 0x07;
    const g3 = (finalRGB333 >> 3) & 0x07;
    const b3 = finalRGB333 & 0x07;

    // Expand 3-bit to 8-bit (replicate MSBs: 000 -> 00000000, 111 -> 11111111)
    const r8 = (r3 << 5) | (r3 << 2) | (r3 >> 1);
    const g8 = (g3 << 5) | (g3 << 2) | (g3 >> 1);
    const b8 = (b3 << 5) | (b3 << 2) | (b3 >> 1);

    const pixelRGBA = 0xff000000 | (b8 << 16) | (g8 << 8) | r8;

    return pixelRGBA;
  }
}
