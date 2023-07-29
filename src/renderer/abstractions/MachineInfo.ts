import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";

/**
 * This type stores information about a particular emulated machine
 */
export type MachineInfo = {
  /**
   * The ID of the machine
   */
  machineId: string;

  /**
   * The friendly name of the machine to display
   */
  displayName: string;

  /**
   * Creates the emulate machine instance
   * @returns The emulated machine instance
   */
  factory: () => IZ80Machine;
};
