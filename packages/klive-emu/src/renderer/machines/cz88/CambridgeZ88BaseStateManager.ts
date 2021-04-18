import { emuStore } from "../../../renderer/emulator/emuStore";
import { ICambridgeZ88StateManager } from "./ICambrideZ88StateMananger";

export class CambridgeZ88StateManager implements ICambridgeZ88StateManager {
  /**
   * Gets the current state
   */
  getState(): any {
    return emuStore.getState();
  }
}
