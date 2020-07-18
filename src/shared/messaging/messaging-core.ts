import { ipcRenderer, IpcRendererEvent } from "electron";
import { RendererMessage, MainMessage } from "./message-types";
import {
  RENDERER_MESSAGING_CHANNEL,
  MAIN_MESSAGING_CHANNEL,
} from "../utils/channel-ids";

/**
 * ID of the last message
 */
let messageSeqNo = 0;

/**
 * Message resolvers
 */
const messageResolvers = new Map<
  number,
  (msg?: MainMessage | PromiseLike<MainMessage>) => void
>();

/**
 * Process the results coming from the main process
 */
ipcRenderer.on(
  MAIN_MESSAGING_CHANNEL,
  (_ev: IpcRendererEvent, response: MainMessage) => {
    // --- Check for UI message
    const resolver = messageResolvers.get(response.correlationId);

    // --- Resolve the message
    if (resolver) {
      resolver(response);
      messageResolvers.delete(response.correlationId);
    }
  }
);

/**
 * Posts a message from the renderer to the main
 * @param message Message contents
 */
export function postMessageToMain(message: RendererMessage): void {
  ipcRenderer.send(RENDERER_MESSAGING_CHANNEL, message);
}

/**
 * Sends an async message to the main process
 * @param message Message to send
 */
export async function sendMessageToMain<TMessage extends MainMessage>(
  message: RendererMessage
): Promise<TMessage> {
  message.correlationId = messageSeqNo++;
  const promise = new Promise<TMessage>((resolve) => {
    messageResolvers.set(message.correlationId, resolve);
  });
  postMessageToMain(message);
  return promise;
}
