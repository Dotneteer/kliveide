import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { IGenericKeyboardDevice } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * This interface defines the properties and operations of the ZX Spectrum's keyboard device.
 */
export interface ISpectrumKeyboardDevice
  extends IGenericKeyboardDevice<IZxSpectrumMachine> {}
