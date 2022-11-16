import { Channel, RequestMessage, ResponseMessage } from "@messaging/message-types";
import { MessengerBase } from "@messaging/MessengerBase";
import { ipcRenderer, IpcRendererEvent } from "electron";
/**
 * Implements a messenger that forwards messages to the main
 * process
 */
class EmuToMainMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor() {
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
  protected send(message: RequestMessage): void {
    // ipcRenderer?.send(
    //   this.requestChannel,
    //   Object.assign({}, message)
    // );
  }

  /**
   * The channel to send the request out
   */
  get requestChannel(): Channel {
    return "EmuToMain";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): Channel {
    return "MainToEmu";
  }
}

/**
 * The singleton messenger instance
 */
export const emuToMainMessenger = new EmuToMainMessenger();
