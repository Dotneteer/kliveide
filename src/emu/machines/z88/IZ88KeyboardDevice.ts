import type { IZ88Machine } from "@emuabstr/IZ88Machine";
import type { IGenericKeyboardDevice } from "@emuabstr/IGenericKeyboardDevice";

/**
 * This interface defines the properties and operations of the Cambridge Z88 keyboard device.
 */
export interface IZ88KeyboardDevice
  extends IGenericKeyboardDevice<IZ88Machine> {
  /**
   * Indicates if there is any key pressed
   */  
  readonly isKeyPressed: boolean;

  /**
   * Indicates if the left shift key is pressed
   */
  readonly isLeftShiftDown: boolean;

  /**
   * Indicates if the right shift key is pressed
   */
  readonly isRightShiftDown: boolean;
}
