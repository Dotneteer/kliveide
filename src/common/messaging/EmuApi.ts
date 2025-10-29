import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";

const NO_PROXY_ERROR = 'Method should be implemented by a proxy.'

/**
 * This class defines the shape of the Emu process API that can be called from
 * the main and Ide processes. The methods are called through a JavaScript proxy.
 */
class EmuApiImpl {
  /**
   * Sets the machine type and optional model/configuration.
   * @param _machineId The machine type ID.
   * @param _modelId Optional model ID.
   * @param _config Optional configuration object.
   */
  async setMachineType(
    _machineId: string,
    _modelId?: string,
    _config?: Record<string, any>
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR))
  }
}

export type EmuApi = EmuApiImpl;

export function createEmuApi(messenger: MessengerBase): EmuApiImpl {
  return buildMessagingProxy(new EmuApiImpl(), messenger, "emu");
}
