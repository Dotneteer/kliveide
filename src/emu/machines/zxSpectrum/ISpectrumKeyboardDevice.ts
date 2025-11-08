import type { IZxSpectrumMachine } from "@emuabstr/IZxSpectrumMachine";
import type { IGenericKeyboardDevice } from "@emuabstr/IGenericKeyboardDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's keyboard device.
 */
export interface ISpectrumKeyboardDevice
  extends IGenericKeyboardDevice<(IZxSpectrumMachine | IZxNextMachine)> {}
