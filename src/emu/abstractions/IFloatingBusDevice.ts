import { IGenericDevice } from "./IGenericDevice";
import { IZxSpectrumMachine } from "@/renderer/abstractions/IZxSpectrumMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's floating bus device.
 */
export interface IFloatingBusDevice extends IGenericDevice<IZxSpectrumMachine> {
  /**
   * Reads the current floating bus value.
   */
  readFloatingBus(): number;
}
