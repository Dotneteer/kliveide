import { IpcRendererEvent } from "electron";
import { KliveAction } from "@state/state-core";
import { IpcRendereApi } from "../../exposed-apis";
import {
  MAIN_STATE_REQUEST_CHANNEL,
  RENDERER_STATE_RESPONSE_CHANNEL,
} from "@messaging/channels";
import {
  DefaultResponse,
  RequestMessage,
  ResponseMessage,
} from "@messaging/message-types";
import { MessengerBase } from "@messaging/MessengerBase";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = globalThis.window
  ? ((window as any).ipcRenderer as IpcRendereApi)
  : null;

/**
 * Implements a messenger that forwards renderer state to the main
 * process
 */
export class RendererToMainStateForwarder extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor(public readonly sourceId: string) {
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
      Object.assign({}, message, { sourceId: this.sourceId })
    );
  }

  /**
   * Forwards the specified application state to the renderer
   * @param state
   */
  async forwardAction(action: KliveAction): Promise<DefaultResponse> {
    return await this.sendMessage({
      type: "ForwardAction",
      action,
    }) as DefaultResponse;
  }

  /**
   * The channel to send the request out
   */
  get requestChannel(): string {
    return MAIN_STATE_REQUEST_CHANNEL;
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): string {
    return RENDERER_STATE_RESPONSE_CHANNEL;
  }
}
