import type { Channel, FloatSource, RequestMessage, ResponseMessage } from "@messaging/messages-core";

import { MessengerBase } from "@messaging/MessengerBase";

const ipcRenderer = (window as any).electron?.ipcRenderer;

/**
 * Implements a messenger that sends messages from a floating document window to the main process
 * (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.2). Every floating window uses the same channel;
 * main tells them apart by the sender, and answers the `WebContents` that asked.
 */
export class FloatToMainMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   * @param source The message source of this floating window (`float<slot>`)
   */
  constructor(public readonly source: FloatSource) {
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
    message.sourceId = this.source;
    ipcRenderer?.send(this.requestChannel, Object.assign({}, message));
  }

  /**
   * The channel to send the request out
   */
  get requestChannel(): Channel {
    return "FloatToMain";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): Channel {
    return "FloatToMainResponse";
  }
}
