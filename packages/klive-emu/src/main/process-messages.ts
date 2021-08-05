import * as path from "path";
import { promises as fs } from "fs";
import { dialog } from "electron";
import {
  DefaultResponse,
  DirectoryContent,
  EmuOpenFileDialogResponse,
  GetFolderContentsResponse,
  GetRegisteredMachinesResponse,
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import {
  emuForwarder,
  emuWindow,
  getRegisteredMachines,
} from "./app-menu-state";
import { flow } from "lodash";

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
    default:
      return await emuForwarder.sendMessage(message);
  }
}

/**
 * Gets the contents of the specified folder
 * @param folder Folder to query
 * @returns
 */
async function getFolderContents(folder: string): Promise<DirectoryContent> {
  // --- Contents of folders already queried
  const foldersRead = new Map<string, DirectoryContent>();
  return readFolders(folder);

  // --- Carries out reading the folder contents
  async function readFolders(
    name: string,
    depth = 0
  ): Promise<DirectoryContent> {
    const cached = foldersRead.get(name);
    if (cached) {
      return { ...cached };
    }

    const result: DirectoryContent = {
      name: path.basename(name),
      folders: [],
      files: [],
    };

    // --- Read folders
    try {
      const entries = await fs.readdir(name, { withFileTypes: true });
      for (var entry of entries) {
        if (entry.isDirectory()) {
          result.folders.push({
            name: entry.name,
            folders: [],
            files: [],
          });
        } else {
          result.files.push(entry.name);
        }
      }
    } catch {
      console.log(`Cannot read the contents of ${name}`);
    }

    // --- Now, recursively read folders
    for (var subfolder of result.folders) {
      const subcontents = await readFolders(
        path.join(name, subfolder.name),
        depth + 1
      );
      subfolder.folders = subcontents.folders;
      subfolder.files = subcontents.files;
    }
    return result;
  }
}
