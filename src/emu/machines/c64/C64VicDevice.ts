import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IC64Machine } from "./IC64Machine";
import { ScreenConfiguration } from "@emu/abstractions/ScreenConfiguration";

/**
 * Implementation of the VIC-II (Video Interface Chip) for the Commodore 64
 * The VIC-II has 47 registers ($D000-$D02E) that control various aspects of the display
 */
export class C64VicDevice implements IGenericDevice<IC64Machine> {
  // --- The current screen configuration
  private _configuration: ScreenConfiguration;

  /**
   * Sprite X coordinates (Registers $D000, $D002, $D004, $D006, $D008, $D00A, $D00C, $D00E)
   * These registers hold the lower 8 bits of the X coordinate for each sprite (0-7).
   * The coordinate system starts from the top-left of the visible screen area.
   * Valid values: 0-255 (combined with MSB from register $D010 allows positions 0-511)
   */
  private _spriteX: Uint8Array = new Uint8Array(8);

  /**
   * Sprite Y coordinates (Registers $D001, $D003, $D005, $D007, $D009, $D00B, $D00D, $D00F)
   * These registers hold the Y coordinate for each sprite (0-7).
   * The coordinate system starts from the top-left of the visible screen area.
   * Valid values: 0-255 (but typically only 50-250 are visible on screen)
   */
  private _spriteY: Uint8Array = new Uint8Array(8);

  /**
   * Sprite X position MSBs (Register $D010)
   * This register contains the most significant bit (9th bit) of each sprite's X position.
   * Bits 0-7: MSB of X coordinate for sprites 0-7 respectively
   * When bit is set, adds 256 to the X coordinate from the corresponding _spriteX register
   */
  private _spriteXMsb: number = 0;

  /**
   * Screen control register 1 (Register $D011)
   * This register controls various screen display parameters:
   * Bit 0-2: Vertical raster scroll (0-7 pixels)
   * Bit 3: Screen height (0=24 rows, 1=25 rows)
   * Bit 4: Screen blanking (0=blank screen, 1=display enabled)
   * Bit 5: Bitmap mode (0=text mode, 1=bitmap mode)
   * Bit 6: Extended background mode (0=off, 1=on)
   * Bit 7: Most significant bit (9th bit) of raster counter
   */
  private _controlReg1: number = 0;

  /**
   * Raster counter (Register $D012)
   * This register contains the current raster line being drawn (lower 8 bits).
   * Combined with bit 7 of register $D011 for a 9-bit value (0-511).
   * Can be written to set the raster line for raster interrupts.
   * Valid values: 0-255 (full range with bit 7 of $D011: 0-311)
   */
  private _rasterLine: number = 0;

  /**
   * Light pen X position (Register $D013)
   * This read-only register contains the X position of the light pen when triggered.
   * Values are relative to the left edge of the screen.
   */
  private _lightPenX: number = 0;

  /**
   * Light pen Y position (Register $D014)
   * This read-only register contains the Y position of the light pen when triggered.
   * Values are relative to the top edge of the screen.
   */
  private _lightPenY: number = 0;

  /**
   * Sprite enable register (Register $D015)
   * Each bit controls whether the corresponding sprite is displayed.
   * Bit 0-7: Enable sprite 0-7 (1=enabled, 0=disabled)
   */
  private _spriteEnable: number = 0;

  /**
   * Screen control register 2 (Register $D016)
   * This register controls horizontal scrolling and multicolor mode:
   * Bit 0-2: Horizontal raster scroll (0-7 pixels)
   * Bit 3: Screen width (0=38 columns, 1=40 columns)
   * Bit 4: Multicolor text mode (0=off, 1=on)
   * Bit 5-7: Unused
   */
  private _controlReg2: number = 0;

  /**
   * Sprite Y-expansion register (Register $D017)
   * Each bit controls vertical expansion of the corresponding sprite.
   * Bit 0-7: Enable Y-expansion for sprite 0-7 (1=double height, 0=normal)
   */
  private _spriteYExpand: number = 0;

  /**
   * Memory pointers register (Register $D018)
   * This register determines the memory locations of screen and character data:
   * Bit 0-3: Character memory location (bits 11-14 of address)
   *          Multiplied by 2048 to get the actual address
   * Bit 4-7: Screen memory location (bits 10-13 of address)
   *          Multiplied by 1024 to get the actual address
   */
  private _memoryPointers: number = 0;

  /**
   * Interrupt register (Register $D019)
   * This register indicates which interrupt sources have been triggered.
   * Writing a '1' to any bit will clear that interrupt.
   * Bit 0: Raster compare interrupt
   * Bit 1: Sprite-background collision interrupt
   * Bit 2: Sprite-sprite collision interrupt
   * Bit 3: Light pen interrupt
   * Bit 4-6: Unused
   * Bit 7: Any interrupt (logical OR of bits 0-3)
   */
  private _interruptReg: number = 0;

  /**
   * Interrupt enable register (Register $D01A)
   * This register controls which interrupt sources are enabled.
   * Bit 0: Enable raster compare interrupt (1=enabled)
   * Bit 1: Enable sprite-background collision interrupt (1=enabled)
   * Bit 2: Enable sprite-sprite collision interrupt (1=enabled)
   * Bit 3: Enable light pen interrupt (1=enabled)
   * Bit 4-7: Unused
   */
  private _interruptEnable: number = 0;

  /**
   * Sprite to background priority register (Register $D01B)
   * Each bit controls whether the corresponding sprite appears behind or in front of background.
   * Bit 0-7: Priority for sprite 0-7 (0=sprite in front, 1=sprite behind)
   */
  private _spriteDataPriority: number = 0;

  /**
   * Sprite multicolor mode register (Register $D01C)
   * Each bit controls whether the corresponding sprite is displayed in multicolor mode.
   * Bit 0-7: Enable multicolor mode for sprite 0-7 (1=multicolor, 0=single color)
   * In multicolor mode, sprite pixels are 2 bits wide and can have 4 colors
   */
  private _spriteMulticolor: number = 0;

  /**
   * Sprite X-expansion register (Register $D01D)
   * Each bit controls horizontal expansion of the corresponding sprite.
   * Bit 0-7: Enable X-expansion for sprite 0-7 (1=double width, 0=normal)
   */
  private _spriteXExpand: number = 0;

  /**
   * Sprite-to-sprite collision register (Register $D01E)
   * This read-only register indicates which sprites have collided with each other.
   * Bit 0-7: Collision detected for sprite 0-7 (1=collision occurred)
   * Reading this register resets all collision detection flags.
   */
  private _spriteSpriteCollision: number = 0;

  /**
   * Sprite-to-background collision register (Register $D01F)
   * This read-only register indicates which sprites have collided with background.
   * Bit 0-7: Collision with background for sprite 0-7 (1=collision occurred)
   * Reading this register resets all collision detection flags.
   */
  private _spriteDataCollision: number = 0;

  /**
   * Border color register (Register $D020)
   * This register sets the color of the screen border.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   * Default value: 14 (Light Blue)
   */
  private _borderColor: number = 0;

  /**
   * Background color 0 register (Register $D021)
   * This register sets the main background color (color 0) for text and bitmap modes.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   * Default value: 6 (Blue)
   */
  private _backgroundColor0: number = 0;

  /**
   * Background color 1 register (Register $D022)
   * This register sets the background color 1 for extended background and multicolor modes.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   */
  private _backgroundColor1: number = 0;

  /**
   * Background color 2 register (Register $D023)
   * This register sets the background color 2 for extended background and multicolor modes.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   */
  private _backgroundColor2: number = 0;

  /**
   * Background color 3 register (Register $D024)
   * This register sets the background color 3 for extended background and multicolor modes.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   */
  private _backgroundColor3: number = 0;

  /**
   * Sprite multicolor 0 register (Register $D025)
   * This register sets the first shared multicolor for all sprites in multicolor mode.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   * This color is used for bit pattern '01' in multicolor sprites.
   */
  private _spriteMulticolor0: number = 0;

  /**
   * Sprite multicolor 1 register (Register $D026)
   * This register sets the second shared multicolor for all sprites in multicolor mode.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   * This color is used for bit pattern '11' in multicolor sprites.
   */
  private _spriteMulticolor1: number = 0;

  /**
   * Sprite individual color registers (Registers $D027-$D02E)
   * These registers set the individual colors for each sprite.
   * Only the lower 4 bits are used (0-15), corresponding to the 16-color C64 palette.
   * In single-color mode: This is the sprite's color
   * In multicolor mode: This is used for bit pattern '10' (bit pattern '01' uses spriteMulticolor0,
   * '11' uses spriteMulticolor1, and '00' is transparent)
   */
  private _spriteColors: Uint8Array = new Uint8Array(8);

  /**
   * Define the screen configuration attributes of C64 (PAL)
   */
  static readonly C64PalScreenConfiguration: ScreenConfiguration = {
    verticalSyncLines: 10,
    nonVisibleBorderTopLines: 11,
    borderTopLines: 40,
    borderBottomLines: 40,
    nonVisibleBorderBottomLines: 11,
    displayLines: 200,
    borderLeftTime: 4,
    borderRightTime: 4,
    displayLineTime: 40,
    horizontalBlankingTime: 11,
    nonVisibleBorderRightTime: 4,
    pixelDataPrefetchTime: 0,
    attributeDataPrefetchTime: 0,
    contentionValues: []
  };

  /**
   * Define the screen configuration attributes of C64 (PAL)
   */
  static readonly C64NtscScreenConfiguration: ScreenConfiguration = {
    verticalSyncLines: 8,
    nonVisibleBorderTopLines: 3,
    borderTopLines: 24,
    borderBottomLines: 24,
    nonVisibleBorderBottomLines: 3,
    displayLines: 200,
    borderLeftTime: 4,
    borderRightTime: 4,
    displayLineTime: 40,
    horizontalBlankingTime: 13,
    nonVisibleBorderRightTime: 4,
    pixelDataPrefetchTime: 0,
    attributeDataPrefetchTime: 0,
    contentionValues: []
  };

  private _pixelBuffer = new Uint32Array(504 * 312); // Buffer for pixel data (width * height)

  constructor(
    public readonly machine: IC64Machine,
    configuration: ScreenConfiguration
  ) {
    this._configuration = configuration;
    this.reset();
  }

  /**
   * Get the number of raster lines (height of the screen including non-visible lines).
   */
  rasterLines: number;

  /**
   * Get the width of the rendered screen.
   */
  screenWidth: number;

  /**
   * Get the number of visible screen lines.
   */
  screenLines: number;

  /**
   * The number of tacts in a single display line.
   */
  tactsInDisplayLine: number;

  getPixelBuffer(): Uint32Array {
    return this._pixelBuffer;
  }

  /**
   * The VIC-II chip is responsible for video output in the C64.
   * This method initializes the VIC-II chip with default settings.
   */
  reset(): void {
    // Reset all VIC registers to their default values
    for (let i = 0; i < 8; i++) {
      this._spriteX[i] = 0;
      this._spriteY[i] = 0;
      this._spriteColors[i] = 0;
    }

    this._spriteXMsb = 0;
    this._controlReg1 = 0;
    this._rasterLine = 0;
    this._lightPenX = 0;
    this._lightPenY = 0;
    this._spriteEnable = 0;
    this._controlReg2 = 0;
    this._spriteYExpand = 0;
    this._memoryPointers = 0;
    this._interruptReg = 0;
    this._interruptEnable = 0;
    this._spriteDataPriority = 0;
    this._spriteMulticolor = 0;
    this._spriteXExpand = 0;
    this._spriteSpriteCollision = 0;
    this._spriteDataCollision = 0;
    this._borderColor = 14; // Light Blue default
    this._backgroundColor0 = 6; // Blue default
    this._backgroundColor1 = 0;
    this._backgroundColor2 = 0;
    this._backgroundColor3 = 0;
    this._spriteMulticolor0 = 0;
    this._spriteMulticolor1 = 0;

    this.initializeRenderingTactTable();
  }

  /**
   * Optional hard reset operation
   */
  hardReset?: () => void = () => {
    // Perform a full reset, including any hardware-specific state
    this.reset();
    // Additional hard reset logic can be added here
  };

  /**
   * Dispose the resources held by the device
   */
  dispose(): void {
    // Clean up resources if necessary
    // For now, nothing to dispose
  }

  /**
   * Gets the current border color (Register $D020)
   */
  get borderColor(): number {
    return this._borderColor;
  }

  /**
   * Sets the border color (Register $D020)
   */
  set borderColor(value: number) {
    this._borderColor = value & 0x0f;
  }

  /**
   * Gets the current background color 0 (Register $D021)
   */
  get backgroundColor0(): number {
    return this._backgroundColor0;
  }

  /**
   * Sets the background color 0 (Register $D021)
   */
  set backgroundColor0(value: number) {
    this._backgroundColor0 = value & 0x0f;
  }

  /**
   * Gets the current raster line (Register $D012)
   */
  get rasterLine(): number {
    return this._rasterLine;
  }

  /**
   * Sets the raster line (Register $D012)
   */
  set rasterLine(value: number) {
    this._rasterLine = value & 0xff;
  }

  /**
   * Gets control register 1 (Register $D011)
   * Bit 0-2: Vertical raster scroll
   * Bit 3: 24/25 row display (1=25 rows)
   * Bit 4: Screen blanking (0=blank, 1=display)
   * Bit 5: Enable bitmap mode (1=enable)
   * Bit 6: Extended background mode (1=enable)
   * Bit 7: Raster MSB (9th bit of raster counter)
   */
  get controlRegister1(): number {
    return this._controlReg1;
  }

  /**
   * Sets control register 1 (Register $D011)
   */
  set controlRegister1(value: number) {
    this._controlReg1 = value & 0xff;
  }

  /**
   * Gets control register 2 (Register $D016)
   * Bit 0-2: Horizontal raster scroll
   * Bit 3: 38/40 column display (1=40 columns)
   * Bit 4: Multi-color mode (1=enable)
   * Bit 5-7: Unused
   */
  get controlRegister2(): number {
    return this._controlReg2;
  }

  /**
   * Sets control register 2 (Register $D016)
   */
  set controlRegister2(value: number) {
    this._controlReg2 = value & 0xff;
  }

  /**
   * Gets memory pointers register (Register $D018)
   * Bit 0-3: Character memory location (bits 11-14 of address)
   * Bit 4-7: Screen memory location (bits 10-13 of address)
   */
  get memoryPointers(): number {
    return this._memoryPointers;
  }

  /**
   * Sets memory pointers register (Register $D018)
   */
  set memoryPointers(value: number) {
    this._memoryPointers = value & 0xff;
  }

  /**
   * Gets interrupt register (Register $D019)
   * Bit 0: Raster interrupt occurred
   * Bit 1: Sprite-background collision occurred
   * Bit 2: Sprite-sprite collision occurred
   * Bit 3: Light pen signal occurred
   * Bit 4-6: Unused
   * Bit 7: Any interrupt occurred (bit 0-3)
   */
  get interruptRegister(): number {
    return this._interruptReg;
  }

  /**
   * Gets interrupt enable register (Register $D01A)
   * Bit 0: Enable raster interrupt
   * Bit 1: Enable sprite-background collision interrupt
   * Bit 2: Enable sprite-sprite collision interrupt
   * Bit 3: Enable light pen interrupt
   * Bit 4-7: Unused
   */
  get interruptEnable(): number {
    return this._interruptEnable;
  }

  /**
   * Sets interrupt enable register (Register $D01A)
   */
  set interruptEnable(value: number) {
    this._interruptEnable = value & 0xff;
  }

  /**
   * Read a VIC-II register value
   * @param regIndex Register index (0-47, corresponding to $D000-$D02E)
   * @returns The value of the register
   */
  readRegister(regIndex: number): number {
    regIndex &= 0x3f; // Limit to 64 registers (0-63), with mirroring

    // Handle sprite position registers ($D000-$D00F)
    if (regIndex < 0x10) {
      if (regIndex % 2 === 0) {
        return this._spriteX[regIndex >> 1];
      } else {
        return this._spriteY[regIndex >> 1];
      }
    }

    // Handle remaining registers
    switch (regIndex) {
      case 0x10:
        return this._spriteXMsb;
      case 0x11:
        return this._controlReg1;
      case 0x12:
        return this._rasterLine;
      case 0x13:
        return this._lightPenX;
      case 0x14:
        return this._lightPenY;
      case 0x15:
        return this._spriteEnable;
      case 0x16:
        return this._controlReg2;
      case 0x17:
        return this._spriteYExpand;
      case 0x18:
        return this._memoryPointers;
      case 0x19:
        return this._interruptReg;
      case 0x1a:
        return this._interruptEnable;
      case 0x1b:
        return this._spriteDataPriority;
      case 0x1c:
        return this._spriteMulticolor;
      case 0x1d:
        return this._spriteXExpand;
      case 0x1e:
        return this._spriteSpriteCollision;
      case 0x1f:
        return this._spriteDataCollision;
      case 0x20:
        return this._borderColor;
      case 0x21:
        return this._backgroundColor0;
      case 0x22:
        return this._backgroundColor1;
      case 0x23:
        return this._backgroundColor2;
      case 0x24:
        return this._backgroundColor3;
      case 0x25:
        return this._spriteMulticolor0;
      case 0x26:
        return this._spriteMulticolor1;
      default:
        // Sprite colors ($D027-$D02E)
        if (regIndex >= 0x27 && regIndex <= 0x2e) {
          return this._spriteColors[regIndex - 0x27];
        }
        // Reading from unused registers returns 0xFF
        return 0xff;
    }
  }

  /**
   * Write to a VIC-II register
   * @param regIndex Register index (0-47, corresponding to $D000-$D02E)
   * @param value The value to write
   */
  writeRegister(regIndex: number, value: number): void {
    regIndex &= 0x3f; // Limit to 64 registers (0-63), with mirroring
    value &= 0xff; // Ensure it's a byte value

    // Handle sprite position registers ($D000-$D00F)
    if (regIndex < 0x10) {
      if (regIndex % 2 === 0) {
        this._spriteX[regIndex >> 1] = value;
      } else {
        this._spriteY[regIndex >> 1] = value;
      }
      return;
    }

    // Handle remaining registers
    switch (regIndex) {
      case 0x10:
        this._spriteXMsb = value;
        break;
      case 0x11:
        this._controlReg1 = value;
        break;
      case 0x12:
        this._rasterLine = value;
        break;
      case 0x13: // Light pen registers are read-only
      case 0x14:
        break;
      case 0x15:
        this._spriteEnable = value;
        break;
      case 0x16:
        this._controlReg2 = value;
        break;
      case 0x17:
        this._spriteYExpand = value;
        break;
      case 0x18:
        this._memoryPointers = value;
        break;
      case 0x19:
        // Writing to interrupt register clears bits that are set in value
        this._interruptReg &= ~value;
        break;
      case 0x1a:
        this._interruptEnable = value;
        break;
      case 0x1b:
        this._spriteDataPriority = value;
        break;
      case 0x1c:
        this._spriteMulticolor = value;
        break;
      case 0x1d:
        this._spriteXExpand = value;
        break;
      case 0x1e: // Collision registers are read-only and cleared on read
      case 0x1f:
        break;
      case 0x20:
        this._borderColor = value & 0x0f;
        break; // Only lower 4 bits for colors
      case 0x21:
        this._backgroundColor0 = value & 0x0f;
        break;
      case 0x22:
        this._backgroundColor1 = value & 0x0f;
        break;
      case 0x23:
        this._backgroundColor2 = value & 0x0f;
        break;
      case 0x24:
        this._backgroundColor3 = value & 0x0f;
        break;
      case 0x25:
        this._spriteMulticolor0 = value & 0x0f;
        break;
      case 0x26:
        this._spriteMulticolor1 = value & 0x0f;
        break;
      default:
        // Sprite colors ($D027-$D02E)
        if (regIndex >= 0x27 && regIndex <= 0x2e) {
          this._spriteColors[regIndex - 0x27] = value & 0x0f;
        }
        break;
    }
  }

  /**
   * This method renders the entire screen frame as the shadow screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    // TODO: Implement the rendering logic for the C64 VIC-II chip
    return this._pixelBuffer;
  }

  /**
   * Initialize the helper tables that accelerate screen rendering by precalculating rendering tact information.
   */
  private initializeRenderingTactTable(): void {
    // --- Calculate the rendered screen size in pixels
    this.rasterLines =
      this._configuration.verticalSyncLines +
      this._configuration.nonVisibleBorderTopLines +
      this._configuration.borderTopLines +
      this._configuration.displayLines +
      this._configuration.borderBottomLines +
      this._configuration.nonVisibleBorderBottomLines;
    this.screenLines =
      this._configuration.borderTopLines +
      this._configuration.displayLines +
      this._configuration.borderBottomLines;
    this.screenWidth =
      8 *
      (this._configuration.borderLeftTime +
        this._configuration.displayLineTime +
        this._configuration.borderRightTime);

    // --- Prepare the pixel buffer to store the rendered screen bitmap
    this._pixelBuffer = new Uint32Array((this.screenLines + 4) * this.screenWidth);

    // --- Calculate the entire rendering time of a single screen line
    this.tactsInDisplayLine =
      this._configuration.borderLeftTime +
      this._configuration.displayLineTime +
      this._configuration.borderRightTime +
      this._configuration.nonVisibleBorderRightTime +
      this._configuration.horizontalBlankingTime;

    // --- Determine the number of tacts in a machine frame
    const tactsInFrame = this.rasterLines * this.tactsInDisplayLine;

    // --- Notify the CPU about it
    this.machine.setTactsInFrame(tactsInFrame);
  }
}
