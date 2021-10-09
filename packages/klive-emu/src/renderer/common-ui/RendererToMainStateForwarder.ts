import { IpcRendererEvent } from "electron";
import { KliveAction } from "@state/state-core";
import { IpcRendereApi } from "../../exposed-apis";
import {
  Channel,
  DefaultResponse,
  MessageSource,
  RequestMessage,
  ResponseMessage,
} from "@core/messaging/message-types";
import { MessengerBase } from "@core/messaging/MessengerBase";

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
  constructor(public readonly sourceId: MessageSource) {
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
    return (await this.sendMessage({
      type: "ForwardAction",
      action,
    })) as DefaultResponse;
  }

  /**
   * The channel to send the request out
   */
  get requestChannel(): Channel {
    return "MainStateRequest";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): Channel {
    return "RendererStateResponse";
  }
}
