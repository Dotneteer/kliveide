import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { RenderingTact } from "@emu/abstractions/RenderingTact";
import type { ScreenConfiguration } from "@emu/abstractions/ScreenConfiguration";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { RenderingPhase } from "@renderer/abstractions/RenderingPhase";
import { zxNext9BitColorCodes } from "./PaletteDevice";

export class NextScreenDevice implements IGenericDevice<IZxNextMachine> {
  displayTiming: number;
  userLockOnDisplayTiming: boolean;
  machineType: number;
  timexScreenMode: number;
  timexColorCombination: number;
  hz60Mode: boolean;
  scandoublerEnabled: boolean;
  scanlineWeight: number;
  videoTimingMode: number;
  enableLoresMode: boolean;
  layerPriority: number;

  activeVideoLine: number;

  fallbackColor: number;

  constructor(
    public readonly machine: IZxNextMachine,
    configuration: ScreenConfiguration
  ) {
    this._configuration = configuration;
    this._flashFlag = false;
    this.reset();
  }

  /**
   * Reset the device to its initial state.
   */
  reset(): void {
    this.displayTiming = 0;
    this.userLockOnDisplayTiming = false;
    this.machineType = 0;
    this.hz60Mode = false;
    this.scandoublerEnabled = false;
    this.scanlineWeight = 0;
    this.videoTimingMode = 0;
    this.enableLoresMode = false;
    this.layerPriority = 0;
    this.activeVideoLine = 0;
    this.fallbackColor = 0xe3;

    // --- Set default color values
    this.borderColor = 7;
    this._flashFlag = false;

    // --- Create helper tables for screen rendering
    this.initializeInkAndPaperTables();
    this.initializeRenderingTactTable();

    // --- Set the screen start offset
    this.ulaScreenStartOffset = this.machine.memoryDevice.getUlaScreenOffset(false);
  }

  // --- The current configuration
  private _configuration: ScreenConfiguration;

  // --- The current value of the flash flag
  private _flashFlag = false;

  // --- Paper color indexes what flash is off
  private readonly _paperColorFlashOff: number[] = [];

  // --- Paper color indexes what flash is on
  private readonly _paperColorFlashOn: number[] = [];

  // --- Ink color indexes what flash is off
  private readonly _inkColorFlashOff: number[] = [];

  // --- Ink color indexes what flash is on
  private readonly _inkColorFlashOn: number[] = [];

  // --- Stores pixel byte #1
  private _pixelByte1 = 0;

  // --- Stores pixel byte #2
  private _pixelByte2 = 0;

  // --- Stores attribute byte #1
  private _attrByte1 = 0;

  // --- Stores attribute byte #2
  private _attrByte2 = 0;

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
      let color = zxNext9BitColorCodes[palette[bright ? ink | 0x08 : ink]];
      this.currentInkColors[i] =
        0xff000000 | ((color & 0xff) << 16) | (color & 0xff00) | ((color & 0xff0000) >> 16);
      color = zxNext9BitColorCodes[palette[bright ? paper | 0x08 : paper]];
      this.currentPaperColors[i] =
        0xff000000 | ((color & 0xff) << 16) | (color & 0xff00) | ((color & 0xff0000) >> 16);
    }
    // TODO: Implement this method for ULA Next
  }

  /**
   * Define the screen configuration attributes of ZX Spectrum 48K (PAL)
   */
  static readonly NextScreenConfiguration: ScreenConfiguration = {
    verticalSyncLines: 23,
    borderTopLines: 49,
    borderBottomLines: 48,
    displayLines: 192,
    borderLeftTime: 24,
    borderRightTime: 24,
    displayLineTime: 128,
    horizontalBlankingTime: 48,
    pixelDataPrefetchTime: 2,
    attributeDataPrefetchTime: 1,
    contentionValues: [6, 5, 4, 3, 2, 1, 0, 0]
  };

  /**
   * Get or set the current border color.
   */
  borderColor = 7;

  /**
   * This table defines the rendering information associated with the tacts of the ULA screen rendering frame.
   */
  renderingTactTable: RenderingTact[] = [];

  /**
   * This buffer stores the bitmap of the screen being rendered. Each 32-bit value represents an ARGB pixel.
   */
  private _pixelBuffer: Uint32Array;

  /**
   * This value shows the refresh rate calculated from the base clock frequency of the CPU and the screen
   * configuration (total #of screen rendering tacts per frame).
   */
  refreshRate: number;

  /**
   * This value shows the number of frames after which the ULA toggles the flash flag. In the hardware machine,
   * the flash flag toggles twice in a second.
   */
  flashToggleFrames: number;

  /**
   * This flag indicates whether the flash is in the standard (false) or inverted (true) phase.
   */
  public get flashFlag(): boolean {
    return this._flashFlag;
  }

  /**
   * Get or set the configuration of this device.
   */
  get configuration(): ScreenConfiguration {
    return this._configuration;
  }
  set configuration(value: ScreenConfiguration) {
    this._configuration = value;
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
   * Use canvas size multipliers
   * @returns The aspect ratio of the screen
   */
  getAspectRatio(): [number, number] {
    return [0.5, 1];
  }

  /**
   *
   */
  ulaScreenStartOffset = 0;

  /**
   * Render the pixel pair belonging to the specified frame tact.
   * @param tact Frame tact to render
   */
  renderTact(tact: number): void {
    const renderTact = this.renderingTactTable[tact];
    renderTact.renderingAction?.(renderTact);
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
      for (let tact = 0; tact < this.renderingTactTable.length; tact++) {
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
    this._flashFlag = Math.floor(this.machine.frames / this.flashToggleFrames) % 2 === 0;
  }

  /**
   * Get the index of the first display line.
   */
  private firstDisplayLine: number;

  /**
   * Get the index of the leftmost pixel's tact within a raster line.
   */
  private firstVisibleBorderTact: number;

  /**
   * Get the index of the first visible line.
   */
  private firstVisibleLine: number;

  /**
   * Initialize the helper tables that accelerate ink and paper color handling.
   */
  private initializeInkAndPaperTables(): void {
    // --- Iterate through all the 256 combinations of attribute values
    for (let attr = 0; attr < 0x100; attr++) {
      const ink = (attr & 0x07) | ((attr & 0x40) >> 3);
      const paper = ((attr & 0x38) >> 3) | ((attr & 0x40) >> 3);

      // --- Use normal paper and ink colors when flash is off and normal flash phase is active
      this._paperColorFlashOff[attr] = paper;
      this._inkColorFlashOff[attr] = ink;

      // --- Use normal paper and ink colors when flash is on and normal flash phase is active
      // --- Exchange paper and ink colors when flash is on and inverted flash phase is active
      this._paperColorFlashOn[attr] = attr & 0x80 ? ink : paper;
      this._inkColorFlashOn[attr] = attr & 0x80 ? paper : ink;
    }
  }

  /**
   * Initialize the helper tables that accelerate screen rendering by precalculating rendering tact information.
   */
  private initializeRenderingTactTable(): void {
    // --- Shortcut to the memory device
    // --- Calculate helper screen dimensions
    this.firstDisplayLine =
      this._configuration.verticalSyncLines + this._configuration.borderTopLines;
    const lastDisplayLine = this.firstDisplayLine + this._configuration.displayLines - 1;

    // --- Calculate the rendered screen size in pixels
    this.rasterLines =
      this.firstDisplayLine +
      this._configuration.displayLines +
      this._configuration.borderBottomLines;
    this.screenLines =
      this._configuration.borderTopLines +
      this._configuration.displayLines +
      this._configuration.borderBottomLines -
      1;
    this.screenWidth =
      4 *
      (this._configuration.borderLeftTime +
        this._configuration.displayLineTime +
        this._configuration.borderRightTime);

    // --- Prepare the pixel buffer to store the rendered screen bitmap
    this._pixelBuffer = new Uint32Array((this.screenLines + 4) * this.screenWidth);

    // --- Calculate the entire rendering time of a single screen line
    const screenLineTime =
      this._configuration.borderLeftTime +
      this._configuration.displayLineTime +
      this._configuration.borderRightTime +
      this._configuration.horizontalBlankingTime;

    // --- Determine the number of tacts in a machine frame
    const tactsInFrame = this.rasterLines * screenLineTime;

    // --- Notify the CPU about it
    this.machine.setTactsInFrame(tactsInFrame);

    // --- Calculate the refresh rate and the flash toggle rate
    this.refreshRate = this.machine.baseClockFrequency / tactsInFrame;
    this.flashToggleFrames = Math.round(this.refreshRate / 2);

    // --- Calculate the first and last visible lines
    this.firstVisibleLine = this._configuration.verticalSyncLines;
    const lastVisibleLine = this.rasterLines;
    this.firstVisibleBorderTact = screenLineTime - this._configuration.borderLeftTime;

    // --- Calculate the last visible line tact
    const lastVisibleLineTact =
      this._configuration.displayLineTime + this._configuration.borderRightTime;

    // --- Calculate border pixel and attribute fetch tacts
    const borderPixelFetchTact = screenLineTime - this._configuration.pixelDataPrefetchTime;
    var borderAttrFetchTact = screenLineTime - this._configuration.attributeDataPrefetchTime;

    // --- Iterate through all tacts to create the rendering table
    this.renderingTactTable = [];
    for (let tact = 0; tact < tactsInFrame; tact++) {
      // --- Init the current tact
      const currentTact: RenderingTact = {
        phase: RenderingPhase.None,
        pixelAddress: 0,
        attributeAddress: 0,
        pixelBufferIndex: 0,
        renderingAction: null
      };

      // --- Calculate line index and the tact index within line
      const line = Math.floor(tact / screenLineTime);
      const tactInLine = tact % screenLineTime;

      // Test, if the current tact is visible
      if (
        line >= this.firstVisibleLine &&
        line <= lastVisibleLine &&
        (tactInLine < lastVisibleLineTact || tactInLine >= this.firstVisibleBorderTact)
      ) {
        // --- Yes, the tact is visible.
        // --- Is it the first pixel/attr prefetch?
        var calculated = false;
        if (line === this.firstDisplayLine - 1) {
          if (tactInLine == borderPixelFetchTact - 1) {
            currentTact.phase = RenderingPhase.Border;
            currentTact.renderingAction = (rt) => this.renderTactBorder(rt);
            calculated = true;
          } else if (tactInLine == borderPixelFetchTact) {
            // --- Yes, prefetch pixel data
            currentTact.phase = RenderingPhase.BorderFetchPixel;
            currentTact.pixelAddress = this.calcPixelAddress(line + 1, 0);
            currentTact.renderingAction = (rt) => this.renderTactBorderFetchPixel(rt);
            calculated = true;
          } else if (tactInLine == borderAttrFetchTact) {
            currentTact.phase = RenderingPhase.BorderFetchAttr;
            currentTact.attributeAddress = this.calcAttrAddress(line + 1, 0);
            currentTact.renderingAction = (rt) => this.renderTactBorderFetchAttr(rt);
            calculated = true;
          }
        }

        if (!calculated) {
          // --- Test, if the tact is in the display area
          if (
            line >= this.firstDisplayLine &&
            line <= lastDisplayLine &&
            tactInLine < this._configuration.displayLineTime
          ) {
            // --- Yes, it is the display area
            // --- Carry out actions according to pixel tact
            const pixelTact = tactInLine & 0x07;
            switch (pixelTact) {
              case 0:
                currentTact.phase = RenderingPhase.DisplayB1FetchB2;
                currentTact.pixelAddress = this.calcPixelAddress(line, tactInLine + 4);
                currentTact.renderingAction = (rt) => this.renderTactDislayByte1FetchByte2(rt);
                break;
              case 1:
                currentTact.phase = RenderingPhase.DisplayB1FetchA2;
                currentTact.attributeAddress = this.calcAttrAddress(line, tactInLine + 3);
                currentTact.renderingAction = (rt) => this.renderTactDislayByte1FetchAttr2(rt);
                break;
              case 2:
                currentTact.phase = RenderingPhase.DisplayB1;
                currentTact.renderingAction = (rt) => this.renderTactDislayByte1(rt);
                break;
              case 3:
                currentTact.phase = RenderingPhase.DisplayB1;
                currentTact.renderingAction = (rt) => this.renderTactDislayByte1(rt);
                break;
              case 4:
                currentTact.phase = RenderingPhase.DisplayB2;
                currentTact.renderingAction = (rt) => this.renderTactDislayByte2(rt);
                break;
              case 5:
                currentTact.phase = RenderingPhase.DisplayB2;
                currentTact.renderingAction = (rt) => this.renderTactDislayByte2(rt);
                break;
              case 6:
                // --- Test, if there are more pixels to display in this line
                if (
                  tactInLine <
                  this._configuration.displayLineTime - this._configuration.pixelDataPrefetchTime
                ) {
                  // --- Yes, there are still more bytes
                  currentTact.phase = RenderingPhase.DisplayB2FetchB1;
                  currentTact.pixelAddress = this.calcPixelAddress(
                    line,
                    tactInLine + this._configuration.pixelDataPrefetchTime
                  );
                  currentTact.renderingAction = (rt) => this.renderTactDislayByte2FetchByte1(rt);
                } else {
                  // --- Last byte in this line
                  currentTact.phase = RenderingPhase.DisplayB2;
                  currentTact.renderingAction = (rt) => this.renderTactDislayByte2(rt);
                }
                break;
              case 7:
                // --- Test, if there are more pixels to display in this line
                if (
                  tactInLine <
                  this._configuration.displayLineTime -
                    this._configuration.attributeDataPrefetchTime
                ) {
                  // --- Yes, there are still more bytes
                  currentTact.phase = RenderingPhase.DisplayB2FetchA1;
                  currentTact.attributeAddress = this.calcAttrAddress(
                    line,
                    tactInLine + this._configuration.attributeDataPrefetchTime
                  );
                  currentTact.renderingAction = (rt) => this.renderTactDislayByte2FetchAttr1(rt);
                } else {
                  // --- Last byte in this line
                  currentTact.phase = RenderingPhase.DisplayB2;
                  currentTact.renderingAction = (rt) => this.renderTactDislayByte2(rt);
                }
                break;
            }
          } else {
            // --- It is the border area
            currentTact.phase = RenderingPhase.Border;
            currentTact.renderingAction = (rt) => this.renderTactBorder(rt);

            // --- Left or right border?
            if (line >= this.firstDisplayLine && line < lastDisplayLine) {
              // -- Yes, it is left or right border
              // --- Is it pixel data prefetch time?
              if (tactInLine === borderPixelFetchTact) {
                // --- Yes, prefetch pixel data
                currentTact.phase = RenderingPhase.BorderFetchPixel;
                currentTact.pixelAddress = this.calcPixelAddress(line + 1, 0);
                currentTact.renderingAction = (rt) => this.renderTactBorderFetchPixel(rt);
              } else if (tactInLine === borderAttrFetchTact) {
                currentTact.phase = RenderingPhase.BorderFetchAttr;
                currentTact.attributeAddress = this.calcAttrAddress(line + 1, 0);
                currentTact.renderingAction = (rt) => this.renderTactBorderFetchAttr(rt);
              }
            }
          }
        }
      }

      // --- Pre-calculate the pixel buffer index for the pixel pair to display.
      if (currentTact.phase !== RenderingPhase.None) {
        currentTact.pixelBufferIndex = this.calculateBufferIndex(line, tactInLine);
      }

      // --- Store the current rendering item
      this.renderingTactTable[tact] = currentTact;
    }
  }

  /**
   * Calculate the pixel address of the specified tact.
   * @param line Line index
   * @param tactInLine Tact within the line
   * @returns The calculated pixel address
   */
  private calcPixelAddress(line: number, tactInLine: number): number {
    const row = line - this.firstDisplayLine;
    return ((row & 0xc0) << 5) + ((row & 0x07) << 8) + ((row & 0x38) << 2) + (tactInLine >> 2);
  }

  /**
   * Calculate the attribute address of the specified tact.
   * @param line Line index
   * @param tactInLine Tact within the line
   * @returns The calculated attribute address
   */
  private calcAttrAddress(line: number, tactInLine: number): number {
    return (tactInLine >> 2) + (((line - this.firstDisplayLine) >> 3) << 5) + 0x1800;
  }

  /**
   * Calculate the index of the specified tact in the pixel buffer.
   * @param line Line index
   * @param tactInLine Tact within the line
   * @returns The calculated pixel buffer index
   *
   * Remember, a single tact represents two consecutive pixels.
   */
  private calculateBufferIndex(line: number, tactInLine: number): number {
    if (tactInLine >= this.firstVisibleBorderTact) {
      // --- This part is the left border
      line++;
      tactInLine -= this.firstVisibleBorderTact;
    } else {
      tactInLine += this._configuration.borderLeftTime;
    }

    // --- At this point, tactInLine and line contain the X and Y coordinates of the corresponding pixel pair.
    return line >= this.firstVisibleLine
      ? 4 * (((line - this.firstVisibleLine) * this.screenWidth) / 4 + tactInLine)
      : 0;
  }

  /**
   * Gets the color of the specified pixel
   * @param pixel Pixel visibility: zero = paper, non-zero = ink
   * @param attr Attribute byte to use
   * @returns ARGB color to display
   */
  private getPixelColor(pixel: number, attr: number): number {
    return pixel
      ? attr & 0x80 && this._flashFlag
        ? this.currentPaperColors[attr]
        : this.currentInkColors[attr]
      : attr & 0x80 && this._flashFlag
        ? this.currentInkColors[attr]
        : this.currentPaperColors[attr];
    // return pixel
    //   ? this._flashFlag
    //     ? this.s_SpectrumColors[this._inkColorFlashOn[attr]]
    //     : this.s_SpectrumColors[this._inkColorFlashOff[attr]]
    //   : this._flashFlag
    //     ? this.s_SpectrumColors[this._paperColorFlashOn[attr]]
    //     : this.s_SpectrumColors[this._paperColorFlashOff[attr]];
  }

  private readScreenMemory(offset: number): number {
    return this.machine.memoryDevice.readMemory(this.ulaScreenStartOffset + offset);
  }

  /**
   * Render a border pixel.
   * @param rt Rendering tact information
   */
  private renderTactBorder(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] =
      this._pixelBuffer[addr + 1] =
      this._pixelBuffer[addr + 2] =
      this._pixelBuffer[addr + 3] =
        this.currentPaperColors[this.borderColor << 3];
  }

  /**
   * Render a border pixel and fetch the pixel byte for the first pixel in the line.
   * @param rt Rendering tact information
   */
  private renderTactBorderFetchPixel(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] =
      this._pixelBuffer[addr + 1] =
      this._pixelBuffer[addr + 2] =
      this._pixelBuffer[addr + 3] =
        this.currentPaperColors[this.borderColor << 3];
    this._pixelByte1 = this.readScreenMemory(rt.pixelAddress);
  }

  /**
   * Render a border pixel and fetch the attribute byte for the first pixel in the line.
   * @param rt Rendering tact information
   */
  private renderTactBorderFetchAttr(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] =
      this._pixelBuffer[addr + 1] =
      this._pixelBuffer[addr + 2] =
      this._pixelBuffer[addr + 3] =
        this.currentPaperColors[this.borderColor << 3];
    this._attrByte1 = this.readScreenMemory(rt.attributeAddress);
  }

  /**
   * Render the next pixel of byte #1.
   * @param rt Rendering tact information
   */
  private renderTactDislayByte1(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] = this._pixelBuffer[addr + 1] = this.getPixelColor(
      this._pixelByte1 & 0x80,
      this._attrByte1
    );
    this._pixelBuffer[addr + 2] = this._pixelBuffer[addr + 3] = this.getPixelColor(
      this._pixelByte1 & 0x40,
      this._attrByte1
    );
    this._pixelByte1 = this._pixelByte1 << 2;
  }

  /**
   * Render the next pixel of byte #1 and fetch byte #2,
   * @param rt Rendering tact information
   */
  private renderTactDislayByte1FetchByte2(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] = this._pixelBuffer[addr + 1] = this.getPixelColor(
      this._pixelByte1 & 0x80,
      this._attrByte1
    );
    this._pixelBuffer[addr + 2] = this._pixelBuffer[addr + 3] = this.getPixelColor(
      this._pixelByte1 & 0x40,
      this._attrByte1
    );
    this._pixelByte1 = this._pixelByte1 << 2;
    this._pixelByte2 = this.readScreenMemory(rt.pixelAddress);
  }

  /**
   * Render the next pixel of byte #1 and fetch attribute #2.
   * @param rt Rendering tact information
   */
  private renderTactDislayByte1FetchAttr2(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] = this._pixelBuffer[addr + 1] = this.getPixelColor(
      this._pixelByte1 & 0x80,
      this._attrByte1
    );
    this._pixelBuffer[addr + 2] = this._pixelBuffer[addr + 3] = this.getPixelColor(
      this._pixelByte1 & 0x40,
      this._attrByte1
    );
    this._pixelByte1 = this._pixelByte1 << 2;
    this._attrByte2 = this.readScreenMemory(rt.attributeAddress);
  }

  /**
   * Render the next pixel of byte #2.
   * @param rt Rendering tact information
   */
  private renderTactDislayByte2(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] = this._pixelBuffer[addr + 1] = this.getPixelColor(
      this._pixelByte2 & 0x80,
      this._attrByte2
    );
    this._pixelBuffer[addr + 2] = this._pixelBuffer[addr + 3] = this.getPixelColor(
      this._pixelByte2 & 0x40,
      this._attrByte2
    );
    this._pixelByte2 = this._pixelByte2 << 2;
  }

  /**
   * Render the next pixel of byte #2 and fetch byte #1.
   * @param rt Rendering tact information
   */
  private renderTactDislayByte2FetchByte1(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] = this._pixelBuffer[addr + 1] = this.getPixelColor(
      this._pixelByte2 & 0x80,
      this._attrByte2
    );
    this._pixelBuffer[addr + 2] = this._pixelBuffer[addr + 3] = this.getPixelColor(
      this._pixelByte2 & 0x40,
      this._attrByte2
    );
    this._pixelByte2 = this._pixelByte2 << 2;
    this._pixelByte1 = this.readScreenMemory(rt.pixelAddress);
  }

  /**
   * Render the next pixel of byte #2 and fetch attribute #1,
   * @param rt Rendering tact information
   */
  private renderTactDislayByte2FetchAttr1(rt: RenderingTact): void {
    const addr = rt.pixelBufferIndex;
    this._pixelBuffer[addr] = this._pixelBuffer[addr + 1] = this.getPixelColor(
      this._pixelByte2 & 0x80,
      this._attrByte2
    );
    this._pixelBuffer[addr + 2] = this._pixelBuffer[addr + 3] = this.getPixelColor(
      this._pixelByte2 & 0x40,
      this._attrByte2
    );
    this._pixelByte2 = this._pixelByte2 << 2;
    this._attrByte1 = this.readScreenMemory(rt.attributeAddress);
  }
}
