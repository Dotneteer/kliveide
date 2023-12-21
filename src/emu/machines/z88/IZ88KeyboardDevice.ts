import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IGenericKeyboardDevice } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * This interface defines the properties and operations of the Cambridge Z88 keyboard device.
 */
export interface IZ88KeyboardDevice
  extends IGenericKeyboardDevice<IZ88Machine> {}
