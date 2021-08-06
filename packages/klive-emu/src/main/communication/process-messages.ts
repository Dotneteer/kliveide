import { dialog } from "electron";
import { getRegisteredMachines } from "../../extensibility/main/machine-registry";
import {
  CreateKliveProjectResponse,
  DefaultResponse,
  EmuOpenFileDialogResponse,
  GetFolderContentsResponse,
  GetRegisteredMachinesResponse,
  RequestMessage,
  ResponseMessage,
} from "../../shared/messaging/message-types";
import { emuForwarder, emuWindow } from "../app/app-menu";
import { createKliveProject, getFolderContents } from "../utils/file-utils";

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
  switch (message.type) {
    case "GetFolderContents":
      return <GetFolderContentsResponse>{
        type: "GetFolderResponse",
        contents: await getFolderContents(message.folder),
      };

    case "GetRegisteredMachines":
      return <GetRegisteredMachinesResponse>{
        type: "GetRegisteredMachinesResponse",
        machines: getRegisteredMachines(),
      };

    case "CreateKliveProject":
      const operation = await createKliveProject(
        message.machineType,
        message.rootFolder,
        message.projectFolder
      );
      return <CreateKliveProjectResponse>{
        type: "CreateKliveProjectResponse",
        error: operation.error,
        targetFolder: operation.targetFolder
      };

    default:
      // --- If the main does not recofnize a request, it forwards it to Emu
      return await emuForwarder.sendMessage(message);
  }
}
