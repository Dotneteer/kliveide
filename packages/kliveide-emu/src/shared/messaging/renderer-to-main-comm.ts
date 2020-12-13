import { ipcRenderer, IpcRendererEvent } from "electron";
import { RequestMessage, ResponseMessage } from "./message-types";
import {
  RENDERER_REQUEST_CHANNEL,
  MAIN_RESPONSE_CHANNEL,
} from "../utils/channel-ids";


// ============================================================================
// Methods for renderer process --> main process communication
/**
 * ID of the last message
 */
let rendererMessageSeqNo = 0;

/**
 * Message resolvers
 */
const rendererMessageResolvers = new Map<
  number,
  (msg?: ResponseMessage | PromiseLike<ResponseMessage>) => void
>();

/**
 * Process the results coming from the main process
 */
ipcRenderer.on(
  MAIN_RESPONSE_CHANNEL,
  (_ev: IpcRendererEvent, response: ResponseMessage) => {
    // --- Check for UI message
    const resolver = rendererMessageResolvers.get(response.correlationId);

    // --- Resolve the message
    if (resolver) {
      resolver(response);
      rendererMessageResolvers.delete(response.correlationId);
    }
  }
);

/**
 * Posts a message from the renderer to the main
 * @param message Message contents
 */
export function postMessageToMain(message: RequestMessage): void {
  ipcRenderer.send(RENDERER_REQUEST_CHANNEL, message);
}

/**
 * Sends an async message to the main process
 * @param message Message to send
 */
export async function sendMessageToMain<TMessage extends ResponseMessage>(
  message: RequestMessage
): Promise<TMessage> {
  message.correlationId = rendererMessageSeqNo++;
  const promise = new Promise<TMessage>((resolve) => {
    rendererMessageResolvers.set(message.correlationId, resolve);
  });
  postMessageToMain(message);
  return promise;
}
