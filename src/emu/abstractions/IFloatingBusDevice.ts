import type { IGenericDevice } from "./IGenericDevice";
import type { IZxSpectrumMachine } from "./IZxSpectrumMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's floating bus device.
 */
export interface IFloatingBusDevice extends IGenericDevice<IZxSpectrumMachine> {
  /**
   * Reads the current floating bus value.
   */
  readFloatingBus(): number;
}
