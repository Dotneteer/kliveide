import { getState } from "@core/service-registry";
import { IMachineComponentProvider } from "@modules-core/abstract-vm";
import { ICambridgeZ88StateManager, Z88_STATE_MANAGER_ID } from "./CambridgeZ88Core";

export class CambridgeZ88StateManager implements IMachineComponentProvider, ICambridgeZ88StateManager {
  readonly id = Z88_STATE_MANAGER_ID;

  getState(): any {
    return getState();
  }
}
