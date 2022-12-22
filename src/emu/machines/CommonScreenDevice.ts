import { IScreenDevice, RenderingPhase, RenderingTact, ScreenConfiguration } from "../abstractions/IScreenDevice";
import { IZxSpectrumMachine } from "../abstractions/IZxSpectrumMachine";

/**
 * This class implements the ZX Spectrum screen device.
 */
export class CommonScreenDevice implements IScreenDevice {
    // --- The current configuration
    private _configuration: ScreenConfiguration;

    // --- The current value of the flash flag
    private _flashFlag = false;

    // --- Paper color indexes what flash is off
    private readonly _paperColorFlashOff: number[] = [];

    // --- Paper color indexes what flash is on
    private readonly _paperColorFlashOn: number[] = [];

    // --- Ink color indexes what flash is off
    private readonly  _inkColorFlashOff: number[] = [];

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

    /**
     * Define the screen configuration attributes of ZX Spectrum 48K (PAL)
     */
    static readonly ZxSpectrum48ScreenConfiguration: ScreenConfiguration = {
        verticalSyncLines: 8,
        nonVisibleBorderTopLines: 7,
        borderTopLines: 49,
        borderBottomLines: 48,
        nonVisibleBorderBottomLines: 8,
        displayLines: 192,
        borderLeftTime: 24,
        borderRightTime: 24,
        displayLineTime: 128,
        horizontalBlankingTime: 40,
        nonVisibleBorderRightTime: 8,
        pixelDataPrefetchTime: 2,
        attributeDataPrefetchTime: 1,
        contentionValues: [6, 5, 4, 3, 2, 1, 0, 0 ]
    };

    /**
     * Define the screen configuration attributes of ZX Spectrum 48K (PAL)
     */
    static readonly ZxSpectrum128ScreenConfiguration: ScreenConfiguration = {
        verticalSyncLines: 8,
        nonVisibleBorderTopLines: 7,
        borderTopLines: 48,
        borderBottomLines: 48,
        nonVisibleBorderBottomLines: 8,
        displayLines: 192,
        borderLeftTime: 24,
        borderRightTime: 24,
        displayLineTime: 128,
        horizontalBlankingTime: 40,
        nonVisibleBorderRightTime: 12,
        pixelDataPrefetchTime: 2,
        attributeDataPrefetchTime: 1,
        contentionValues: [4, 3, 2, 1, 0, 0, 6, 5]
    };

    /**
     * Define the screen configuration attributes of ZX Spectrum 48K (PAL)
     */
    static readonly ZxSpectrumP3EScreenConfiguration: ScreenConfiguration = {
        verticalSyncLines: 8,
        nonVisibleBorderTopLines: 7,
        borderTopLines: 48,
        borderBottomLines: 48,
        nonVisibleBorderBottomLines: 8,
        displayLines: 192,
        borderLeftTime: 24,
        borderRightTime: 24,
        displayLineTime: 128,
        horizontalBlankingTime: 40,
        nonVisibleBorderRightTime: 12,
        pixelDataPrefetchTime: 2,
        attributeDataPrefetchTime: 1,
        contentionValues: [0, 7, 6, 5, 4, 3, 2, 1]
    };

    /**
     * This table defines the ARGB colors for the 16 available colors on the ZX Spectrum 48K model.
     */
    private readonly s_SpectrumColors: number[] = [
        0xFF000000, // Black
        0xFF0000AA, // Blue
        0xFFAA0000, // Red
        0xFFAA00AA, // Magenta
        0xFF00AA00, // Green
        0xFF00AAAA, // Cyan
        0xFFAAAA00, // Yellow
        0xFFAAAAAA, // White
        0xFF000000, // Bright Black
        0xFF0000FF, // Bright Blue
        0xFFFF0000, // Bright Red
        0xFFFF00FF, // Bright Magenta
        0xFF00FF00, // Bright Green
        0xFF00FFFF, // Bright Cyan
        0xFFFFFF00, // Bright Yellow
        0xFFFFFFFF, // Bright White
    ];

    // --- We use this reference for the default contention values so that in the future, we can configure it (for
    // --- example, when implementing ZX Spectrum +2/+3)
    private get contentionValues() {
        return this._configuration.contentionValues;
    }

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

    /// <summary>
    /// Initialize the screen device and assign it to its host machine.
    /// </summary>
    /// <param name="machine">The machine hosting this device</param>
    /// <param name="config">Screen configuration to use</param>
    constructor(
        public readonly machine: IZxSpectrumMachine, 
        configuration: ScreenConfiguration) {
        this._configuration = configuration;
        this._flashFlag = false;
    }

    /**
     * Reset the device to its initial state.
     */
    reset(): void {
        // --- Set default color values
        this.borderColor = 7;
        this._flashFlag = false;

        // --- Create helper tables for screen rendering
        this.initializeInkAndPaperTables();
        this.initializeRenderingTactTable();
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
     * Render the pixel pair belonging to the specified frame tact.
     * @param tact Frame tact to render
     */
    renderTact(tact: number): void {
        const renderTact = this.renderingTactTable[tact];
        renderTact.renderingAction?.(renderTact);
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
        this._flashFlag = (this.machine.frames / this.flashToggleFrames) % 2 === 0;
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
            this._paperColorFlashOn[attr] = (attr & 0x80) ? ink : paper;
            this._inkColorFlashOn[attr] = (attr & 0x80) ? paper : ink;
        }
    }

    /**
     * Initialize the helper tables that accelerate screen rendering by precalculating rendering tact information.
     */
    private initializeRenderingTactTable(): void {
        // --- Shortcut to the memory device
        // --- Calculate helper screen dimensions
        this.firstDisplayLine =
            this._configuration.verticalSyncLines +
            this._configuration.nonVisibleBorderTopLines +
            this._configuration.borderTopLines;
        const lastDisplayLine =
            this.firstDisplayLine +
            this._configuration.displayLines
            - 1;

        // --- Calculate the rendered screen size in pixels
        this.rasterLines =
            this.firstDisplayLine +
            this._configuration.displayLines +
            this._configuration.borderBottomLines +
            this._configuration.nonVisibleBorderBottomLines;
        this.screenLines = this._configuration.borderTopLines +
            this._configuration.displayLines +
            this._configuration.borderBottomLines - 1;
        this.screenWidth = 2 * (
            this._configuration.borderLeftTime +
            this._configuration.displayLineTime +
            this._configuration.borderRightTime);

        // --- Prepare the pixel buffer to store the rendered screen bitmap
        this._pixelBuffer = new Uint32Array((this.screenLines + 4) * this.screenWidth);

        // --- Calculate the entire rendering time of a single screen line
        const screenLineTime =
            this._configuration.borderLeftTime +
            this._configuration.displayLineTime +
            this._configuration.borderRightTime +
            this._configuration.nonVisibleBorderRightTime +
            this._configuration.horizontalBlankingTime;

        // --- Determine the number of tacts in a machine frame
        const tactsInFrame = this.rasterLines * screenLineTime;

        // --- Notify the CPU about it
        this.machine.setTactsInFrame(tactsInFrame);

        // --- Calculate the refresh rate and the flash toggle rate
        this.refreshRate = this.machine.baseClockFrequency / tactsInFrame;
        this.flashToggleFrames = Math.round(this.refreshRate / 2);

        // --- Calculate the first and last visible lines
        this.firstVisibleLine = 
            this._configuration.verticalSyncLines + 
            this._configuration.nonVisibleBorderTopLines;
        const lastVisibleLine = 
            this.rasterLines - 
            this._configuration.nonVisibleBorderBottomLines;
        this.firstVisibleBorderTact = screenLineTime - this._configuration.borderLeftTime;

        // --- Calculate the last visible line tact
        const lastVisibleLineTact = 
            this._configuration.displayLineTime + 
            this._configuration.borderRightTime;

        // --- Calculate border pixel and attribute fetch tacts
        const borderPixelFetchTact = screenLineTime - this._configuration.pixelDataPrefetchTime;
        var borderAttrFetchTact = screenLineTime - this._configuration.attributeDataPrefetchTime;

        // --- Iterate through all tacts to create the rendering table
        this.renderingTactTable = [];
        for (let tact = 0; tact < tactsInFrame; tact++)
        {
            // --- Init the current tact
            const currentTact: RenderingTact = {
                phase: RenderingPhase.None,
                pixelAddress: 0,
                attributeAddress: 0,
                pixelBufferIndex: 0,
                renderingAction: null
            };
            this.machine.setContentionValue(tact, 0);

            // --- Calculate line index and the tact index within line
            const line = tact / screenLineTime;
            const tactInLine = tact % screenLineTime;

            // Test, if the current tact is visible
            if (
              (line >= this.firstVisibleLine) &&
              (line <= lastVisibleLine) &&
              (tactInLine < lastVisibleLineTact || tactInLine >= this.firstVisibleBorderTact)
            ) {
                // --- Yes, the tact is visible.
                // --- Is it the first pixel/attr prefetch?
                var calculated = false;
                if (line === this.firstDisplayLine - 1) {
                    if (tactInLine == borderPixelFetchTact - 1)
                    {
                        currentTact.phase = RenderingPhase.Border;
                        currentTact.renderingAction = this.renderTactBorder;
                        this.machine.setContentionValue(tact, this.contentionValues[6]);
                        calculated = true;
                    } else if (tactInLine == borderPixelFetchTact) {
                        // --- Yes, prefetch pixel data
                        currentTact.phase = RenderingPhase.BorderFetchPixel;
                        currentTact.pixelAddress = this.calcPixelAddress(line + 1, 0);
                        currentTact.renderingAction = this.renderTactBorderFetchPixel;
                        this.machine.setContentionValue(tact, this.contentionValues[7]);
                        calculated = true;
                    } else if (tactInLine == borderAttrFetchTact) {
                        currentTact.phase = RenderingPhase.BorderFetchAttr;
                        currentTact.attributeAddress = this.calcAttrAddress(line + 1, 0);
                        currentTact.renderingAction = this.renderTactBorderFetchAttr;
                        this.machine.setContentionValue(tact, this.contentionValues[0]);
                        calculated = true;
                    }
                }

                if (!calculated) {
                    // --- Test, if the tact is in the display area
                    if (
                      (line >= this.firstDisplayLine) &&
                      (line <= lastDisplayLine) &&
                      (tactInLine < this._configuration.displayLineTime)
                    ) {
                        // --- Yes, it is the display area
                        // --- Carry out actions according to pixel tact
                        const pixelTact = tactInLine & 0x07;
                        switch (pixelTact)
                        {
                            case 0:
                                currentTact.phase = RenderingPhase.DisplayB1FetchB2;
                                currentTact.pixelAddress = this.calcPixelAddress(line, tactInLine + 4);
                                currentTact.renderingAction = this.renderTactDislayByte1FetchByte2;
                                this.machine.setContentionValue(tact, this.contentionValues[1]);
                                break;
                            case 1:
                                currentTact.phase = RenderingPhase.DisplayB1FetchA2;
                                currentTact.attributeAddress = this.calcAttrAddress(line, tactInLine + 3);
                                currentTact.renderingAction = this.renderTactDislayByte1FetchAttr2;
                                this.machine.setContentionValue(tact, this.contentionValues[2]);
                                break;
                            case 2:
                                currentTact.phase = RenderingPhase.DisplayB1;
                                currentTact.renderingAction = this.renderTactDislayByte1;
                                this.machine.setContentionValue(tact, this.contentionValues[3]);
                                break;
                            case 3:
                                currentTact.phase = RenderingPhase.DisplayB1;
                                currentTact.renderingAction = this.renderTactDislayByte1;
                                this.machine.setContentionValue(tact, this.contentionValues[4]);
                                break;
                            case 4:
                                currentTact.phase = RenderingPhase.DisplayB2;
                                currentTact.renderingAction = this.renderTactDislayByte2;
                                this.machine.setContentionValue(tact, this.contentionValues[5]);
                                break;
                            case 5:
                                currentTact.phase = RenderingPhase.DisplayB2;
                                currentTact.renderingAction = this.renderTactDislayByte2;
                                this.machine.setContentionValue(tact, this.contentionValues[6]);
                                break;
                            case 6:
                                // --- Test, if there are more pixels to display in this line
                                if (tactInLine < (this._configuration.displayLineTime - 
                                    this._configuration.pixelDataPrefetchTime)) {
                                    // --- Yes, there are still more bytes
                                    currentTact.phase = RenderingPhase.DisplayB2FetchB1;
                                    currentTact.pixelAddress = this.calcPixelAddress(line, tactInLine + 
                                        this._configuration.pixelDataPrefetchTime);
                                    currentTact.renderingAction = this.renderTactDislayByte2FetchByte1;
                                    this.machine.setContentionValue(tact, this.contentionValues[7]);
                                } else {
                                    // --- Last byte in this line
                                    currentTact.phase = RenderingPhase.DisplayB2;
                                    currentTact.renderingAction = this.renderTactDislayByte2;
                                }
                                break;
                            case 7:
                                // --- Test, if there are more pixels to display in this line
                                if (tactInLine < (this._configuration.displayLineTime - 
                                    this._configuration.attributeDataPrefetchTime)) {
                                    // --- Yes, there are still more bytes
                                    currentTact.phase = RenderingPhase.DisplayB2FetchA1;
                                    currentTact.attributeAddress = this.calcAttrAddress(line, tactInLine + 
                                        this._configuration.attributeDataPrefetchTime);
                                    currentTact.renderingAction = this.renderTactDislayByte2FetchAttr1;
                                    this.machine.setContentionValue(tact, this.contentionValues[0]);
                                } else {
                                    // --- Last byte in this line
                                    currentTact.phase = RenderingPhase.DisplayB2;
                                    currentTact.renderingAction = this.renderTactDislayByte2;
                                }
                                break;
                        }
                    } else {
                        // --- It is the border area
                        currentTact.phase = RenderingPhase.Border;
                        currentTact.renderingAction = this.renderTactBorder;

                        // --- Left or right border?
                        if (line >= this.firstDisplayLine && line < lastDisplayLine) {
                            // -- Yes, it is left or right border
                            // --- Is it pixel data prefetch time?
                            if (tactInLine === borderPixelFetchTact) {
                                // --- Yes, prefetch pixel data
                                currentTact.phase = RenderingPhase.BorderFetchPixel;
                                currentTact.pixelAddress = this.calcPixelAddress(line + 1, 0);
                                currentTact.renderingAction = this.renderTactBorderFetchPixel;
                                this.machine.setContentionValue(tact, this.contentionValues[7]);
                            } else if (tactInLine === borderAttrFetchTact) {
                                currentTact.phase = RenderingPhase.BorderFetchAttr;
                                currentTact.attributeAddress = this.calcAttrAddress(line + 1, 0);
                                currentTact.renderingAction = this.renderTactBorderFetchAttr;
                                this.machine.setContentionValue(tact, this.contentionValues[0]);
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
        return ((row & 0xc0) << 5) +
            ((row & 0x07) << 8) +
            ((row & 0x38) << 2) +
            (tactInLine >> 2);
    }

    /**
     * Calculate the attribute address of the specified tact.
     * @param line Line index
     * @param tactInLine Tact within the line
     * @returns The calculated attribute address
     */
    private calcAttrAddress(line: number, tactInLine: number): number {
        return ((tactInLine >> 2) +
            (((line - this.firstDisplayLine) >> 3) << 5) +
            0x1800);
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
            ? 2 *((line - this.firstVisibleLine) * this.screenWidth/2 + tactInLine)
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
        ? (this._flashFlag 
            ? this.s_SpectrumColors[this._inkColorFlashOn[attr]] 
            : this.s_SpectrumColors[this._inkColorFlashOff[attr]])
        : (this._flashFlag 
            ? this.s_SpectrumColors[this._paperColorFlashOn[attr]] 
            : this.s_SpectrumColors[this._paperColorFlashOff[attr]]);
    }

    /**
     * Render a border pixel.
     * @param rt Rendering tact information
     */
    private renderTactBorder(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.s_SpectrumColors[this.borderColor];
        this._pixelBuffer[addr + 1] = this.s_SpectrumColors[this.borderColor];
    }

    /**
     * Render a border pixel and fetch the pixel byte for the first pixel in the line.
     * @param rt Rendering tact information
     */
    private renderTactBorderFetchPixel(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.s_SpectrumColors[this.borderColor];
        this._pixelBuffer[addr + 1] = this.s_SpectrumColors[this.borderColor];
        this._pixelByte1 = this.machine.readScreenMemory(rt.pixelAddress);
    }

    /**
     * Render a border pixel and fetch the attribute byte for the first pixel in the line.
     * @param rt Rendering tact information
     */
    private renderTactBorderFetchAttr(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.s_SpectrumColors[this.borderColor];
        this._pixelBuffer[addr + 1] = this.s_SpectrumColors[this.borderColor];
        this._attrByte1 = this.machine.readScreenMemory(rt.attributeAddress);
    }

    /**
     * Render the next pixel of byte #1.
     * @param rt Rendering tact information
     */
    private renderTactDislayByte1(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.getPixelColor(this._pixelByte1 & 0x80, this._attrByte1);
        this._pixelBuffer[addr + 1] = this.getPixelColor(this._pixelByte1 & 0x40, this._attrByte1);
        this._pixelByte1 = this._pixelByte1 << 2;
    }

    /**
     * Render the next pixel of byte #1 and fetch byte #2,
     * @param rt Rendering tact information
     */
    private renderTactDislayByte1FetchByte2(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.getPixelColor(this._pixelByte1 & 0x80, this._attrByte1);
        this._pixelBuffer[addr + 1] = this.getPixelColor(this._pixelByte1 & 0x40, this._attrByte1);
        this._pixelByte1 = this._pixelByte1 << 2;
        this._pixelByte2 = this.machine.readScreenMemory(rt.pixelAddress);
    }

    /**
     * Render the next pixel of byte #1 and fetch attribute #2.
     * @param rt Rendering tact information
     */
    private renderTactDislayByte1FetchAttr2(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.getPixelColor(this._pixelByte1 & 0x80, this._attrByte1);
        this._pixelBuffer[addr + 1] = this.getPixelColor(this._pixelByte1 & 0x40, this._attrByte1);
        this._pixelByte1 = this._pixelByte1 << 2;
        this._attrByte2 = this.machine.readScreenMemory(rt.attributeAddress);
    }

    /**
     * Render the next pixel of byte #2.
     * @param rt Rendering tact information
     */
    private renderTactDislayByte2(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.getPixelColor(this._pixelByte2 & 0x80, this._attrByte2);
        this._pixelBuffer[addr + 1] = this.getPixelColor(this._pixelByte2 & 0x40, this._attrByte2);
        this._pixelByte2 = this._pixelByte2 << 2;
    }

    /**
     * Render the next pixel of byte #2 and fetch byte #1.
     * @param rt Rendering tact information
     */
    private renderTactDislayByte2FetchByte1(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.getPixelColor(this._pixelByte2 & 0x80, this._attrByte2);
        this._pixelBuffer[addr + 1] = this.getPixelColor(this._pixelByte2 & 0x40, this._attrByte2);
        this._pixelByte2 = this._pixelByte2 << 2;
        this._pixelByte1 = this.machine.readScreenMemory(rt.pixelAddress);
    }

    /**
     * Render the next pixel of byte #2 and fetch attribute #1,
     * @param rt Rendering tact information
     */
    private renderTactDislayByte2FetchAttr1(rt: RenderingTact): void {
        const addr = rt.pixelBufferIndex;
        this._pixelBuffer[addr] = this.getPixelColor(this._pixelByte2 & 0x80, this._attrByte2);
        this._pixelBuffer[addr + 1] = this.getPixelColor(this._pixelByte2 & 0x40, this._attrByte2);
        this._pixelByte2 = this._pixelByte2 << 2;
        this._attrByte1 = this.machine.readScreenMemory(rt.attributeAddress);
    }
}
