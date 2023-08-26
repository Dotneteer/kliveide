import { AppServices } from "@renderer/abstractions/AppServices";
import {
  RequestMessage,
  ResponseMessage,
  defaultResponse
} from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import {
  MEMORY_PANEL_ID,
  MEMORY_EDITOR,
  DISASSEMBLY_PANEL_ID,
  DISASSEMBLY_EDITOR,
  BASIC_PANEL_ID,
  BASIC_EDITOR
} from "@state/common-ids";
import { Store } from "@state/redux-light";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToIdeMessages (
  message: RequestMessage,
  store: Store<AppState>,
  { outputPaneService, ideCommandsService, projectService }: AppServices
): Promise<ResponseMessage> {
  const documentHubService = projectService.getActiveDocumentHubService();
  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it
      store.dispatch(message.action, message.sourceId);
      break;

    case "IdeDisplayOutput":
      // --- Display the output message
      const buffer = outputPaneService.getOutputPaneBuffer(message.pane);
      if (!buffer) break;
      buffer.resetStyle();
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
        documentHubService.openDocument(
          {
            id: MEMORY_PANEL_ID,
            name: "Machine Memory",
            type: MEMORY_EDITOR,
            viewVersion: 0
          },
          undefined,
          false
        );
      } else {
        documentHubService.closeDocument(MEMORY_PANEL_ID);
      }
      break;
    }

    case "IdeShowDisassembly": {
      if (message.show) {
        documentHubService.openDocument(
          {
            id: DISASSEMBLY_PANEL_ID,
            name: "Z80 Disassembly",
            type: DISASSEMBLY_EDITOR,
            viewVersion: 0
          },
          undefined,
          false
        );
      } else {
        documentHubService.closeDocument(DISASSEMBLY_PANEL_ID);
      }
      break;
    }

    case "IdeShowBasic": {
      if (message.show) {
        documentHubService.openDocument(
          {
            id: BASIC_PANEL_ID,
            name: "BASIC Listing",
            type: BASIC_EDITOR,
            viewVersion: 0
          },
          undefined,
          false
        );
      } else {
        documentHubService.closeDocument(BASIC_PANEL_ID);
      }
      break;
    }

    case "IdeExecuteCommand": {
      const pane = outputPaneService.getOutputPaneBuffer("build");
      const response = await ideCommandsService.executeCommand(message.commandText, pane);
      return {
        type: "IdeExecuteCommandResponse",
        success: response.success,
        finalMessage: response.finalMessage
      }
    }
  }
  return defaultResponse();
}
