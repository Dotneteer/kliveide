import {
  Channel,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { ipcRenderer, IpcRendererEvent } from "electron";

/**
 * Implements a messenger that send messages from the Ide to the Main process
 */
export class IdeToMainMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor () {
    super();
    ipcRenderer?.on(
      this.responseChannel,
      (_ev: IpcRendererEvent, response: ResponseMessage) =>
        this.processResponse(response)
    );
  }

  /**
   * Sends out the message
   * @param message Message to send
   */
  protected send (message: RequestMessage): void {
    ipcRenderer?.send(this.requestChannel, Object.assign({}, message));
  }

  /**
   * The channel to send the request out
   */
  get requestChannel (): Channel {
    return "IdeToMain";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel (): Channel {
    return "IdeToMainResponse";
  }
}

/**
 * The singleton messenger instance
 */
//const ideToMainMessenger = new IdeToMainMessenger();

/**
 * Sends the specified message from the Emu process to Main
 * @param message Message to send
 * @returns Response
 */
// export async function sendFromIdeToMain<TResp extends ResponseMessage> (
//   message: RequestMessage
// ): Promise<TResp> {
//   return await ideToMainMessenger.sendMessage(message);
// }
