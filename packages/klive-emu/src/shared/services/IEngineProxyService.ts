import { MachineState } from "../../renderer/machines/core/vm-core-types";
import { ICpuState } from "../machines/AbstractCpu";
import { ILiteEvent } from "../utils/LiteEvent";

/**
 * Arguments of RunEvent
 */
export type RunEventArgs = { execState: number; isDebug: boolean };

/**
 * Defines the interface of the service handling the engine proxy
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
