import { IpcRendererEvent } from "electron";
import { IpcRendereApi } from "../../exposed-apis";
import {
  Channel,
  RequestMessage,
  ResponseMessage,
} from "@messaging/message-types";
import { MessengerBase } from "@messaging/MessengerBase";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = globalThis.window
  ? ((window as any).ipcRenderer as IpcRendereApi)
  : null;

/**
 * Implements a messenger that forwards IDE messages to the main
 * process
 */
export class IdeToEmuMessenger extends MessengerBase {
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
    ipcRenderer?.send(this.requestChannel, Object.assign({}, message));
  }

  /**
   * The channel to send the request out
   */
  get requestChannel(): Channel {
    return "IdeToEmuMainRequest";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): Channel {
    return "IdeToEmuMainResponse";
  }
}
