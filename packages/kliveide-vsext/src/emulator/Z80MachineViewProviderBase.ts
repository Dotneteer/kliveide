import { MachineState } from "@shared/machines/machine-state";
import { TreeItem } from "vscode";

/**
 * This class represents a view provider bas class for all
 * Z80 machines
 */
export abstract class Z80MachineViewProviderBase {
  /**
   * Override this member to provide additional hardware register
   * data
   * @param _state Current machine state
   */
  async getHardwareRegisters(_state: MachineState): Promise<TreeItem[]> {
    return [];
  }
}
