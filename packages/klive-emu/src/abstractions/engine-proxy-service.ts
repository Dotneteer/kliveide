import { MachineState } from "../renderer/machines/core/vm-core-types";
import { ICpuState } from "../shared/machines/AbstractCpu";
import { ILiteEvent } from "@core/LiteEvent";

/**
 * Arguments of RunEvent
 */
export type RunEventArgs = { execState: number; isDebug: boolean };

/**
 * IEngineProxyService declares helper methods that allow the IDE process
 * to access the virtual machine engine running in the Emulator proces
 */
export interface IEngineProxyService {
  /**
   * Fires when a run event, such as execution state change or screen refresh happens
   */
  readonly runEvent: ILiteEvent<RunEventArgs>;

  /**
   * Gets the current CPU state
   */
  getCpuState(): Promise<ICpuState>;

  /**
   * Gets the cached CPU state
   */
  getCachedCpuState(): Promise<ICpuState>;

  /**
   * Gets the current machine state
   */
  getMachineState(): Promise<MachineState>;

  /**
   * Gets the cached machine state
   */
  getCachedMachineState(): Promise<MachineState>;

  /**
   * Gets the memory contents of the machine
   */
  getMemoryContents(): Promise<Uint8Array>;

  /**
   * Gets the cached memory contents of the machine
   */
  getCachedMemoryContents(): Promise<Uint8Array>;
}
