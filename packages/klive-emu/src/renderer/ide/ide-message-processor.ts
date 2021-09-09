import {
  DefaultResponse,
  RequestMessage,
  ResponseMessage,
} from "../../shared/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import { MAIN_TO_IDE_REQUEST_CHANNEL } from "../../shared/messaging/channels";
import { MAIN_TO_IDE_RESPONE_CHANNEL } from "../../shared/messaging/channels";
import { IpcRendererEvent } from "electron";
import { ideStore } from "./ideStore";
import { ideSyncAction } from "../../shared/state/show-ide-reducer";
import { modalDialogService } from "../common-ui/modal-service";
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
      ideStore.dispatch(ideSyncAction(message.mainState));
      return <DefaultResponse>{ type: "Ack" };

    case "NewProjectRequest":
      const result = await modalDialogService.showModalDialog(
        NEW_PROJECT_DIALOG_ID,
        {
          machineType: "",
          projectPath: "",
          projectName: "",
          open: true,
        }
      );
      return <DefaultResponse>{ type: "Ack" };

    default:
      return <DefaultResponse>{ type: "Ack" };
  }
}

// --- Set up message processing
ipcRenderer.on(
  MAIN_TO_IDE_REQUEST_CHANNEL,
  async (_ev: IpcRendererEvent, message: RequestMessage) => {
    const response = await processIdeMessages(message);
    response.correlationId = message.correlationId;
    ipcRenderer.send(MAIN_TO_IDE_RESPONE_CHANNEL, response);
  }
);
