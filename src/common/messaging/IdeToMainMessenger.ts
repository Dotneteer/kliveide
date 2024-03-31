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
    message.sourceId = "ide";
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
