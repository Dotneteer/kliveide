import {
  Channel,
  RequestMessage,
  ResponseMessage
} from "@/common/messaging/messages-core";
import { MessengerBase } from "@/common/messaging/MessengerBase";
import { ipcRenderer, IpcRendererEvent } from "electron";
/**
 * Implements a messenger that send messages from the Emu to the Main process
 */
export class EmuToMainMessenger extends MessengerBase {
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
    message.sourceId = "emu";
    ipcRenderer?.send(this.requestChannel, Object.assign({}, message));
  }

  /**
   * The channel to send the request out
   */
  get requestChannel (): Channel {
    return "EmuToMain";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel (): Channel {
    return "EmuToMainResponse";
  }
}

/**
 * The singleton messenger instance
 */
//const emuToMainMessenger = new EmuToMainMessenger();

// /**
//  * Sends the specified message from the Emu process to Main
//  * @param message Message to send
//  * @returns Response
//  */
// export async function sendFromEmuToMain<TResp extends ResponseMessage> (
//   message: RequestMessage
// ): Promise<TResp> {
//   return await emuToMainMessenger.sendMessage(message);
// }
