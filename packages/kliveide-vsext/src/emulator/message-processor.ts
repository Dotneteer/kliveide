import * as vscode from "vscode";
import {
  RendererMessage,
  GetMemoryContentsResponse,
  MainMessage,
  DefaultResponse,
  GetExecutionStateResponse,
  ErrorResponse,
  GetRomPageResponse,
  GetBankPageResponse,
} from "../custom-editors/messaging/message-types";
import { communicatorInstance } from "./communicator";
import { getLastConnectedState, getLastExecutionState } from "./notifier";

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
    try {
      switch (message.type) {
        case "getMemoryContents":
          const memContents = await communicatorInstance.getMemory();
          response = <GetMemoryContentsResponse>{
            type: "ackGetMemoryContents",
            bytes: memContents,
          };
          break;

        case "getExecutionState":
          const connected = getLastConnectedState();
          const execState = getLastExecutionState();
          response = <GetExecutionStateResponse>{
            type: "ackGetExecutionState",
            state: connected ? execState.state : "disconnected",
          };
          break;

        case "getRomPage":
          const romContents = await communicatorInstance.getRomPage(
            message.page
          );
          response = <GetRomPageResponse>{
            type: "ackGetRomPage",
            bytes: romContents,
          };
          break;

        case "getBankPage":
          const bankContents = await communicatorInstance.getBankPage(
            message.page
          );
          response = <GetBankPageResponse>{
            type: "ackGetBankPage",
            bytes: bankContents,
          };
          break;
      }
    } catch (err) {
      response = <ErrorResponse>{
        type: "error",
        errorMessage: err.toString(),
      };
    }
    response.correlationId = message.correlationId;
    this.webView.postMessage(response);
  }
}
