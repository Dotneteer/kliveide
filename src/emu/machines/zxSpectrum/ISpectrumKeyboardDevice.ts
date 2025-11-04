import type { IZxSpectrumMachine } from "../../abstractions/IZxSpectrumMachine";
import type { IGenericKeyboardDevice } from "../../abstractions/IGenericKeyboardDevice";
import type { IZxNextMachine } from "../../abstractions/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's keyboard device.
 */
export interface ISpectrumKeyboardDevice
  extends IGenericKeyboardDevice<(IZxSpectrumMachine | IZxNextMachine)> {}
