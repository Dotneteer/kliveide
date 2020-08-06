import * as vscode from "vscode";
import {
  RendererMessage,
  GetMemoryContentsResponse,
  MainMessage,
  DefaultResponse,
} from "../custom-editors/messaging/message-types";
import { communicatorInstance } from "./communicator";

/**
 * This class processes messages on thw WevView side
 */
export class MessageProcessor {
  constructor(public readonly webView: vscode.Webview) {}

  /**
   * Processes the specified input message
   * @param message Input message
   */
  async processMessage(message: RendererMessage): Promise<void> {
    let response: MainMessage = <DefaultResponse>{
        type: "ack",
    };
    switch (message.type) {
      case "getMemoryContents":
        const memContents = await communicatorInstance.getMemory(
          message.from,
          message.to
        );
        response = <GetMemoryContentsResponse>{
          type: "ackGetMemoryContents",
          bytes: memContents
        };
        break;
    }
    response.correlationId = message.correlationId;
    this.webView.postMessage(response);
  }
}
