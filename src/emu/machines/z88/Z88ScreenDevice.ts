import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IZ88ScreenDevice } from "./IZ88ScreenDevice";

/**
 * This class implements the Cambridge Z88 screen device.
 */
export class Z88ScreenDevice implements IZ88ScreenDevice {
  /**
   * Initialize the screen device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZ88Machine) {}

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
  get flashFlag (): boolean {
    // TODO: Implement this
    return false;
  }

  /**
   * Get the width of the rendered screen.
   */
  get screenWidth (): number {
    return 640;
  }

  /**
   * Get the number of visible screen lines.
   */
  get screenLines (): number {
    return 64;
  }

  /**
   * Gets the buffer that stores the rendered pixels
   */
  getPixelBuffer (): Uint32Array {
    // TODO: Implement this
    return new Uint32Array(0);
  }

  /**
   * This method signs that a new screen frame has been started
   */
  onNewFrame (): void {
    // TODO: Implement this
  }

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    // TODO: Implement this
  }

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // TODO: Implement this
  }
}
