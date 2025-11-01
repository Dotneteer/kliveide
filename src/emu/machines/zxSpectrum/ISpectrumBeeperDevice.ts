import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { IGenericBeeperDevice } from "../../abstractions/IGenericBeeperDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface ISpectrumBeeperDevice
  extends IGenericBeeperDevice<IZxSpectrumMachine | IZxNextMachine> {}
