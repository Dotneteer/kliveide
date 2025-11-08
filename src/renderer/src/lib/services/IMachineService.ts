import type { Unsubscribe } from "@state/redux-light";
import type { MachineConfigSet, MachineInfo, MachineModel } from "@common/machines/info-types";
import { IAnyMachine } from "@emuabstr/IAnyMachine";
import { IMachineController } from "@/emu/abstractions/IMachineController";

/**
 * This function type represents the event handler when a machine type is changing
 */
export type MachineTypeEventHandler = (machineId: string) => void;

/**
 * This function type represents the event handler of a particular machine intance
 */
export type MachineInstanceEventHandler = (machine: IAnyMachine) => void;

/**
 * This interface defines the functions managing the emulated machines within the IDE
 */
export interface IMachineService {
  /**
   * Sets the machine to to the specified one
   * @param machineId ID of the machine type to set
   * @param modelId ID of the machine model
   * @param config Optional machine configuration
   */
  setMachineType(machineId: string, modelId?: string, config?: MachineConfigSet): Promise<void>;

  /**
   * Gets the current machine type
   */
  getMachineType(): string | undefined;

  /**
   * Gets descriptive information about the current machine
   */
  getMachineInfo(): { machine: MachineInfo; model: MachineModel } | undefined;

  /**
   * Gets the current machine controller instance
   */
  getMachineController(): IMachineController | undefined;

  /**
   * Subscribes to an event when the old machine type is about to being disposed
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  oldMachineTypeDisposing(handler: MachineTypeEventHandler): Unsubscribe;

  /**
   * Subscribes to an event when the old machine type has been disposed
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  oldMachineTypeDisposed(handler: MachineTypeEventHandler): Unsubscribe;

  /**
   * Subscribes to an event when the new machine type is about to being initialized
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  newMachineTypeInitializing(handler: MachineInstanceEventHandler): Unsubscribe;

  /**
   * Subscribes to an event when the new machine type have been initialized
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  newMachineTypeInitialized(handler: MachineInstanceEventHandler): Unsubscribe;
}
