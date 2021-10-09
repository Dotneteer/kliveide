import { dispatch, getModalDialogService } from "@core/service-registry";

import {
  DefaultResponse,
  NewProjectResponse,
  RequestMessage,
  ResponseMessage,
} from "@core/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import { IpcRendererEvent } from "electron";
import { ideSyncAction } from "@state/show-ide-reducer";
import { NEW_PROJECT_DIALOG_ID } from "./explorer-tools/NewProjectDialog";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

/**
 * Processes the messages arriving from the main process
 * @param message
 */
async function processIdeMessages(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "SyncMainState":
      dispatch(ideSyncAction(message.mainState));
      return <DefaultResponse>{ type: "Ack" };

    case "NewProjectRequest":
      const result = await getModalDialogService().showModalDialog(
        NEW_PROJECT_DIALOG_ID,
        {
          machineType: "",
          projectPath: "",
          projectName: "",
          open: true,
        }
      );
      return <NewProjectResponse>{ type: "NewProjectResponse", project: result };

    default:
      return <DefaultResponse>{ type: "Ack" };
  }
}

// --- Set up message processing
ipcRenderer.on(
  "MainToIdeRequest",
  async (_ev: IpcRendererEvent, message: RequestMessage) => {
    const response = await processIdeMessages(message);
    response.correlationId = message.correlationId;
    ipcRenderer.send("MainToIdeResponse", response);
  }
);
