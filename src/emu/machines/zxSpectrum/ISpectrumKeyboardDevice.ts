import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { IGenericKeyboardDevice } from "@emu/abstractions/IGenericKeyboardDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's keyboard device.
 */
export interface ISpectrumKeyboardDevice
  extends IGenericKeyboardDevice<(IZxSpectrumMachine | IZxNextMachine)> {}
