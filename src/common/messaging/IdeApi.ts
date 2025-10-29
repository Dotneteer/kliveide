import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * Abstract base class defining the shape of the IDE process API that can be called from
 * the Emu and main processes. The methods are called through a JavaScript proxy and must
 * be implemented by a proxy handler. Do not instantiate directly.
 */
abstract class IdeApiImpl {
  /**
   * Sends script output to the IDE.
   * @param _id Script ID.
   * @param _operation Buffer operation to perform.
   * @param _args Optional arguments for the operation.
   */
  async scriptOutput(_id: number, _operation: any, _args?: any[]): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

}

// Internal concrete subclass for proxy instantiation
class ProxyIdeApiImpl extends IdeApiImpl {}

export type IdeApi = IdeApiImpl;

export function createIdeApi(messenger: MessengerBase): IdeApiImpl {
  return buildMessagingProxy(new ProxyIdeApiImpl(), messenger, "ide");
}
