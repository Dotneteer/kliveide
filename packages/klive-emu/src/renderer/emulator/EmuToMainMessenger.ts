import { IpcRendererEvent } from "electron";
import { IpcRendereApi } from "../../exposed-apis";
import {
  RequestMessage,
  ResponseMessage,
} from "../../shared/messaging/message-types";
import { MessengerBase } from "../../shared/messaging/MessengerBase";
import { EMU_TO_MAIN_REQUEST_CHANNEL, EMU_TO_MAIN_RESPONSE_CHANNEL } from "../../shared/messaging/channels";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = globalThis.window
  ? ((window as any).ipcRenderer as IpcRendereApi)
  : null;

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
    ipcRenderer?.send(
      this.requestChannel,
      Object.assign({}, message)
    );
  }

  /**
   * The channel to send the request out
   */
  get requestChannel(): string {
    return EMU_TO_MAIN_REQUEST_CHANNEL;
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): string {
    return EMU_TO_MAIN_RESPONSE_CHANNEL;
  }
}

/**
 * The singleton messenger instance
 */
export const emuToMainMessenger = new EmuToMainMessenger();
