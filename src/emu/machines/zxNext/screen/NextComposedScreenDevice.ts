import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { Pentagon_50Hz, Plus3_50Hz, Plus3_60Hz, TimingConfig, selectTimingConfig } from "./TimingConfig";
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
  private confIntPulseCycles: number;
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
  /** The 50/60 Hz bit in effect for the current frame (set at the frame start). */
  effective60Hz = false;
  /** The scandoubler bit in effect for the current frame (set at the frame start). */
  effectiveScandoubler = true;
  // INT signal (active: true, inactive: false)
  pulseIntActive: boolean;
  // Line interrupt pulse: true for one tact (HC=0) when the raster enters the target line
  lineIntActive: boolean;
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
  // The border value the picture shows: zxula.vhd attr_reg, loaded from the port every 8 pixels
  private borderColorLatched: number;
  // The raster in effect is Pentagon's (its border reloads every clock)
  private confPentagon = false;
  /**
   * The contention pattern of the raster in effect (zxnext.vhd ~4461-4473, `eff_nr_03_machine_timing`,
   * latched at the frame start like the raster): 0 none (Pentagon), 1 48K, 2 128K, 3 +3.
   */
  contentionTiming = 0;
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
    this.timexPortBit7 = false;
    this.ulaStandardScreenAt0x4000 = true;
    this.ulaHiResMode = false;
    this.ulaHiResModeSampled = false;
    this.ulaHiResColor = 0;
    this.ulaHiColorMode = false;
    this.ulaScreenModeSampled = 0;
    this.ulaHalfPixelScrollSampled = false;

    // --- Initialize LoRes state
    this.loResEnabled = false;
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
    this.ulaNextFormat = 0x07; // Default: 3-bit INK, 5-bit PAPER

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
    this.tilemapControlBit2 = false;
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
    // --- The display Y start derives from the raster config; it used to be computed only on a tilemap
    // --- scroll write, so a program that enabled the tilemap without writing $2F-$31 saw no tilemap.
    this.updateTilemapDisplayOrigin();
    this.tilemapDefaultAttrCache = 0;
    this.tilemapPixel1BelowUla = false;
    this.tilemapPixel2BelowUla = false;

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

    // --- NextReg $03 timing, user lock and machine type have no reset branch in zxnext.vhd: a soft
    // --- reset keeps them. NextRegDevice.hardReset sets the post-firmware values.
    this.displayTiming ??= 0b011;
    this.userLockOnDisplayTiming ??= false;
    this.machineType ??= 0b011;
    this.videoTimingMode = 0;

    // --- Initialize border color (use setter to update cache)
    this.borderColor = 7; // Default white border
    this.borderColorLatched = 7;
    this.updateBorderRgbCache();

    // --- Initialize timing mode, matrices, and the pixel bitmap
    this.onNewFrame();

    // --- Rendering state
    this.pulseIntActive = false;
    this.lineIntActive = false;
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

  // Set the border color written to port $FE. The picture takes it at the next border latch
  // (renderTact), which updates the cached RGB value.
  set borderColor(value: number) {
    this.borderColorField = value;
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
    if (this.ulaNextEnabledField) {
      // ULANext: border resolves through paper path (palette indices 128+)
      this.borderRgbCache = this.paletteDevice.getUlaRgb333(128 + this.borderColorLatched);
    } else if (this.ulaPlusEnabledField) {
      // ULA+: Border uses palette indices 200-207 (for border colors 0-7)
      const ulaPlusPaletteIndex = 200 + this.borderColorLatched;
      this.borderRgbCache = this.paletteDevice.getUlaRgb333(ulaPlusPaletteIndex);
    } else {
      // Standard: Border uses paper palette indices 16-23
      this.borderRgbCache = this.paletteDevice.getUlaRgb333(16 + this.borderColorLatched);
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
    this.updateTilemapDisplayOrigin();
  }

  // Gets the Layer 2 Y Scroll value
  get tilemapScrollY(): number {
    return this.tilemapScrollYField;
  }

  // Sets the Layer 2 Y Scroll value, updating related caches
  set tilemapScrollY(value: number) {
    this.tilemapScrollYField = value;
    this.updateTilemapDisplayOrigin();
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
      (this.tilemapControlBit2 ? 0x04 : 0) |
      (this.tilemap512TileMode ? 0x02 : 0) |
      (this.tilemapForceOnTopOfUla ? 0x01 : 0)
    );
  }

  /** $6B bit 2: no function, but zxnext.vhd ~5439 stores bits 6-0 and ~6048 reads them back. */
  private tilemapControlBit2 = false;

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
    this.tilemapControlBit2 = (value & 0x04) !== 0;
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
    this.updateTilemapDisplayOrigin();
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
    // --- zxnext.vhd ~5781: Pentagon timing holds the 50/60 Hz bit at 0
    if (this.displayTiming & 0b100) this.is60HzMode = false;
    // --- zxnext.vhd ~6644-6649: the 50/60 Hz bit and the scandoubler take effect at the frame start;
    // --- $05 reads these effective values
    this.effective60Hz = this.is60HzMode;
    this.effectiveScandoubler = this.scandoublerEnabled;
    // --- Set up the timing mode and rendering matrices accord to the current frequency mode
    const is60Hz = this.is60HzMode;
    const oldConfig = this.config;
    // --- NextReg $03 display timing picks the raster (48K / 128K / +3 / Pentagon), $05 bit 2 50/60 Hz
    this.config = selectTimingConfig(this.displayTiming, is60Hz);

    // Copy config properties to flattened fields (eliminates property access overhead)
    this.confIntStartTact = this.config.intStartTact;
    this.confIntPulseCycles = this.config.intPulseCycles;
    this.confTotalVC = this.config.totalVC;
    this.confTotalHC = this.config.totalHC;
    this.confDisplayXStart = this.config.displayXStart;
    this.confDisplayYStart = this.config.displayYStart;
    this.confPentagon = this.config === Pentagon_50Hz;
    const timing = this.displayTiming;
    this.contentionTiming = timing & 0b100 ? 0 : timing === 0b010 ? 2 : timing === 0b011 ? 3 : 1;
    this.updateTilemapDisplayOrigin();

    this.renderingTacts = this.confTotalVC * this.confTotalHC;
    this.machine.setTactsInFrame(this.renderingTacts);

    // --- Update module-level active timing mode cache
    setActiveTimingMode(this.config);

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
    this.tilemapPixel1BelowUla = false;
    this.tilemapPixel2BelowUla = false;
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

  /**
   * Convert a raw ULA vertical counter into the copper vertical line — the hardware `cvc`.
   *
   * `zxula_timing.vhd` builds `cvc` as a counter that is loaded with NextReg $64 at the first
   * active video line (`ula_min_vactive`), then increments per line and wraps at `c_max_vc`
   * (310 at 50Hz, 263 at 60Hz — exactly `totalVC - 1`). That is equivalent to:
   *
   *   cvc = (vc - displayYStart + copperOffset) mod totalVC
   *
   * Three consumers must agree on this value, because the hardware feeds all three from the
   * same `cvc` signal: the copper (`zxnext.vhd`: `vcount_i => cvc`), the line interrupt
   * (`zxula_timing.vhd:577`), and NextRegs $1E/$1F (`zxnext.vhd`: `port_253b_dat <= cvc`).
   * Keeping one formula here is what stops them drifting apart.
   *
   * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.5.
   */
  vcToCopperLine(vc: number, offset = this.machine.copperDevice.offsetAfterReload): number {
    return (vc - this.confDisplayYStart + offset + this.confTotalVC) % this.confTotalVC;
  }

  /**
   * The frame tact at which `cvc` is loaded with NextReg $64: `hc_ula` 0 of the first active line
   * (zxula_timing.vhd ~457-468, `ula_max_hc and ula_min_vactive`).
   */
  get cvcReloadTact(): number {
    return this.confDisplayYStart * this.confTotalHC + this.confDisplayXStart - 12;
  }

  /** The $64 offset `cvc` counts from at a raw beam position: the one loaded at the last reload. */
  private copperOffsetAt(vc: number, hc: number): number {
    const copper = this.machine.copperDevice;
    return vc * this.confTotalHC + hc >= this.cvcReloadTact ? copper.offsetAfterReload : copper.offsetBeforeReload;
  }

  /**
   * The copper's horizontal counter, hardware `hc_ula`, at raw horizontal clock `hc`.
   *
   * The copper, the ULA and NextRegs $1E/$1F all run on `hc_ula`, which wraps to 0 at
   * `c_min_hactive - 12` - twelve pixels before paper x 0 (zxula_timing.vhd: `ula_min_hactive`).
   * The raw `hc` wraps 144 pixels before paper x 0, so feeding it to the copper made every WAIT with a
   * horizontal position fire 132 pixels early.
   */
  copperHcAt(hc: number): number {
    return (hc - (this.confDisplayXStart - 12) + this.confTotalHC) % this.confTotalHC;
  }

  /**
   * The copper line, hardware `cvc`, at raw beam position (`vc`, `hc`). `cvc` advances when `hc_ula`
   * wraps, not when the raw `hc` does, so before raw hc `displayXStart - 12` the beam is still on the
   * previous copper line.
   */
  copperLineAt(vc: number, hc: number): number {
    const offset = this.copperOffsetAt(vc, hc);
    return hc >= this.confDisplayXStart - 12 ? this.vcToCopperLine(vc, offset) : this.vcToCopperLine(vc - 1, offset);
  }

  /**
   * The INT pulse length in frame tacts (7 MHz HC ticks). zxnext.vhd ~1968-2000 counts the pulse on the
   * CPU clock - 32 cycles (48K, +3) or 36 (128K, Pentagon) - so it lasts 2 HC ticks per cycle at
   * 3.5 MHz and halves with every speed step: at 28 MHz a 32-cycle pulse is 8 ticks. A pulse measured
   * in ticks would stay 64 ticks long and be taken again by a short handler at 28 MHz.
   */
  get intPulseLength(): number {
    return (this.confIntPulseCycles * 2) >> this.machine.cpuSpeedDevice.effectiveSpeed;
  }

  /**
   * The CPU T-states (3.5 MHz) a contended memory cycle starting at `frameTact` waits for the ULA
   * (zxula.vhd ~579-600). `wait_s` holds the CPU clock in the 256 x 192 display for ULA hc with
   * ((hc + 1) & 15) >= 4 - "contend 3-14" of every 16-HC (8 T-state) group -, and in +3 timing also for
   * ((hc + 1) & 15) < 2. Each held T-state moves the beam 2 HC on, so the classic tables fall out:
   * 6,5,4,3,2,1,0,0 (48K / 128K) and 1,0,7,6,5,4,3,2 (+3). hc_ula and vc_ula are as in
   * `floatingBusAt`. Whether the accessed page is contended at all is the caller's decision.
   */
  contentionDelayAt(frameTact: number): number {
    const vc = Math.floor(frameTact / this.confTotalHC) - this.confDisplayYStart;
    if (vc < 0 || vc >= 192) return 0;
    let hc = (frameTact % this.confTotalHC) - (this.confDisplayXStart - 12);
    const p3 = this.contentionTiming === 3;
    let delay = 0;
    while (hc >= 0 && hc < 256) {
      const adj = (hc + 1) & 0x0f;
      if (adj < 4 && !(p3 && adj < 2)) break;
      delay++;
      hc += 2;
    }
    return delay;
  }

  /**
   * The ULA floating bus at a frame tact (zxula.vhd ~306-340, 573). In the display area each 16-HC
   * character pair puts the bytes the ULA fetches on the bus - pixel, attribute, pixel, attribute for
   * ULA hc 9-10, 11-12, 13-14, 15-0 - and nothing ($FF) for hc 1-8; the border is $FF. In +3 timing
   * bit 0 of those bytes reads 1 and the rest of the time the bus holds `p3Latch`, the last byte the
   * CPU moved to or from a contended bank (zxnext.vhd ~4478-4488).
   *
   * The ULA counters are the raster's, offset as the copper sees them: hc_ula = HC - (displayXStart -
   * 12), vc_ula = VC - displayYStart. Scrolling and the Timex modes are not applied.
   */
  floatingBusAt(frameTact: number, p3Latch: number): number {
    const p3 = this.displayTiming === 0b011;
    const hc = (frameTact % this.confTotalHC) - (this.confDisplayXStart - 12);
    const vc = Math.floor(frameTact / this.confTotalHC) - this.confDisplayYStart;
    if (hc >= 0 && hc < 256 && vc >= 0 && vc < 192) {
      const phase = hc & 0x0f;
      if ((phase >= 9 || phase === 0) && !(phase === 0 && hc === 0)) {
        const pair = (phase === 0 ? hc - 16 : hc) >> 4;
        const column = pair * 2 + (phase >= 13 || phase === 0 ? 1 : 0);
        const attribute = phase === 11 || phase === 12 || phase === 15 || phase === 0;
        const offset = attribute
          ? 0x1800 + ((vc >> 3) << 5) + column
          : ((vc & 0xc0) << 5) | ((vc & 0x07) << 8) | ((vc & 0x38) << 2) | column;
        const value = this.machine.memoryDevice.readScreenMemory(offset);
        return p3 ? value | 0x01 : value;
      }
    }
    return p3 ? p3Latch : 0xff;
  }

  /**
   * The frame tact at which the line interrupt pulse for NextReg $22/$23 starts.
   *
   * zxula_timing.vhd: "the line interrupt occurs before the line is drawn" - it fires when
   * `hc_ula = 255` on copper line `L - 1` (`c_max_vc` for L = 0), and `cvc` includes the $64 offset.
   * `hc_ula` 255 is raw HC `displayXStart - 12 + 255`, on the raw line whose copper line is `L - 1`.
   */
  lineInterruptStartTact(): number {
    const line = this.machine.interruptDevice.lineInterrupt;
    // --- int_line_num = line - 1 is compared with cvc (0 ... c_max_vc): lines past c_max_vc + 1 never fire
    if (line > this.confTotalVC) return -1;
    const targetCvc = line === 0 ? this.confTotalVC - 1 : line - 1;
    // --- cvc counts from the offset loaded at the last reload: the match is where it reaches targetCvc
    // --- under the offset in effect at that position (after this frame's reload, or before it)
    const copper = this.machine.copperDevice;
    const startFor = (offset: number) =>
      ((targetCvc + this.confDisplayYStart - offset + this.confTotalVC) % this.confTotalVC) * this.confTotalHC +
      this.confDisplayXStart - 12 + 255;
    const after = startFor(copper.offsetAfterReload);
    if (after >= this.cvcReloadTact) return after;
    const before = startFor(copper.offsetBeforeReload);
    return before < this.cvcReloadTact ? before : -1;
  }

  // Render the pixel pair belonging to the specified frame tact. This method is the core
  // of the rendering pipeline, called once per tact in the frame.
  renderTact(tact: number): boolean {
    const pulseLength = this.intPulseLength;
    // --- The Pentagon interrupt starts at the last tact of the frame: the pulse wraps into the next one
    const sinceInt = tact - this.confIntStartTact;
    this.pulseIntActive = (sinceInt >= 0 ? sinceInt : sinceInt + this.renderingTacts) < pulseLength;

    // --- Get pre-calculated VC and HC positions
    const vc = activeTactToVC[tact];
    const hc = activeTactToHC[tact];

    // --- Update active video line counter (NextRegs 0x1E/0x1F) for every tact, including
    // blanking, so the value is always current when the CPU reads it.
    // Formula mirrors MAME's vpos_to_cvc:
    //   CVC = (vc - displayYStart + copperOffset + totalVC) % totalVC
    // At vc=displayYStart with no offset, CVC=0 (first ULA pixel row = line 0).
    // The line changes with `hc_ula`, like the copper's (zxnext.vhd: $1E/$1F read `cvc`).
    this.activeVideoLine = this.copperLineAt(vc, hc);

    // --- zxula.vhd ~427-441: the border reaches the picture through attr_reg, which takes the port
    // --- $FE value only at the shift-register loads, every 8 pixels (HC = displayXStart mod 8);
    // --- Pentagon timing reloads it every clock. The palette lookup stays per pixel.
    if (this.borderColorLatched !== this.borderColorField && ((hc & 0x07) === 0 || this.confPentagon)) {
      this.borderColorLatched = this.borderColorField;
      this.updateBorderRgbCache();
    }

    // --- Line interrupt pulse: as long as the ULA interrupt pulse, starting at the hardware position.
    const lineStart = this.lineInterruptStartTact();
    const lineElapsed = (tact - lineStart + this.renderingTacts) % this.renderingTacts;
    this.lineIntActive = lineStart >= 0 && lineElapsed < pulseLength;

    // === BLANKING CHECK ===
    // All rendering flags have identical blanking regions (cell value 0) for a given frequency mode.
    // We can use active ULA rendering flags as the blanking mask for all layers.
    // If the cell is 0 in this flags array, it's 0 in all other flags arrays (blanking region).
    if (activeRenderingFlagsULA[tact] === 0) {
      /*
       * Nothing is shown here, but the sprite engine keeps working: like the FPGA, it fills the next
       * line's buffer through the horizontal blanking interval. Only that — no layer composes and
       * nothing reaches the bitmap for a blanking tact.
       */
      // --- The engine runs whether or not $15 bit 0 shows its output (sprites.vhd has no enable)
      const spritesCell = activeRenderingFlagsSprites[tact];
      if (spritesCell !== 0) this.renderSpritesPixel(vc, hc, spritesCell);
      return false; // Skip blanking tact - no visible content in any layer
    }

    // --- HC is already computed above

    // === ULA rendering
    // --- The ULA always runs, so its pipeline is current whenever LoRes is switched off
    if (this.ulaHiResModeSampled) {
      // --- Timex HiRes (screen mode bit 2: 512×192, 2 pixels per HC)
      this.renderULAHiResPixel(vc, hc, activeRenderingFlagsULA[tact]);
    } else {
      // --- Standard, second display file, HiColor (screen modes 0-3: one pipeline, the mode only
      // --- picks the fetch addresses - zxula.vhd ~230-250)
      this.renderULAStandardPixel(vc, hc, activeRenderingFlagsULA[tact]);
    }
    // --- LoRes (128×96) runs beside it and replaces its pixel where valid; $15 bit 7 acts per pixel
    // --- (zxnext.vhd ~6763, ~6879, ~6926)
    if (this.loResEnabled) {
      this.renderLoResPixel(vc, hc, activeRenderingFlagsLoRes[tact]);
    }

    // --- NextReg $68 bit 7 (ULA disabled) is applied in composeLayers: it removes the ULA as a layer but
    // --- not as the blend operand (zxnext.vhd `ula_mix_rgb` ignores `ula_en`). The ULA still runs above -
    // --- it keeps sampling its registers - so clearing the bit shows the ULA again from the next pixel.

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
    // --- The sprite engine always runs (collisions, time-outs); $15 bit 0 only gates its pixels into the
    // --- mixer (zxnext.vhd ~6880)
    this.renderSpritesPixel(vc, hc, activeRenderingFlagsSprites[tact]);

    // Render Tilemap pixel(s) if enabled
    if (this.tilemapEnabled) {
      this.renderTilemapPixel(vc, hc);
    }

    // Stage 2: compose ULA, tilemap, Layer 2 and sprites per pixel (zxnext.vhd video stage 2)
    const bitmapOffset = activeTactToBitmapOffset[tact];
    if (bitmapOffset >= 0) {
      const tmOn = this.tilemapEnabled;
      const border = (activeRenderingFlagsULA[tact] & SCR_DISPLAY_AREA) === 0;
      this.pixelBufferField[bitmapOffset] = this.composeLayers(
        this.ulaPixel1Rgb333,
        this.ulaPixel1Transparent,
        tmOn ? this.tilemapPixel1Rgb333 : null,
        !tmOn || this.tilemapPixel1Rgb333 === null || this.tilemapPixel1Transparent,
        tmOn ? this.tilemapPixel1BelowUla : !this.tilemapForceOnTopOfUla,
        this.layer2Pixel1Rgb333,
        this.layer2Pixel1Transparent,
        this.layer2Pixel1Priority,
        this.spritesPixel1Rgb333,
        this.spritesPixel1Transparent,
        border
      );
      this.pixelBufferField[bitmapOffset + 1] = this.composeLayers(
        this.ulaPixel2Rgb333,
        this.ulaPixel2Transparent,
        tmOn ? this.tilemapPixel2Rgb333 : null,
        !tmOn || this.tilemapPixel2Rgb333 === null || this.tilemapPixel2Transparent,
        tmOn ? this.tilemapPixel2BelowUla : !this.tilemapForceOnTopOfUla,
        this.layer2Pixel2Rgb333,
        this.layer2Pixel2Transparent,
        this.layer2Pixel2Priority,
        this.spritesPixel2Rgb333,
        this.spritesPixel2Transparent,
        border
      );
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
    // --- 8-bit RRRGGGBB to 9 bits: the extra blue bit is B1 OR B0 (zxnext.vhd: `fallback_rgb_2 &
    // --- (fallback_rgb_2(1) or fallback_rgb_2(0))`). OR-ing in B1 itself turned blue 10 into 110.
    const fallbackRgb332 = this.fallbackColorField;
    const blueLSB = (fallbackRgb332 & 0x03) !== 0 ? 1 : 0;
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

  // The tilemap's display origin: 32 lines above the paper
  private updateTilemapDisplayOrigin(): void {
    this.tilemapWideDisplayYStart = this.confDisplayYStart - 32;
  }

  // ==============================================================================================
  // Port updates
  //
  // These properties are used to get/set the values of special ports used by the ZX Spectrum Next
  // screen rendering.
  // ==============================================================================================

  // Timex port (0xff) ULA flags - The last 6 bit of the Timex port
  timexPortBits: number;
  // Timex port (0xff) bit 7: stored and read back only (zxnext.vhd port_ff_reg; bit 6 is the
  // interrupt device's ULA interrupt disable). Every reset clears the register.
  timexPortBit7 = false;

  get timexPortValue(): number {
    return this.timexPortBits;
  }

  set timexPortValue(value: number) {
    this.timexPortBits = value & 0x3f;
    this.ulaHiResColor = (value >> 3) & 0x07;
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
    // --- ~5781: Pentagon timing holds the 50/60 Hz bit at 0
    this.is60HzMode = (value & 0x04) !== 0 && (this.displayTiming & 0b100) === 0;
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
    this.updateTilemapDisplayOrigin();
  }

  set nextReg0x42Value(value: number) {
    this.ulaNextFormat = value;
    this.updateFallbackRgb333Cache();
    this.updateBorderRgbCache();
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

  /** Composes ULA, Layer 2 and sprites with no tilemap. Not used by the renderer: test/zxnext/UlaRendering. */
  composeSinglePixel(
    ulaPixelRgb333: number | null,
    ulaTransparent: boolean,
    layer2PixelRgb333: number | null,
    layer2Transparent: boolean,
    layer2Priority: boolean,
    spritesPixelRgb333: number | null,
    spritesTransparent: boolean
  ): number {
    return this.composeLayers(
      ulaPixelRgb333, ulaTransparent, null, true, !this.tilemapForceOnTopOfUla,
      layer2PixelRgb333, layer2Transparent, layer2Priority, spritesPixelRgb333, spritesTransparent, false
    );
  }

  /**
   * One output pixel from the four layers, as zxnext.vhd video stage 2 mixes them (the WASM core's
   * `zxnextUlaCompose` is the same logic):
   * - `ula_mix_*` is the ULA as the blend operand ($68 bit 7 does not apply); `ula_*` the ULA as a layer.
   * - `ula_final_*` is the stencil (`ula_stencil_mode and ula_en and tm_en`: AND of both colours) or the
   *   ULA/tilemap merge (tilemap wins unless it is below an opaque ULA pixel).
   * - Orders SLU..ULS by `$15` bits 4-2 with the Layer 2 priority bit, and the border exception in
   *   LUS/USL/ULS: a sprite shows over an opaque ULA border pixel where the tilemap is transparent.
   * - 110/111: Layer 2 plus `mix_rgb` chosen by `$68` bits 6-5 (`case ula_blend_mode_2`), with the
   *   tilemap or ULA as the top/bottom layer around it; 110 saturates, 111 subtracts 5 and clamps.
   * Returns the pixel in the RGBA format of the pixel buffer.
   */
  private composeLayers(
    ulaPixelRgb333: number | null,
    ulaMixTransparent: boolean,
    tmPixelRgb333: number | null,
    tmTransparent: boolean,
    tmBelow: boolean,
    layer2PixelRgb333: number | null,
    layer2Transparent: boolean,
    layer2Priority: boolean,
    spritesPixelRgb333: number | null,
    spritesTransparent: boolean,
    border: boolean
  ): number {
    const ulaMixT = ulaMixTransparent || ulaPixelRgb333 == null;
    const ulaMixRgb = ulaMixT ? 0 : ulaPixelRgb333! & 0x1ff;
    const ulaEn = !this.ulaDisableOutput;
    const ulaT = ulaMixT || !ulaEn;
    const ulaRgb = ulaT ? 0 : ulaMixRgb;
    const ulaBorder = !ulaT && border;

    const tmT = tmTransparent || tmPixelRgb333 == null;
    const tmRgb = tmT ? 0 : tmPixelRgb333! & 0x1ff;

    let finalT: boolean;
    let finalRgb: number;
    if (this.ulaEnableStencilMode && ulaEn && this.tilemapEnabled) {
      finalT = ulaT || tmT;
      finalRgb = finalT ? 0 : ulaRgb & tmRgb;
    } else {
      finalT = ulaT && tmT;
      finalRgb = !tmT && (!tmBelow || ulaT) ? tmRgb : ulaRgb;
    }

    const sprT = spritesTransparent || spritesPixelRgb333 == null;
    const sprRgb = sprT ? 0 : spritesPixelRgb333! & 0x1ff;
    const l2T = layer2Transparent || layer2PixelRgb333 == null;
    const l2Rgb = l2T ? 0 : layer2PixelRgb333! & 0x1ff;
    const l2Prio = !l2T && layer2Priority;

    let out = -1;
    const ulaWins = !finalT && !(ulaBorder && tmT && !sprT);
    switch (this.layerPriority) {
      case 0: // SLU
        if (l2Prio) out = l2Rgb;
        else if (!sprT) out = sprRgb;
        else if (!l2T) out = l2Rgb;
        else if (!finalT) out = finalRgb;
        break;
      case 1: // LSU
        if (!l2T) out = l2Rgb;
        else if (!sprT) out = sprRgb;
        else if (!finalT) out = finalRgb;
        break;
      case 2: // SUL
        if (l2Prio) out = l2Rgb;
        else if (!sprT) out = sprRgb;
        else if (!finalT) out = finalRgb;
        else if (!l2T) out = l2Rgb;
        break;
      case 3: // LUS
        if (!l2T) out = l2Rgb;
        else if (ulaWins) out = finalRgb;
        else if (!sprT) out = sprRgb;
        break;
      case 4: // USL
        if (l2Prio) out = l2Rgb;
        else if (ulaWins) out = finalRgb;
        else if (!sprT) out = sprRgb;
        else if (!l2T) out = l2Rgb;
        break;
      case 5: // ULS
        if (l2Prio) out = l2Rgb;
        else if (ulaWins) out = finalRgb;
        else if (!l2T) out = l2Rgb;
        else if (!sprT) out = sprRgb;
        break;
      default: {
        // --- 110 / 111: blend. mix_* by $68 bits 6-5.
        let mixRgb: number, mixT: boolean, topT: boolean, topRgb: number, botT: boolean, botRgb: number;
        switch (this.ulaBlendingInSLUModes & 0x03) {
          case 0:
            mixRgb = ulaMixRgb; mixT = ulaMixT;
            topT = tmT || tmBelow; topRgb = tmRgb;
            botT = tmT || !tmBelow; botRgb = tmRgb;
            break;
          case 2:
            mixRgb = finalRgb; mixT = finalT;
            topT = true; topRgb = tmRgb; botT = true; botRgb = tmRgb;
            break;
          case 3:
            mixRgb = tmRgb; mixT = tmT;
            topT = ulaT || !tmBelow; topRgb = ulaRgb;
            botT = ulaT || tmBelow; botRgb = ulaRgb;
            break;
          default:
            mixRgb = 0; mixT = true;
            if (tmBelow) { topT = ulaT; topRgb = ulaRgb; botT = tmT; botRgb = tmRgb; }
            else { topT = tmT; topRgb = tmRgb; botT = ulaT; botRgb = ulaRgb; }
            break;
        }
        let r = ((l2Rgb >> 6) & 7) + ((mixRgb >> 6) & 7);
        let g = ((l2Rgb >> 3) & 7) + ((mixRgb >> 3) & 7);
        let b = (l2Rgb & 7) + (mixRgb & 7);
        if (this.layerPriority === 6) {
          r = Math.min(r, 7); g = Math.min(g, 7); b = Math.min(b, 7);
        } else if (!mixT) {
          r = r <= 4 ? 0 : r >= 12 ? 7 : r - 5;
          g = g <= 4 ? 0 : g >= 12 ? 7 : g - 5;
          b = b <= 4 ? 0 : b >= 12 ? 7 : b - 5;
        }
        const mixed = ((r & 7) << 6) | ((g & 7) << 3) | (b & 7);
        if (l2Prio) out = mixed;
        else if (!topT) out = topRgb;
        else if (!sprT) out = sprRgb;
        else if (!botT) out = botRgb;
        else if (!l2T) out = mixed;
        break;
      }
    }
    // --- No opaque layer: the fallback colour (NextReg $4A), expanded once in its cache
    return zxNextBgra[(out < 0 ? this.fallbackRgb333Cache : out) & 0x1ff];
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
  private ulaHiResModeSampled: boolean;
  // The Timex screen mode (port $FF bits 2-0) in effect, sampled with the scroll
  private ulaScreenModeSampled: number;
  private ulaHalfPixelScrollSampled: boolean;

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
      // --- zxula.vhd ~196-208: (vc + scroll) mod 192, also for scroll values of 192-255
      this.ulaScrollYSampled = (vc - this.confDisplayYStart + this.ulaScrollYSampled) % 0xc0;
    }

    // --- Shift Register Load ---
    if ((cell & SCR_SHIFT_REG_LOAD) !== 0) {
      // Load pixel and attribute data into shift register
      // This prepares the next 8 pixels for output
      // --- Both bytes are kept (zxula.vhd shift_reg_ld): bit 15 - j is pixel j of this group, and
      // --- bit 7 the first pixel of the next one, which the half-pixel scroll shows early
      this.ulaShiftReg =
        (((this.ulaPixelByte1 << 8) | this.ulaPixelByte2) << (this.ulaScrollXSampled & 0x07)) & 0xffff;
      this.ulaShiftAttr = this.ulaAttrByte1; // Load attribute byte 1
      this.ulaShiftAttr2 = this.ulaAttrByte2; // Load attribute byte 2
      this.ulaShiftAttrCount = 8 - (this.ulaScrollXSampled & 0x07); // Reset attribute shift counter
    }

    // --- Memory Read Activities ---
    if ((cell & SCR_BYTE1_READ) !== 0) {
      // --- Calculate pixel address using pre-computed Y-dependent base + X component
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      // --- zxula.vhd ~232: screen mode bit 0 selects the second display file at $6000
      const pixelAddr = ((this.ulaScreenModeSampled & 0x01) << 13) | ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;
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
      const attrAddr = this.ulaAttributeAddress(shiftCols);

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
      // --- ULANext format $FF: the border selects the fallback colour (zxula.vhd ula_select_bgnd), which
      // --- replaces the palette colour *before* the $14 compare (zxnext.vhd ~6933, ~7046)
      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 =
        this.ulaNextEnabled && this.ulaNextFormat === 0xff
          ? this.machine.composedScreenDevice.fallbackRgb333Cache
          : this.borderRgbCache;
      // --- The border is a ULA pixel: it is transparent when it matches $14 (zxnext.vhd ula_rgb_2).
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = this.ulaPixel1Rgb333 >> 1 === this.globalTransparencyColor;
      return;
    }

    // // --- Pixel Generation ---
    // Generate pixel from shift register (happens every HC position)
    // Extract current pixel bit from shift register
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;
    const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
    const pixelBit = (this.ulaShiftReg >> (15 - pixelWithinByte)) & 0x01;
    const pixelRgb333 = this.ulaStandardPixelRgb333(pixelBit, this.ulaShiftAttr);

    // --- Half-pixel scroll ($68 bit 2): zxula.vhd ~397 loads the shift register one more 14 MHz
    // --- half pixel to the left, so the second half of this pixel is the first half of the next one
    let nextRgb333 = pixelRgb333;
    if (this.ulaHalfPixelScrollSampled) {
      const nextBit = (this.ulaShiftReg >> (14 - pixelWithinByte)) & 0x01;
      const nextAttr = this.ulaShiftAttrCount > 1 ? this.ulaShiftAttr : this.ulaShiftAttr2;
      nextRgb333 = this.ulaStandardPixelRgb333(nextBit, nextAttr);
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
    const transparent = pixelRgb333 >> 1 === this.globalTransparencyColor || clipped;
    if (this.ulaHalfPixelScrollSampled) {
      this.ulaPixel1Rgb333 = pixelRgb333;
      this.ulaPixel1Transparent = transparent;
      this.ulaPixel2Rgb333 = nextRgb333;
      this.ulaPixel2Transparent = nextRgb333 >> 1 === this.globalTransparencyColor || clipped;
    } else {
      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = pixelRgb333;
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = transparent;
    }
  }

  /**
   * The address of the attribute byte (zxula.vhd ~236-250): with screen mode bit 1 (HiColor) the byte at
   * $6000 + the pixel offset (8x1 attributes), otherwise the 32x24 attributes at $5800, or at $7800 with
   * mode bit 0. HiRes fetches its second pixel byte through the same address.
   */
  private ulaAttributeAddress(shiftCols: number): number {
    const mode = this.ulaScreenModeSampled;
    return (mode & 0x02) !== 0
      ? 0x2000 | ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols
      : ((mode & 0x01) << 13) | ulaAttrLineBaseAddr[this.ulaScrollYSampled] | shiftCols;
  }

  /**
   * The Timex HiRes attribute (zxula.vhd ~431 border_clr_tmx): "01" & not n & n, n = port $FF bits 5-3.
   * It is attr_reg in the paper and in the border, and goes through the ULANext / ULA+ / standard decode.
   */
  private get ulaHiResAttr(): number {
    const n = this.ulaHiResColor;
    return 0x40 | ((~n & 0x07) << 3) | n;
  }

  /** A HiRes pixel: the Timex attribute decoded like any other; ULA+ forces index bit 3 (screen_mode(2)). */
  private ulaHiResPixelRgb333(pixelBit: number): number {
    if (!this.ulaNextEnabled && this.ulaPlusEnabled) {
      const n = this.ulaHiResColor;
      return this.paletteDevice.getUlaRgb333(0xd8 | (pixelBit ? n : 7 - n));
    }
    return this.ulaStandardPixelRgb333(pixelBit, this.ulaHiResAttr);
  }

  /**
   * The HiRes border (zxula.vhd ~491-553 with attr_reg = the Timex attribute and pixel_en = 0): ULANext
   * $80 + attr(5:3) (the fallback for format $FF), ULA+ $C0 + group 1 + 8 + attr(5:3), standard BRIGHT
   * paper - all three 7 - n.
   */
  private ulaHiResBorderRgb333(): number {
    const paper = 7 - this.ulaHiResColor;
    if (this.ulaNextEnabled) {
      return this.ulaNextFormat === 0xff
        ? this.machine.composedScreenDevice.fallbackRgb333Cache
        : this.paletteDevice.getUlaRgb333(0x80 + paper);
    }
    return this.paletteDevice.getUlaRgb333((this.ulaPlusEnabled ? 0xd8 : 24) + paper);
  }

  /** The colour of a standard-mode ULA pixel (ink or paper of `attr`) in ULANext, ULA+ or standard mode. */
  private ulaStandardPixelRgb333(pixelBit: number, attr: number): number {
    if (this.ulaNextEnabled) {
      // --- ULANext: ink 0-127; paper 128-255, or 255 for "use the fallback colour"
      if (pixelBit) {
        return this.paletteDevice.getUlaRgb333(getULANextInkIndex(this.ulaNextFormat, attr));
      }
      const paperIndex = getULANextPaperIndex(this.ulaNextFormat, attr);
      return paperIndex === 255
        ? this.machine.composedScreenDevice.fallbackRgb333Cache
        : this.paletteDevice.getUlaRgb333(paperIndex);
    }
    if (this.ulaPlusEnabled) {
      // --- ULA+: 64 colours at ULA palette indices 192-255
      return this.paletteDevice.getUlaRgb333(pixelBit ? this.ulaPlusAttrToInk[attr] : this.ulaPlusAttrToPaper[attr]);
    }
    // --- Standard: BRIGHT already applied by the lookup tables
    return this.paletteDevice.getUlaRgb333(pixelBit ? this.ulaActiveAttrToInk[attr] : this.ulaActiveAttrToPaper[attr]);
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
   * **Colours**: the Timex attribute ("01" & not n & n) goes through the ULANext / ULA+ / standard decode
   * (`ulaHiResPixelRgb333`, `ulaHiResBorderRgb333`); with ULA+, screen_mode(2) forces index bit 3.
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
      // --- zxula.vhd ~196-208: (vc + scroll) mod 192, also for scroll values of 192-255
      this.ulaScrollYSampled = (vc - this.confDisplayYStart + this.ulaScrollYSampled) % 0xc0;
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
          ((this.ulaScrollXSampled & 0x07) * 2 + (this.ulaHalfPixelScrollSampled ? 1 : 0))) >>
          16) &
        0xffff;
    }

    // --- Read pixel data from Bank 0
    if ((cell & SCR_BYTE1_READ) !== 0) {
      // Calculate pixel address (same Y-dependent address as Standard mode)
      const baseCol = (hc + 0x0c - this.confDisplayXStart) >> 3;
      const shiftCols = (baseCol + (this.ulaScrollXSampled >> 3)) & 0x1f;
      const pixelAddr = ((this.ulaScreenModeSampled & 0x01) << 13) | ulaPixelLineBaseAddr[this.ulaScrollYSampled] | shiftCols;

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
      // --- mode 6: $6000 + pixel offset; modes 4, 5, 7 fetch whatever the attribute address gives
      const pixelAddr = this.ulaAttributeAddress(shiftCols);

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
      const borderRgb333 = this.ulaHiResBorderRgb333();
      this.ulaPixel1Rgb333 = this.ulaPixel2Rgb333 = borderRgb333;
      // --- The border is a ULA pixel: it is transparent when it matches $14 (zxnext.vhd ula_rgb_2).
      this.ulaPixel1Transparent = this.ulaPixel2Transparent = this.ulaPixel1Rgb333 >> 1 === this.globalTransparencyColor;
      return;
    }

    // --- Pixel Generation ---
    // Generate pixel from shift register (happens every HC position)
    const displayHC = hc - this.confDisplayXStart;
    const displayVC = vc - this.confDisplayYStart;
    const pixelWithinByte = displayHC & 0x07; // Pixel position within byte (0-7)
    const pixelBit1 = (this.ulaShiftReg >> (2 * (7 - pixelWithinByte) + 1)) & 0x01;
    const pixelBit2 = (this.ulaShiftReg >> (2 * (7 - pixelWithinByte))) & 0x01;

    const pixel1Rgb333 = this.ulaHiResPixelRgb333(pixelBit1);
    const pixel2Rgb333 = this.ulaHiResPixelRgb333(pixelBit2);

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

  // Samples Next registers for ULA mode
  private sampleNextRegistersForUlaMode(): void {
    // --- Scroll
    this.ulaScrollXSampled = this.ulaScrollX;
    this.ulaScrollYSampled = this.ulaScrollY;

    // --- zxula.vhd ~191: the screen mode is port $FF bits 2-0, forced to 0 while the 128K shadow
    // --- screen (bank 7, which has no second display file) is displayed
    const mode = this.machine.memoryDevice.useShadowScreen ? 0 : this.timexPortBits & 0x07;
    this.ulaScreenModeSampled = mode;
    this.ulaHiResModeSampled = (mode & 0x04) !== 0;

    // --- Half-pixel scroll
    this.ulaHalfPixelScrollSampled = this.ulaHalfPixelScroll;
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
      // Pre-display position always fetches unconditionally to avoid stale data
      const isPreDisplay = (cell & SCR_DISPLAY_AREA) === 0;
      const shouldFetch = isPreDisplay
        || (!this.loResRadastanModeSampled ? (x & 0x01) === 0 : (x & 0x03) === 0);

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
          // FPGA: lores_dfile_0 <= port_ff_screen_mode(0) xor nr_6a_lores_radastan_xor
          const dfile = ((this.timexPortBits & 0x01) !== 0) !== this.loResRadastanTimexXor;
          blockAddr = (dfile ? 0x2000 : 0) | ((y >> 1) << 6) | (x >> 2);
        }

        // Read from Bank 5 memory (LoRes always uses bank 5, never shadow screen bank 7)
        // FPGA: lores has dedicated port on bank-5 SRAM arbitrator
        this.loResBlockByte = this.machine.memoryDevice.memory[OFFS_BANK_05 + (blockAddr & 0x3fff)];
      }
    }

    // === STAGE 3: Border Area ===
    // --- LoRes has no border pixel (lores.vhd: valid only inside the clip window): the ULA's stays
    if ((cell & SCR_DISPLAY_AREA) === 0) {
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
      if (this.ulaPlusEnabled && !this.ulaNextEnabled) {
        // ULA+ mode: use group 3 (bits 7:6 = 11) with palette offset in bits 5:4
        // FPGA: pixel_rad_nib_H <= ("11" & lores_palette_offset_i(1 downto 0))
        paletteIndex = 0xc0 | ((this.loResPaletteOffset & 0x03) << 4) | nibble;
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
    if (pixelValue < 0) {
      // --- past the 2 MB SRAM: no pixel (layer2.vhd layer2_addr_eff(21))
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Apply palette offset before transparency check (per FPGA layer2.vhd line 207)
    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);

    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }
    const priority = (rgb333 & 0x200) !== 0;

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

    // Pre-calculate Y coordinate with FPGA wrapping formula (layer2.vhd lines 147-149):
    // When y_pre >= 192, add 1 to bits[7:6] (not simple modulo)
    this.layer2Scanline192Y = loResYWrapTable![displayVC + this.layer2ScrollY];

    // Pre-select bank and store in member variable
    // --- zxnext.vhd ~4203: the display always uses $12; $123B bit 3 ($13) is for paging only
    this.layer2Scanline192Bank = this.layer2ActiveRamBank;

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
   * @returns Pixel byte value (0-255), or -1 past the 2 MB SRAM
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
    // --- layer2.vhd: SRAM bank = $12 + 16 + segment; bit 21 set (bank >= 128) disables the pixel
    if (bank16K + segment16K + 16 >= 128) return -1;
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
    if (pixelValue < 0) {
      // --- past the 2 MB SRAM: no pixel (layer2.vhd layer2_addr_eff(21))
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Apply palette offset before transparency check (per FPGA layer2.vhd line 207)
    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);

    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }
    const priority = (rgb333 & 0x200) !== 0;

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
    if (pixelValue < 0) {
      // --- past the 2 MB SRAM: no pixel (layer2.vhd layer2_addr_eff(21))
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Apply palette offset before transparency check (per FPGA layer2.vhd line 207)
    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);

    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }
    const priority = (rgb333 & 0x200) !== 0;

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
    // --- zxnext.vhd ~4203: the display always uses $12; $123B bit 3 ($13) is for paging only
    this.layer2Scanline320x256Bank = this.layer2ActiveRamBank;

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
    if (pixelValue < 0) {
      // --- past the 2 MB SRAM: no pixel (layer2.vhd layer2_addr_eff(21))
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Apply palette offset before transparency check (per FPGA layer2.vhd line 207)
    const upperNibble = ((pixelValue >> 4) + (this.layer2PaletteOffset & 0x0f)) & 0x0f;
    const paletteIndex = (upperNibble << 4) | (pixelValue & 0x0f);

    const rgb333 = this.paletteDevice.getLayer2Rgb333(paletteIndex);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }
    const priority = (rgb333 & 0x200) !== 0;

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
    // --- zxnext.vhd ~4203: the display always uses $12; $123B bit 3 ($13) is for paging only
    this.layer2Scanline640x256Bank = this.layer2ActiveRamBank;

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
    if (pixelByte < 0) {
      // --- past the 2 MB SRAM: no pixel (layer2.vhd layer2_addr_eff(21))
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Extract two 4-bit pixels from the byte (per VHDL line 206)
    // Upper nibble [7:4] = pixel1 (left pixel, output first)
    // Lower nibble [3:0] = pixel2 (right pixel, output second)
    const pixel1_4bit = (pixelByte >> 4) & 0x0f;
    const pixel2_4bit = pixelByte & 0x0f;

    // Process pixel 1 (left pixel)
    // In 640x256 mode, palette index = (palette_offset << 4) | pixel_4bit
    const paletteIndex1 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel1_4bit;

    const rgb333_1 = this.paletteDevice.getLayer2Rgb333(paletteIndex1);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333_1 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = 0;
      this.layer2Pixel1Transparent = true;
      this.layer2Pixel1Priority = false;
    } else {
      const priority1 = (rgb333_1 & 0x200) !== 0;

      this.layer2Pixel1Rgb333 = rgb333_1 & 0x1ff;
      this.layer2Pixel1Transparent = false;
      this.layer2Pixel1Priority = priority1;
    }

    // Process pixel 2 (right pixel)
    const paletteIndex2 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel2_4bit;

    const rgb333_2 = this.paletteDevice.getLayer2Rgb333(paletteIndex2);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333_2 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel2Transparent = true;
      this.layer2Pixel2Priority = false;
    } else {
      const priority2 = (rgb333_2 & 0x200) !== 0;

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
    if (pixelByte < 0) {
      // --- past the 2 MB SRAM: no pixel (layer2.vhd layer2_addr_eff(21))
      this.layer2Pixel1Rgb333 = this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel1Transparent = this.layer2Pixel2Transparent = true;
      return;
    }

    // Extract two 4-bit pixels from the byte (per VHDL line 206)
    // Upper nibble [7:4] = pixel1 (left pixel, output first)
    // Lower nibble [3:0] = pixel2 (right pixel, output second)
    const pixel1_4bit = (pixelByte >> 4) & 0x0f;
    const pixel2_4bit = pixelByte & 0x0f;

    // Process pixel 1 (left pixel)
    const paletteIndex1 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel1_4bit;

    const rgb333_1 = this.paletteDevice.getLayer2Rgb333(paletteIndex1);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333_1 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel1Rgb333 = 0;
      this.layer2Pixel1Transparent = true;
      this.layer2Pixel1Priority = false;
    } else {
      const priority1 = (rgb333_1 & 0x200) !== 0;

      this.layer2Pixel1Rgb333 = rgb333_1 & 0x1ff;
      this.layer2Pixel1Transparent = false;
      this.layer2Pixel1Priority = priority1;
    }

    // Process pixel 2 (right pixel)
    const paletteIndex2 = ((this.layer2PaletteOffset & 0x0f) << 4) | pixel2_4bit;

    const rgb333_2 = this.paletteDevice.getLayer2Rgb333(paletteIndex2);
    // --- Transparency tests the palette-mapped RGB, not the index (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) = transparent_rgb_2`).
    if ((rgb333_2 & 0x1fe) >> 1 === this.globalTransparencyColor) {
      this.layer2Pixel2Rgb333 = 0;
      this.layer2Pixel2Transparent = true;
      this.layer2Pixel2Priority = false;
    } else {
      const priority2 = (rgb333_2 & 0x200) !== 0;

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

  // --- Per-pixel tilemap-below-ULA flags (D1 fix: per-tile priority compositing)
  tilemapPixel1BelowUla: boolean;
  tilemapPixel2BelowUla: boolean;

  // --- The tilemap's first line: 32 lines above the paper
  private tilemapWideDisplayYStart: number;

  /**
   * The tilemap pixel pair of HC `hc` on line `vc`, straight from tilemap.vhd:
   * - 320 x 256 coordinates from 32 pixels left of / above the paper; 40 columns give one pixel per HC,
   *   80 columns two (640 across).
   * - Tilemap x = (x + scroll X) mod 320 / 640 (tm_x_sum / tm_x_correction, for scroll values below the
   *   width), y = (y + scroll Y) mod 256. Map entry row * 40 (80) + column: tile byte and attribute, or
   *   the tile byte and $6C with $6B bit 5. 512-tile mode takes tile bit 8 from attribute bit 0.
   * - Standard tiles: X mirror XOR rotate inverts x, Y mirror inverts y, rotate swaps them; byte
   *   tile * 32 + y * 4 + x / 2, high nibble for even x; index attr(7:4) & nibble; transparent when the
   *   nibble equals $4C. Text mode: bit 7 - x of byte tile * 8 + y, no transform; index attr(7:1) & bit;
   *   transparent when its RGB equals $14 (zxnext.vhd ~7055).
   * - Below the ULA when (attribute bit 0 or 512-tile mode) and not $6B bit 0.
   * - Clip: x1 * 2 .. x2 * 2 + 1, y1 .. y2 in 320 x 256 coordinates.
   * The hardware samples the configuration once per character; this takes the registers per pixel.
   */
  private renderTilemapPixel(vc: number, hc: number): void {
    const wx = hc - this.confDisplayXStart + 32;
    const wy = vc - this.tilemapWideDisplayYStart;
    if (
      wx < 0 ||
      wx >= 320 ||
      wy < 0 ||
      wy >= 256 ||
      wx < this.tilemapClipWindowX1 << 1 ||
      wx > ((this.tilemapClipWindowX2 << 1) | 1) ||
      wy < this.tilemapClipWindowY1 ||
      wy > this.tilemapClipWindowY2
    ) {
      this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
      this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
      return;
    }
    if (this.tilemap80x32Resolution) {
      this.tilemapPixelAt(wx << 1, wy, 640);
      this.tilemapPixel1Rgb333 = this.tilemapOutRgb333;
      this.tilemapPixel1Transparent = this.tilemapOutTransparent;
      this.tilemapPixel1BelowUla = this.tilemapOutBelow;
      this.tilemapPixelAt((wx << 1) | 1, wy, 640);
      this.tilemapPixel2Rgb333 = this.tilemapOutRgb333;
      this.tilemapPixel2Transparent = this.tilemapOutTransparent;
      this.tilemapPixel2BelowUla = this.tilemapOutBelow;
    } else {
      this.tilemapPixelAt(wx, wy, 320);
      this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = this.tilemapOutRgb333;
      this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = this.tilemapOutTransparent;
      this.tilemapPixel1BelowUla = this.tilemapPixel2BelowUla = this.tilemapOutBelow;
    }
  }

  // --- The output of tilemapPixelAt
  private tilemapOutRgb333 = 0;
  private tilemapOutTransparent = true;
  private tilemapOutBelow = false;

  /** One tilemap pixel at tilemap-space x (0 .. width - 1) and y: see renderTilemapPixel. */
  private tilemapPixelAt(x: number, y: number, width: number): void {
    const ax = (x + this.tilemapScrollXField) % width;
    const ay = (y + this.tilemapScrollYField) & 0xff;
    const entry = (ay >> 3) * (width === 640 ? 80 : 40) + (ax >> 3);
    let tile: number;
    let attr: number;
    if (this.tilemapEliminateAttributes) {
      tile = this.getTilemapVRAM(this.tilemapUseBank7, this.tilemapBank5Msb, entry);
      attr = this.tilemapDefaultAttrCache;
    } else {
      tile = this.getTilemapVRAM(this.tilemapUseBank7, this.tilemapBank5Msb, entry << 1);
      attr = this.getTilemapVRAM(this.tilemapUseBank7, this.tilemapBank5Msb, (entry << 1) | 1);
    }
    if (this.tilemap512TileMode && (attr & 0x01) !== 0) tile |= 0x100;
    const px = ax & 0x07;
    const py = ay & 0x07;
    let index: number;
    let transparent: boolean;
    if (this.tilemapTextMode) {
      const bits = this.getTilemapVRAM(this.tilemapTileDefUseBank7, this.tilemapTileDefBank5Msb, (tile << 3) | py);
      index = (attr & 0xfe) | ((bits >> (7 - px)) & 0x01);
      transparent = (this.paletteDevice.getTilemapPaletteEntry(index) & 0x1fe) >> 1 === this.globalTransparencyColor;
    } else {
      const ex = ((attr >> 3) ^ (attr >> 1)) & 0x01 ? 7 - px : px;
      const ey = attr & 0x04 ? 7 - py : py;
      const tx = attr & 0x02 ? ey : ex;
      const ty = attr & 0x02 ? ex : ey;
      const byte = this.getTilemapVRAM(this.tilemapTileDefUseBank7, this.tilemapTileDefBank5Msb, (tile << 5) | (ty << 2) | (tx >> 1));
      const nibble = tx & 0x01 ? byte & 0x0f : byte >> 4;
      index = (attr & 0xf0) | nibble;
      transparent = nibble === (this.tilemapTransparencyIndex & 0x0f);
    }
    this.tilemapOutRgb333 = this.paletteDevice.getTilemapRgb333(index);
    this.tilemapOutTransparent = transparent;
    this.tilemapOutBelow = ((attr & 0x01) !== 0 || this.tilemap512TileMode) && !this.tilemapForceOnTopOfUla;
  }

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
    // D2 fix: MAME uses 5-bit mask for bank 7, 6-bit mask for bank 5
    const offsetMask = useBank7 ? 0x1f : 0x3f;
    const highByte = ((offset & offsetMask) + ((address >> 8) & 0x3f)) & 0x3f;
    const fullAddress = (highByte << 8) | (address & 0xff);

    // Bank selection: Bank 5 or Bank 7 (these are 16K RAM banks in ZX Next)
    // OFFS_BANK_05 = 0x054000, OFFS_BANK_07 = 0x05c000
    const bankBase = useBank7 ? OFFS_BANK_07 : OFFS_BANK_05;
    const physicalAddress = bankBase + fullAddress;

    // Priority 1D: Access cached memory array (eliminates property chain traversal)
    return this.memoryArrayCache[physicalAddress] || 0;
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
  // --- The 28 MHz clock of the line build (from the line reset) and the X wrap mask of the last
  // --- qualified sprite (sprites.vhd spr_cur_x_wrap)
  private spritesClock = 0;
  private spritesLastXWrapMask = 0x1c;
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
    const sd = this.spriteDevice;
    const OVER_BORDER = 32;
    if (sd.spritesOverBorderEnabled) {
      if (!sd.spriteClippingEnabled) {
        // Mode 1: over-border, no clip → full 320×256 display area
        this.spritesClipXMin = 0;
        this.spritesClipXMax = 319;
        this.spritesClipYMin = 0;
        this.spritesClipYMax = 255;
      } else {
        // Mode 3: over-border with clip → clip regs are direct (X regs in 2-pixel units,
        // matching MAME: clip_x1<<1 → sprite-pixel = clip_x1*2)
        this.spritesClipXMin = sd.clipWindowX1 << 1;
        this.spritesClipXMax = (sd.clipWindowX2 << 1) | 1;
        this.spritesClipYMin = sd.clipWindowY1;
        this.spritesClipYMax = sd.clipWindowY2;
      }
    } else {
      // Mode 2: not over-border → clip regs are ULA-relative; add OVER_BORDER offset. sprites.vhd also
      // requires vcounter < 224 (the bottom of the paper) without over-border.
      this.spritesClipXMin = sd.clipWindowX1 + OVER_BORDER;
      this.spritesClipXMax = sd.clipWindowX2 + OVER_BORDER;
      this.spritesClipYMin = sd.clipWindowY1 + OVER_BORDER;
      this.spritesClipYMax = Math.min(sd.clipWindowY2 + OVER_BORDER, 223);
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

        /*
         * No clip-window test here. The FPGA writes every sprite into its line buffer and clips only
         * on output (`sprites.vhd`, the `x_s_v`/`y_s_v` window applied to the buffer's contents), so
         * sprites outside the window still collide. Clipping is applied per pixel in the display step.
         */

        // Check if we've processed all sprites (128)
        if (this.spritesIndex >= 128) {
          // All sprites have been checked; switch to IDLE
          this.spritesRenderingDone = true;
          return;
        }

        // Fetch the sprite attributes for the current sprite
        const spriteAttrs = this.spriteDevice.resolvedAttributes[this.spritesIndex];
        
        // Safety check: ensure sprite attributes exist
        if (!spriteAttrs) {
          // Invalid sprite index, stop processing
          this.spritesRenderingDone = true;
          return;
        }

        // Check if sprite is globally enabled (attr3 bit 7)
        if (!spriteAttrs.visible) {
          // Sprite is not visible; skip to next sprite
          this.spritesIndex++;
          return;
        }

        // Check if the current scanline intersects with the sprite's vertical position
        // D4: Wrap 9-bit Y to signed range (MAME: if desty > 255 then desty -= 512)
        let spriteY = spriteAttrs.y;
        if (spriteY > 255) spriteY -= 512;
        const spriteHeight = spriteAttrs.height;
        const spriteBottom = spriteY + spriteHeight;
        
        const scanlineIntersects =
          this.spritesVc >= spriteY && 
          this.spritesVc < spriteBottom;

        if (!scanlineIntersects) {
          // Sprite does not intersect this scanline
          this.spritesIndex++;
          return;
        }

        // Check if sprite is within horizontal clip boundaries
        // D4: Wrap 9-bit X to signed range (MAME: if destx > 319 then destx -= 512)
        let spriteX = spriteAttrs.x;
        if (spriteX > 319) spriteX -= 512;
        const spriteWidth = spriteAttrs.width;
        const spriteRight = spriteX + spriteWidth;
        
        // --- Only the 320-pixel line buffer bounds count (FPGA `spr_cur_hcount_valid`), not the clip.
        const horizontallyVisible = spriteX <= 319 && spriteRight > 0;

        if (!horizontallyVisible) {
          // Sprite is entirely outside the line buffer
          this.spritesIndex++;
          return;
        }

        // --- sprites.vhd spr_cur_notime: a drawable sprite is not started while the wide counter is in
        // --- 288-319 with its low bits under the mask of the previously qualified sprite's X wrap
        // --- (spr_cur_x_wrap(2:0) & "00", a register) - there would be no time to draw it. The line is
        // --- abandoned and $303B bit 1 set (status_reg_s(1) <= ... or sprites_overtime).
        const whc = (511 + ((this.spritesClock + 2) >> 2)) & 0x1ff;
        const mask = this.spritesLastXWrapMask;
        this.spritesLastXWrapMask = [0x1c, 0x18, 0x10, 0x00][spriteAttrs.scaleX & 3];
        if (whc >= 288 && whc < 320 && (whc & 0x20) !== 0 && (whc & 0x1f & mask) === mask) {
          this.spritesOvertime = true;
          this.spriteDevice.tooManySpritesPerLine = true;
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
        const yOffset = this.spritesVc - spriteY;  // use wrapped Y (D4)
        this.spritesPatternYIndex = yOffset >> spriteAttrs.scaleY;  // Apply Y-scale (0-15)

        // 2. Get pre-transformed pattern variant using cached variant index
        //    The variant index is precalculated when sprite attributes are written
        this.spritesPatternData = spriteAttrs.is4BitPattern
          ? this.spriteDevice.patternMemory4bit[spriteAttrs.patternVariantIndex]
          : this.spriteDevice.patternMemory8bit[spriteAttrs.patternVariantIndex];

        // 3. Initialize counters
        this.spritesCurrentPixel = 0;           // Pixel counter (0 to sprite.width-1)
        this.spritesCurrentX = spriteX;         // Line buffer write position (wrapped, D4)

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
        //    For 4-bit sprites mask transparencyIndex to 4 bits (MAME: transp_colour & 0x0f)
        const transpMask = sprite.is4BitPattern ? 0x0f : 0xff;
        const isTransparent = (pixelValue === (this.spriteDevice.transparencyIndex & transpMask));

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

        // 8. Collision detection, before zero-on-top has its say
        //    FPGA: `status_reg_s(0) <= ... or (spr_line_data_o(8) and spr_line_we)`, where
        //    `spr_line_we` is the write request itself; zero-on-top only gates the write that follows
        //    (`spr_line_we_s`). So an overlap hidden by sprite 0 on top still collides.
        if (inBounds && existingValid) {
          this.spriteDevice.collisionDetected = true;
        }

        // 9. Determine write enable
        let writeEnable = inBounds;
        
        if (this.spriteDevice.sprite0OnTop && existingValid) {
          // Zero-on-top mode: don't overwrite existing valid pixels
          writeEnable = false;
        }

        // 10. Write to line buffer
        if (writeEnable) {
          // Set bit 8 (valid flag) and bits 7:0 (palette index)
          this.spritesBuffer[bufferPos] = 0x100 | paletteIndex;
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
      // Resolve relative sprites onto their anchors (once per dirty cycle)
      this.spriteDevice.resolveRelativeSprites();
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
      /*
       * sprites.vhd builds the next line from the line reset (whc = 511, just before the wide display)
       * through the whole line: one state per 28 MHz clock. This builds it at once, counting the clocks,
       * so the time rules - spr_cur_notime above, and a line still busy at the next line reset - apply as
       * on the FPGA. (It used to get only the blanking interval, 544 clocks, and dropped sprites.)
       */
      const lineClocks = this.confTotalHC * 4;
      for (this.spritesClock = 0; !this.spritesRenderingDone && this.spritesClock < lineClocks; this.spritesClock++) {
        renderPixelClk28();
      }
      if (!this.spritesRenderingDone) {
        this.spritesOvertime = true;
        this.spriteDevice.tooManySpritesPerLine = true;
        this.spritesRenderingDone = true;
      }
    }

    if ((cell & SCR_SPRITE_INIT_DISPLAY) !== 0) {
      this.spritesBufferPosition = 0;
    }


    if ((cell & SCR_SPRITE_DISPLAY) === 0) {
      // --- sprites.vhd ~1019, ~1085: pixel_en needs `hcounter_i < 320` - outside the 320-pixel window
      // --- the layer is transparent. Keeping the last pixel smeared sprite x 319 across the right
      // --- border and into the next line's left border whenever sprites went over the border.
      this.spritesPixel1Rgb333 = this.spritesPixel2Rgb333 = 0;
      this.spritesPixel1Transparent = this.spritesPixel2Transparent = true;
    } else {
      const bufferX = this.spritesBufferPosition++;
      const bufferValue = this.spritesBuffer[bufferX];
      // --- The clip window applies here, per pixel, to what the line buffer holds — as on the FPGA.
      // --- `spritesVc` is still the line this buffer was rendered for.
      const clipped =
        bufferX < this.spritesClipXMin ||
        bufferX > this.spritesClipXMax ||
        this.spritesVc < this.spritesClipYMin ||
        this.spritesVc > this.spritesClipYMax;
      const isTransparent = clipped || !(bufferValue & 0x100) || !this.spriteDevice.spritesEnabled;
      
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
const SCR_BYTE2_READ = 0b00010000; // bit 4
const SCR_SHIFT_REG_LOAD = 0b00100000; // bit 5
const SCR_FLOATING_BUS_UPDATE = 0b01000000; // bit 6
const SCR_BORDER_AREA = 0b10000000; // bit 7
const SCR_SPRITE_DISPLAY = 0b00000001; // bit 0, the sprite buffer is displayed
const SCR_SPRITE_INIT_DISPLAY = 0b00000010; // bit 1, the sprite display is initialized
const SCR_SPRITE_RENDER = 0b00000100; // bit 2, the sprite buffer is rendered
const SCR_SPRITE_INIT_RENDER = 0b00001000; // bit 3, the sprite buffer is initialized

// Full scanline including blanking of the +3 raster (HC 0-455); the tables use config.totalHC

/**
 * Every table the renderer indexes by frame tact, for one timing configuration. Tables are indexed
 * `vc * config.totalHC + hc`, i.e. by the frame tact itself; built on first use and cached (the
 * 48K/128K/+3/Pentagon rasters differ in line and frame length).
 */
type TimingTables = {
  ula: Uint8Array;
  layer2_256x192: Uint8Array;
  layer2Wide: Uint8Array;
  sprites: Uint16Array;
  loRes: Uint16Array;
  tactToHC: Uint16Array;
  tactToVC: Uint16Array;
  tactToBitmapOffset: Int32Array;
};

const timingTablesCache = new Map<TimingConfig, TimingTables>();

function getTimingTables(config: TimingConfig): TimingTables {
  let tables = timingTablesCache.get(config);
  if (!tables) {
    const [tactToHC, tactToVC] = generateTactLookupTables(config);
    tables = {
      ula: generateULAStandardRenderingFlags(config),
      layer2_256x192: generateLayer2_256x192x8RenderingFlags(config),
      // --- Layer 2 320x256 and 640x256 share the same rendering flags
      layer2Wide: generateLayer2_WideRenderingFlags(config),
      sprites: generateSpritesRenderingFlags(config),
      loRes: generateLoResRenderingFlags(config),
      tactToHC,
      tactToVC,
      tactToBitmapOffset: generateBitmapOffsetTable(config)
    };
    timingTablesCache.set(config, tables);
  }
  return tables;
}

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
  // --- The +3 rasters are the ones in use after reset; build them up front
  getTimingTables(Plus3_50Hz);
  getTimingTables(Plus3_60Hz);
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
  const hcCount = config.totalHC;
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
  const hcCount = config.totalHC;
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
  const hcCount = config.totalHC;
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
  const hcCount = config.totalHC;
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
    } else {
      /*
       * The sprite buffer is being rendered for the next line: everywhere outside the display
       * window — the rest of this line after it, and the next line before it — which is the whole
       * horizontal blanking interval. This used to be only the 16 tacts before the window (64 CLK_28
       * cycles), so two 32-pixel-wide sprites on one line already ran out of time. The line buffer is
       * shared with display, so rendering cannot overlap the window itself.
       */
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
  const hcCount = config.totalHC;
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


// ================================================================================================
// Bitmap Offset Lookup Tables
//
// These tables map each tact (machine cycle) to the corresponding bitmap buffer offset
// for rendering. They are generated for both 50Hz and 60Hz timing modes to optimize
// pixel rendering performance by avoiding real-time calculations.
// ================================================================================================

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
    const paperPaletteIndex = paperColor + brightOffset + 0x10;

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

function setActiveTimingMode(config: TimingConfig): void {
  const tables = getTimingTables(config);
  activeRenderingFlagsULA = tables.ula;
  activeRenderingFlagsLayer2_256x192 = tables.layer2_256x192;
  activeRenderingFlagsLayer2_320x256 = tables.layer2Wide;
  activeRenderingFlagsLayer2_640x256 = tables.layer2Wide;
  activeRenderingFlagsSprites = tables.sprites;
  activeRenderingFlagsLoRes = tables.loRes;
  activeTactToHC = tables.tactToHC;
  activeTactToVC = tables.tactToVC;
  activeTactToBitmapOffset = tables.tactToBitmapOffset;
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
    if (x >= 320) {
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
