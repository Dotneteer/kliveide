import { dialog } from "electron";
import {
  DefaultResponse,
  EmuOpenFileDialogResponse,
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import { emuForwarder, emuWindow } from "./app-menu-state";

/**
 * Processes the requests arriving from the emulator process
 * @param message to process
 * @returns Message response
 */
export async function processEmulatorRequest(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "EmuOpenFileDialog":
      const result = await dialog.showOpenDialog(emuWindow.window, {
        title: message.title,
        filters: message.filters,
      });
      return <EmuOpenFileDialogResponse>{
        type: "EmuOpenFileDialogResponse",
        filename: result.canceled ? undefined : result.filePaths[0],
      };

    case "ManageZ88Cards":
      const manageCardsStub = (emuWindow.machineContextProvider as any)?.[
        "insertOrRemoveCards"
      ].bind(emuWindow.machineContextProvider);
      if (manageCardsStub) {
        await manageCardsStub();
      }
      return <DefaultResponse>{ type: "Ack" };

    default:
      return <DefaultResponse>{ type: "Ack" };
  }
}

/**
 * Processes the requests arriving from the IDE process
 * @param message to process
 * @returns Message response
 */
 export async function processIdeRequest(
  message: RequestMessage
): Promise<ResponseMessage> {
  return await emuForwarder.sendMessage(message);
}
