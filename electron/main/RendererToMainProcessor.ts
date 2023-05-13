import {
  defaultResponse,
  errorResponse,
  RequestMessage,
  ResponseMessage
} from "../../common/messaging/messages-core";
import * as path from "path";
import * as fs from "fs";
import { app, BrowserWindow, dialog, } from "electron";
import {
  textContentsResponse,
  binaryContentsResponse,
  MainCreateKliveProjectResponse,
  MainShowOpenFolderDialogResponse
} from "../../common/messaging/any-to-main";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";
import { ProjectNodeWithChildren } from "@/appIde/project/project-node";
import { createKliveProject, openFolder, openFolderByPath, resolvePublicFilePath, saveKliveProject } from "./projects";
import { appSettings, saveAppSettings } from "./settings";
import { mainStore } from "./main-store";
import { dimMenuAction } from "../../common/state/actions";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processRendererToMainMessages (
  message: RequestMessage,
  window: BrowserWindow
): Promise<ResponseMessage> {
  switch (message.type) {
    case "MainReadTextFile":
      // --- A client want to read the contents of a text file
      try {
        const contents = fs.readFileSync(resolvePublicFilePath(message.path), {
          encoding: (message.encoding ?? "utf8") as BufferEncoding
        });
        return textContentsResponse(contents);
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainReadBinaryFile":
      // --- A client want to read the contents of a binary file
      try {
        const contents = fs.readFileSync(resolvePublicFilePath(message.path));
        return binaryContentsResponse(contents);
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainDisplayMessageBox":
      // --- A client wants to display an error message.
      // --- We intentionally do not wait for confirmation.
      mainStore.dispatch(dimMenuAction(true));
      try {
        await dialog.showMessageBox(window, {
          type: message.messageType ?? "none",
          title: message.title,
          message: message.message
        });
      } finally {
        mainStore.dispatch(dimMenuAction(false));
      }
      break;

    case "MainGetDirectoryContent":
      const folderContent = await getDirectoryContent(message.directory);
      return {
        type: "MainGetDirectoryContentResponse",
        contents: folderContent
      };

    case "MainOpenFolder":
      if (message.folder) {
        const openError = openFolderByPath(message.folder);
        if (openError) {
          return errorResponse(openError);
        }
      } else {
        openFolder(window);
      }
      break;

    case "MainCreateKliveProject":
      const createFolderResponse = createKliveProject(
        message.machineId,
        message.projectName,
        message.projectFolder
      );
      return {
        type: "MainCreateKliveProjectResponse",
        path: createFolderResponse.path,
        errorMessage: createFolderResponse.errorMessage
      } as MainCreateKliveProjectResponse;

    case "MainRenameFileEntry":
      try {
        fs.renameSync(message.oldName, message.newName);
        break;
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainDeleteFileEntry":
      try {
        if (message.isFolder) {
          fs.rmdirSync(message.name, { recursive: true });
        } else {
          fs.unlinkSync(message.name);
        }
        break;
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainAddNewFileEntry":
      const newItemName = path.join(message.folder, message.name);
      if (fs.existsSync(newItemName)) {
        return errorResponse(`${newItemName} already exists`);
      }
      try {
        if (message.isFolder) {
          fs.mkdirSync(newItemName);
        } else {
          fs.closeSync(fs.openSync(newItemName, "w"));
        }
        break;
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainShowOpenFolderDialog":
      const selectedFolder = await displayOpenFolderDialog(
        window,
        message.title,
        message.settingsId
      );
      return {
        type: "MainShowOpenFolderDialogResponse",
        folder: selectedFolder
      } as MainShowOpenFolderDialogResponse;

    case "MainSaveTextFile":
      try {
        fs.writeFileSync(message.path, message.data);
        break;
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainSaveProject":
      await saveKliveProject();
      break;

    case "EmuMachineCommand":
      // --- A client wants to send a machine command (start, pause, stop, etc.)
      // --- Send this message to the emulator
      return await sendFromMainToEmu(message);

    case "IdeDisplayOutput":
      // --- A client wants to display an output message
      return await sendFromMainToIde(message);

    // --- Forward these messages to the emulator
    case "EmuGetCpuState":
    case "EmuGetUlaState":
    case "EmuEraseAllBreakpoints":
    case "EmuListBreakpoints":
    case "EmuSetBreakpoint":
    case "EmuRemoveBreakpoint":
    case "EmuEnableBreakpoint":
    case "EmuGetMemory":
    case "EmuGetSysVars":
      return sendFromMainToEmu(message);
  }
  return defaultResponse();
}

/**
 * Gets the contents of the specified directory
 * @param root
 */
async function getDirectoryContent (
  root: string
): Promise<ProjectNodeWithChildren> {
  if (!path.isAbsolute(root)) {
    root = path.join(app.getPath("home"), root);
  }

  let fileEntryCount = 0;
  const folderSegments = root.replace("\\", "/").split("/");
  const lastFolder =
    folderSegments.length > 0
      ? folderSegments[folderSegments.length - 1]
      : root;
  return getFileEntryInfo(root, lastFolder);

  function getFileEntryInfo (
    entryPath: string,
    name: string
  ): ProjectNodeWithChildren {
    // --- Store the root node information
    const fileEntryInfo = fs.statSync(entryPath);
    const entry: ProjectNodeWithChildren = {
      isFolder: false,
      name,
      fullPath: entryPath,
      children: []
    };
    if (fileEntryInfo.isFile()) {
      fileEntryCount++;
      return entry;
    }
    if (fileEntryInfo.isDirectory()) {
      entry.isFolder = true;
      const names = fs.readdirSync(entryPath);
      for (const name of names) {
        if (fileEntryCount++ > 10240) break;
        entry.children.push(getFileEntryInfo(path.join(entryPath, name), name));
      }
      return entry;
    }
  }
}

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function displayOpenFolderDialog (
  browserWindow: BrowserWindow,
  title?: string,
  settingsId?: string
): Promise<string> {
  const defaultPath =
    appSettings?.folders?.[settingsId ?? ""] || app.getPath("home");
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: title ?? "Open Folder",
    defaultPath,
    properties: ["openDirectory"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  const selectedFolder = dialogResult.filePaths[0];

  // --- Save the folder into settings
  if (settingsId) {
    appSettings.folders ??= {};
    appSettings.folders[settingsId] = selectedFolder;
    saveAppSettings();
  }

  return selectedFolder;
}
