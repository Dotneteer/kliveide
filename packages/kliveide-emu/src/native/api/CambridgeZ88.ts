import { CambridgeZ88MachineState, MachineState } from "./machine-state";
import { MemoryHelper } from "./memory-helpers";
import { FrameBoundZ80Machine } from "./Z80VmBase";

/**
 * This class implements the Cambride Z88 machine
 */
export class CambridgeZ88 extends FrameBoundZ80Machine {

      /**
   * Retrieves a ZX Spectrum 48 machine state object
   */
  createMachineState(): MachineState {
    return new CambridgeZ88MachineState()
  }
}