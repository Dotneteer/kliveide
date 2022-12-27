import { IGenericDevice } from "./IGenericDevice";
import { IZxSpectrumMachine } from "./IZxSpectrumMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's screen device.
 */
export interface IScreenDevice extends IGenericDevice<IZxSpectrumMachine>
{
    /**
     * Get or set the configuration of this device.
     */
    configuration: ScreenConfiguration;

    /**
     * Get or set the current border color.
     */
    borderColor: number;

    /**
     * This table defines the rendering information associated with the tacts of the ULA screen rendering frame.
     */
    renderingTactTable: RenderingTact[];

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
    get flashFlag(): boolean

    /**
     * Get the number of raster lines (height of the rendered screen).
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
    renderTact(tact: number): void;

    /**
     * Gets the buffer that stores the rendered pixels
     */
    getPixelBuffer(): Uint32Array;

    /**
     * This method signs that a new screen frame has been started
     */
    onNewFrame(): void;
}

/**
 * This interface defines the data that can be used to render a Spectrum model's screen
 */
export type ScreenConfiguration = {
    /**
     * Number of lines used for vertical synch
     */
    verticalSyncLines: number;

    /**
     * The number of top border lines that are not visible
     * when rendering the screen
     */
    nonVisibleBorderTopLines: number;

    /**
     * The number of border lines before the display
     */
    borderTopLines: number;

    /**
     * Number of display lines
     */
    displayLines: number;

    /**
     * The number of border lines after the display
     */
    borderBottomLines: number;

    /**
     * The number of bottom border lines that are not visible
     * when rendering the screen
     */
    nonVisibleBorderBottomLines: number;

    /**
     * Horizontal blanking time (HSync+blanking).
     * Given in Z80 clock cycles.
     */
    horizontalBlankingTime: number;

    /**
     * The time of displaying left part of the border.
     * Given in Z80 clock cycles.
     */
    borderLeftTime: number;

    /**
     * The time of displaying a pixel row.
     * Given in Z80 clock cycles.
     */
    displayLineTime: number;

    /**
     * The time of displaying right part of the border.
     * Given in Z80 clock cycles.
     */
    borderRightTime: number;

    /**
     * The time used to render the nonvisible right part of the border.
     * Given in Z80 clock cycles.
     */
    nonVisibleBorderRightTime: number;

    /**
     * The time the data of a particular pixel should be prefetched
     * before displaying it.
     * Given in Z80 clock cycles.
     */
    pixelDataPrefetchTime: number;

    /**
     * The time the data of a particular pixel attribute should be prefetched
     * before displaying it.
     * Given in Z80 clock cycles.
     */
    attributeDataPrefetchTime: number;

    /**
     * Gets the contention values to be used with the device
     */
    contentionValues: number[];
}

/**
 * This structure defines information related to a particular tact of the ULA screen rendering frame.
 */
export type RenderingTact = {
    /**
     * Describe the rendering phase associated with the current tact.
     */
    phase: RenderingPhase;

    /**
     * Display memory address used in the particular tact
     */
    pixelAddress: number;

    /**
     * Display memory address used in the particular tact
     */
    attributeAddress: number;

    /**
     * This property indicates the pixel buffer index associated with the rendering tact. If this tact displays a
     * visible pixel (border or display pixel), this value shows the index in the buffer holding the screen bitmap.
     */
    pixelBufferIndex: number;

    /**
     * This property refers to a function that knows how to render the specified tact.
     * @param tact Tact to render
     */
    renderingAction: (tact: RenderingTact) => void;
}

/**
 * This enumeration defines the different phases of ULA rendering.
 */
export enum RenderingPhase
{
    /**
     * The ULA does not do any rendering.
     */
    None = 0,

    /**
     * The ULA sets the border color to display the current pixel.
     */
    Border,

    /**
     * The ULA sets the border color to display the current pixel. It prepares to display the first pixel in the row
     * by pre-fetching the corresponding byte from the display memory.
     */
    BorderFetchPixel,

    /**
     * The ULA sets the border color to display the current pixel. It has already fetched the byte of eight pixels to
     * display, and it prepares to display the first pixel in the row by pre-fetching the corresponding attribute
     * byte from the display memory.
     */
    BorderFetchAttr,

    /**
     * The ULA displays the subsequent two pixels of Byte1 sequentially during a single Z80 clock cycle.
     */
    DisplayB1,

    /**
     * The ULA displays the subsequent two pixels of Byte2 sequentially during a single Z80 clock cycle.
     */
    DisplayB2,

    /**
     * The ULA displays the subsequent two pixels of Byte1 sequentially during a single Z80 clock cycle. It prepares
     * to display the pixels of the next byte in the row by pre-fetching the corresponding byte from the display
     * memory.
     */
    DisplayB1FetchB2,

    /**
     * The ULA displays the subsequent two pixels of Byte1 sequentially during a single Z80 clock cycle. It prepares
     * to display the pixels of the next byte in the row by pre-fetching the corresponding attribute from the display
     * memory.
     */
    DisplayB1FetchA2,

    /**
     * The ULA displays the subsequent two pixels of Byte2 sequentially during a single Z80 clock cycle. It prepares
     * to display the pixels of the next byte in the row by pre-fetching the corresponding byte from the display
     * memory.
     */
    DisplayB2FetchB1,

    /**
     * The ULA displays the subsequent two pixels of Byte2 sequentially during a single Z80 clock cycle. It prepares
     * to display the pixels of the next byte in the row by pre-fetching the corresponding attribute from the display
     * memory.
     */
    DisplayB2FetchA1
}
