import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { IGenericBeeperDevice } from "../../abstractions/IGenericBeeperDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface ISpectrumBeeperDevice
  extends IGenericBeeperDevice<IZxSpectrumMachine | IZxNextMachine> {}
