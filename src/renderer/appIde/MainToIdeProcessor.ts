import { AppServices } from "@renderer/abstractions/AppServices";
import {
  RequestMessage,
  ResponseMessage,
  defaultResponse
} from "@messaging/messages-core";
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
import { dimMenuAction } from "@common/state/actions";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { PANE_ID_BUILD } from "@common/integration/constants";

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
        await documentHubService.openDocument(
          {
            id: MEMORY_PANEL_ID,
            name: "Machine Memory",
            type: MEMORY_EDITOR
          },
          undefined,
          false
        );
      } else {
        await documentHubService.closeDocument(MEMORY_PANEL_ID);
      }
      break;
    }

    case "IdeShowDisassembly": {
      if (message.show) {
        await documentHubService.openDocument(
          {
            id: DISASSEMBLY_PANEL_ID,
            name: "Z80 Disassembly",
            type: DISASSEMBLY_EDITOR
          },
          undefined,
          false
        );
      } else {
        await documentHubService.closeDocument(DISASSEMBLY_PANEL_ID);
      }
      break;
    }

    case "IdeShowBasic": {
      if (message.show) {
        await documentHubService.openDocument(
          {
            id: BASIC_PANEL_ID,
            name: "BASIC Listing",
            type: BASIC_EDITOR
          },
          undefined,
          false
        );
      } else {
        await documentHubService.closeDocument(BASIC_PANEL_ID);
      }
      break;
    }

    case "IdeExecuteCommand": {
      const pane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
      const response = await ideCommandsService.executeCommand(
        message.commandText,
        pane
      );
      return {
        type: "IdeExecuteCommandResponse",
        success: response.success,
        finalMessage: response.finalMessage
      };
    }

    case "IdeSaveAllBeforeQuit": {
      await saveAllBeforeQuit(store, projectService);
      break;
    }
  }
  return defaultResponse();
}

export async function saveAllBeforeQuit(store: Store<AppState>, projectService: IProjectService) : Promise<void> {
  let wasDimmed = store.getState().dimMenu;
  store.dispatch(dimMenuAction(true))
  try { await projectService.performAllDelayedSavesNow(); }
  finally { store.dispatch(dimMenuAction(wasDimmed)); }
}
