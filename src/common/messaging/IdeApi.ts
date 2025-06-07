import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * This class defines the shape of the Ide process API that can be called from
 * the Emu and main processes. The methods are called through a JavaScript proxy.
 */
class IdeApiImpl {}

export type IdeApi = IdeApiImpl;

export function createIdeApi(messenger: MessengerBase): IdeApiImpl {
  return buildMessagingProxy(new IdeApiImpl(), messenger, "ide");
}
