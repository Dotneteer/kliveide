import { dialog } from "electron";

import * as Messages from "@messaging/message-types";
import { emuWindow } from "../app/emu-window";

/**
 * Processes the requests arriving from the emulator process
 * @param message to process
 * @returns Message response
 */
export async function processEmulatorRequest(
  message: Messages.RequestMessage
): Promise<Messages.ResponseMessage> {
  switch (message.type) {
    case "EmuOpenFileDialog":
      const result = await dialog.showOpenDialog(emuWindow.window, {
        title: message.title,
        filters: message.filters,
      });
      return <Messages.EmuOpenFileDialogResponse>{
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
      return Messages.defaultResponse();

    default:
      return Messages.defaultResponse();
  }
}
