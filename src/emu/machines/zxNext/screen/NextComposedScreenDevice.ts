import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { Plus3_50Hz, Plus3_60Hz, TimingConfig } from "./TimingConfig";
import { zxNextBgra } from "../PaletteDevice";
import { OFFS_BANK_05, OFFS_BANK_07, OFFS_NEXT_RAM } from "../MemoryDevice";
import { SpriteDevice, type SpriteAttributes } from "../SpriteDevice";

/**
 * ZX Spectrum Next Rendering Device
 *
 * Manages the entire rendering pipeline including all layers and all rendering matrices
 * for both timing modes (50Hz and 60Hz). The machine operates on a tact-by-tact basis,
 * where each tact corresponds to one CLK_7 cycle at a specific (VC, HC) position.
 */
export class NextComposedScreenDevice implements IGenericDevice<IZxNextMachine> {
  // --------------------------------------------------------------------------
  // Configuration properties

  // Current timing configuration (50Hz or 60Hz)
  config: TimingConfig;

  // Flattened config properties (eliminates property access overhead in hot path)
  private confIntStartTact: number;
  private confIntEndTact: number;
  private confTotalVC: number;
  private confTotalHC: number;
  private confDisplayXStart: number;
  private confDisplayYStart: number;

  // --------------------------------------------------------------------------
  // Unused (but handled) Next Reg properties

  // Reg $03 [2:0] - Machine type
  machineType: number;
  // Reg $05 [0] - Enable scandoubler (1 = enabled for vga, 0 for crt)
  scandoublerEnabled: boolean;
  // Reg $09 [1:0] - Scanline weight
  scanlineWeight: number;
  // Reg $11 [2:0] - Video timing mode
  videoTimingMode: number;

  // --------------------------------------------------------------------------
  // Timing-related properties and state variables

  // Reg $03 [6:4] - Display timing mode
  displayTiming: number;
  // Reg $03 [3] - User lock on display timing applied
  userLockOnDisplayTiming: boolean;
  // Reg $05 [2] - 50/60 Hz mode (0 = 50Hz, 1 = 60Hz, Pentagon forces 50Hz)
  is60HzMode: boolean;
  // INT signal (active: true, inactive: false)
  pulseIntActive: boolean;
  // Reg $1E/$1F - The active video line being rendered
  activeVideoLine: number;
  // Flash counter (0-31, cycles ~16 frames per state)
  private flashCounter: number = 0;
  // Flash state flag (true = flash on, false = flash off)
  private flashFlag: boolean = false;

  // --------------------------------------------------------------------------
  // Common (all layer) properties and state variables

  // --- The number of rendering tacts for the screen frame
  renderingTacts: number;
  // Reg $14 - Global Transparency Color
  globalTransparencyColor: number;
  // Reg $4A - Fallback color
  private fallbackColorField: number;
  // Standard 0xFE port border value
  private borderColorField: number;
  // Reg $15 [4:2] - Layer priority (Sprites, Layer 2, ULA)
  layerPriority: number;

  // ==============================================================================================
  // Lifecycle methods

  private paletteDevice: any;
  private memoryArrayCache: Uint8Array;
  private spriteDevice: SpriteDevice;

  /**
   * Initializes a new instance of the NextComposedScreenDevice class.
   * @param machine The machine the screen device is attached to
   */
  constructor(public readonly machine: IZxNextMachine) {
    this.paletteDevice = machine.paletteDevice;
    this.spriteDevice = machine.spriteDevice;
    this.memoryArrayCache = machine.memoryDevice.memory;

    // Screen dimensions
    this.screenWidth = BITMAP_WIDTH;
    this.screenLines = BITMAP_HEIGHT;

    // Initialize all module-level lookup tables (lazy initialization)
    initializeAllRenderingFlags();
    initializeTactLookupTables();
    initializeBitmapOffsetTables();
    initializeULAAddressTables();
    initializeAttributeDecodeTables();
    initializeULANextTables();
    initializeLayer2HelperTables();

    // Initialize active attribute lookup tables (default to flash off)
    this.ulaActiveAttrToInk = attrToInkFlashOff;
    this.ulaActiveAttrToPaper = attrToPaperFlashOff;

    // Get references to module-level ULA+ attribute tables
    this.ulaPlusAttrToInk = ulaPlusAttrToInk;
    this.ulaPlusAttrToPaper = ulaPlusAttrToPaper;

    this.reset();
  }

  /**
   * Resets the screen device to its initial state.
   */
  reset(): void {
    // --- No timing config yet
    this.config = undefined;

    // --- Create the pixel buffer
    this.pixelBufferField = new Uint32Array(BITMAP_SIZE);

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
    this.ulaStandardScreenAt0x4000 = true;
    this.ulaHiResMode = false;
    this.ulaHiResModeSampled = false;
    this.ulaHiResColor = 0;
    this.ulaHiColorMode = false;
    this.ulaHiColorModeSampled = false;

    // --- Initialize LoRes state
    this.loResEnabled = false;
    this.loResEnabledSampled = false;
    this.loResRadastanModeSampled = false;
    this.loResBlockByte = 0;
    this.loResScrollXSampled = 0;
    this.loResScrollYSampled = 0;

    // --- Initialize ULA+ state
    this.ulaPlusEnabledField = false;
    this.ulaPlusMode = 0;
    this.ulaPlusPaletteIndex = 0;

    // --- Initialize ULANext state
    this.ulaNextEnabledField = false;
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
    this.updateLayer2FastPathCaches();
    this.layer2ClipIndex = 0; // Clip window write index
    this.layer2ActiveRamBank = 8; // NextReg 0x12: default to bank 8 (soft reset value)
    this.layer2ShadowRamBank = 11; // NextReg 0x13: default to bank 11 (soft reset value)
    this.layer2UseShadowBank = false; // Port 0x123B bit 3: use active bank by default
    this.layer2Bank = 0; // Port 0x123B bits [7:6] + bit 3: mapping bank selector
    this.layer2EnableMappingForReads = false; // Port 0x123B bit 2: memory mapping disabled
    this.layer2EnableMappingForWrites = false; // Port 0x123B bit 0: memory mapping disabled
    this.machine.memoryDevice.updateFastPathFlags();

    // --- Initialize Tilemap state
    this.tilemapEnabled = false;
    this.tilemap80x32Resolution = false;
    this.tilemapEliminateAttributes = false;
    this.tilemapTextMode = false;
    this.tilemap512TileMode = false;
    this.tilemapForceOnTopOfUla = false;
    this.tilemapTransparencyIndex = 0x0f;
    this.tilemapClipIndex = 0;
    this.tilemapClipWindowX1 = 0;
    this.tilemapClipWindowX2 = 159;
    this.tilemapClipWindowY1 = 0;
    this.tilemapClipWindowY2 = 255;
    this.tilemapScrollXField = 0;
    this.tilemapScrollYField = 0;
    this.tilemapUseBank7 = false;
    this.tilemapBank5Msb = 0;
    this.tilemapTileDefUseBank7 = false;
    this.tilemapTileDefBank5Msb = 0;

    // --- Initialize Tilemap default attributes (Reg 0x6C)
    this.tilemapPaletteOffset = 0;
    this.tilemapXMirror = false;
    this.tilemapYMirror = false;
    this.tilemapRotate = false;
    this.tilemapUlaOver = false;
    this.tilemapDefaultAttrCache = 0;

    // --- Initialize sampled tilemap configuration
    this.tilemapTextModeSampled = false;
    this.tilemapEliminateAttrSampled = false;
    this.tilemap512TileModeSampled = false;

    // --- Initialize current tile state
    this.tilemapCurrentTileIndex = 0;
    this.tilemapCurrentAttr = 0;
    this.tilemapTileAttr = 0;
    this.tilemapNextTileAttr = 0;

    // --- Initialize tile transformation flags
    this.tilemapTilePriority = false;
    this.tilemapTilePaletteOffset = 0;

    // --- Initialize pixel buffer
    this.tilemapPixelBuffer0 = new Uint8Array(8);
    this.tilemapPixelBuffer1 = new Uint8Array(8);
    this.tilemapCurrentBuffer = 0;
    this.tilemapBufferPosition = 0;

    // --- Initialize fast path flags
    this.tilemapCanUseFastPath = false;

    // --- Initialize palette lookup cache
    this.tilemapLastPaletteIndex = -1;
    this.tilemapCachedRgb333 = null;
    this.tilemapCachedPaletteEntry = 0;

    // --- Initialize sprites state machine
    this.spritesBufferPosition = 0;
    this.spritesCurrentPixel = 0;
    this.spritesCurrentX = 0;
    this.spritesPatternData = null;
    this.spritesCurrentSprite = null;
    
    // --- Initialize sprite clip boundaries
    this.spritesClipXMin = 0;
    this.spritesClipXMax = 319;
    this.spritesClipYMin = 0;
    this.spritesClipYMax = 255;
    this.updateSpriteClipBoundaries();

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
    this.pulseIntActive = false;
    this.flashCounter = 0;
  }

  // ==============================================================================================
  // Public properties and methods used by the ZX Spectrum Next machine or its devices

  // Get the width of the rendered screen.
  screenWidth: number;

  // Get the number of visible screen lines.
  screenLines: number;

  // The aspect ratio of the screen pixels used in the rendered canvas
  getAspectRatio(): [number, number] {
    return [0.5, 1];
  }

  // Indicate that the device is requesting an interrupt
  requestsIrq(): boolean {
    return this.pulseIntActive;
  }

  // Get the current border color value
  get borderColor(): number {
    return this.borderColorField;
  }

  // Set the border color and update the cached RGB value
  // This optimization eliminates method calls for border pixels (~30% of pixels)
  set borderColor(value: number) {
    this.borderColorField = value;
    this.updateBorderRgbCache();
  }

  // Get the fallback color value
  get fallbackColor(): number {
    return this.fallbackColorField;
  }

  // Set the fallback color and update the cached RGB value
  set fallbackColor(value: number) {
    this.fallbackColorField = value;
    this.updateFallbackRgb333Cache();
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
    if (this.ulaPlusEnabledField) {
      // ULA+: Border uses palette indices 200-207 (for border colors 0-7)
      const ulaPlusPaletteIndex = 200 + this.borderColorField;
      this.borderRgbCache = this.paletteDevice.getUlaRgb333(ulaPlusPaletteIndex);
    } else {
      // Standard: Border uses palette indices 0-7
      this.borderRgbCache = this.paletteDevice.getUlaRgb333(this.borderColorField);
    }
  }

  // Test if ULA+ mode is enabled
  get ulaPlusEnabled(): boolean {
    return this.ulaPlusEnabledField;
  }

  // Enable or disable ULA+ mode and update the border RGB cache
  set ulaPlusEnabled(value: boolean) {
    this.ulaPlusEnabledField = value;
    this.updateBorderRgbCache();
  }

  // Test if ULA Next mode is enabled
  get ulaNextEnabled(): boolean {
    return this.ulaNextEnabledField;
  }

  // Enable or disable ULA Next mode and update the related caches
  set ulaNextEnabled(value: boolean) {
    this.ulaNextEnabledField = value;
    this.updateBorderRgbCache();
    this.updateFallbackRgb333Cache();
  }

  // Gets the Layer 2 X Scroll value (LSB and MSB combined)
  get layer2ScrollX(): number {
    return this.layer2ScrollXField;
  }

  // Sets the Layer 2 X Scroll value (LSB and MSB combined), updating related caches
  set layer2ScrollX(value: number) {
    this.layer2ScrollXField = value;
    this.updateLayer2FastPathCaches();
  }

  // Gets the Layer 2 Y Scroll value
  get layer2ScrollY(): number {
    return this.layer2ScrollYField;
  }

  // Sets the Layer 2 Y Scroll value, updating related caches
  set layer2ScrollY(value: number) {
    this.layer2ScrollYField = value;
    this.updateLayer2FastPathCaches();
  }

  // Gets the Layer 2 X Scroll value (LSB and MSB combined)
  get tilemapScrollX(): number {
    return this.tilemapScrollXField;
  }

  // Sets the Layer 2 X Scroll value (LSB and MSB combined), updating related caches
  set tilemapScrollX(value: number) {
    this.tilemapScrollXField = value;
    this.updateTilemapFastPathCaches();
  }

  // Gets the Layer 2 Y Scroll value
  get tilemapScrollY(): number {
    return this.tilemapScrollYField;
  }

  // Sets the Layer 2 Y Scroll value, updating related caches
  set tilemapScrollY(value: number) {
    this.tilemapScrollYField = value;
    this.updateTilemapFastPathCaches();
  }

  /**
   * Gets the value of Next register 0x6B (Tilemap Control)
   * Returns bits [7:0] = [enabled, 80x32, elimAttr, -, textMode, -, 512tile, forceOnTop]
   * Note: Bit 4 (second palette bank) is handled separately in PaletteDevice
   */
  get nextReg0x6bValue(): number {
    return (
      (this.tilemapEnabled ? 0x80 : 0) |
      (this.tilemap80x32Resolution ? 0x40 : 0) |
      (this.tilemapEliminateAttributes ? 0x20 : 0) |
      (this.tilemapTextMode ? 0x08 : 0) |
      (this.tilemap512TileMode ? 0x02 : 0) |
      (this.tilemapForceOnTopOfUla ? 0x01 : 0)
    );
  }

  /**
   * Sets the value of Next register 0x6B (Tilemap Control)
   * Accepts bits [7:0] = [enabled, 80x32, elimAttr, -, textMode, -, 512tile, forceOnTop]
   * Note: Bit 4 (second palette bank) must be handled separately in PaletteDevice
   */
  set nextReg0x6bValue(value: number) {
    const enabled = (value & 0x80) !== 0;
    const wasEnabled = this.tilemapEnabled;
    this.tilemapEnabled = enabled;

    // Clear tilemap outputs when disabling
    if (wasEnabled && !enabled) {
      this.tilemapPixel1Rgb333 = null;
      this.tilemapPixel2Rgb333 = null;
      this.tilemapPixel1Transparent = true;
      this.tilemapPixel2Transparent = true;
    }

    this.tilemap80x32Resolution = (value & 0x40) !== 0;
    this.tilemapEliminateAttributes = (value & 0x20) !== 0;
    this.tilemapTextMode = (value & 0x08) !== 0;
    this.tilemap512TileMode = (value & 0x02) !== 0;
    this.tilemapForceOnTopOfUla = (value & 0x01) !== 0;
  }

  /**
   * Returns the value of Next register 0x6C (Default Tilemap Attribute)
   * Returns bits [7:0] = [paletteOffset[3:0], xMirror, yMirror, rotate, ulaOver]
   */
  get nextReg0x6cValue(): number {
    return (
      (this.tilemapPaletteOffset << 4) |
      (this.tilemapXMirror ? 0x08 : 0) |
      (this.tilemapYMirror ? 0x04 : 0) |
      (this.tilemapRotate ? 0x02 : 0) |
      (this.tilemapUlaOver ? 0x01 : 0)
    );
  }

  /**
   * Sets the value of Next register 0x6C (Default Tilemap Attribute)
   * Accepts bits [7:0] = [paletteOffset[3:0], xMirror, yMirror, rotate, ulaOver]
   */
  set nextReg0x6cValue(value: number) {
    this.tilemapPaletteOffset = (value >> 4) & 0x0f;
    this.tilemapXMirror = (value & 0x08) !== 0;
    this.tilemapYMirror = (value & 0x04) !== 0;
    this.tilemapRotate = (value & 0x02) !== 0;
    this.tilemapUlaOver = (value & 0x01) !== 0;
    // Update cached default attribute value
    this.tilemapDefaultAttrCache = value & 0xff;
  }

  /**
   * This method renders the entire screen frame as the instant screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const pixelBuffer = new Uint32Array(this.pixelBufferField);
    if (savedPixelBuffer) {
      this.pixelBufferField = new Uint32Array(savedPixelBuffer);
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
    return this.pixelBufferField;
  }

  /**
   * Gets the buffer that stores the rendered pixels
   */
  getPixelBuffer(): Uint32Array {
    return this.pixelBufferField;
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

    this.renderingTacts = this.confTotalVC * this.confTotalHC;
    this.machine.setTactsInFrame(this.renderingTacts);

    // --- Update module-level active timing mode cache
    setActiveTimingMode(is60Hz);

    // Increment flash counter (cycles 0-31 for ~1 Hz flash rate at 50Hz)
    // Flash period: ~16 frames ON, ~16 frames OFF
    // Full cycle: ~32 frames (~0.64s at 50Hz, ~0.55s at 60Hz)
    this.flashCounter = (this.flashCounter + 1) & 0x1f;
    const newFlashFlag = this.flashCounter >= 16;

    // Switch active attribute lookup tables when flash state changes
    if (newFlashFlag !== this.flashFlag) {
      this.flashFlag = newFlashFlag;
      if (this.flashFlag) {
        this.ulaActiveAttrToInk = attrToInkFlashOn;
        this.ulaActiveAttrToPaper = attrToPaperFlashOn;
      } else {
        this.ulaActiveAttrToInk = attrToInkFlashOff;
        this.ulaActiveAttrToPaper = attrToPaperFlashOff;
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

  // ================================================================================================
  // Rendering Core
  //
  // The following properties and methods are used internally by the rendering pipeline.
  // ================================================================================================

  // This buffer stores the bitmap of the screen being rendered.
  // Each 32-bit value represents an ARGB pixel.
  private pixelBufferField: Uint32Array;

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
  tilemapPixel1Rgb333: number | null;
  tilemapPixel1Transparent: boolean;
  tilemapPixel2Rgb333: number | null;
  tilemapPixel2Transparent: boolean;
  private spritesPixel1Rgb333: number | null;
  private spritesPixel1Transparent: boolean;
  private spritesPixel2Rgb333: number | null;
  private spritesPixel2Transparent: boolean;

  // Render the pixel pair belonging to the specified frame tact. This method is the core
  // of the rendering pipeline, called once per tact in the frame.
  renderTact(tact: number): boolean {
    this.pulseIntActive = tact >= this.confIntStartTact && tact < this.confIntEndTact;

    // === BLANKING CHECK ===
    // All rendering flags have identical blanking regions (cell value 0) for a given frequency mode.
    // We can use active ULA rendering flags as the blanking mask for all layers.
    // If the cell is 0 in this flags array, it's 0 in all other flags arrays (blanking region).
    // Since totalHC == RENDERING_FLAGS_HC_COUNT, tact directly equals the 1D array index.
    if (activeRenderingFlagsULA[tact] === 0) {
      return false; // Skip blanking tact - no visible content in any layer
    }

    // --- Get pre-calculated (HC, VC) position from lookup tables
    const hc = activeTactToHC[tact];
    const vc = activeTactToVC[tact];

    // === ULA rendering
    if (this.loResEnabledSampled) {
      // LoRes mode (128×96, replaces ULA output)
      const loresCell = activeRenderingFlagsLoRes[tact];
      this.renderLoResPixel(vc, hc, loresCell);
    } else if (!this.ulaDisableOutputSampled) {
      if (this.ulaHiResModeSampled || this.ulaHiColorModeSampled) {
        // ULA Hi-Res and Hi-Color modes
        if (this.ulaHiResModeSampled) {
          // ULA Hi-Res mode (512×192, 2 pixels per HC)
          const ulaCell = activeRenderingFlagsULA[tact];
          this.renderULAHiResPixel(vc, hc, ulaCell);
        } else {
          // ULA Hi-Color mode (256×192)
          const ulaCell = activeRenderingFlagsULA[tact];
          this.renderULAHiColorPixel(vc, hc, ulaCell);
        }
      } else {
        // ULA Standard mode (256×192)
        const ulaCell = activeRenderingFlagsULA[tact];
        this.renderULAStandardPixel(vc, hc, ulaCell);
      }
    }

    // Render Layer 2 pixel(s) if enabled
    if (this.layer2Enabled) {
      if (this.layer2Resolution === 0) {
        // Layer 2 256×192 mode
        const layer2Cell = activeRenderingFlagsLayer2_256x192[tact];
        this.renderLayer2_256x192Pixel(vc, hc, layer2Cell);
      } else if (this.layer2Resolution === 1) {
        // Layer 2 320×256 mode
        const layer2Cell = activeRenderingFlagsLayer2_320x256[tact];
        this.renderLayer2_320x256Pixel(vc, hc, layer2Cell);
      } else if (this.layer2Resolution === 2) {
        // Layer 2 640×256 mode (Hi-Res, 2 pixels per HC)
        const layer2Cell = activeRenderingFlagsLayer2_640x256[tact];
        this.renderLayer2_640x256Pixel(vc, hc, layer2Cell);
      }
    }

    // Render Sprites pixel(s) if enabled
    if (this.spriteDevice.spritesEnabled) {
      const spritesCell = activeRenderingFlagsSprites[tact];
      this.renderSpritesPixel(vc, hc, spritesCell);
    }

    // Render Tilemap pixel(s) if enabled
    if (this.tilemapEnabled) {
      if (this.tilemap80x32Resolution) {
        // Tilemap 80×32 mode (Hi-Res, 2 pixels per HC)
        const tilemapCell = activeRenderingFlagsTilemap_80x32[tact];
        // Advanced Strategy: Use fast path when conditions allow
        if (this.tilemapCanUseFastPath) {
          this.renderTilemap_80x32Pixel_FastPath(vc, hc, tilemapCell);
        } else {
          this.renderTilemap_80x32Pixel(vc, hc, tilemapCell);
        }
      } else {
        // Tilemap 40×32 mode
        const tilemapCell = activeRenderingFlagsTilemap_40x32[tact];
        // Advanced Strategy: Use fast path when conditions allow
        if (this.tilemapCanUseFastPath) {
          this.renderTilemap_40x32Pixel_FastPath(vc, hc, tilemapCell);
        } else {
          this.renderTilemap_40x32Pixel(vc, hc, tilemapCell);
        }
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
    const bitmapOffset = activeTactToBitmapOffset[tact];
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
      this.pixelBufferField[bitmapOffset] = pixelRGBA1;

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
      this.pixelBufferField[bitmapOffset + 1] = pixelRGBA2;
    }

    // --- Visible pixel rendered
    return true;
  }

  // ==============================================================================================
  // Cache helpers

  // When Next registers, port values, or machine state change, we can pre-calculate some values
  // to speed up rendering. These methods are called by the machine or devices when relevant
  // state changes occur.

  // Cached border RGB333 value
  borderRgbCache: number;

  // Cached fallback RGB333 value
  fallbackRgb333Cache: number;

  // Updates the cached fallback RGB333 value when fallback color changes.
  private updateFallbackRgb333Cache(): void {
    const fallbackRgb332 = this.fallbackColorField;
    const blueLSB = (fallbackRgb332 & 0x02) | (fallbackRgb332 & 0x01);
    this.fallbackRgb333Cache = (fallbackRgb332 << 1) | blueLSB;
  }

  // Updates the cached fast path eligibility for Layer 2 rendering modes
  private updateLayer2FastPathCaches(): void {
    this.layer2R320x256CanUseFastPath =
      this.layer2ScrollXField === 0 &&
      this.layer2ScrollY === 0 &&
      this.layer2ClipWindowX1 === 0 &&
      this.layer2ClipWindowX2 === 159 &&
      this.layer2ClipWindowY1 === 0 &&
      this.layer2ClipWindowY2 === 255;

    this.layer2R256x192CanUseFastPath =
      this.layer2ScrollXField === 0 &&
      this.layer2ScrollY === 0 &&
      this.layer2ClipWindowX1 === 0 &&
      this.layer2ClipWindowX2 === 255 &&
      this.layer2ClipWindowY1 === 0 &&
      this.layer2ClipWindowY2 === 191;

    this.layer2R640x256CanUseFastPath =
      this.layer2ScrollXField === 0 &&
      this.layer2ScrollY === 0 &&
      this.layer2ClipWindowX1 === 0 &&
      this.layer2ClipWindowX2 === 159 &&
      this.layer2ClipWindowY1 === 0 &&
      this.layer2ClipWindowY2 === 255;
  }

  // Updates the cached fast path eligibility for Layer 2 rendering modes
  private updateTilemapFastPathCaches(): void {
    // Priority 1A: Update cached display coordinate calculations
    this.tilemapWideDisplayYStart = this.confDisplayYStart - 32;
    this.tilemapClipX1Cache_80x32 = Math.min(this.tilemapClipWindowX1 << 1, 639);
    this.tilemapClipX2Cache_80x32 = Math.min((this.tilemapClipWindowX2 << 1) | 1, 639);

    // Advanced Strategy: Determine if fast path can be used
    // Fast path requirements: no scroll, no transformations, full clip window
    this.tilemapCanUseFastPath =
      this.tilemapScrollXField === 0 &&
      this.tilemapScrollYField === 0 &&
      !this.tilemapXMirror &&
      !this.tilemapYMirror &&
      !this.tilemapRotate &&
      this.tilemapClipWindowX1 === 0 &&
      this.tilemapClipWindowX2 === 159 &&
      this.tilemapClipWindowY1 === 0 &&
      this.tilemapClipWindowY2 === 255;
  }

  // ==============================================================================================
  // Port updates
  //
  // These properties are used to get/set the values of special ports used by the ZX Spectrum Next
  // screen rendering.
  // ==============================================================================================

  // Timex port (0xff) ULA flags - The last 6 bit of the Timex port
  timexPortBits: number;

  set timexPortValue(value: number) {
    this.timexPortBits = value & 0x3f;
    this.ulaHiResColor = (value >> 3) & 0x07;
    this.ulaHiResInkRgb333 = this.paletteDevice.getUlaRgb333(this.ulaHiResColor);
    this.ulaHiResPaperRgb333 = this.paletteDevice.getUlaRgb333(7 - this.ulaHiResColor);
    const mode = value & 0x07;
    switch (mode) {
      case 0:
        this.ulaStandardScreenAt0x4000 = true;
        this.ulaHiColorMode = false;
        this.ulaHiResMode = false;
        break;
      case 1:
        this.ulaStandardScreenAt0x4000 = false;
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
  //
  // These properties are used to get/set the values of special Next registers used by the ZX
  // Spectrum Next screen rendering.
  // ==============================================================================================
  set nextReg0x05Value(value: number) {
    this.is60HzMode = (value & 0x04) !== 0;
    this.scandoublerEnabled = (value & 0x01) !== 0;
  }

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
    this.updateLayer2FastPathCaches();
  }

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

  get nextReg0x1bValue(): number {
    switch (this.tilemapClipIndex) {
      case 0:
        return this.tilemapClipWindowX1;
      case 1:
        return this.tilemapClipWindowX2;
      case 2:
        return this.tilemapClipWindowY1;
      default:
        return this.tilemapClipWindowY2;
    }
  }

  set nextReg0x1bValue(value: number) {
    switch (this.tilemapClipIndex) {
      case 0:
        this.tilemapClipWindowX1 = value;
        break;
      case 1:
        this.tilemapClipWindowX2 = value;
        break;
      case 2:
        this.tilemapClipWindowY1 = value;
        break;
      default:
        this.tilemapClipWindowY2 = value;
        break;
    }
    this.tilemapClipIndex = (this.tilemapClipIndex + 1) & 0x03;
  }

  set nextReg0x42Value(value: number) {
    this.ulaNextFormat = value;
    this.updateFallbackRgb333Cache();
  }

  get nextReg0x42Value(): number {
    return this.ulaNextFormat;
  }

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
    this.pixelBufferField.fill(0x00000000);
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

  // ==============================================================================================
  // ULA Rendering
  //
  // This section contains all properties and methods related to ULA rendering,
  // including ULA Standard, ULA Hi-Res, and ULA Hi-Color modes.
  // ==============================================================================================

  // Reg $1A - Clip Window ULA
  ulaClipWindowX1: number;
  ulaClipWindowX2: number;
  ulaClipWindowY1: number;
  ulaClipWindowY2: number;
  ulaClipIndex: number;
  // Reg $26 - ULA X Scroll
  ulaScrollX: number;
  // Reg $27 - ULA Y Scroll
  ulaScrollY: number;

  // Reg $68 [7] - ULA Control: When true, ULA output is disabled (ULA layer goes transparent)
  ulaDisableOutput: boolean;
  // Reg $68 [6:5] - Blending in SLU modes 6 & 7
  ulaBlendingInSLUModes: number;
  // Reg $68 [2] - Not used yet
  ulaHalfPixelScroll: boolean;
  // Reg $68 [0] - Enable stencil mode when both the ULA and tilemap are enabled
  ulaEnableStencilMode: boolean;

  // The start of the standard screen memory (true = 0x4000, false = 0x6000)
  ulaStandardScreenAt0x4000: boolean;
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

  // ULA+ Mode/Index register port (0xbf3b)
  private ulaPlusEnabledField: boolean;
  ulaPlusMode: number;
  ulaPlusPaletteIndex: number;

  // ULANext mode (NextReg 0x42, 0x43)
  private ulaNextEnabledField: boolean;
  ulaNextFormat: number;

  // ULA rendering state
  private ulaScrollXSampled: number;
  private ulaScrollYSampled: number;
  private ulaPixelByte1: number;
  private ulaPixelByte2: number;
  private ulaPixelByte3: number;
  private ulaPixelByte4: number;
  floatingBusValue: number;
  private ulaAttrByte1: number;
  private ulaAttrByte2: number;
  private ulaShiftReg: number;
  private ulaShiftAttr: number;
  private ulaShiftAttr2: number;
  private ulaShiftAttrCount: number;
  private ulaDisableOutputSampled: boolean;
  private ulaHiResModeSampled: boolean;
  private ulaHiColorModeSampled: boolean;
  private ulaHiResInkRgb333: number;
  private ulaHiResPaperRgb333: number;

  // Active attribute lookup tables (references to module-level tables, switch based on flash state)
  private ulaActiveAttrToInk: Uint8Array;
  private ulaActiveAttrToPaper: Uint8Array;

  // ULA+ attribute decode lookup tables (references to module-level shared tables)
  private ulaPlusAttrToInk: Uint8Array;
  private ulaPlusAttrToPaper: Uint8Array;

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
  private renderULAStandardPixel(vc: number, hc: number, cell: number): void {
    // === Display Area: ULA Standard Rendering ===
    // --- Scroll & mode sampling ---
    if ((cell & SCR_NREG_SAMPLE) !== 0) {
      this.sampleNextRegistersForUlaMode();

      // Calculate scrolled Y position with vertical scroll offset
      this.ulaScrollYSampled = vc - this.confDisplayYStart + this.ulaScrollYSampled;
      if (this.ulaScrollYSampled >= 0xc0) {
        this.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
      }
    }

    // --- Shift Register Load ---
    if ((cell & SCR_SHIFT_REG_LOAD) !== 0) {
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
    if ((cell & SCR_BYTE1_READ) !== 0) {
      // --- Calculate pixel address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;
      // Read pixel byte from Bank 5 or Bank 7
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);
      if (hc & 0x04) {
        this.ulaPixelByte2 = pixelByte;
      } else {
        this.ulaPixelByte1 = pixelByte;
      }

      // --- Update floating bus with pixel data
      if ((cell & SCR_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    if ((cell & SCR_BYTE2_READ) !== 0) {
      // --- Calculate attribute address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0a - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const attrAddr = ulaAttrLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

      // --- Read attribute byte from Bank 5 or Bank 7
      const ulaAttrByte = this.machine.memoryDevice.readScreenMemory(attrAddr);
      if (hc & 0x04) {
        this.ulaAttrByte2 = ulaAttrByte;
      } else {
        this.ulaAttrByte1 = ulaAttrByte;
      }

      // --- Update floating bus with attribute data
      if ((cell & SCR_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = ulaAttrByte;
      }
    }

    // === Border Area ===
    if ((cell & SCR_DISPLAY_AREA) === 0) {
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
        pixelRgb333 = this.paletteDevice.getUlaRgb333(paletteIndex);
      }
    } else if (this.ulaPlusEnabled) {
      // ULA+ Mode: Use 64-color palette (indices 192-255 in ULA palette)
      // Use pre-calculated lookup tables - no bit operations needed
      const ulaPaletteIndex = pixelBit
        ? this.ulaPlusAttrToInk[this.ulaShiftAttr]
        : this.ulaPlusAttrToPaper[this.ulaShiftAttr];
      pixelRgb333 = this.paletteDevice.getUlaRgb333(ulaPaletteIndex);
    } else {
      // Standard Mode: Use pre-calculated lookup tables with BRIGHT already applied
      // Direct palette index lookup (0-15) - no bit operations needed
      const paletteIndex = pixelBit
        ? this.ulaActiveAttrToInk[this.ulaShiftAttr]
        : this.ulaActiveAttrToPaper[this.ulaShiftAttr];
      pixelRgb333 = this.paletteDevice.getUlaRgb333(paletteIndex);
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
  private renderULAHiResPixel(vc: number, hc: number, cell: number): void {
    // === Display Area: ULA Standard Rendering ===
    // --- Scroll & mode sampling ---
    if ((cell & SCR_NREG_SAMPLE) !== 0) {
      this.sampleNextRegistersForUlaMode();

      // Calculate scrolled Y position with vertical scroll offset
      this.ulaScrollYSampled = vc - this.confDisplayYStart + this.ulaScrollYSampled;
      if (this.ulaScrollYSampled >= 0xc0) {
        this.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
      }
    }

    // --- Shift Register Load ---
    if ((cell & SCR_SHIFT_REG_LOAD) !== 0) {
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
    if ((cell & SCR_BYTE1_READ) !== 0) {
      // Calculate pixel address (same Y-dependent address as Standard mode)
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

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
      if ((cell & SCR_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    // --- Read pixel data from Bank 1 at HC subcycles 0x2, 0x6, 0xA, 0xE
    if ((cell & SCR_BYTE2_READ) !== 0) {
      // Calculate pixel address with 0x2000 offset for Bank 1
      const baseCol = (hc + 0x0a - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = 0x2000 | ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

      // Read from Bank 1 (0x6000-0x77FF range via 0x2000 offset)
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);

      // Store in byte buffer based on which 8-HC group we're in
      if (hc & 0x04) {
        this.ulaPixelByte4 = pixelByte; // Bank 1, second byte
      } else {
        this.ulaPixelByte2 = pixelByte; // Bank 1, first byte
      }

      // --- Update floating bus with pixel data
      if ((cell & SCR_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    // === Border Area ===
    if ((cell & SCR_BORDER_AREA) !== 0) {
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
          : this.paletteDevice.getUlaRgb333(index1);
      pixel2Rgb333 =
        index2 === 255
          ? this.machine.composedScreenDevice.fallbackRgb333Cache
          : this.paletteDevice.getUlaRgb333(index2);
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
  private renderULAHiColorPixel(vc: number, hc: number, cell: number): void {
    // === Display Area: ULA Standard Rendering ===
    // --- Scroll & mode sampling ---
    if ((cell & SCR_NREG_SAMPLE) !== 0) {
      this.sampleNextRegistersForUlaMode();

      // Calculate scrolled Y position with vertical scroll offset
      this.ulaScrollYSampled = vc - this.confDisplayYStart + this.ulaScrollYSampled;
      if (this.ulaScrollYSampled >= 0xc0) {
        this.ulaScrollYSampled -= 0xc0; // Wrap Y at 192 for vertical scrolling
      }
    }

    // --- Shift Register Load ---
    if ((cell & SCR_SHIFT_REG_LOAD) !== 0) {
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
    if ((cell & SCR_BYTE1_READ) !== 0) {
      // --- Calculate pixel address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;
      // Read pixel byte from Bank 5 or Bank 7
      const pixelByte = this.machine.memoryDevice.readScreenMemory(pixelAddr);
      if (hc & 0x04) {
        this.ulaPixelByte2 = pixelByte;
      } else {
        this.ulaPixelByte1 = pixelByte;
      }

      // --- Update floating bus with pixel data
      if ((cell & SCR_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = pixelByte;
      }
    }

    if ((cell & SCR_BYTE2_READ) !== 0) {
      // --- Calculate attribute address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0a - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const attrAddr = 0x2000 | ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

      // --- Read attribute byte from Bank 5 or Bank 7
      const ulaAttrByte = this.machine.memoryDevice.readScreenMemory(attrAddr);
      if (hc & 0x04) {
        this.ulaAttrByte2 = ulaAttrByte;
      } else {
        this.ulaAttrByte1 = ulaAttrByte;
      }

      // --- Update floating bus with attribute data
      if ((cell & SCR_FLOATING_BUS_UPDATE) !== 0) {
        this.floatingBusValue = ulaAttrByte;
      }
    }

    // === Border Area ===
    if ((cell & SCR_DISPLAY_AREA) === 0) {
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
        pixelRgb333 = this.paletteDevice.getUlaRgb333(paletteIndex);
      }
    } else {
      // Standard HiColor mode: Use pre-calculated lookup tables with BRIGHT already applied
      // Direct palette index lookup (0-15) - no bit operations needed
      const paletteIndex = pixelBit
        ? this.ulaActiveAttrToInk[this.ulaShiftAttr]
        : this.ulaActiveAttrToPaper[this.ulaShiftAttr];
      pixelRgb333 = this.paletteDevice.getUlaRgb333(paletteIndex);
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

  // Samples Next registers for ULA mode
  private sampleNextRegistersForUlaMode(): void {
    // --- Scroll
    this.ulaScrollXSampled = this.ulaScrollX;
    this.ulaScrollYSampled = this.ulaScrollY;

    // --- ULA Standard mode
    this.ulaDisableOutputSampled = this.ulaDisableOutput;

    // --- ULA Hi-Res mode
    this.ulaHiResModeSampled = this.ulaHiResMode;
    // --- ULA Hi-Color mode
    this.ulaHiColorModeSampled = this.ulaHiColorMode;

    // --- Lo-Res mode
    this.loResEnabledSampled = this.loResEnabled;
  }

  // ==============================================================================================
  // LoRes Rendering
  //
  // This section contains all properties and methods related to LoRes rendering,
  // including Standard LoRes and Radastan LoRes modes.
  // ==============================================================================================

  // Reg 0x15 [7] - LoRes mode
  loResEnabled: boolean;
  // Reg $32 - LoRes X Scroll
  loResScrollX: number;
  // Reg $33 - LoRes Y Scroll
  loResScrollY: number;
  // Reg 0x6A [5] - LoRes is Radastan mode (128x96x4, 6144 bytes)
  loResRadastanMode: boolean;
  // Reg 0x6A [4] - LoRes Radastan timex display file xor
  loResRadastanTimexXor: boolean;
  // Reg 0x6A [3:0] - LoRes palette offset (multiplied by 16; bits 1:0 apply in ULA+ mode)
  loResPaletteOffset: number;

  // LoRes rendering state
  private loResEnabledSampled: boolean;
  private loResRadastanModeSampled: boolean;
  private loResBlockByte: number; // Current block data byte
  private loResScrollXSampled: number; // Sampled X scroll for LoRes
  private loResScrollYSampled: number; // Sampled Y scroll for LoRes

  // Optimization: pre-computed display coordinates (computed once, reused multiple times)
  private loResDisplayHC: number;
  private loResDisplayVC: number;

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
  private renderLoResPixel(vc: number, hc: number, cell: number): void {
    // === STAGE 1: Scroll & Mode Sampling ===
    if ((cell & SCR_NREG_SAMPLE) !== 0) {
      // Sample scroll registers and mode flags
      this.loResScrollXSampled = this.loResScrollX;
      this.loResScrollYSampled = this.loResScrollY;
      this.loResEnabledSampled = this.loResEnabled;
      this.loResRadastanModeSampled = this.loResRadastanMode;
    }

    // === STAGE 2: Block Memory Fetch ===
    // Fetch every 2 HC positions (one LoRes block = 2×2 pixels in 256×192 space)
    // Standard mode: each byte = 2×2 pixels, Radastan: each byte = 2 nibbles for 2×4 pixels
    if ((cell & SCR_BYTE1_READ) !== 0) {
      // Calculate display coordinates once (will be reused in pixel generation stage)
      this.loResDisplayHC = hc - this.confDisplayXStart;
      this.loResDisplayVC = vc - this.confDisplayYStart;

      // Apply scroll (matching VHDL: x <= hc_i(7 downto 0) + scroll_x_i)
      const x = (this.loResDisplayHC + this.loResScrollXSampled) & 0xff;

      // Apply Y scroll with 192-line wrap using pre-computed lookup table
      const y = loResYWrapTable[this.loResDisplayVC + this.loResScrollYSampled];

      // Fetch when entering new block horizontally
      // Standard mode: fetch when x[0]=0 (every 2 pixels)
      // Radastan mode: fetch when x[1:0]=0 (every 4 pixels)
      const shouldFetch = !this.loResRadastanModeSampled ? (x & 0x01) === 0 : (x & 0x03) === 0;

      if (shouldFetch) {
        let blockAddr: number;

        if (!this.loResRadastanModeSampled) {
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
          blockAddr = (this.loResRadastanTimexXor ? 0x2000 : 0) | ((y >> 1) << 6) | (x >> 2);
        }

        // Read from Bank 5 memory (ULA memory space)
        this.loResBlockByte = this.machine.memoryDevice.readScreenMemory(blockAddr);
      }
    }

    // === STAGE 3: Border Area ===
    if ((cell & SCR_DISPLAY_AREA) === 0) {
      // Border uses cached border RGB value (same as ULA)
      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = this.borderRgbCache;
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = false;
      return;
    }

    // === STAGE 4: Pixel Generation ===
    // Generate pixel from block byte (happens every HC position)
    // Calculate display coordinates for clipping test
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;

    // Apply scroll to get pixel position (matching VHDL)
    const x = (displayHC + this.loResScrollXSampled) & 0xff;
    let pixelRgb333: number;

    if (!this.loResRadastanModeSampled) {
      // Standard LoRes: 8-bit color with palette offset on high nibble
      // VHDL: pixel_lores_nib_H <= lores_data_i(7 downto 4) + lores_palette_offset_i
      //       lores_pixel_o <= pixel_lores_nib_H & lores_data_i(3 downto 0)
      // High nibble gets palette offset added, low nibble used directly
      const highNibble = ((this.loResBlockByte >> 4) + this.loResPaletteOffset) & 0x0f;
      const lowNibble = this.loResBlockByte & 0x0f;
      const paletteIndex = (highNibble << 4) | lowNibble;
      pixelRgb333 = this.paletteDevice.getUlaRgb333(paletteIndex);
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
        paletteIndex = 0xc0 | ((this.loResPaletteOffset & 0x03) << 2) | nibble;
      } else {
        // Standard mode: palette offset in upper nibble
        paletteIndex = ((this.loResPaletteOffset & 0x0f) << 4) | nibble;
      }

      pixelRgb333 = this.paletteDevice.getUlaRgb333(paletteIndex);
    }

    // === STAGE 5: Clipping Test ===
    // Check if pixel is within ULA clip window (LoRes uses ULA clip window)
    // Use display-area coordinates for clipping (same as ULA Standard mode)
    const clipped =
      displayHC < this.ulaClipWindowX1 ||
      displayHC > this.ulaClipWindowX2 ||
      displayVC < this.ulaClipWindowY1 ||
      displayVC > this.ulaClipWindowY2;

    // === STAGE 6: Return Layer Output ===
    this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = pixelRgb333;
    this.ulaPixel1Transparent = this.ulaPixel2Transparent =
      pixelRgb333 >> 1 === this.globalTransparencyColor || clipped;
  }

  // ==============================================================================================
  // Layer 2 Rendering
  //
  // This section contains all properties and methods related to Layer 2 rendering.
  // ==============================================================================================

  // Reg $12 - Layer 2 active RAM bank
  layer2ActiveRamBank: number;
  // Reg $13 - Layer 2 shadow RAM bank
  layer2ShadowRamBank: number;
  // Reg $16 - Layer 2 X Scroll LSB combined with Reg $71 - Layer 2 X Scroll MSB
  private layer2ScrollXField: number;
  // Reg $17 - Layer 2 Y Scroll
  private layer2ScrollYField: number;
  // Reg $18 - Layer 2 Clip Window
  layer2ClipWindowX1: number;
  layer2ClipWindowX2: number;
  layer2ClipWindowY1: number;
  layer2ClipWindowY2: number;
  layer2ClipIndex: number;
  // Reg $70 [5:4] - Layer 2 control: 0 = 256x192, 1 = 320x256, 2 = 640x256
  layer2Resolution: number;
  // Reg $70 [3:0] - Layer 2 control flags: Palette offset
  layer2PaletteOffset: number;
  // === Layer 2 port (0x123b) flags
  layer2Enabled: boolean;
  layer2Bank: number;
  layer2BankOffset: number; // 3-bit offset applied to bank address (bits 2:0 when port bit 4=1)
  layer2UseShadowBank: boolean;
  layer2EnableMappingForReads: boolean;
  layer2EnableMappingForWrites: boolean;

  // Layer 2 rendering state
  private layer2R320x256CanUseFastPath: boolean;
  private layer2R256x192CanUseFastPath: boolean;
  private layer2R640x256CanUseFastPath: boolean;
  private layer2Scanline192Y: number;
  private layer2Scanline192Bank: number;
  private layer2Scanline320x256Y: number;
  private layer2Scanline320x256Bank: number;
  private layer2Scanline640x256Y: number;
  private layer2Scanline640x256Bank: number;
  // Cache bank calculations for sequential pixel access (Priority 2E)
  private layer2LastOffset: number = -1;
  private layer2LastBank16K: number = -1;
  private layer2LastMemoryBase: number = -1;

  /**
   * Render Layer 2 256×192 mode pixel (optimized version).
   * @param vc Vertical counter position
   * @param hc Horizontal counter position
   * @param cell Layer 2 rendering cell with activity flags
   */
  private renderLayer2_256x192Pixel(vc: number, hc: number, cell: number): void {
    if (!cell) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Phase 1: Prepare scanline state (would be cached per scanline in real implementation)
    const scanlineValid = this.prepareScanlineState192(vc);

    // Phase 1: Early rejection for clipped/invalid scanlines
    if (!scanlineValid) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Phase 2: Fast path for unscrolled, unclipped content
    if (this.layer2R256x192CanUseFastPath) {
      this.renderLayer2_256x192Pixel_FastPath(hc);
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

    const offset = (this.layer2Scanline192Y << 8) | x;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(this.layer2Scanline192Bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
    const priority = (rgb333 & 0x100) !== 0;

    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = rgb333 & 0x1ff;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = false;
    this.layer2Pixel1Priority = this.layer2Pixel2Priority = priority;
  }

  /**
   * Prepare scanline state for 256×192 mode rendering.
   * Precomputes all per-scanline constants to avoid redundant calculations.
   * Phase 1: Scanline-based state precomputation for 256×192 mode.
   * @returns true if scanline is valid and visible, false otherwise
   */
  private prepareScanlineState192(vc: number): boolean {
    const displayVC = vc - this.confDisplayYStart;

    // Early rejection: outside display area
    if (displayVC < 0 || displayVC >= 192) {
      return false;
    }

    // Early rejection: clipped by Y bounds
    if (displayVC < this.layer2ClipWindowY1 || displayVC > this.layer2ClipWindowY2) {
      return false;
    }

    // Pre-calculate Y coordinate with modulo and store in member variable
    this.layer2Scanline192Y = (displayVC + this.layer2ScrollY) % 192;

    // Pre-select bank and store in member variable
    this.layer2Scanline192Bank = this.layer2UseShadowBank
      ? this.layer2ShadowRamBank
      : this.layer2ActiveRamBank;

    return true;
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
    if (this.layer2LastBank16K === bank16K && (offset ^ this.layer2LastOffset) < 0x2000) {
      // Fast path: reuse cached bank calculation
      const offsetWithin8K = offset & 0x1fff;
      return this.machine.memoryDevice.memory[this.layer2LastMemoryBase + offsetWithin8K] || 0;
    }

    // Slow path: recalculate and update cache
    const segment16K = (offset >> 14) & 0x07;
    const half8K = (offset >> 13) & 0x01;
    const bank8K = (bank16K + segment16K) * 2 + half8K;
    const memoryBase = OFFS_NEXT_RAM + (bank8K << 13);

    // Update cache
    this.layer2LastOffset = offset;
    this.layer2LastBank16K = bank16K;
    this.layer2LastMemoryBase = memoryBase;

    const offsetWithin8K = offset & 0x1fff;
    return this.machine.memoryDevice.memory[memoryBase + offsetWithin8K] || 0;
  }

  /**
   * Fast path for 256×192 mode with no scrolling and full clip window.
   * Phase 2: Optimized rendering for common unscrolled case.
   */
  private renderLayer2_256x192Pixel_FastPath(hc: number): void {
    const displayHC = hc - this.confDisplayXStart;

    // Fast bounds check (no clipping needed)
    if (displayHC < 0 || displayHC >= 256) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Direct memory access: offset = (y << 8) | x
    const offset = (this.layer2Scanline192Y << 8) | displayHC;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(this.layer2Scanline192Bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
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
    if (!cell) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Priority 1A: Prepare scanline state (would be cached per scanline in real implementation)
    const scanlineValid = this.prepareScanlineState320x256(vc);

    // Priority 1B: Early rejection for clipped/invalid scanlines
    if (!scanlineValid) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Priority 3H: Fast path for unscrolled, unclipped content
    if (this.layer2R320x256CanUseFastPath) {
      this.renderLayer2_320x256Pixel_FastPath(hc);
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
    const x = layer2XWrappingTableWide[x_pre & 0x3ff];

    // Priority 2E: Use cached bank access
    const offset = (x << 8) | this.layer2Scanline320x256Y;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(this.layer2Scanline320x256Bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
    const priority = (rgb333 & 0x100) !== 0;

    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = rgb333 & 0x1ff;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = false;
    this.layer2Pixel1Priority = this.layer2Pixel2Priority = priority;
  }

  /**
   * Prepare scanline state for 320×256 mode rendering.
   * Precomputes all per-scanline constants to avoid redundant calculations.
   * Priority 1A: Scanline-based state precomputation.
   * @returns true if scanline is valid and visible, false otherwise
   */
  private prepareScanlineState320x256(vc: number): boolean {
    const displayVC = vc - this.confDisplayYStart;
    const displayVC_wide = displayVC + 32;
    const vc_valid = displayVC_wide >= 0 && displayVC_wide < 256;

    // Priority 1B: Early scanline rejection
    if (!vc_valid) {
      return false;
    }

    const clipY1 = this.layer2ClipWindowY1;
    const clipY2 = this.layer2ClipWindowY2;
    const clippedByVertical = displayVC_wide < clipY1 || displayVC_wide > clipY2;

    // Priority 1B: Early scanline rejection for clipped scanlines
    if (clippedByVertical) {
      return false;
    }

    const y_pre = displayVC_wide + this.layer2ScrollY;
    this.layer2Scanline320x256Y = y_pre & 0xff;
    this.layer2Scanline320x256Bank = this.layer2UseShadowBank
      ? this.layer2ShadowRamBank
      : this.layer2ActiveRamBank;

    return true;
  }

  /**
   * Fast path for 320×256 mode with no scrolling and full clip window.
   * Priority 1C & 3H: Optimized memory access for common case.
   */
  private renderLayer2_320x256Pixel_FastPath(hc: number): void {
    const displayHC_wide = hc - this.confDisplayXStart + 32;

    // Fast bounds check (no clipping needed)
    if (displayHC_wide >= 320) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Sequential memory access: offset = (x << 8) | y
    // Priority 2E: Use cached bank access for sequential pixels
    const offset = (displayHC_wide << 8) | this.layer2Scanline320x256Y;
    const pixelValue = this.getLayer2PixelFromSRAM_Cached(this.layer2Scanline320x256Bank, offset);

    if (pixelValue === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);
    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
    const priority = (rgb333 & 0x100) !== 0;

    this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = rgb333 & 0x1ff;
    this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = false;
    this.layer2Pixel1Priority = this.layer2Pixel2Priority = priority;
  }

  /**
   * Prepare scanline state for 640×256 mode rendering.
   * Precomputes all per-scanline constants to avoid redundant calculations.
   * Priority 1A: Scanline-based state precomputation.
   * @returns true if scanline is valid and visible, false otherwise
   */
  private prepareScanlineState640x256(vc: number): boolean {
    const displayVC = vc - this.confDisplayYStart;
    const displayVC_wide = displayVC + 32;
    const vc_valid = displayVC_wide >= 0 && displayVC_wide < 256;

    // Priority 1B: Early scanline rejection
    if (!vc_valid) {
      return false;
    }

    const clipY1 = this.layer2ClipWindowY1;
    const clipY2 = this.layer2ClipWindowY2;
    const clippedByVertical = displayVC_wide < clipY1 || displayVC_wide > clipY2;

    // Priority 1B: Early scanline rejection for clipped scanlines
    if (clippedByVertical) {
      return false;
    }

    const y_pre = displayVC_wide + this.layer2ScrollY;
    this.layer2Scanline640x256Y = y_pre & 0xff;
    this.layer2Scanline640x256Bank = this.layer2UseShadowBank
      ? this.layer2ShadowRamBank
      : this.layer2ActiveRamBank;

    return true;
  }

  /**
   * Render Layer 2 640×256 mode pixel (cloned from 320×256 for step 1).
   * @param vc Vertical counter position
   * @param hc Horizontal counter position
   * @param cell Layer 2 rendering cell with activity flags
   */
  private renderLayer2_640x256Pixel(vc: number, hc: number, cell: number): void {
    if (!cell) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Priority 1A: Prepare scanline state (would be cached per scanline in real implementation)
    const scanlineValid = this.prepareScanlineState640x256(vc);

    // Priority 1B: Early rejection for clipped/invalid scanlines
    if (!scanlineValid) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Priority 3H: Fast path for unscrolled, unclipped content
    if (this.layer2R640x256CanUseFastPath) {
      this.renderLayer2_640x256Pixel_FastPath(hc);
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
    const x = layer2XWrappingTableWide[x_pre & 0x3ff];

    // Priority 2E: Use cached bank access
    const offset = (x << 8) | this.layer2Scanline640x256Y;
    const pixelByte = this.getLayer2PixelFromSRAM_Cached(this.layer2Scanline640x256Bank, offset);

    // Extract two 4-bit pixels from the byte (per VHDL line 206)
    // Lower nibble [3:0] = pixel1 (left pixel, output first)
    // Upper nibble [7:4] = pixel2 (right pixel, output second)
    const pixel1_4bit = pixelByte & 0x0f;
    const pixel2_4bit = (pixelByte >> 4) & 0x0f;

    // Process pixel 1 (left pixel)
    // In 640x256 mode, palette index = (palette_offset << 4) | pixel_4bit
    const paletteIndex1 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel1_4bit;

    if (paletteIndex1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = 0;
      this.layer2Pixel1Transparent = true;
      this.layer2Pixel1Priority = false;
    } else {
      const rgb333_1 = this.paletteDevice.getLayer2Rgb333(paletteIndex1);
      const priority1 = (rgb333_1 & 0x100) !== 0;

      this.layer2Pixel1Rgb333 = rgb333_1 & 0x1ff;
      this.layer2Pixel1Transparent = false;
      this.layer2Pixel1Priority = priority1;
    }

    // Process pixel 2 (right pixel)
    const paletteIndex2 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel2_4bit;

    if (paletteIndex2 === this.globalTransparencyColor) {
      this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel2Transparent = true;
      this.layer2Pixel2Priority = false;
    } else {
      const rgb333_2 = this.paletteDevice.getLayer2Rgb333(paletteIndex2);
      const priority2 = (rgb333_2 & 0x100) !== 0;

      this.layer2Pixel2Rgb333 = rgb333_2 & 0x1ff;
      this.layer2Pixel2Transparent = false;
      this.layer2Pixel2Priority = priority2;
    }
  }

  /**
   * Fast path for 640×256 mode with no scrolling and full clip window.
   * Priority 1C & 3H: Optimized memory access for common case.
   */
  private renderLayer2_640x256Pixel_FastPath(hc: number): void {
    const displayHC_wide = hc - this.confDisplayXStart + 32;

    // Fast bounds check (no clipping needed)
    if (displayHC_wide >= 320) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Sequential memory access: offset = (x << 8) | y
    // Priority 2E: Use cached bank access for sequential pixels
    const offset = (displayHC_wide << 8) | this.layer2Scanline640x256Y;
    const pixelByte = this.getLayer2PixelFromSRAM_Cached(this.layer2Scanline640x256Bank, offset);

    // Extract two 4-bit pixels from the byte (per VHDL line 206)
    // Lower nibble [3:0] = pixel1 (left pixel, output first)
    // Upper nibble [7:4] = pixel2 (right pixel, output second)
    const pixel1_4bit = pixelByte & 0x0f;
    const pixel2_4bit = (pixelByte >> 4) & 0x0f;

    // Process pixel 1 (left pixel)
    const paletteIndex1 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel1_4bit;

    if (paletteIndex1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = 0;
      this.layer2Pixel1Transparent = true;
      this.layer2Pixel1Priority = false;
    } else {
      const rgb333_1 = this.paletteDevice.getLayer2Rgb333(paletteIndex1);
      const priority1 = (rgb333_1 & 0x100) !== 0;

      this.layer2Pixel1Rgb333 = rgb333_1 & 0x1ff;
      this.layer2Pixel1Transparent = false;
      this.layer2Pixel1Priority = priority1;
    }

    // Process pixel 2 (right pixel)
    const paletteIndex2 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel2_4bit;

    if (paletteIndex2 === this.globalTransparencyColor) {
      this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel2Transparent = true;
      this.layer2Pixel2Priority = false;
    } else {
      const rgb333_2 = this.paletteDevice.getLayer2Rgb333(paletteIndex2);
      const priority2 = (rgb333_2 & 0x100) !== 0;

      this.layer2Pixel2Rgb333 = rgb333_2 & 0x1ff;
      this.layer2Pixel2Transparent = false;
      this.layer2Pixel2Priority = priority2;
    }
  }

  // ==============================================================================================
  // Tilemap Rendering
  //
  // This section contains all properties and methods related to Tilemap rendering.
  // ==============================================================================================

  // Reg $1B - Clip Window Tilemap
  tilemapClipWindowX1: number;
  tilemapClipWindowX2: number;
  tilemapClipWindowY1: number;
  tilemapClipWindowY2: number;
  tilemapClipIndex: number;

  // Reg $30 - Tilemap X Scroll LSB combined with Reg $2F - Tilemap X Scroll MSB
  private tilemapScrollXField: number;
  // Reg $31 - Tilemap Y Scroll
  private tilemapScrollYField: number;
  // REG $4C - Tilemap transparency index
  tilemapTransparencyIndex: number;
  // Reg 0x6B [7] - Enable the tilemap
  tilemapEnabled: boolean;
  // Reg 0x6B [6] - Tilemap resolution: 0 = 40x32, 1 = 80x32
  tilemap80x32Resolution: boolean;
  // Reg 0x6B [5] - Eliminate the attribute entry in the tilemap
  tilemapEliminateAttributes: boolean;
  // Reg 0x6B [3] - Tilemap mode: 0 = Graphics, 1 = Text
  tilemapTextMode: boolean;
  // Reg 0x6B [1] - Activate 512 tile mode
  tilemap512TileMode: boolean;
  // Reg 0x6B [0] - Force tilemap on top of ULA
  tilemapForceOnTopOfUla: boolean;
  // Reg $6C [7:4] - Palette offset
  tilemapPaletteOffset: number;
  // Reg $6C [3] - X Mirror
  tilemapXMirror: boolean;
  // Reg $6C [2] - Y Mirror
  tilemapYMirror: boolean;
  // Reg $6C [1] - Rotate 90 degrees
  tilemapRotate: boolean;
  // Reg $6C [0] - ULA Over Tilemap (or bit 8 of the tile number if 512 tile mode is enabled)
  tilemapUlaOver: boolean;
  // --- Cached default attribute value (Reg 0x6C) for when attributes are eliminated
  tilemapDefaultAttrCache: number;
  // Reg $6E [7] - true to select bank 7, false to select bank 5
  tilemapUseBank7: boolean;
  // Reg $6E [5:0] - MSB of address of the tilemap in Bank 5
  tilemapBank5Msb: number;
  // Reg $6F [7] - true to select bank 7, false to select bank 5
  tilemapTileDefUseBank7: boolean;
  // Reg $6F [5:0] - MSB of address of the tile definitions in Bank 5
  tilemapTileDefBank5Msb: number;

  // --- Sampled tilemap configuration (sampled based on rendering flags)
  private tilemapTextModeSampled: boolean; // Sampled at tile boundaries
  private tilemapEliminateAttrSampled: boolean; // Sampled at tile boundaries
  private tilemap512TileModeSampled: boolean; // Sampled at tile boundaries

  // --- Current tile being rendered
  private tilemapCurrentTileIndex: number;
  private tilemapCurrentAttr: number;
  private tilemapTileAttr: number; // Current tile's attribute (double-buffered for text mode)
  private tilemapNextTileAttr: number; // Next tile's attribute (fetched ahead)

  // --- Current tile transformation flags (for rendering)
  private tilemapTilePriority: boolean;
  private tilemapTilePaletteOffset: number;

  // --- Next tile transformation flags (fetched ahead, applied at tile boundary)
  private tilemapNextTileXMirror: boolean;
  private tilemapNextTileYMirror: boolean;
  private tilemapNextTileRotate: boolean;
  private tilemapNextTilePaletteOffset: number;

  // --- Pixel buffers for double-buffering (current tile and next tile)
  private tilemapPixelBuffer0: Uint8Array; // 8 entries, 4-bit indices
  private tilemapPixelBuffer1: Uint8Array; // 8 entries, 4-bit indices
  private tilemapCurrentBuffer: number; // 0 or 1, which buffer is currently being rendered
  private tilemapBufferPosition: number; // 0-7, which pixel to read next

  // --- Cached computed values (Priority 1A optimization)
  private tilemapWideDisplayYStart: number; // Cached: confDisplayYStart - 32
  private tilemapClipX1Cache_80x32: number; // Cached: Math.min((tilemapClipWindowX1 << 1), 639)
  private tilemapClipX2Cache_80x32: number; // Cached: Math.min((tilemapClipWindowX2 << 1) | 1, 639)

  // --- Fast path optimization flags
  private tilemapCanUseFastPath: boolean;

  // --- Palette lookup cache (reduces redundant lookups)
  private tilemapLastPaletteIndex: number;
  private tilemapCachedRgb333: number | null;
  private tilemapCachedPaletteEntry: number;

  /**
   * Get tilemap data byte from VRAM (bank 5 or 7).
   * @param useBank7 - true for bank 7, false for bank 5
   * @param offset - 6-bit MSB offset within bank (base address bits [13:8])
   * @param address - 14-bit address within the tilemap/tile definition region
   * @returns Byte value from VRAM
   */
  private getTilemapVRAM(useBank7: boolean, offset: number, address: number): number {
    // Address calculation per VHDL tilemap.vhd line 404:
    // tm_mem_addr_o <= (tm_mem_addr_sub(13:8) + tm_mem_addr_offset(5:0)) & tm_mem_addr_sub(7:0)
    // The offset (MSB from reg $6E/$6F bits 5:0) is added to the high byte of the address
    const highByte = ((offset & 0x3f) + ((address >> 8) & 0x3f)) & 0x3f;
    const fullAddress = (highByte << 8) | (address & 0xff);

    // Bank selection: Bank 5 or Bank 7 (these are 16K RAM banks in ZX Next)
    // OFFS_BANK_05 = 0x054000, OFFS_BANK_07 = 0x05c000
    const bankBase = useBank7 ? OFFS_BANK_07 : OFFS_BANK_05;
    const physicalAddress = bankBase + fullAddress;

    // Priority 1D: Access cached memory array (eliminates property chain traversal)
    return this.memoryArrayCache[physicalAddress] || 0;
  }

  /**
   * Apply tile transformations (mirror/rotate) to pixel coordinates within tile.
   * Implements the transformation logic per ZX Spectrum Next hardware specification.
   *
   * @param xInTile - X coordinate within tile (0-7)
   * @param yInTile - Y coordinate within tile (0-7)
   * @param xMirror - Horizontal flip flag
   * @param yMirror - Vertical flip flag
   * @param rotate - 90° clockwise rotation flag
   * @returns Transformed coordinates
   */
  private applyTileTransformation(
    xInTile: number,
    yInTile: number,
    xMirror: boolean,
    yMirror: boolean,
    rotate: boolean
  ): { transformedX: number; transformedY: number } {
    // Apply transformations per hardware specification
    let effectiveX = xInTile;
    let effectiveY = yInTile;

    // Step 1: Rotation XOR X-Mirror determines effective X mirror
    const effectiveXMirror = xMirror !== rotate; // XOR operation

    // Step 2: Apply X Mirror
    if (effectiveXMirror) {
      effectiveX = 7 - effectiveX;
    }

    // Step 3: Apply Y Mirror
    if (yMirror) {
      effectiveY = 7 - effectiveY;
    }

    // Step 4: Apply Rotation (swap coordinates)
    const transformedX = rotate ? effectiveY : effectiveX;
    const transformedY = rotate ? effectiveX : effectiveY;

    return { transformedX, transformedY };
  }

  /**
   * Fetch tile index from tilemap VRAM.
   * Called when SCR_TILE_INDEX_FETCH flag is set.
   * @param absX - Absolute X coordinate in tilemap
   * @param absY - Absolute Y coordinate in tilemap
   * @param mode80x32 - true for 80×32 mode, false for 40×32 mode
   * @param attrEliminated - true if attributes are eliminated
   */
  /**
   * Fetch tile attribute from tilemap VRAM.
   * Called when SCR_TILE_ATTR_FETCH flag is set.
   * Must be called after fetchTilemapTileIndex.
   * @param absX - Absolute X coordinate in tilemap
   * @param absY - Absolute Y coordinate in tilemap
   * @param mode80x32 - true for 80×32 mode, false for 40×32 mode
   * @param attrEliminated - true if attributes are eliminated
   */
  /**
   * Fetch tile pattern pixels and populate buffer.
   * Called when SCR_PATTERN_FETCH flag is set.
   * Tile index and attributes must have been fetched previously.
   * @param absX - Absolute X coordinate in tilemap
   * @param absY - Absolute Y coordinate in tilemap
   * @param textMode - true for text mode, false for graphics mode
   */
  private fetchTilemapPattern(absY: number, textMode: boolean): void {
    // For each pixel position within the tile (0-7), apply transformation
    // xInTile and yInTile are positions WITHIN the 8x8 tile, not absolute coordinates
    // Note: absX is passed for API consistency but not used (tile is identified by previously fetched index)
    // Use "next" transformation flags which were set during tile index/attr fetch
    // Write to the NEXT buffer (not currently being rendered)
    const nextBuffer =
      this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer1 : this.tilemapPixelBuffer0;
    const yInTile = absY & 0x07;

    if (textMode) {
      // Text mode: fetch all 8 pixels WITHOUT transformations (rotation/mirror ignored)
      const patternAddr = this.tilemapCurrentTileIndex * 8 + yInTile;
      const patternByte = this.getTilemapVRAM(
        this.tilemapTileDefUseBank7,
        this.tilemapTileDefBank5Msb,
        patternAddr
      );

      nextBuffer[0] = (patternByte >> 7) & 0x01;
      nextBuffer[1] = (patternByte >> 6) & 0x01;
      nextBuffer[2] = (patternByte >> 5) & 0x01;
      nextBuffer[3] = (patternByte >> 4) & 0x01;
      nextBuffer[4] = (patternByte >> 3) & 0x01;
      nextBuffer[5] = (patternByte >> 2) & 0x01;
      nextBuffer[6] = (patternByte >> 1) & 0x01;
      nextBuffer[7] = patternByte & 0x01;
    } else {
      // Graphics mode: fetch 8 pixels with transformations
      for (let xInTile = 0; xInTile < 8; xInTile++) {
        // Apply transformation to get which row, byte, and nibble to read from pattern
        const { transformedX, transformedY } = this.applyTileTransformation(
          xInTile,
          yInTile,
          this.tilemapNextTileXMirror,
          this.tilemapNextTileYMirror,
          this.tilemapNextTileRotate
        );

        // Address: tile_base + transformedY * 4 + (transformedX >> 1)
        const byteAddr = this.tilemapCurrentTileIndex * 32 + transformedY * 4 + (transformedX >> 1);
        const patternByte = this.getTilemapVRAM(
          this.tilemapTileDefUseBank7,
          this.tilemapTileDefBank5Msb,
          byteAddr
        );

        // Extract nibble: high nibble if transformedX is even, low if odd
        const pixelValue =
          (transformedX & 1) === 0 ? (patternByte >> 4) & 0x0f : patternByte & 0x0f;
        nextBuffer[xInTile] = pixelValue;
      }
    }
  }

  /**
   * Render Tilemap 40×32 mode pixel (Stage 1: Pixel Generation).
   * Generates two pixels per HC position at CLK_14 rate.
   *
   * @param vc - Vertical counter position
   * @param hc - Horizontal counter position
   * @param cell - Rendering cell with activity flags
   */
  private renderTilemap_40x32Pixel(vc: number, hc: number, cell: number): void {
    // Sample config bits at tile boundaries (hardware: when state = S_IDLE)
    if ((cell & SCR_TILEMAP_SAMPLE_CONFIG) !== 0) {
      this.tilemapTextModeSampled = this.tilemapTextMode;
      this.tilemapEliminateAttrSampled = this.tilemapEliminateAttributes;
      this.tilemap512TileModeSampled = this.tilemap512TileMode;
    }

    // Calculate display coordinates
    // For 40×32 (320×256) mode, display starts 32 pixels earlier than standard ULA
    // Match Layer 2 320×256: displayHC_wide = hc - confDisplayXStart + 32
    const displayX = hc - this.confDisplayXStart + 32; // Can be negative (border before display)
    const displayY = vc - this.tilemapWideDisplayYStart; // 0-255 (Priority 1A: use cached value)

    // ===== PHASE 1: FETCH (happens in border area for prefetching) =====

    // Fetch tile data if flags are set
    // This happens even in border area (displayX < 0) to prefetch first tile
    // When fetching at positions 6,7, look ahead +8 pixels to fetch NEXT tile's data
    const fetchX = displayX + 8;
    // Priority 1B: Inline getTilemapAbsoluteCoordinates (eliminates object allocation)
    const fetchAbsX = (fetchX + this.tilemapScrollXField) % 320;
    const fetchAbsY = (displayY + this.tilemapScrollYField) & 0xff;

    // Fetch tile index at position 6
    if ((cell & SCR_TILE_INDEX_FETCH) !== 0) {
      // Inline tile index fetch (40×32 mode: 40 tiles wide)
      const tileArrayIndex = (fetchAbsY >> 3) * 40 + (fetchAbsX >> 3);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      this.tilemapCurrentTileIndex = this.getTilemapVRAM(
        this.tilemapUseBank7,
        this.tilemapBank5Msb,
        tileIndexAddr
      );
    }

    // Fetch tile attribute at position 7
    if ((cell & SCR_TILE_ATTR_FETCH) !== 0) {
      // Inline tile attribute fetch (40×32 mode: 40 tiles wide)
      const tileArrayIndex = (fetchAbsY >> 3) * 40 + (fetchAbsX >> 3);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      const tileAttrAddr = this.tilemapEliminateAttrSampled ? -1 : tileIndexAddr + 1;

      if (this.tilemap512TileModeSampled && !this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
        const tileIndexBit8 = this.tilemapCurrentAttr & 0x01;
        this.tilemapCurrentTileIndex |= tileIndexBit8 << 8;
      } else if (!this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
      } else {
        this.tilemapCurrentAttr = this.tilemapDefaultAttrCache;
      }

      this.tilemapNextTileAttr = this.tilemapCurrentAttr;
      this.tilemapNextTilePaletteOffset = (this.tilemapCurrentAttr >> 4) & 0x0f;
      this.tilemapNextTileXMirror = (this.tilemapCurrentAttr & 0x08) !== 0;
      this.tilemapNextTileYMirror = (this.tilemapCurrentAttr & 0x04) !== 0;
      this.tilemapNextTileRotate = (this.tilemapCurrentAttr & 0x02) !== 0;
      this.tilemapTilePriority = this.tilemap512TileModeSampled
        ? false
        : (this.tilemapCurrentAttr & 0x01) !== 0;
    }

    // Fetch pattern at position 7 (uses attributes set at this position)
    if ((cell & SCR_PATTERN_FETCH) !== 0) {
      // Inline text mode pattern fetch (eliminates function call overhead)
      if (this.tilemapTextModeSampled) {
        const nextBuffer =
          this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer1 : this.tilemapPixelBuffer0;
        const yInTile = fetchAbsY & 0x07;
        const patternAddr = this.tilemapCurrentTileIndex * 8 + yInTile;
        const patternByte = this.getTilemapVRAM(
          this.tilemapTileDefUseBank7,
          this.tilemapTileDefBank5Msb,
          patternAddr
        );
        // Extract all 8 bits (MSB first)
        nextBuffer[0] = (patternByte >> 7) & 0x01;
        nextBuffer[1] = (patternByte >> 6) & 0x01;
        nextBuffer[2] = (patternByte >> 5) & 0x01;
        nextBuffer[3] = (patternByte >> 4) & 0x01;
        nextBuffer[4] = (patternByte >> 3) & 0x01;
        nextBuffer[5] = (patternByte >> 2) & 0x01;
        nextBuffer[6] = (patternByte >> 1) & 0x01;
        nextBuffer[7] = patternByte & 0x01;
      } else {
        // Graphics mode: call function (has complex transformations)
        this.fetchTilemapPattern(fetchAbsY, this.tilemapTextModeSampled);
      }
    }

    // ===== PHASE 2: RENDER (only for pixels in display area) =====

    // Check if in valid display area
    if (displayX < 0 || displayX >= 320 || displayY < 0 || displayY >= 256) {
      this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
      this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
      return;
    }

    // Calculate clip window coordinates (match VHDL pattern)
    // X clip coordinates are doubled: xsv = clip_x1 << 1, xev = (clip_x2 << 1) | 1
    // Priority 1A: Use cached clip window values
    const clipX1 = this.tilemapClipX1Cache_80x32;
    const clipX2 = this.tilemapClipX2Cache_80x32;
    const clipY1 = this.tilemapClipWindowY1;
    const clipY2 = this.tilemapClipWindowY2;

    // Check if this pixel is outside clip window
    const isClipped =
      displayX < clipX1 || displayX > clipX2 || displayY < clipY1 || displayY > clipY2;

    // Reset buffer position at start of each tile (when displayX is at tile boundary)
    // Also copy "next" transformation flags to "current" for this tile
    // And swap buffers (next buffer becomes current)
    if ((displayX & 0x07) === 0) {
      this.tilemapBufferPosition = 0;
      this.tilemapTileAttr = this.tilemapNextTileAttr;
      this.tilemapTilePaletteOffset = this.tilemapNextTilePaletteOffset;
      // Swap buffers: what was "next" is now "current"
      this.tilemapCurrentBuffer = 1 - this.tilemapCurrentBuffer;
      // When attributes are eliminated, ensure tile attribute uses default value
      // This handles the first tile of each line where attribute hasn't been fetched
      if (this.tilemapEliminateAttrSampled) {
        this.tilemapTileAttr = this.tilemapDefaultAttrCache;
      }
    }

    // Generate one pixel for this HC position (CLK_7 rate)
    // Read pixel sequentially from CURRENT buffer (transformations applied during fetch)
    // Priority 2H: Use conditional for faster buffer selection (no array allocation)
    const currentBuffer =
      this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer0 : this.tilemapPixelBuffer1;
    const pixelValue = currentBuffer[this.tilemapBufferPosition++];

    // Generate palette index
    let paletteIndex: number;
    if (this.tilemapTextModeSampled) {
      // Text mode: 7 bits from attribute + 1 bit from pattern
      paletteIndex = ((this.tilemapTileAttr >> 1) << 1) | pixelValue;
    } else {
      // Graphics mode: 4 bits palette offset + 4 bits pixel value
      paletteIndex = (this.tilemapTilePaletteOffset << 4) | pixelValue;
    }

    // Palette lookup (use Tilemap palette, first or second bank based on Reg $6B bit 4)
    let rgb333: number | null;
    let paletteEntry: number;
    if (paletteIndex === this.tilemapLastPaletteIndex) {
      // Cache hit
      rgb333 = this.tilemapCachedRgb333;
      paletteEntry = this.tilemapCachedPaletteEntry;
    } else {
      // Cache miss - lookup and cache
      rgb333 = this.paletteDevice.getTilemapRgb333(paletteIndex & 0xff);
      paletteEntry = this.paletteDevice.getTilemapPaletteEntry(paletteIndex & 0xff);
      this.tilemapLastPaletteIndex = paletteIndex;
      this.tilemapCachedRgb333 = rgb333;
      this.tilemapCachedPaletteEntry = paletteEntry;
    }

    // Check transparency
    // Priority 2G: Pre-compute comparison value for transparency check
    let transparent: boolean;
    if (this.tilemapTextModeSampled) {
      // Text mode: RGB comparison with global transparency color
      const globalTransparencyColorShifted = this.globalTransparencyColor << 1;
      transparent = (paletteEntry & 0x1fe) === globalTransparencyColorShifted;
    } else {
      // Graphics mode: palette index comparison
      transparent = (pixelValue & 0x0f) === (this.tilemapTransparencyIndex & 0x0f);
    }

    // Apply clipping: if outside clip window, force transparent (matches VHDL pixel_en_s behavior)
    // The VHDL sets pixel_en_s='0' for clipped pixels, effectively making them transparent
    if (isClipped) {
      transparent = true;
    }

    // Store same pixel to both outputs (CLK_7 rate)
    this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = rgb333;
    this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = transparent;
  }

  /**
   * Fast path for Tilemap 40×32 mode (Advanced Strategy).
   * Optimized version with minimal conditionals for common case:
   * - No scrolling (scrollX=0, scrollY=0)
   * - No transformations (no mirror, no rotate)
   * - Full clip window (no clipping needed)
   *
   * @param vc - Vertical counter position
   * @param hc - Horizontal counter position
   * @param cell - Rendering cell with activity flags
   */
  private renderTilemap_40x32Pixel_FastPath(vc: number, hc: number, cell: number): void {
    // Sample mode and config (same as regular path)
    if ((cell & SCR_TILEMAP_SAMPLE_CONFIG) !== 0) {
      this.tilemapTextModeSampled = this.tilemapTextMode;
      this.tilemapEliminateAttrSampled = this.tilemapEliminateAttributes;
      this.tilemap512TileModeSampled = this.tilemap512TileMode;
    }

    const displayX = hc - this.confDisplayXStart + 32;
    const displayY = vc - this.tilemapWideDisplayYStart;

    // Fast path: No scrolling, so fetchAbsX = fetchX, fetchAbsY = displayY
    const fetchX = displayX + 8;

    if ((cell & SCR_TILE_INDEX_FETCH) !== 0) {
      // Inline tile index fetch (40×32 mode: 40 tiles wide, no scrolling)
      const tileArrayIndex = (displayY >> 3) * 40 + (fetchX >> 3);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      this.tilemapCurrentTileIndex = this.getTilemapVRAM(
        this.tilemapUseBank7,
        this.tilemapBank5Msb,
        tileIndexAddr
      );
    }
    if ((cell & SCR_TILE_ATTR_FETCH) !== 0) {
      // Inline tile attribute fetch (40×32 mode: 40 tiles wide, no scrolling)
      const tileArrayIndex = (displayY >> 3) * 40 + (fetchX >> 3);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      const tileAttrAddr = this.tilemapEliminateAttrSampled ? -1 : tileIndexAddr + 1;

      if (this.tilemap512TileModeSampled && !this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
        const tileIndexBit8 = this.tilemapCurrentAttr & 0x01;
        this.tilemapCurrentTileIndex |= tileIndexBit8 << 8;
      } else if (!this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
      } else {
        this.tilemapCurrentAttr = this.tilemapDefaultAttrCache;
      }

      this.tilemapNextTileAttr = this.tilemapCurrentAttr;
      this.tilemapNextTilePaletteOffset = (this.tilemapCurrentAttr >> 4) & 0x0f;
      this.tilemapNextTileXMirror = (this.tilemapCurrentAttr & 0x08) !== 0;
      this.tilemapNextTileYMirror = (this.tilemapCurrentAttr & 0x04) !== 0;
      this.tilemapNextTileRotate = (this.tilemapCurrentAttr & 0x02) !== 0;
      this.tilemapTilePriority = this.tilemap512TileModeSampled
        ? false
        : (this.tilemapCurrentAttr & 0x01) !== 0;
    }
    if ((cell & SCR_PATTERN_FETCH) !== 0) {
      // Inline text mode pattern fetch (eliminates function call overhead)
      if (this.tilemapTextModeSampled) {
        const nextBuffer =
          this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer1 : this.tilemapPixelBuffer0;
        const yInTile = displayY & 0x07;
        const patternAddr = this.tilemapCurrentTileIndex * 8 + yInTile;
        const patternByte = this.getTilemapVRAM(
          this.tilemapTileDefUseBank7,
          this.tilemapTileDefBank5Msb,
          patternAddr
        );
        // Extract all 8 bits (MSB first)
        nextBuffer[0] = (patternByte >> 7) & 0x01;
        nextBuffer[1] = (patternByte >> 6) & 0x01;
        nextBuffer[2] = (patternByte >> 5) & 0x01;
        nextBuffer[3] = (patternByte >> 4) & 0x01;
        nextBuffer[4] = (patternByte >> 3) & 0x01;
        nextBuffer[5] = (patternByte >> 2) & 0x01;
        nextBuffer[6] = (patternByte >> 1) & 0x01;
        nextBuffer[7] = patternByte & 0x01;
      } else {
        // Graphics mode: call function (has complex transformations)
        this.fetchTilemapPattern(displayY, this.tilemapTextModeSampled);
      }
    }

    // Fast path: Skip bounds and clipping checks (full clip window = no clipping)
    if (displayX < 0 || displayX >= 320 || displayY < 0 || displayY >= 256) {
      this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
      this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
      return;
    }

    // Reset buffer position at tile boundary
    if ((displayX & 0x07) === 0) {
      this.tilemapBufferPosition = 0;
      this.tilemapTileAttr = this.tilemapNextTileAttr;
      this.tilemapTilePaletteOffset = this.tilemapNextTilePaletteOffset;
      this.tilemapCurrentBuffer = 1 - this.tilemapCurrentBuffer;
      // When attributes are eliminated, ensure tile attribute uses default value
      // This handles the first tile of each line where attribute hasn't been fetched
      if (this.tilemapEliminateAttrSampled) {
        this.tilemapTileAttr = this.tilemapDefaultAttrCache;
      }
    }

    // Fast path: Direct buffer access (no transformation flags needed, no array allocation)
    const pixelValue = (
      this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer0 : this.tilemapPixelBuffer1
    )[this.tilemapBufferPosition++];

    // Generate palette index
    const paletteIndex = this.tilemapTextModeSampled
      ? (((this.tilemapTileAttr >> 1) << 1) | pixelValue) & 0xff
      : ((this.tilemapTilePaletteOffset << 4) | pixelValue) & 0xff;

    // Palette lookup with caching
    let rgb333: number | null;
    let paletteEntry: number;
    if (paletteIndex === this.tilemapLastPaletteIndex) {
      rgb333 = this.tilemapCachedRgb333;
      paletteEntry = this.tilemapCachedPaletteEntry;
    } else {
      rgb333 = this.paletteDevice.getTilemapRgb333(paletteIndex);
      paletteEntry = this.paletteDevice.getTilemapPaletteEntry(paletteIndex);
      this.tilemapLastPaletteIndex = paletteIndex;
      this.tilemapCachedRgb333 = rgb333;
      this.tilemapCachedPaletteEntry = paletteEntry;
    }

    // Check transparency
    const transparent = this.tilemapTextModeSampled
      ? (paletteEntry & 0x1fe) === this.globalTransparencyColor << 1
      : (pixelValue & 0x0f) === (this.tilemapTransparencyIndex & 0x0f);

    // Store output (no clipping check needed in fast path)
    this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = rgb333;
    this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = transparent;
  }

  /**
   * Fast path for Tilemap 80×32 mode (Advanced Strategy).
   * Optimized version with minimal conditionals for common case:
   * - No scrolling (scrollX=0, scrollY=0)
   * - No transformations (no mirror, no rotate)
   * - Full clip window (no clipping needed)
   *
   * @param vc - Vertical counter position
   * @param hc - Horizontal counter position
   * @param cell - Rendering cell with activity flags
   */
  private renderTilemap_80x32Pixel_FastPath(vc: number, hc: number, cell: number): void {
    // Sample mode and config (same as regular path)
    if ((cell & SCR_TILEMAP_SAMPLE_CONFIG) !== 0) {
      this.tilemapTextModeSampled = this.tilemapTextMode;
      this.tilemapEliminateAttrSampled = this.tilemapEliminateAttributes;
      this.tilemap512TileModeSampled = this.tilemap512TileMode;
    }

    // Same as 40x32, but each HC generates 2 pixels
    const displayX = hc - this.confDisplayXStart + 32;
    const displayY = vc - this.tilemapWideDisplayYStart;

    // Fast path: No scrolling
    const fetchX = displayX + 4;

    if ((cell & SCR_TILE_INDEX_FETCH) !== 0) {
      // Inline tile index fetch (80×32 mode: 80 tiles wide, no scrolling)
      const tileArrayIndex = (displayY >> 3) * 80 + (fetchX >> 2);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      this.tilemapCurrentTileIndex = this.getTilemapVRAM(
        this.tilemapUseBank7,
        this.tilemapBank5Msb,
        tileIndexAddr
      );
    }
    if ((cell & SCR_TILE_ATTR_FETCH) !== 0) {
      // Inline tile attribute fetch (80×32 mode: 80 tiles wide, no scrolling)
      const tileArrayIndex = (displayY >> 3) * 80 + (fetchX >> 2);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      const tileAttrAddr = this.tilemapEliminateAttrSampled ? -1 : tileIndexAddr + 1;

      if (this.tilemap512TileModeSampled && !this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
        const tileIndexBit8 = this.tilemapCurrentAttr & 0x01;
        this.tilemapCurrentTileIndex |= tileIndexBit8 << 8;
      } else if (!this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
      } else {
        this.tilemapCurrentAttr = this.tilemapDefaultAttrCache;
      }

      this.tilemapNextTileAttr = this.tilemapCurrentAttr;
      this.tilemapNextTilePaletteOffset = (this.tilemapCurrentAttr >> 4) & 0x0f;
      this.tilemapNextTileXMirror = (this.tilemapCurrentAttr & 0x08) !== 0;
      this.tilemapNextTileYMirror = (this.tilemapCurrentAttr & 0x04) !== 0;
      this.tilemapNextTileRotate = (this.tilemapCurrentAttr & 0x02) !== 0;
      this.tilemapTilePriority = this.tilemap512TileModeSampled
        ? false
        : (this.tilemapCurrentAttr & 0x01) !== 0;
    }
    if ((cell & SCR_PATTERN_FETCH) !== 0) {
      // Inline text mode pattern fetch (eliminates function call overhead)
      if (this.tilemapTextModeSampled) {
        const nextBuffer =
          this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer1 : this.tilemapPixelBuffer0;
        const yInTile = displayY & 0x07;
        const patternAddr = this.tilemapCurrentTileIndex * 8 + yInTile;
        const patternByte = this.getTilemapVRAM(
          this.tilemapTileDefUseBank7,
          this.tilemapTileDefBank5Msb,
          patternAddr
        );
        // Extract all 8 bits (MSB first)
        nextBuffer[0] = (patternByte >> 7) & 0x01;
        nextBuffer[1] = (patternByte >> 6) & 0x01;
        nextBuffer[2] = (patternByte >> 5) & 0x01;
        nextBuffer[3] = (patternByte >> 4) & 0x01;
        nextBuffer[4] = (patternByte >> 3) & 0x01;
        nextBuffer[5] = (patternByte >> 2) & 0x01;
        nextBuffer[6] = (patternByte >> 1) & 0x01;
        nextBuffer[7] = patternByte & 0x01;
      } else {
        // Graphics mode: call function (has complex transformations)
        this.fetchTilemapPattern(displayY, this.tilemapTextModeSampled);
      }
    }

    // Fast path: Skip bounds and clipping checks (full clip window = no clipping)
    if (displayX < 0 || displayX >= 320 || displayY < 0 || displayY >= 256) {
      this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
      this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
      return;
    }

    // Reset buffer position at tile boundary
    if ((displayX & 0x03) === 0) {
      this.tilemapBufferPosition = 0;
      this.tilemapTileAttr = this.tilemapNextTileAttr;
      this.tilemapTilePaletteOffset = this.tilemapNextTilePaletteOffset;
      this.tilemapCurrentBuffer = 1 - this.tilemapCurrentBuffer;
      // When attributes are eliminated, ensure tile attribute uses default value
      if (this.tilemapEliminateAttrSampled) {
        this.tilemapTileAttr = this.tilemapDefaultAttrCache;
      }
    }

    // Fast path: In 80×32 mode, each HC generates TWO different pixels
    const currentBuffer =
      this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer0 : this.tilemapPixelBuffer1;

    // Generate FIRST pixel
    const pixelValue1 = currentBuffer[this.tilemapBufferPosition++];
    const paletteIndex1 = this.tilemapTextModeSampled
      ? (((this.tilemapTileAttr >> 1) << 1) | pixelValue1) & 0xff
      : ((this.tilemapTilePaletteOffset << 4) | pixelValue1) & 0xff;

    let rgb333_1: number | null;
    let paletteEntry1: number;
    if (paletteIndex1 === this.tilemapLastPaletteIndex) {
      rgb333_1 = this.tilemapCachedRgb333;
      paletteEntry1 = this.tilemapCachedPaletteEntry;
    } else {
      rgb333_1 = this.paletteDevice.getTilemapRgb333(paletteIndex1);
      paletteEntry1 = this.paletteDevice.getTilemapPaletteEntry(paletteIndex1);
      this.tilemapLastPaletteIndex = paletteIndex1;
      this.tilemapCachedRgb333 = rgb333_1;
      this.tilemapCachedPaletteEntry = paletteEntry1;
    }

    const transparent1 = this.tilemapTextModeSampled
      ? (paletteEntry1 & 0x1fe) === this.globalTransparencyColor << 1
      : (pixelValue1 & 0x0f) === (this.tilemapTransparencyIndex & 0x0f);

    // Generate SECOND pixel
    const pixelValue2 = currentBuffer[this.tilemapBufferPosition++];
    const paletteIndex2 = this.tilemapTextModeSampled
      ? (((this.tilemapTileAttr >> 1) << 1) | pixelValue2) & 0xff
      : ((this.tilemapTilePaletteOffset << 4) | pixelValue2) & 0xff;

    let rgb333_2: number | null;
    let paletteEntry2: number;
    if (paletteIndex2 === this.tilemapLastPaletteIndex) {
      rgb333_2 = this.tilemapCachedRgb333;
      paletteEntry2 = this.tilemapCachedPaletteEntry;
    } else {
      rgb333_2 = this.paletteDevice.getTilemapRgb333(paletteIndex2);
      paletteEntry2 = this.paletteDevice.getTilemapPaletteEntry(paletteIndex2);
      this.tilemapLastPaletteIndex = paletteIndex2;
      this.tilemapCachedRgb333 = rgb333_2;
      this.tilemapCachedPaletteEntry = paletteEntry2;
    }

    const transparent2 = this.tilemapTextModeSampled
      ? (paletteEntry2 & 0x1fe) === this.globalTransparencyColor << 1
      : (pixelValue2 & 0x0f) === (this.tilemapTransparencyIndex & 0x0f);

    // Store TWO different pixels (no clipping check needed in fast path)
    this.tilemapPixel1Rgb333 = rgb333_1;
    this.tilemapPixel1Transparent = transparent1;
    this.tilemapPixel2Rgb333 = rgb333_2;
    this.tilemapPixel2Transparent = transparent2;
  }

  /**
   * Render Tilemap 80×32 mode pixel (Stage 1: Pixel Generation).
   * In 80×32 mode, each HC generates 2 pixels (doubled horizontal resolution).
   *
   * @param vc - Vertical counter position
   * @param hc - Horizontal counter position
   * @param cell - Rendering cell with activity flags
   */
  private renderTilemap_80x32Pixel(vc: number, hc: number, cell: number): void {
    // Priority 2F: Combine sampling checks for faster execution when no flags are set
    // Sample config bits at tile boundaries (hardware: when state = S_IDLE)
    if ((cell & SCR_TILEMAP_SAMPLE_CONFIG) !== 0) {
      this.tilemapTextModeSampled = this.tilemapTextMode;
      this.tilemapEliminateAttrSampled = this.tilemapEliminateAttributes;
      this.tilemap512TileModeSampled = this.tilemap512TileMode;
    }

    // Calculate display coordinates
    // Same as 40×32, but each HC generates 2 pixels instead of 1
    const displayX = hc - this.confDisplayXStart + 32;
    const displayY = vc - this.tilemapWideDisplayYStart; // Priority 1A: use cached value

    // ===== PHASE 1: FETCH (happens in border area for prefetching) =====

    // Fetch tile data if flags are set
    // This happens even in border area (displayX < 0) to prefetch first tile
    // When fetching at positions 6,7, look ahead +8 pixels to fetch NEXT tile's data
    const fetchX = displayX + 4;
    // Priority 1B: Inline getTilemapAbsoluteCoordinates (eliminates object allocation)
    const fetchAbsX = (fetchX + this.tilemapScrollXField) % 320;
    const fetchAbsY = (displayY + this.tilemapScrollYField) & 0xff;

    // Fetch tile index at position 6
    if ((cell & SCR_TILE_INDEX_FETCH) !== 0) {
      // Inline tile index fetch (80×32 mode: 80 tiles wide)
      const tileArrayIndex = (fetchAbsY >> 3) * 80 + (fetchAbsX >> 2);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      this.tilemapCurrentTileIndex = this.getTilemapVRAM(
        this.tilemapUseBank7,
        this.tilemapBank5Msb,
        tileIndexAddr
      );
    }

    // Fetch tile attribute at position 7
    if ((cell & SCR_TILE_ATTR_FETCH) !== 0) {
      // Inline tile attribute fetch (80×32 mode: 80 tiles wide)
      const tileArrayIndex = (fetchAbsY >> 3) * 80 + (fetchAbsX >> 2);
      const tileIndexAddr = this.tilemapEliminateAttrSampled ? tileArrayIndex : tileArrayIndex << 1;
      const tileAttrAddr = this.tilemapEliminateAttrSampled ? -1 : tileIndexAddr + 1;

      if (this.tilemap512TileModeSampled && !this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
        const tileIndexBit8 = this.tilemapCurrentAttr & 0x01;
        this.tilemapCurrentTileIndex |= tileIndexBit8 << 8;
      } else if (!this.tilemapEliminateAttrSampled) {
        this.tilemapCurrentAttr = this.getTilemapVRAM(
          this.tilemapUseBank7,
          this.tilemapBank5Msb,
          tileAttrAddr
        );
      } else {
        this.tilemapCurrentAttr = this.tilemapDefaultAttrCache;
      }

      this.tilemapNextTileAttr = this.tilemapCurrentAttr;
      this.tilemapNextTilePaletteOffset = (this.tilemapCurrentAttr >> 4) & 0x0f;
      this.tilemapNextTileXMirror = (this.tilemapCurrentAttr & 0x08) !== 0;
      this.tilemapNextTileYMirror = (this.tilemapCurrentAttr & 0x04) !== 0;
      this.tilemapNextTileRotate = (this.tilemapCurrentAttr & 0x02) !== 0;
      this.tilemapTilePriority = this.tilemap512TileModeSampled
        ? false
        : (this.tilemapCurrentAttr & 0x01) !== 0;
    }

    // Fetch pattern at position 7 (uses attributes set at this position)
    if ((cell & SCR_PATTERN_FETCH) !== 0) {
      // Inline text mode pattern fetch (eliminates function call overhead)
      if (this.tilemapTextModeSampled) {
        const nextBuffer =
          this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer1 : this.tilemapPixelBuffer0;
        const yInTile = fetchAbsY & 0x07;
        const patternAddr = this.tilemapCurrentTileIndex * 8 + yInTile;
        const patternByte = this.getTilemapVRAM(
          this.tilemapTileDefUseBank7,
          this.tilemapTileDefBank5Msb,
          patternAddr
        );
        // Extract all 8 bits (MSB first)
        nextBuffer[0] = (patternByte >> 7) & 0x01;
        nextBuffer[1] = (patternByte >> 6) & 0x01;
        nextBuffer[2] = (patternByte >> 5) & 0x01;
        nextBuffer[3] = (patternByte >> 4) & 0x01;
        nextBuffer[4] = (patternByte >> 3) & 0x01;
        nextBuffer[5] = (patternByte >> 2) & 0x01;
        nextBuffer[6] = (patternByte >> 1) & 0x01;
        nextBuffer[7] = patternByte & 0x01;
      } else {
        // Graphics mode: call function (has complex transformations)
        this.fetchTilemapPattern(fetchAbsY, this.tilemapTextModeSampled);
      }
    }

    // ===== PHASE 2: RENDER (only for pixels in display area) =====

    // Check if in valid display area
    if (displayX < 0 || displayX >= 320 || displayY < 0 || displayY >= 256) {
      this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
      this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
      return;
    }

    // Calculate clip window coordinates (match VHDL pattern)
    // X clip coordinates are doubled: xsv = clip_x1 << 1, xev = (clip_x2 << 1) | 1
    // Priority 1A: Use cached clip window values
    const clipX1 = this.tilemapClipX1Cache_80x32;
    const clipX2 = this.tilemapClipX2Cache_80x32;
    const clipY1 = this.tilemapClipWindowY1;
    const clipY2 = this.tilemapClipWindowY2;

    // Reset buffer position at start of each tile (when displayX is at tile boundary)
    // Also copy "next" transformation flags to "current" for this tile
    // And swap buffers (next buffer becomes current)
    if ((displayX & 0x03) === 0) {
      this.tilemapBufferPosition = 0;
      this.tilemapTileAttr = this.tilemapNextTileAttr;
      this.tilemapTilePaletteOffset = this.tilemapNextTilePaletteOffset;
      // Swap buffers: what was "next" is now "current"
      this.tilemapCurrentBuffer = 1 - this.tilemapCurrentBuffer;
      // When attributes are eliminated, ensure tile attribute uses default value
      // This handles the first tile of each line where attribute hasn't been fetched
      if (this.tilemapEliminateAttrSampled) {
        this.tilemapTileAttr = this.tilemapDefaultAttrCache;
      }
    }

    // In 80×32 mode, each HC generates TWO different pixels
    // Priority 2H: Use conditional for faster buffer selection (no array allocation)
    const currentBuffer =
      this.tilemapCurrentBuffer === 0 ? this.tilemapPixelBuffer0 : this.tilemapPixelBuffer1;

    // Generate FIRST pixel (pixel1)
    const pixelValue1 = currentBuffer[this.tilemapBufferPosition++];
    const displayX1 = displayX; // First pixel's X coordinate
    const isClipped1 =
      displayX1 < clipX1 || displayX1 > clipX2 || displayY < clipY1 || displayY > clipY2;

    let paletteIndex1: number;
    if (this.tilemapTextModeSampled) {
      paletteIndex1 = ((this.tilemapTileAttr >> 1) << 1) | pixelValue1;
    } else {
      paletteIndex1 = (this.tilemapTilePaletteOffset << 4) | pixelValue1;
    }

    let rgb333_1: number | null;
    let paletteEntry1: number;
    if (paletteIndex1 === this.tilemapLastPaletteIndex) {
      rgb333_1 = this.tilemapCachedRgb333;
      paletteEntry1 = this.tilemapCachedPaletteEntry;
    } else {
      rgb333_1 = this.paletteDevice.getTilemapRgb333(paletteIndex1 & 0xff);
      paletteEntry1 = this.paletteDevice.getTilemapPaletteEntry(paletteIndex1 & 0xff);
      this.tilemapLastPaletteIndex = paletteIndex1;
      this.tilemapCachedRgb333 = rgb333_1;
      this.tilemapCachedPaletteEntry = paletteEntry1;
    }

    let transparent1: boolean;
    if (this.tilemapTextModeSampled) {
      const globalTransparencyColorShifted = this.globalTransparencyColor << 1;
      transparent1 = (paletteEntry1 & 0x1fe) === globalTransparencyColorShifted;
    } else {
      transparent1 = (pixelValue1 & 0x0f) === (this.tilemapTransparencyIndex & 0x0f);
    }
    if (isClipped1) transparent1 = true;

    // Generate SECOND pixel (pixel2)
    const pixelValue2 = currentBuffer[this.tilemapBufferPosition++];
    const displayX2 = displayX + 1; // Second pixel's X coordinate (1 pixel to the right)
    const isClipped2 =
      displayX2 < clipX1 || displayX2 > clipX2 || displayY < clipY1 || displayY > clipY2;

    let paletteIndex2: number;
    if (this.tilemapTextModeSampled) {
      paletteIndex2 = ((this.tilemapTileAttr >> 1) << 1) | pixelValue2;
    } else {
      paletteIndex2 = (this.tilemapTilePaletteOffset << 4) | pixelValue2;
    }

    let rgb333_2: number | null;
    let paletteEntry2: number;
    if (paletteIndex2 === this.tilemapLastPaletteIndex) {
      rgb333_2 = this.tilemapCachedRgb333;
      paletteEntry2 = this.tilemapCachedPaletteEntry;
    } else {
      rgb333_2 = this.paletteDevice.getTilemapRgb333(paletteIndex2 & 0xff);
      paletteEntry2 = this.paletteDevice.getTilemapPaletteEntry(paletteIndex2 & 0xff);
      this.tilemapLastPaletteIndex = paletteIndex2;
      this.tilemapCachedRgb333 = rgb333_2;
      this.tilemapCachedPaletteEntry = paletteEntry2;
    }

    let transparent2: boolean;
    if (this.tilemapTextModeSampled) {
      const globalTransparencyColorShifted = this.globalTransparencyColor << 1;
      transparent2 = (paletteEntry2 & 0x1fe) === globalTransparencyColorShifted;
    } else {
      transparent2 = (pixelValue2 & 0x0f) === (this.tilemapTransparencyIndex & 0x0f);
    }
    if (isClipped2) transparent2 = true;

    // Store TWO different pixels
    this.tilemapPixel1Rgb333 = rgb333_1;
    this.tilemapPixel1Transparent = transparent1;
    this.tilemapPixel2Rgb333 = rgb333_2;
    this.tilemapPixel2Transparent = transparent2;
  }

  // ==============================================================================================
  // Sprites Rendering
  //
  // This section contains all properties and methods related to Sprites rendering.
  // ==============================================================================================
  // Sprite pixel buffer (size: 320 pixels, 2 pixels per HC, RGB333)
  spritesBuffer = new Uint16Array(320);
  // Sprite pixel buffer position (0-319)
  spritesBufferPosition: number;
  // The sprite scanline index being processed (0-255)
  spritesVc: number;
  // The sprite being processed (0-127)
  spritesIndex: number;
  // Indicates if the current sprite is QUALIFYING (true) or PROCESSING (false)
  spritesQualifying: boolean;
  // Indicates that sprite rendering is done (before the end of the rendering window)
  spritesRenderingDone: boolean;
  // The number of tacts remaining for sprite processing on this scanline
  spritesRemainingClk7Tacts: number;
  // Indicates that sprite overflow occurred (no time to render visible sprite)
  spritesOvertime: boolean;
  // Current sprite pattern Y index (0-15)
  spritesPatternYIndex: number;
  
  // PROCESSING phase state variables
  // Pixel counter (0 to sprite.width-1)
  private spritesCurrentPixel: number;
  // Line buffer write position (9-bit, -256 to 511)
  private spritesCurrentX: number;
  // Cached pattern data for current sprite
  private spritesPatternData: Uint8Array | null;
  // Current sprite being processed (cached reference)
  private spritesCurrentSprite: SpriteAttributes | null;
  
  // Precalculated sprite clipping boundaries (updated when spritesOverBorderEnabled changes)
  private spritesClipXMin: number;
  private spritesClipXMax: number;
  private spritesClipYMin: number;
  private spritesClipYMax: number;

  /**
   * Render Sprites layer pixel (Stage 1).
   * @param vc - Vertical counter position
   * @param _hc - Horizontal counter position
   * @param cell - ULA Standard rendering cell with activity flags
   */
  /**
   * Update sprite clipping boundaries based on spritesOverBorderEnabled flag.
   * Called when NextReg 0x15 bit 1 changes.
   */
  updateSpriteClipBoundaries(): void {
    if (this.spriteDevice.spritesOverBorderEnabled) {
      // Full sprite area: 320×256 pixels
      this.spritesClipXMin = 0;
      this.spritesClipXMax = 319;
      this.spritesClipYMin = 0;
      this.spritesClipYMax = 255;
    } else {
      // Restricted to ULA area: 256×192 pixels (X: 32-287, Y: 32-223)
      this.spritesClipXMin = 32;
      this.spritesClipXMax = 287;
      this.spritesClipYMin = 32;
      this.spritesClipYMax = 223;
    }
  }

  private renderSpritesPixel(vc: number, _hc: number, cell: number): void {
    // This function executes the next CLK_28 cycle (implementing the QUALIFY/PROCESS phases)
    const renderPixelClk28 = () => {
      if (this.spritesRenderingDone) {
        // Nothing to render for this scanline; all sprites processed
        return;
      }

      if (this.spritesQualifying) {
        // QUALIFYING phase: Check if current sprite is visible on this scanline

        // Early exit: If the scanline is entirely outside vertical clip boundaries,
        // no sprite can be visible on this scanline
        if (this.spritesVc < this.spritesClipYMin || this.spritesVc > this.spritesClipYMax) {
          // Scanline is outside vertical clip bounds; skip all sprites
          this.spritesRenderingDone = true;
          return;
        }

        // Check if we've processed all sprites (128)
        if (this.spritesIndex >= 128) {
          // All sprites have been checked; switch to IDLE
          this.spritesRenderingDone = true;
          return;
        }

        // Fetch the sprite attributes for the current sprite
        const spriteAttrs = this.spriteDevice.attributes[this.spritesIndex];

        // Check if sprite is globally enabled (attr3 bit 7)
        if (!spriteAttrs.visible) {
          // Sprite is not visible; skip to next sprite
          this.spritesIndex++;
          return;
        }

        // Check if the current scanline intersects with the sprite's vertical position
        const spriteY = spriteAttrs.y;
        const spriteHeight = spriteAttrs.height;
        const spriteBottom = spriteY + spriteHeight;
        
        const scanlineIntersects =
          this.spritesVc >= spriteY && 
          this.spritesVc < spriteBottom &&
          spriteY <= this.spritesClipYMax && 
          spriteBottom > this.spritesClipYMin;

        if (!scanlineIntersects) {
          // Sprite does not intersect this scanline or is outside vertical clip bounds
          this.spritesIndex++;
          return;
        }

        // Check if sprite is within horizontal clip boundaries
        const spriteX = spriteAttrs.x;
        const spriteWidth = spriteAttrs.width;
        const spriteRight = spriteX + spriteWidth;
        
        const horizontallyVisible = 
          spriteX <= this.spritesClipXMax && 
          spriteRight > this.spritesClipXMin;

        if (!horizontallyVisible) {
          // Sprite is outside horizontal clip bounds
          this.spritesIndex++;
          return;
        }

        // Check if there is still time for processing this sprite on this scanline
        // The PROCESSING phase needs enough CLK_28 cycles to render the sprite width
        // (+2 CLK_28 tacts for setup/overhead)
        const cyclesNeeded = spriteWidth + 2;
        if (this.spritesRemainingClk7Tacts * 4 < cyclesNeeded) {
          // Not enough time to render this sprite (no_time condition)
          // Set sprite overflow flag and skip remaining sprites
          this.spritesOvertime = true;
          this.spritesRenderingDone = true;
          return;
        }

        // Sprite qualifies! Switch to PROCESSING phase
        this.spritesQualifying = false;

        // Cache sprite reference for PROCESSING phase
        this.spritesCurrentSprite = spriteAttrs;

        // 1. Calculate Y index within pattern (accounting for scale only)
        //    This represents which row of the 16×16 pattern we're rendering
        //    Note: Y-mirror is already applied in the pre-transformed pattern variant
        const yOffset = this.spritesVc - spriteAttrs.y;
        this.spritesPatternYIndex = yOffset >> spriteAttrs.scaleY;  // Apply Y-scale (0-15)

        // 2. Get pre-transformed pattern variant using cached variant index
        //    The variant index is precalculated when sprite attributes are written
        this.spritesPatternData = spriteAttrs.is4BitPattern
          ? this.spriteDevice.patternMemory4bit[spriteAttrs.patternVariantIndex]
          : this.spriteDevice.patternMemory8bit[spriteAttrs.patternVariantIndex];

        // 3. Initialize counters
        this.spritesCurrentPixel = 0;           // Pixel counter (0 to sprite.width-1)
        this.spritesCurrentX = spriteAttrs.x;   // Line buffer write position (9-bit)

      } else {
        // PROCESSING phase: Render sprite pixels
        
        // Safety check: ensure we have a valid sprite reference
        if (!this.spritesCurrentSprite) {
          // This shouldn't happen, but if it does, go back to QUALIFYING
          this.spritesQualifying = true;
          return;
        }
        
        // Check completion first
        if (this.spritesCurrentPixel >= this.spritesCurrentSprite.width) {
          // Sprite rendering complete - transition back to QUALIFYING
          this.spritesQualifying = true;
          this.spritesIndex++;
          return;
        }

        const sprite = this.spritesCurrentSprite;

        // 1. Calculate X index within pattern (0-15)
        //    Account for scaling: multiple output pixels map to same pattern pixel
        const xScaled = this.spritesCurrentPixel >> sprite.scaleX;  // Divide by 2^scaleX
        const xIndex = xScaled & 0x0f;                              // Modulo 16

        // 2. Fetch pixel from pre-transformed pattern (DIRECT LOOKUP - no transform!)
        //    Pattern is always indexed as [y][x] because transformation is pre-applied
        const patternOffset = (this.spritesPatternYIndex << 4) | xIndex;
        const pixelValue = this.spritesPatternData![patternOffset];

        // 3. Check transparency FIRST (before any color processing)
        //    Compare against global transparency index (NextReg 0x4B, default 0xE3)
        const isTransparent = (pixelValue === this.spriteDevice.transparencyIndex);

        if (isTransparent) {
          // Skip transparent pixels - advance to next pixel
          this.spritesCurrentPixel++;
          this.spritesCurrentX++;
          return;
        }

        // 4. Extract pixel color value
        //    For 4-bit: only lower nibble is used (upper nibble ignored)
        //    For 8-bit: full byte is used
        let colorValue: number;
        if (sprite.is4BitPattern) {
          colorValue = pixelValue & 0x0f;  // Use only lower nibble
        } else {
          colorValue = pixelValue;  // Use full byte
        }

        // 5. Apply palette offset
        let paletteIndex: number;
        if (sprite.is4BitPattern) {
          // 4-bit mode: palette offset replaces upper 4 bits
          paletteIndex = (sprite.paletteOffset << 4) | colorValue;
        } else {
          // 8-bit mode: add palette offset to upper 4 bits only
          const upper = ((colorValue >> 4) + sprite.paletteOffset) & 0x0f;
          const lower = colorValue & 0x0f;
          paletteIndex = (upper << 4) | lower;
        }

        // 6. Check line buffer bounds
        //    Only write if X position is within visible display (0-319)
        //    Negative positions and positions >= 320 are clipped
        const bufferPos = this.spritesCurrentX;
        const inBounds = (bufferPos >= 0 && bufferPos < 320);

        // 7. Read existing line buffer value (for collision and zero-on-top)
        let existingValue = 0;
        let existingValid = false;
        if (inBounds) {
          existingValue = this.spritesBuffer[bufferPos];
          existingValid = (existingValue & 0x100) !== 0;  // Bit 8 = valid flag
        }

        // 8. Determine write enable
        let writeEnable = inBounds;
        
        if (this.spriteDevice.sprite0OnTop && existingValid) {
          // Zero-on-top mode: don't overwrite existing valid pixels
          writeEnable = false;
        }

        // 9. Write to line buffer
        if (writeEnable) {
          // Set bit 8 (valid flag) and bits 7:0 (palette index)
          this.spritesBuffer[bufferPos] = 0x100 | paletteIndex;
          
          // 10. Collision detection
          //     Trigger when writing to a position that already has a valid pixel
          if (existingValid) {
            this.spriteDevice.collisionDetected = true;
          }
        }

        // 11. Advance to next pixel
        this.spritesCurrentPixel++;
        this.spritesCurrentX++;
      }
    };

    if (cell === 0) {
      // No sprite activity in this cell
      this.spritesPixel1Rgb333 = this.spritesPixel2Rgb333 = 0;
      this.spritesPixel1Transparent = this.spritesPixel2Transparent = true;
      return;
    }

    if ((cell & SCR_SPRITE_INIT_RENDER) !== 0) {
      // Initialize sprite rendering for the next scanline (index 0)
      this.spritesBufferPosition = 0;
      this.spritesBuffer.fill(0x00); // Clear sprite buffer
      // Sprite Y coordinates use a 256-line display area that starts 32 lines before ULA display
      // (same as tilemapWideDisplayYStart)
      this.spritesVc = vc - (this.confDisplayYStart - 32) + 1;
      this.spritesIndex = 0;
      this.spritesQualifying = true;
      this.spritesRenderingDone = false;
      this.spritesOvertime = false;
      this.spritesRemainingClk7Tacts = 120; // Total CLK_28 tacts available (480 CLK_28 ÷ 4 = 120 CLK_7 tacts)
    }

    if ((cell & SCR_SPRITE_INIT_DISPLAY) !== 0) {
      this.spritesBufferPosition = 0;
    }

    if ((cell & SCR_SPRITE_RENDER) !== 0) {
      // This cell renders 4 CLK_28 cycles (4 potential machine state transitions)
      renderPixelClk28();
      renderPixelClk28();
      renderPixelClk28();
      renderPixelClk28();
      this.spritesRemainingClk7Tacts--;
    }

    if ((cell & SCR_SPRITE_DISPLAY) !== 0) {
      const bufferValue = this.spritesBuffer[this.spritesBufferPosition++];
      const isTransparent = !(bufferValue & 0x100);
      
      if (isTransparent) {
        this.spritesPixel1Rgb333 = this.spritesPixel2Rgb333 = 0;
        this.spritesPixel1Transparent = this.spritesPixel2Transparent = true;
      } else {
        const paletteIndex = bufferValue & 0xff;
        const rgb333 = this.paletteDevice.getSpriteRgb333(paletteIndex);
        this.spritesPixel1Rgb333 = this.spritesPixel2Rgb333 = rgb333;
        this.spritesPixel1Transparent = this.spritesPixel2Transparent = false;
      }
    }
  }
}

// ================================================================================================
// Rendering tables and constants
//
// Screen rendering is accelerated with several precomputed tables. This section contains the
// definitions and initialization functions for these tables.
//
// Rendering flags tables contain bit flags for each (VC, HC) cell indicating the activity a
// particular layer has at that position. These tables are generated based on the timing
// configuration (50Hz or 60Hz) and the specific layer mode (ULA, Layer2, Sprites, Tilemap, LoRes).
// ================================================================================================

// For emulation purposes, a **fixed-size bitmap** represents the visible portion of
// the display across all timing modes and rendering modes.
//
// Bitmap size: 720 × 288 pixels
//
// This allows seamless switching between resolution modes without bitmap reallocation.
// The visible area (HC 96-455) maps to bitmap X 0-719 with appropriate pixel
// replication per mode.
//
// **Vertical Resolution**:
// - **50Hz**: 288 lines (VC 16-303 mapped to Y 0-287) — fills entire bitmap height
// - **60Hz**: 240 lines (VC 16-255 mapped to Y 24-263) — top 24 and bottom 24 lines
//   rendered as transparent pixels

// Horizontal pixels (doubled to support HiRes/Standard/LoRes)
const BITMAP_WIDTH = 720;
// Vertical pixels (50Hz: Y 0-287 full, 60Hz: Y 24-263 centered)
const BITMAP_HEIGHT = 288;
// Total bitmap size in pixels: 207,360
const BITMAP_SIZE = BITMAP_WIDTH * BITMAP_HEIGHT;

// ================================================================================================
// Rendering Cell Bit Flags (for Uint16Array representation)
// ================================================================================================

// ULA Standard Cell (8 different flag values)
const SCR_DISPLAY_AREA = 0b00000001; // bit 0
const SCR_CONTENTION_WINDOW = 0b00000010; // bit 1
const SCR_NREG_SAMPLE = 0b00000100; // bit 2
const SCR_BYTE1_READ = 0b00001000; // bit 3
const SCR_TILE_INDEX_FETCH = 0b00001000; // bit 3, an alias to SCR_BYTE1_READ (Tilemap: fetch tile index)
const SCR_BYTE2_READ = 0b00010000; // bit 4
const SCR_TILE_ATTR_FETCH = 0b00010000; // bit 4, an alias to SCR_BYTE2_READ (Tilemap: fetch tile attribute)
const SCR_PATTERN_FETCH = 0b00010000; // bit 4, an alias to SCR_BYTE2_READ (Tilemap: fetch tile pattern row)
const SCR_SHIFT_REG_LOAD = 0b00100000; // bit 5
const SCR_FLOATING_BUS_UPDATE = 0b01000000; // bit 6
const SCR_BORDER_AREA = 0b10000000; // bit 7
const SCR_TILEMAP_SAMPLE_CONFIG = 0b10000000; // bit 7, alias to SCR_BORDER_AREA (Tilemap: sample config bits at tile boundaries)
const SCR_SPRITE_DISPLAY = 0b00000001; // bit 0, the sprite buffer is displayed
const SCR_SPRITE_INIT_DISPLAY = 0b00000010; // bit 1, the sprite display is initialized
const SCR_SPRITE_RENDER = 0b00000100; // bit 2, the sprite buffer is rendered
const SCR_SPRITE_INIT_RENDER = 0b00001000; // bit 3, the sprite buffer is initialized

// Full scanline including blanking (both 50Hz and 60Hz use HC 0-455)
const RENDERING_FLAGS_HC_COUNT = 456; // 0 to maxHC (455)

// ULA rendering flags for both timing modes
let renderingFlagsULA50Hz: Uint8Array | undefined;
let renderingFlagsULA60Hz: Uint8Array | undefined;

// Layer2 rendering flags for both timing modes and all resolutions
// Using Uint8Array with 0/1 values (single flag only)
let renderingFlagsLayer2_256x192_50Hz: Uint8Array | undefined;
let renderingFlagsLayer2_256x192_60Hz: Uint8Array | undefined;
// Wide mode (320x256 and 640x256) use the same rendering flags
let renderingFlagsLayer2_Wide_50Hz: Uint8Array | undefined;
let renderingFlagsLayer2_Wide_60Hz: Uint8Array | undefined;

// Sprites rendering flags for both timing modes
let renderingFlagsSprites50Hz: Uint16Array | undefined;
let renderingFlagsSprites60Hz: Uint16Array | undefined;

// Tilemap rendering flags for both timing modes and resolutions
let renderingFlagsTilemap_40x32_50Hz: Uint8Array | undefined;
let renderingFlagsTilemap_40x32_60Hz: Uint8Array | undefined;
let renderingFlagsTilemap_80x32_50Hz: Uint8Array | undefined;
let renderingFlagsTilemap_80x32_60Hz: Uint8Array | undefined;

// LoRes rendering flags for both timing modes
let renderingFlagsLoRes50Hz: Uint16Array | undefined;
let renderingFlagsLoRes60Hz: Uint16Array | undefined;

// -------------------------------------------------------------------------------------------
// Tact to HC/VC and Bitmap Offset tables for both timing modes
// These tables map each tact (machine cycle) to its corresponding
// Active Timing Mode Cache (module-level, updated on mode switch)
// -------------------------------------------------------------------------------------------

// These module-level variables cache the currently active timing mode tables
// to avoid repeated conditional checks and function calls in hot path (renderTact).
// Updated via setActiveTimingMode() when switching between 50Hz and 60Hz.

let activeRenderingFlagsULA: Uint8Array;
let activeRenderingFlagsLayer2_256x192: Uint8Array;
let activeRenderingFlagsLayer2_320x256: Uint8Array;
let activeRenderingFlagsLayer2_640x256: Uint8Array;
let activeRenderingFlagsSprites: Uint16Array;
let activeRenderingFlagsTilemap_40x32: Uint8Array;
let activeRenderingFlagsTilemap_80x32: Uint8Array;
let activeRenderingFlagsLoRes: Uint16Array;
let activeTactToHC: Uint16Array;
let activeTactToVC: Uint16Array;
let activeTactToBitmapOffset: Int32Array;

// -------------------------------------------------------------------------------------------
// Rendering Flags Initialization
//
// These functions generate the rendering flags tables based on timing mode
// and layer configuration. They are called once during emulator initialization.
// -------------------------------------------------------------------------------------------
function initializeAllRenderingFlags(): void {
  if (renderingFlagsULA50Hz) {
    return; // Already initialized
  }

  // Generate ULA rendering flags for both timing modes
  renderingFlagsULA50Hz = generateULAStandardRenderingFlags(Plus3_50Hz);
  renderingFlagsULA60Hz = generateULAStandardRenderingFlags(Plus3_60Hz);

  // Generate Layer2 rendering flags for all resolutions and timing modes
  renderingFlagsLayer2_256x192_50Hz = generateLayer2_256x192x8RenderingFlags(Plus3_50Hz);
  renderingFlagsLayer2_256x192_60Hz = generateLayer2_256x192x8RenderingFlags(Plus3_60Hz);

  // Layer 2 Wide mode (320x256 and 640x256) share the same rendering flags
  renderingFlagsLayer2_Wide_50Hz = generateLayer2_WideRenderingFlags(Plus3_50Hz);
  renderingFlagsLayer2_Wide_60Hz = generateLayer2_WideRenderingFlags(Plus3_60Hz);

  // Generate Sprites rendering flags for both timing modes
  renderingFlagsSprites50Hz = generateSpritesRenderingFlags(Plus3_50Hz);
  renderingFlagsSprites60Hz = generateSpritesRenderingFlags(Plus3_60Hz);

  // Generate Tilemap rendering flags for both resolutions and timing modes
  renderingFlagsTilemap_40x32_50Hz = generateTilemap40x32RenderingFlags(Plus3_50Hz);
  renderingFlagsTilemap_40x32_60Hz = generateTilemap40x32RenderingFlags(Plus3_60Hz);
  renderingFlagsTilemap_80x32_50Hz = generateTilemap80x32RenderingFlags(Plus3_50Hz);
  renderingFlagsTilemap_80x32_60Hz = generateTilemap80x32RenderingFlags(Plus3_60Hz);

  // Generate LoRes rendering flags for both timing modes
  renderingFlagsLoRes50Hz = generateLoResRenderingFlags(Plus3_50Hz);
  renderingFlagsLoRes60Hz = generateLoResRenderingFlags(Plus3_60Hz);
}

// -------------------------------------------------------------------------------------------
// Matrix helpers
// -------------------------------------------------------------------------------------------

function isDisplayArea(config: TimingConfig, vc: number, hc: number): boolean {
  return (
    hc >= config.displayXStart &&
    hc <= config.displayXEnd &&
    vc >= config.displayYStart &&
    vc <= config.displayYEnd
  );
}

function isVisibleArea(config: TimingConfig, vc: number, hc: number): boolean {
  return (
    hc >= config.firstVisibleHC &&
    hc <= config.maxHC &&
    vc >= config.firstBitmapVC &&
    vc <= config.lastBitmapVC
  );
}

function isContentionWindow(hc: number, inDisplayArea: boolean): boolean {
  if (!inDisplayArea) return false;

  const hcAdj = ((hc & 0x0f) + 1) & 0x0f;
  const hcAdj_32 = (hcAdj >> 2) & 0x03; // bits [3:2]
  const hcAdj_31 = (hcAdj >> 1) & 0x07; // bits [3:1]

  // +3 mode contention: hc_adj[3:2] != 00 OR hc_adj[3:1] == 000
  return hcAdj_32 !== 0 || hcAdj_31 === 0;
}

function generateULAStandardRenderingFlags(config: TimingConfig): Uint8Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint8Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateULARenderingFlag(vc, hc);
    }
  }

  return renderingFlags;

  function generateULARenderingFlag(vc: number, hc: number): number {
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
      flags |= SCR_DISPLAY_AREA;
    } else {
      // --- Border area (outside display area but within visible area)
      flags |= SCR_BORDER_AREA;
    }

    // --- Contention window calculation (for +3 timing)
    if (isContentionWindow(hc, displayArea)) {
      flags |= SCR_CONTENTION_WINDOW;
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
      flags |= SCR_NREG_SAMPLE;
    }

    // --- Pixel read: read pixel byte from VRAM at HC subcycle positions 0x1, 0x5, 0x9, 0xD
    // --- The memory read occurs at HC subcycle 0x0, 0x4, 0x8, 0xC.
    if (fetchActive && (hcSub === 0x00 || hcSub === 0x04 || hcSub === 0x08 || hcSub === 0x0c)) {
      flags |= SCR_BYTE1_READ;
    }

    // --- Attribute read: read attribute byte from VRAM at HC subcycle positions 0x2, 0x6, 0xA, 0xE
    if (fetchActive && (hcSub === 0x02 || hcSub === 0x06 || hcSub === 0x0a || hcSub === 0x0e)) {
      flags |= SCR_BYTE2_READ;
    }

    // --- Shift register load: load pixel/attribute data into shift register
    // --- at HC subcycle positions 0xC and 0x4
    if (fetchActive && (hcSub === 0x00 || hcSub === 0x08)) {
      flags |= SCR_SHIFT_REG_LOAD;
    }

    // --- Floating bus update at HC subcycle positions 0x9, 0xB, 0xD, 0xF
    if (displayArea && (hcSub === 0x05 || hcSub === 0x07 || hcSub === 0x09 || hcSub === 0x0b)) {
      flags |= SCR_FLOATING_BUS_UPDATE;
    }

    // --- Done
    return flags;
  }
}

function generateLayer2_256x192x8RenderingFlags(config: TimingConfig): Uint8Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint8Array(vcCount * hcCount);

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
   * @returns 1 if in display area, 0 otherwise
   */
  function generateLayer2_256x192x8Cell(vc: number, hc: number): number {
    // Check if we're in the display area
    const displayArea = isDisplayArea(config, vc, hc);
    if (!displayArea) {
      return 0; // No Layer 2 activity outside display area
    }

    // Layer 2 renders during the entire display area.
    // In Option B rendering (no cycle-exact timing), pixel fetch, coordinate transformation,
    // clipping, and palette lookup all happen atomically in the rendering pipeline.
    return 1;
  }
}

function generateLayer2_WideRenderingFlags(config: TimingConfig): Uint8Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint8Array(vcCount * hcCount);

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
  function generateLayer2_320x256x8Cell(vc: number, hc: number): number {
    // For 320×256 mode, we need a wider horizontal display area
    // Wide display starts 32 pixels earlier: displayXStart - 32 = 144 - 32 = 112
    // Wide display is 320 pixels wide: 112 + 320 - 1 = 431
    const wideDisplayXStart = config.displayXStart - 32;
    const wideDisplayXEnd = wideDisplayXStart + 319;

    // Vertical display area is also extended for 320×256 mode
    // wide_min_vactive = c_min_vactive - 32
    // For 50Hz: displayYStart=64, so wide starts at 64-32=32, wvc=0 to 255 covers 256 lines
    // For 60Hz: displayYStart=40, so wide starts at 40-32=8, wvc=0 to 255 covers 256 lines
    // The 256 lines span from wide_min_vactive to wide_min_vactive + 255
    const wideDisplayYStart = config.displayYStart - 32;
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
    return 1;
  }
}

function generateSpritesRenderingFlags(config: TimingConfig): Uint16Array {
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
  function generateSpritesCell(vc: number, hc: number): number {
    // Vertical display area is also extended for 320×256 mode
    const wideDisplayYStart = config.displayYStart - 32;
    const wideDisplayYEnd = wideDisplayYStart + 255;

    // Check if we're in top or bottom display area. We start rendering sprites
    // one scanline before the display area to prepare the sprite buffer.
    if (vc < wideDisplayYStart - 1 || vc > wideDisplayYEnd) {
      return 0; // No sprite activity outside the top and bottom sprite borders
    }

    let flags = 0;
    // We need a wider horizontal display area for sprites
    const wideDisplayXStart = config.displayXStart - 32;
    const wideDisplayXEnd = wideDisplayXStart + 319;
    const swapStart = wideDisplayXStart - 16; // 16 tacts before wide display starts

    if (hc >= wideDisplayXStart && hc <= wideDisplayXEnd) {
      // The current content of the sprite buffer is displayed
      flags |= SCR_SPRITE_DISPLAY;
    } else if (hc >= swapStart && hc < wideDisplayXStart) {
      // The sprite buffer is being rendered (new data being drawn)
      flags |= SCR_SPRITE_RENDER;
    }

    if (hc === wideDisplayXEnd + 1) {
      // Initialize sprite buffer for the next line
      flags |= SCR_SPRITE_INIT_RENDER;
    }

    if (hc === swapStart) {
      // Initialize sprite display for the current line
      flags |= SCR_SPRITE_INIT_DISPLAY;
    }

    // Done
    return flags;
  }
}

function generateLoResRenderingFlags(config: TimingConfig): Uint16Array {
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
  function generateLoResCell(vc: number, hc: number): number {
    // Check if we're in visible area
    if (!isVisibleArea(config, vc, hc)) {
      return 0;
    }

    const displayArea = isDisplayArea(config, vc, hc);
    let flags = 0;

    // Extract HC subcycle position (hc[3:0])
    const hcSub = hc & 0x0f;

    // Check if we're one position before display area starts (for block pre-fetch with odd scrolling)
    const preDisplayArea =
      vc >= config.displayYStart && vc <= config.displayYEnd && hc === config.displayXStart - 1;

    if (displayArea) {
      flags |= SCR_DISPLAY_AREA;

      // Scroll/mode sample at HC subcycle positions 0x7 and 0xF (like ULA)
      if (hcSub === 0x07 || hcSub === 0x0f) {
        flags |= SCR_NREG_SAMPLE;
      }

      // Block fetch on every HC position in display area
      flags |= SCR_BYTE1_READ;
    } else if (preDisplayArea) {
      // Pre-fetch the first block one position before display starts
      // This ensures we have valid data when rendering the first pixel with odd scroll offsets
      flags |= SCR_BYTE1_READ;
    }

    return flags;
  }
}

// ================================================================================================
// HC/VC Lookup Tables
//
// These tables map each tact (machine cycle) to its corresponding HC and VC values to
// eliminate expensive modulo/division operations. They are generated for both 50Hz and 60Hz
// timing modes to optimize rendering performance.
// ================================================================================================
let tactToHC50Hz: Uint16Array | undefined;
let tactToVC50Hz: Uint16Array | undefined;
let tactToHC60Hz: Uint16Array | undefined;
let tactToVC60Hz: Uint16Array | undefined;

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

function initializeTactLookupTables(): void {
  if (tactToHC50Hz) {
    return; // Already initialized
  }

  const [hc50, vc50] = generateTactLookupTables(Plus3_50Hz);
  tactToHC50Hz = hc50;
  tactToVC50Hz = vc50;

  const [hc60, vc60] = generateTactLookupTables(Plus3_60Hz);
  tactToHC60Hz = hc60;
  tactToVC60Hz = vc60;
}

// ================================================================================================
// Bitmap Offset Lookup Tables
//
// These tables map each tact (machine cycle) to the corresponding bitmap buffer offset
// for rendering. They are generated for both 50Hz and 60Hz timing modes to optimize
// pixel rendering performance by avoiding real-time calculations.
// ================================================================================================
let tactToBitmapOffset50Hz: Int32Array | undefined;
let tactToBitmapOffset60Hz: Int32Array | undefined;

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

function initializeBitmapOffsetTables(): void {
  if (tactToBitmapOffset50Hz) {
    return; // Already initialized
  }

  tactToBitmapOffset50Hz = generateBitmapOffsetTable(Plus3_50Hz);
  tactToBitmapOffset60Hz = generateBitmapOffsetTable(Plus3_60Hz);
}

// ================================================================================================
// ULA Address Lookup Tables
//
// These tables map Y coordinates (0-191) to ULA pixel and attribute base addresses.
// Pre-calculating these addresses eliminates bit manipulations during rendering.
// ================================================================================================
let ulaPixelLineBaseAddr: Uint16Array | undefined;
let ulaAttrLineBaseAddr: Uint16Array | undefined;

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

function initializeULAAddressTables(): void {
  if (ulaPixelLineBaseAddr) {
    return; // Already initialized
  }

  const [pixel, attr] = generateULAAddressTables();
  ulaPixelLineBaseAddr = pixel;
  ulaAttrLineBaseAddr = attr;
}

// ================================================================================================
// Attribute Decode Lookup Tables
//
// These tables map attribute byte values (0-255) to pre-calculated ink and paper
// palette indices for both flash on and flash off states, as well as ULA+ mode.
// This eliminates bit operations during pixel rendering.
// ================================================================================================
let attrToInkFlashOff: Uint8Array | undefined;
let attrToPaperFlashOff: Uint8Array | undefined;
let attrToInkFlashOn: Uint8Array | undefined;
let attrToPaperFlashOn: Uint8Array | undefined;
let ulaPlusAttrToInk: Uint8Array | undefined;
let ulaPlusAttrToPaper: Uint8Array | undefined;

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

function initializeAttributeDecodeTables(): void {
  if (attrToInkFlashOff) {
    return; // Already initialized
  }

  const tables = generateAttributeDecodeTables();
  attrToInkFlashOff = tables.attrToInkFlashOff;
  attrToPaperFlashOff = tables.attrToPaperFlashOff;
  attrToInkFlashOn = tables.attrToInkFlashOn;
  attrToPaperFlashOn = tables.attrToPaperFlashOn;
  ulaPlusAttrToInk = tables.ulaPlusAttrToInk;
  ulaPlusAttrToPaper = tables.ulaPlusAttrToPaper;
}

function setActiveTimingMode(is60Hz: boolean): void {
  activeRenderingFlagsULA = is60Hz ? renderingFlagsULA60Hz : renderingFlagsULA50Hz;
  activeRenderingFlagsLayer2_256x192 = is60Hz
    ? renderingFlagsLayer2_256x192_60Hz
    : renderingFlagsLayer2_256x192_50Hz;
  // Both 320x256 and 640x256 use the same wide mode rendering flags
  activeRenderingFlagsLayer2_320x256 = is60Hz
    ? renderingFlagsLayer2_Wide_60Hz
    : renderingFlagsLayer2_Wide_50Hz;
  activeRenderingFlagsLayer2_640x256 = is60Hz
    ? renderingFlagsLayer2_Wide_60Hz
    : renderingFlagsLayer2_Wide_50Hz;
  activeRenderingFlagsSprites = is60Hz ? renderingFlagsSprites60Hz : renderingFlagsSprites50Hz;
  activeRenderingFlagsTilemap_40x32 = is60Hz
    ? renderingFlagsTilemap_40x32_60Hz
    : renderingFlagsTilemap_40x32_50Hz;
  activeRenderingFlagsTilemap_80x32 = is60Hz
    ? renderingFlagsTilemap_80x32_60Hz
    : renderingFlagsTilemap_80x32_50Hz;
  activeRenderingFlagsLoRes = is60Hz ? renderingFlagsLoRes60Hz : renderingFlagsLoRes50Hz;
  activeTactToHC = is60Hz ? tactToHC60Hz : tactToHC50Hz;
  activeTactToVC = is60Hz ? tactToVC60Hz : tactToVC50Hz;
  activeTactToBitmapOffset = is60Hz ? tactToBitmapOffset60Hz : tactToBitmapOffset50Hz;
}

// ================================================================================================
// ULANext Attribute Decode Lookup Tables
//
// These tables map ULANext format masks and attribute byte values to pre-calculated
// ink and paper palette indices. This eliminates bit operations during pixel rendering.
// ================================================================================================
let ulaNextInkLookup: Uint8Array | undefined; // [format][attr] -> ink palette index (0-127)
let ulaNextPaperLookup: Uint8Array | undefined; // [format][attr] -> paper palette index (128-255) or 255 for fallback

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

function initializeULANextTables(): void {
  if (ulaNextInkLookup) {
    return; // Already initialized
  }

  const [ink, paper] = generateULANextAttributeTables();
  ulaNextInkLookup = ink;
  ulaNextPaperLookup = paper;
}

/**
 * Get ULANext ink palette index for given format and attribute.
 * @param format ULANext format mask (NextReg 0x42)
 * @param attr Attribute byte value
 * @returns Ink palette index (0-127)
 */
function getULANextInkIndex(format: number, attr: number): number {
  return ulaNextInkLookup[format * 256 + attr];
}

/**
 * Get ULANext paper palette index for given format and attribute.
 * @param format ULANext format mask (NextReg 0x42)
 * @param attr Attribute byte value
 * @returns Paper palette index (128-255) or 255 if fallback color should be used
 */
function getULANextPaperIndex(format: number, attr: number): number {
  return ulaNextPaperLookup[format * 256 + attr];
}

// ================================================================================================
// Tilemap Rendering Flags Generation
// ================================================================================================

/**
 * Generate tilemap 40×32 rendering flags for a timing configuration.
 *
 * This function creates a flag matrix for the 40×32 tilemap mode (320×256 pixels).
 * Each tile is 8×8 pixels, requiring 40 tiles horizontally and 32 tiles vertically.
 *
 * Fetch timing:
 * - Tile index fetch occurs at tile boundaries (pixelInTile === 0)
 * - Tile attribute fetch occurs 1 pixel after (pixelInTile === 1)
 * - Tile pattern fetch occurs 2 pixels after (pixelInTile === 2)
 * - Buffer advance occurs for all pixels in display area
 *
 * @param config Timing configuration (Plus3_50Hz or Plus3_60Hz)
 * @returns Uint8Array with flags for each (VC, HC) position
 */
function generateTilemap40x32RenderingFlags(config: TimingConfig): Uint8Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint8Array(vcCount * hcCount);

  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateTilemap40x32Cell(vc, hc);
    }
  }

  return renderingFlags;

  /**
   * Generate rendering flags for a single tilemap cell in 40×32 mode.
   * @param vc Vertical counter position
   * @param hc Horizontal counter position
   * @returns Flags indicating tilemap activities at this position
   */
  function generateTilemap40x32Cell(vc: number, hc: number): number {
    // For 40×32 (320×256) mode, we need a wider horizontal display area
    // Wide display starts 32 pixels earlier: displayXStart - 32 = 144 - 32 = 112
    // But we also need to include border area for prefetching (8 pixels before)
    // So extend by another 8 pixels: 112 - 8 = 104
    const wideDisplayXStart = config.displayXStart - 32 - 8; // Include prefetch border
    const wideDisplayXEnd = wideDisplayXStart + 319 + 8; // 320 display + 8 prefetch

    // Vertical display area is also extended for 320×256 mode
    // For 50Hz: displayYStart=64, so wide starts at 64-32=32
    // For 60Hz: displayYStart=40, so wide starts at 40-32=8
    const wideDisplayYStart = config.displayYStart - 32;
    const wideDisplayYEnd = wideDisplayYStart + 255;

    // Check if we're in the wide display area (including prefetch borders)
    if (
      hc < wideDisplayXStart ||
      hc > wideDisplayXEnd ||
      vc < wideDisplayYStart ||
      vc > wideDisplayYEnd
    ) {
      return 0; // No tilemap activity outside display area
    }

    let flags = 0;

    // Calculate pixel position within display area relative to wide display start (without prefetch offset)
    // The actual display starts 8 pixels after wideDisplayXStart
    const pixelX = hc - (wideDisplayXStart + 8);

    // VHDL uses "one character ahead" (hcount_eff), which means fetching happens
    // during the border area before visible pixels start. To match this, we need
    // to allow fetching even when pixelX is negative (in the border).
    // The fetch at pixelX=-2,-1 will load tile 0 data, ready for rendering at pixelX=0.

    // Tilemap fetches occur at 8-pixel tile boundaries
    // Each tile is 8 pixels wide in 40×32 mode
    // Calculate which tile we're fetching for (accounting for +8 lookahead)
    const fetchForPixelX = pixelX + 8;

    // Only fetch if the target tile is within the display area or just before it
    // Allow fetching from pixelX=-8 (fetchForPixelX=0, first tile) to pixelX=311 (fetchForPixelX=319, last pixel of last tile)
    if (fetchForPixelX >= 0 && fetchForPixelX < 320) {
      const hcInTile = pixelX & 0x07; // Use bitwise AND for modulo 8

      // Sample config bits at tile boundaries (when we'd start rendering the next tile)
      if (hcInTile === 0 && pixelX >= 0 && pixelX < 320) {
        flags |= SCR_TILEMAP_SAMPLE_CONFIG;
      }

      // Fetch tile data at END of previous tile so it's ready for new tile
      // Fetch tile index 2 positions before tile boundary
      if (hcInTile === 6) {
        flags |= SCR_TILE_INDEX_FETCH;
      }

      // Fetch tile attribute 1 position before tile boundary
      if (hcInTile === 7) {
        flags |= SCR_TILE_ATTR_FETCH;
        // Also fetch pattern at position 7 so buffer is ready for position 0 of next tile
        flags |= SCR_PATTERN_FETCH;
      }
    }

    return flags;
  }
}

/**
 * Generate tilemap 80×32 rendering flags for a timing configuration.
 *
 * This function creates a flag matrix for the 80×32 tilemap mode (640×256 pixels).
 * Each tile is still 8×8 pixels, but the horizontal resolution is doubled.
 * Each HC position generates 2 pixels instead of 1.
 *
 * Fetch timing adjusted for doubled horizontal resolution:
 * - Tile index fetch occurs at pixelInTile === 0 (every 4 HC positions)
 * - Tile attribute fetch occurs at pixelInTile === 2 (1 HC after index)
 * - Tile pattern fetch occurs at pixelInTile === 4 (2 HC after index)
 * - Buffer advance occurs for all pixels in display area
 *
 * @param config Timing configuration (Plus3_50Hz or Plus3_60Hz)
 * @returns Uint8Array with flags for each (VC, HC) position
 */
function generateTilemap80x32RenderingFlags(config: TimingConfig): Uint8Array {
  const vcCount = config.totalVC;
  const hcCount = RENDERING_FLAGS_HC_COUNT;
  const renderingFlags = new Uint8Array(vcCount * hcCount);

  let tmFetch = 0;
  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      renderingFlags[index] = generateTilemap80x32Cell(vc, hc);
      if (renderingFlags[index] & SCR_TILE_INDEX_FETCH) {
        tmFetch++;
      }
    }
  }

  return renderingFlags;

  /**
   * Generate rendering flags for a single tilemap cell in 80×32 mode.
   * @param vc Vertical counter position
   * @param hc Horizontal counter position
   * @returns Flags indicating tilemap activities at this position
   */
  function generateTilemap80x32Cell(vc: number, hc: number): number {
    // For 80×32 mode: SAME as 40×32, but fetch at twice the frequency (every 4 HC instead of every 8 HC)
    // Wide display starts 32 pixels earlier: displayXStart - 32 = 144 - 32 = 112
    // But we also need to include border area for prefetching (8 pixels before)
    // So extend by another 8 pixels: 112 - 8 = 104
    const wideDisplayXStart = config.displayXStart - 32 - 8; // Include prefetch border
    const wideDisplayXEnd = wideDisplayXStart + 319 + 8; // 320 display + 8 prefetch (pixel coordinates 0-319)

    // Vertical display area is also extended for 320×256 mode
    // For 50Hz: displayYStart=64, so wide starts at 64-32=32
    // For 60Hz: displayYStart=40, so wide starts at 40-32=8
    const wideDisplayYStart = config.displayYStart - 32;
    const wideDisplayYEnd = wideDisplayYStart + 255;

    // Check if we're in the wide display area (including prefetch borders)
    if (
      hc < wideDisplayXStart ||
      hc > wideDisplayXEnd ||
      vc < wideDisplayYStart ||
      vc > wideDisplayYEnd
    ) {
      return 0; // No tilemap activity outside display area
    }

    let flags = 0;

    // Calculate pixel position within display area relative to wide display start (without prefetch offset)
    // The actual display starts 8 pixels after wideDisplayXStart
    const pixelX = hc - (wideDisplayXStart + 8);

    // VHDL uses "one character ahead" (hcount_eff), which means fetching happens
    // during the border area before visible pixels start. To match this, we need
    // to allow fetching even when pixelX is negative (in the border).
    // The fetch at pixelX=-2,-1 will load tile 0 data, ready for rendering at pixelX=0.

    // Tilemap fetches occur at 8-pixel tile boundaries in 40×32, but every 4 pixels in 80×32
    // Each tile is 8 pixels wide, but in 80×32 we have twice as many tiles
    // Calculate which tile we're fetching for (accounting for +8 lookahead)
    const fetchForPixelX = pixelX + 8;

    // Only fetch if the target tile is within the display area or just before it
    // Allow fetching from pixelX=-8 (fetchForPixelX=0, first tile) to pixelX=311 (fetchForPixelX=319, last pixel of last tile)
    // NOTE: pixelX ranges 0-319 (same as 40x32), so fetchForPixelX ranges -8 to 327
    if (fetchForPixelX >= 0 && fetchForPixelX < 320) {
      const hcInTile = pixelX & 0x03; // Use bitwise AND for modulo 8

      if (hcInTile === 0x00 && pixelX >= 0 && pixelX < 320) {
        flags |= SCR_TILEMAP_SAMPLE_CONFIG;
      }

      if (hcInTile === 0x01) {
        flags |= SCR_TILE_INDEX_FETCH;
      }

      if (hcInTile === 0x02) {
        flags |= SCR_TILE_ATTR_FETCH;
      }

      if (hcInTile === 0x03) {
        flags |= SCR_PATTERN_FETCH;
      }
    }

    return flags;
  }
}

// ================================================================================================
// Layer 2 helper tables
//
// This table assists in coordinate wrapping for Layer 2 wide modes (320x256 and 640x256).
// Both modes use the same wrapping logic.
// ================================================================================================
let layer2XWrappingTableWide: Uint16Array | undefined;

// LoRes Y-coordinate wrapping lookup table for performance optimization
// Pre-computed for all possible y_pre values (0-447: 192 display lines + 256 max scroll)
let loResYWrapTable: Uint8Array | undefined;

function initializeLayer2HelperTables(): void {
  // Both 320x256 and 640x256 modes use the same wrapping logic
  layer2XWrappingTableWide = new Uint16Array(1024);

  for (let i = 0; i < 1024; i++) {
    let x = i;
    if (x >= 320 && x < 512) {
      const upper = ((x >> 6) & 0x7) + 3;
      x = (upper << 6) | (x & 0x3f);
    }
    layer2XWrappingTableWide[i] = x & 0x1ff;
  }

  // Initialize LoRes Y-wrap lookup table
  // Covers all possible displayVC (0-191) + scrollY (0-255) = 0-446
  loResYWrapTable = new Uint8Array(448);
  for (let y_pre = 0; y_pre < 448; y_pre++) {
    if (y_pre >= 192) {
      // Wrap: y(7 downto 6) <= (y_pre(7 downto 6) + 1)
      const upperBits = ((y_pre >> 6) + 1) & 0x03;
      loResYWrapTable[y_pre] = (upperBits << 6) | (y_pre & 0x3f);
    } else {
      loResYWrapTable[y_pre] = y_pre & 0xff;
    }
  }
}
