import { VmKeyCode } from "../../native/api/api";
import { ExecuteCycleOptions } from "./machine-state";

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
