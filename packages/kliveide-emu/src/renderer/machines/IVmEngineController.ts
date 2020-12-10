import { VmKeyCode } from "./wa-api";
import { ExecuteCycleOptions } from "../../shared/machines/machine-state";

/**
 * Defines the services of a virtual machine engine controller.
 * The virtual machines can access this controller.
 */
export interface IVmEngineController {
  /**
   * Starts the virtual machine with the specified exeution options
   * @param options Execution options
   */
  run(options: ExecuteCycleOptions): Promise<void>;

  /**
   * Signs that the screen has been refreshed
   */
  signScreenRefreshed(): void;

  /**
   * Waits while the execution cycle terminates
   */
  waitForCycleTermination(): Promise<boolean>;

  /**
   * Puts a keystroke into the queue of emulated keystrokes and delays it
   * @param primary Primary key
   * @param secodary Optional secondary key
   */
  delayKey(primaryKey: VmKeyCode, secondaryKey?: VmKeyCode): Promise<void>;
}
