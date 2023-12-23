import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IZ88ScreenDevice } from "./IZ88ScreenDevice";
import { COMFlags } from "./IZ88BlinkDevice";

const SBF_ROW_WIDTH = 256;
const TEXT_FLASH_TOGGLE = 200;

// --- Pixel colors
const PX_COL_ON = 0xff7d1b46;
const PX_COL_OFF = 0xffb9e0d2;
const PX_COL_GREY = 0xffa7b090;
const PX_SCR_OFF = 0xffe0e0e0;

// --- Attribute flags
const ATTR_HRS = 0x20;
const ATTR_REV = 0x10;
const ATTR_FLS = 0x08;
const ATTR_GRY = 0x04;
const ATTR_UND = 0x02;
const ATTR_NUL = 0x34;
const ATTR_CUR = 0x38;

/**
 * This class implements the Cambridge Z88 screen device.
 */
export class Z88ScreenDevice implements IZ88ScreenDevice {
  private _defaultSCW = 0;
  private _defaultSCH = 0;
  private _ctrlCharsPerRow = 0;
  private _textFlashCount = 0;
  private _textFlashPhase = false;
  private _pixelBuffer: Uint32Array;

  /**
   * Initialize the screen device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZ88Machine) {}

  /**
   * LORES0 (PB0, 16bits register). The 6 * 8 pixel per char User Defined Fonts.
   */
  PB0: number;

  /**
   * LORES1 (PB1, 16bits register). The 6 * 8 pixel per char fonts.
   */
  PB1: number;

  /**
   * HIRES0 (PB2 16bits register). The 8 * 8 pixel per char PipeDream Map.
   */
  PB2: number;

  /**
   * HIRES1 (PB3, 16bits register) The 8 * 8 pixel per char fonts for the OZ window
   */
  PB3: number;

  /**
   * Screen Base Register (16bits register) The Screen base File (2K size,
   * containing char info about screen). If this register is 0, then the system
   * cannot render the pixel screen.
   */
  SBR: number;

  /**
   * Blink Read register, SCW ($70)
   * LCD Horisontal resolution in pixels / 8
   * Available horizontal resolutions:
   * 640 pixels ($FF or 80), 800 pixels (100)
   */
  SCW: number;

  /**
   * Blink Read register, SCH ($71)
   * LCD Vertical resolution in pixels / 8
   * Available horizontal resolutions:
   * 64 pixels ($FF or 8), 256 pixels (32), 480 pixels (60)
   */
  SCH: number;

  /**
   * Indicates that the LCD went off.
   */
  lcdWentOff: boolean;

  /**
   * This value shows the refresh rate calculated from the base clock frequency of the CPU and the screen
   * configuration (total #of screen rendering tacts per frame).
   */
  refreshRate: number;

  /**
   * This value shows the number of frames after which the display HW toggles the flash flag.
   */
  flashToggleFrames: number;

  /**
   * This flag indicates whether the flash is in the standard (false) or inverted (true) phase.
   */
  flashFlag: boolean;

  /**
   * Sets the screen dimensions
   * @param width Screen width in pixels
   * @param height Screen height in pixels
   */
  setScreenSize (width: number, height: number): void {
    this._defaultSCW = width;
    this._defaultSCH = height;
    this.reset();
  }

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    this.PB0 = 0;
    this.PB1 = 0;
    this.PB2 = 0;
    this.PB3 = 0;
    this.SBR = 0;
    this.SCH = this._defaultSCH;
    this.SCW = this._defaultSCW;
    this.flashFlag = false;
    this._textFlashPhase = false;
    this._textFlashCount = 0;
    this.lcdWentOff = false;

    // --- Screen width in pixels
    this.screenWidth = this.SCW === 0xff ? 640 : this.SCW * 8;

    // --- Screen height
    this.screenLines = this.SCH * 8;

    // --- Control characters in a row
    this._ctrlCharsPerRow = Math.floor(this.screenWidth / 6);

    // --- Create the buffer for pixels
    this._pixelBuffer = new Uint32Array(this.screenWidth * this.screenLines);
  }

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // TODO: Implement this
  }

  /**
   * Get the width of the rendered screen.
   */
  screenWidth: number;

  /**
   * Get the number of visible screen lines.
   */
  screenLines: number;

  /**
   * Gets the buffer that stores the rendered pixels
   */
  getPixelBuffer (): Uint32Array {
    return this._pixelBuffer;
  }

  /**
   * This method signs that a new screen frame has been started
   */
  onNewFrame (): void {
    // TODO: Implement this
  }

  /**
   * Renders the LCD screen
   */
  renderScreen (): void {
    const blink = this.machine.blinkDevice;
    const screen = this;

    // --- Calculate flash phase related information
    this.flashFlag = blink.TIM0 <= 120;

    // --- Set text flash phase
    this._textFlashCount += 1;
    if (this._textFlashCount >= TEXT_FLASH_TOGGLE) {
      this._textFlashCount = 0;
      this._textFlashPhase = !this._textFlashPhase;
    }

    // --- Refresh the screen for every 8th frame
    if (this.machine.frames % this.machine.uiFrameFrequency) {
      return;
    }

    // --- Test if LCD is ON
    if (!(blink.COM & COMFlags.LCDON)) {
      if (!this.lcdWentOff) {
        this.renderScreenOff();
      }
      this.lcdWentOff = true;
      return;
    }

    // --- Prepare rendering
    this.lcdWentOff = false;

    // --- LORES 0
    let loRes0 = (((this.PB0 << 3) & 0xf700) | ((this.PB0 << 1) & 0x003f)) << 8;
    const loRes0Bank = loRes0 >>> 16;
    loRes0 &= 0x3fff;

    // --- LORES 1
    let loRes1 = (((this.PB1 << 6) & 0xff00) | ((this.PB1 << 4) & 0x0030)) << 8;
    const loRes1Bank = loRes1 >>> 16;
    loRes1 &= 0x3fff;

    // --- HIRES 0
    let hiRes0 = (((this.PB2 << 7) & 0xff00) | ((this.PB2 << 5) & 0x0020)) << 8;
    const hiRes0Bank = hiRes0 >>> 16;
    hiRes0 &= 0x3fff;

    // --- HIRES 1
    let hiRes1 = (((this.PB3 << 5) & 0xff00) | ((this.PB3 << 3) & 0x0038)) << 8;
    const hiRes1Bank = hiRes1 >>> 16;
    hiRes1 &= 0x3fff;

    // --- SBR
    let sbr = (((this.SBR << 5) & 0xff00) | ((this.SBR << 3) & 0x38)) << 8;
    const sbrBank = sbr >>> 16;
    sbr &= 0x3fff;

    // --- Init coordinates and pointers
    let coordX = 0;
    let coordY = 0;
    let rowCount = this.SCH;
    let rowSbrPtr = (sbr & 0x3fff) | (sbrBank << 14);

    const directRead = (v: number) => {
      return this.machine.directReadMemory.call(this.machine, v);
    };

    // --- Row loop
    while (rowCount) {
      // --- Initialize the row pointer and the column loop
      let sbrPtr = rowSbrPtr;
      let columnCount = this._ctrlCharsPerRow + 1;

      // --- Column loop
      while (columnCount) {
        // --- Read the screen character and its attribute
        const char = directRead(sbrPtr);
        const attr = directRead(sbrPtr + 1);

        // --- Render individual characters
        if (!(attr & ATTR_HRS)) {
          // --- It is a LORES character
          drawLoResChar(coordX, coordY, char, attr);
          coordX += 6;
        } else {
          if ((attr & ATTR_CUR) === ATTR_CUR) {
            drawLoResCursor(coordX, coordY, char, attr);
            coordX += 6;
          } else {
            if ((attr & ATTR_NUL) != ATTR_NUL) {
              drawHiResChar(coordX, coordY, char, attr);
              coordX += 8;
            }
          }
        }

        // --- Next column
        sbrPtr += 2;
        columnCount -= 1;
      }

      // --- Turn off the remaining pixels
      // --- Iterate through the pixel rows
      let orphanCount = 8;
      let orphanY = coordY;
      while (orphanCount) {
        // --- Calculate the top-left pixel address
        let pixelPtr = coordX + coordY * this.screenWidth;

        // --- Iterate through the orphaned pixels
        columnCount = coordX;
        while (columnCount < this.screenWidth) {
          this._pixelBuffer[pixelPtr] = PX_COL_OFF;
          pixelPtr += 1;
          columnCount += 1;
        }

        // --- Next row
        orphanCount -= 1;
        orphanY += 1;
      }

      // --- Prepare for the next row
      coordY += 8;
      coordX = 0;
      rowSbrPtr += SBF_ROW_WIDTH;
      rowCount -= 1;
    }

    /**
     * Draws a LORES character
     */
    function drawLoResChar (
      x: number,
      y: number,
      char: number,
      attr: number
    ): void {
      if (screen.screenWidth < x + 6) {
        return;
      }

      // --- Initialize the top-left position
      let pixelPtr = x + y * screen.screenWidth;

      // --- Check empty flash character
      if (attr & ATTR_FLS) {
        if (screen._textFlashPhase) {
          let rowCount = 8;
          while (rowCount) {
            // --- Store empty pixels
            screen._pixelBuffer[pixelPtr] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 1] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 2] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 3] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 4] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 5] = PX_COL_OFF;
            pixelPtr += screen.screenWidth;
            rowCount -= 1;
          }
          return;
        }
      }

      // --- Set pixel color
      const pixelColor = attr & ATTR_GRY ? PX_COL_GREY : PX_COL_ON;

      // --- Calculate font offset
      let fontOffset = ((attr & 0x01) << 8) | char;
      let fontBank = 0;
      if (fontOffset >= 0x01c0) {
        // --- UDG
        fontOffset = loRes0 + ((char & 0x3f) << 3);
        fontBank = loRes0Bank;
      } else {
        // --- Standard character
        fontOffset = loRes1 + (fontOffset << 3);
        fontBank = loRes1Bank;
      }

      // --- Draw the bits sequentially
      const fontAddress = (fontOffset & 0x3fff) | (fontBank << 14);
      const charMask = attr & ATTR_REV ? 0xff : 0x00;

      // --- Line 0
      let charPattern = directRead(fontAddress) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);

      // --- Line 1
      pixelPtr += screen.screenWidth;
      charPattern = directRead(fontAddress + 1) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);

      // --- Line 2
      pixelPtr += screen.screenWidth;
      charPattern = directRead(fontAddress + 2) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);

      // --- Line 3
      pixelPtr += screen.screenWidth;
      charPattern = directRead(fontAddress + 3) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);

      // --- Line 4
      pixelPtr += screen.screenWidth;
      charPattern = directRead(fontAddress + 4) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);

      // --- Line 5
      pixelPtr += screen.screenWidth;
      charPattern = directRead(fontAddress + 5) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);

      // --- Line 6
      pixelPtr += screen.screenWidth;
      charPattern = directRead(fontAddress + 6) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);

      // --- Line 7
      pixelPtr += screen.screenWidth;

      // --- Check for underline
      if (attr & ATTR_UND) {
        if (attr & ATTR_REV) {
          drawLowResRow(pixelPtr, pixelColor, 0x00);
        } else {
          drawLowResRow(pixelPtr, pixelColor, 0xff);
        }
        return;
      }

      // --- No underscore, display the 8th row of the char font
      charPattern = directRead(fontAddress + 7) ^ charMask;
      drawLowResRow(pixelPtr, pixelColor, charPattern);
    }

    /**
     * Draws a LORES cursor
     */
    function drawLoResCursor (
      x: number,
      y: number,
      char: number,
      attr: number
    ): void {
      if (screen.screenWidth < x + 6) {
        return;
      }

      // --- Initialize the top-left position
      let pixelPtr = x + y * screen.screenWidth;

      // --- Calculate font offset
      let fontOffset = ((attr & 0x01) << 8) | char;
      let fontBank = 0;
      if (fontOffset >= 0x01c0) {
        // --- UDG
        fontOffset = loRes0 + ((char & 0x3f) << 3);
        fontBank = loRes0Bank;
      } else {
        // --- Standard character
        fontOffset = loRes1 + (fontOffset << 3);
        fontBank = loRes1Bank;
      }

      // --- Draw the bits sequentially
      let fontAddress = (fontOffset & 0x3fff) | (fontBank << 14);
      const charMask = screen.flashFlag ? 0xff : 0x00;
      for (let i = 0; i < 8; i++) {
        let charPattern = directRead(fontAddress + i) ^ charMask;
        drawLowResRow(pixelPtr, PX_COL_ON, charPattern);
        pixelPtr += screen.screenWidth;
      }
    }

    /**
     * Draws a HIRES character
     */
    function drawHiResChar (
      x: number,
      y: number,
      char: number,
      attr: number
    ): void {
      if (screen.screenWidth < x + 8) {
        return;
      }

      // --- Initialize the top-left position
      let pixelPtr = x + y * screen.screenWidth;

      // --- Check empty flash character
      if (attr & ATTR_FLS) {
        if (screen._textFlashPhase) {
          let rowCount = 8;
          while (rowCount) {
            // --- Store empty pixels
            screen._pixelBuffer[pixelPtr] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 1] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 2] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 3] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 4] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 5] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 6] = PX_COL_OFF;
            screen._pixelBuffer[pixelPtr + 7] = PX_COL_OFF;
            pixelPtr += screen.screenWidth;
            rowCount -= 1;
          }
          return;
        }
      }

      // --- Set pixel color
      const pixelColor = attr & ATTR_GRY ? PX_COL_GREY : PX_COL_ON;

      // --- Calculate font offset
      let fontOffset = ((attr & 0x03) << 8) | char;
      let fontBank = 0;
      if (fontOffset >= 0x0300) {
        // --- OZ window font entries
        fontOffset = hiRes1 + (char << 3);
        fontBank = hiRes1Bank;
      } else {
        // --- Pipedream map entries
        fontOffset = hiRes0 + (fontOffset << 3);
        fontBank = hiRes0Bank;
      }

      // --- Draw the bits sequentially
      const fontAddress = (fontOffset & 0x3fff) | (fontBank << 14);
      const charMask = attr & ATTR_REV ? 0xff : 0x00;
      for (let i = 0; i < 8; i++) {
        const charPattern = directRead[fontAddress] ^ charMask;
        drawHiResRow(pixelPtr, pixelColor, charPattern);
        pixelPtr += screen.screenWidth;
      }
    }

    /**
     * Draws a LORES character row
     */
    function drawLowResRow (
      pixelPtr: number,
      pixelColor: number,
      charPattern: number
    ): void {
      screen._pixelBuffer[pixelPtr] =
        charPattern & 0x20 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 1] =
        charPattern & 0x10 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 2] =
        charPattern & 0x08 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 3] =
        charPattern & 0x04 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 4] =
        charPattern & 0x02 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 5] =
        charPattern & 0x01 ? pixelColor : PX_COL_OFF;
    }

    /**
     * Draws a LORES character row
     */
    function drawHiResRow (
      pixelPtr: number,
      pixelColor: number,
      charPattern: number
    ): void {
      screen._pixelBuffer[pixelPtr] =
        charPattern & 0x80 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 1] =
        charPattern & 0x40 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 2] =
        charPattern & 0x20 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 3] =
        charPattern & 0x10 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 4] =
        charPattern & 0x08 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 5] =
        charPattern & 0x04 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 6] =
        charPattern & 0x02 ? pixelColor : PX_COL_OFF;
      screen._pixelBuffer[pixelPtr + 7] =
        charPattern & 0x01 ? pixelColor : PX_COL_OFF;
    }
  }

  // ==========================================================================
  // Helpers

  /**
   * Renders the OFF state of the LCD screen
   */
  private renderScreenOff (): void {
    for (let i = 0; i < this.screenWidth * this.screenLines; i++) {
      this._pixelBuffer[i] = PX_SCR_OFF;
    }
  }
}
