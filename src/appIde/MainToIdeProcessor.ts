import {
  defaultResponse,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
import { AppServices } from "./abstractions";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { DISASSEMBLY_EDITOR, DISASSEMBLY_PANEL_ID, MEMORY_EDITOR, MEMORY_PANEL_ID } from "@state/common-ids";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToIdeMessages (
  message: RequestMessage,
  store: Store<AppState>,
  ideToMain: MessengerBase,
  { outputPaneService, documentService }: AppServices
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
      if (message.backgroundColor !== undefined)
        buffer.backgroundColor(message.color);
      buffer.bold(message.bold ?? false);
      buffer.italic(message.italic ?? false);
      buffer.underline(message.underline ?? false);
      buffer.strikethru(message.strikeThru ?? false);
      if (message.writeLine) {
        buffer.writeLine(message.text, message.data, message.actionable);
      } else {
        buffer.write(message.text, message.data, message.actionable);
      }
      break;

      case "IdeShowMemory": {
        if (message.show) {
          documentService.openDocument(
            {
              id: MEMORY_PANEL_ID,
              name: "Machine Memory",
              type: MEMORY_EDITOR
            },
            false
          );
        } else {
          documentService.closeDocument(MEMORY_PANEL_ID);
        }
        break;
      }
  
    case "IdeShowDisassembly": {
      if (message.show) {
        documentService.openDocument(
          {
            id: DISASSEMBLY_PANEL_ID,
            name: "Z80 Disassembly",
            type: DISASSEMBLY_EDITOR
          },
          false
        );
      } else {
        documentService.closeDocument(DISASSEMBLY_PANEL_ID);
      }
      break;
    }
  }
  return defaultResponse();
}
