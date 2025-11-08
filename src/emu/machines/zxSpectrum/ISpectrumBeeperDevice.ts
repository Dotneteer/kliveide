import type { IZxSpectrumMachine } from "@emuabstr/IZxSpectrumMachine";
import type { IGenericBeeperDevice } from "@emuabstr/IGenericBeeperDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface ISpectrumBeeperDevice
  extends IGenericBeeperDevice<IZxSpectrumMachine | IZxNextMachine> {}
