import { IGenericDevice } from "./IGenericDevice";
import { IZxSpectrumMachine } from "@/renderer/abstractions/IZxSpectrumMachine";
import { RenderingTact } from "./RenderingTact";
import { ScreenConfiguration } from "./ScreenConfiguration";

/**
 * This interface defines the properties and operations of the ZX Spectrum's screen device.
 */
export interface IScreenDevice extends IGenericDevice<IZxSpectrumMachine> {
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
  get flashFlag(): boolean;

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
