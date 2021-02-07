import { rendererProcessStore } from "../../rendererProcessStore";
import { ICambridgeZ88BaseStateManager } from "./ICambrideZ88BaseStateMananger";

export class CambridgeZ88BaseStateManager
  implements ICambridgeZ88BaseStateManager {
  /**
   * Gets the current state
   */
  getState(): any {
    return rendererProcessStore.getState();
  }
}
