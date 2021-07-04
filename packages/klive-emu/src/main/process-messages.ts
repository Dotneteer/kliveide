import { dialog } from "electron";
import {
  DefaultResponse,
  OpenFileResponse,
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import { emuWindow } from "./app-menu-state";

/**
 * Processes the requests arriving from the emulator process
 * @param message to process
 * @returns Message response
 */
export async function processEmulatorRequest(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "openFileDialog":
      const result = await dialog.showOpenDialog(emuWindow.window, {
        title: message.title,
        filters: message.filters,
      });
      return <OpenFileResponse>{
        type: "openFileDialogResponse",
        filename: result.canceled ? undefined : result.filePaths[0],
      };
    default:
      return <DefaultResponse>{ type: "ack" };
  }
}
