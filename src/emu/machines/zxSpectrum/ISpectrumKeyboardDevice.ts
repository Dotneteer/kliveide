import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { IGenericKeyboardDevice } from "@emu/abstractions/IGenericKeyboardDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's keyboard device.
 */
export interface ISpectrumKeyboardDevice
  extends IGenericKeyboardDevice<(IZxSpectrumMachine | IZxNextMachine)> {}
