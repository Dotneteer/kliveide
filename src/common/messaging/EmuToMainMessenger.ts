import type { Channel, RequestMessage, ResponseMessage } from "@messaging/messages-core";

import { MessengerBase } from "@messaging/MessengerBase";

const ipcRenderer = window.electron.ipcRenderer;

/**
 * Implements a messenger that send messages from the Emu to the Main process
 */
export class EmuToMainMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor() {
    super();
    ipcRenderer?.on(this.responseChannel, (_ev: any, response: ResponseMessage) =>
      this.processResponse(response)
    );
  }

  /**
   * Sends out the message
   * @param message Message to send
   */
  protected send(message: RequestMessage): void {
    message.sourceId = "emu";
    ipcRenderer?.send(this.requestChannel, Object.assign({}, message));
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
    return "EmuToMainResponse";
  }
}
