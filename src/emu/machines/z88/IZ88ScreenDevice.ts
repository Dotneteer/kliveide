import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IGenericDevice } from "@emu/abstractions/IGenericDevice";

/**
 * This interface defines the properties and operations of the ZX Spectrum's screen device.
 */
export interface IZ88ScreenDevice extends IGenericDevice<IZ88Machine> {
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
   * Renders the LCD screen
   */
  renderScreen(): void;

  /**
   * This method signs that a new screen frame has been started
   */
  onNewFrame(): void;
}
