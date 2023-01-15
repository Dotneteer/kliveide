import {
  defaultResponse,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
import { AppServices } from "./abstractions";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { writeFile } from "original-fs";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToIdeMessages (
  message: RequestMessage,
  store: Store<AppState>,
  ideToMain: MessengerBase,
  { outputPaneService }: AppServices
): Promise<ResponseMessage> {
  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it
      store.dispatch(message.action, message.sourceId);
      break;

    case "IdeDisplayOutput":
      // --- Display the output message
      const buffer = outputPaneService.getOutputPaneBuffer(message.pane);
      if (!buffer) break;
      buffer.resetColor();
      if (message.color !== undefined) buffer.color(message.color);
      if (message.backgroundColor !== undefined) buffer.backgroundColor(message.color);
      buffer.bold(message.bold ?? false);
      buffer.italic(message.italic ?? false);
      buffer.underline(message.underline ?? false);
      buffer.strikethru(message.strikeThru ?? false);
      if (message.writeLine) {
        buffer.writeLine(message.text, message.data, message.actionable)
      } else {
        buffer.write(message.text, message.data, message.actionable)
      }
      break;
  }
  return defaultResponse();
}
