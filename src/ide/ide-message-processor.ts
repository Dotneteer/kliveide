import { IpcRendererEvent } from "electron";
import { IpcRendereApi } from "../exposed-apis";

import {
  dispatch,
  getModalDialogService,
  getOutputPaneService,
} from "@core/service-registry";
import {
  DefaultResponse,
  NewProjectResponse,
  RequestMessage,
  ResponseMessage,
} from "@core/messaging/message-types";
import { ideSyncAction } from "@state/show-ide-reducer";
import { NEW_PROJECT_DIALOG_ID } from "./explorer-tools/NewProjectDialog";
import {
  BUILD_OUTPUT_PANE_ID,
  IHighlightable,
} from "@abstractions/output-pane-service";
import { isAssemblerError } from "@abstractions/compiler-registry";

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

    case "NewProject":
      const result = await getModalDialogService().showModalDialog(
        NEW_PROJECT_DIALOG_ID,
        {
          machineType: "",
          projectPath: "",
          projectName: "",
          open: true,
        }
      );
      return <NewProjectResponse>{
        type: "NewProjectResponse",
        project: result,
      };

    case "CompilerMessage":
      const outputPaneService = getOutputPaneService();
      const buildPane = outputPaneService.getPaneById(BUILD_OUTPUT_PANE_ID);
      const buffer = buildPane.buffer;
      const msgObj = message.message;
      buffer.color(message.isError ? "bright-red" : "bright-yellow");
      if (isAssemblerError(msgObj)) {
        buffer.write(msgObj.errorCode);
        buffer.resetColor();
        buffer.write(`: ${msgObj.message} `);
        buffer.color("cyan");
        const location =
          msgObj.startColumn === 0 && msgObj.endColumn === 0
            ? `${msgObj.fileName}:[${msgObj.line}]`
            : `${msgObj.fileName}:[${msgObj.line}:${msgObj.startColumn}-${msgObj.endColumn}]`;
        buffer.writeLine(location, <IHighlightable>{
          highlight: true,
          title: `Click to locate the error\n${msgObj.message}`,
          errorItem: msgObj,
        });
        buffer.resetColor();
      } else {
        buffer.writeLine(msgObj.toString());
      }
      return <DefaultResponse>{ type: "Ack" };

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
