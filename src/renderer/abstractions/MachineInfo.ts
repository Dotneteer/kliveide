import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
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

  // --- Number of ROMS available
  roms?: number;

  // --- Number of memory banks available
  banks?: number;

  // --- The machine supports tape files
  tapeSupport?: boolean;

  /**
   * Creates the emulate machine instance
   * @returns The emulated machine instance
   */
  factory: (store: Store<AppState>) => IZ80Machine;
};
