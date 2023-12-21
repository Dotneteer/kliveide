import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IGenericDevice } from "@emu/abstractions/IGenericDevice";

/**
 * This interface defines the properties and operations of the ZX Spectrum's screen device.
 */
export interface IZ88ScreenDevice extends IGenericDevice<IZ88Machine> {
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
  get flashFlag(): boolean;

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
  getPixelBuffer(): Uint32Array;

  /**
   * This method signs that a new screen frame has been started
   */
  onNewFrame(): void;
}
