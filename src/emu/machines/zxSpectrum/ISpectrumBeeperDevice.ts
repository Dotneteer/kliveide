import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { IGenericBeeperDevice } from "../../abstractions/IGenericBeeperDevice";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface ISpectrumBeeperDevice extends IGenericBeeperDevice<IZxSpectrumMachine> {
}
