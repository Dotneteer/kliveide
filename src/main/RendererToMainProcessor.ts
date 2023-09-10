import * as path from "path";
import * as fs from "fs";

import { app, BrowserWindow, dialog, shell } from "electron";
import {
  defaultResponse,
  errorResponse,
  RequestMessage,
  ResponseMessage
} from "../common/messaging/messages-core";
import {
  textContentsResponse,
  binaryContentsResponse,
  MainCreateKliveProjectResponse,
  MainShowOpenFolderDialogResponse,
  MainShowOpenFileDialogResponse
} from "../common/messaging/any-to-main";
import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import {
  createKliveProject,
  getKliveProjectFolder,
  openFolder,
  openFolderByPath,
  resolveHomeFilePath,
  resolvePublicFilePath,
  saveKliveProject
} from "./projects";
import { appSettings, saveAppSettings } from "./settings";
import { mainStore } from "./main-store";
import {
  dimMenuAction,
  refreshExcludedProjectItemsAction
} from "../common/state/actions";
import {
  getCompiler,
  KliveCompilerOutput,
  SimpleAssemblerOutput
} from "./compiler-integration/compiler-registry";
import {
  getDirectoryContent,
  getProjectDirectoryContentFilter
} from "./directory-content";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processRendererToMainMessages (
  message: RequestMessage,
  window: BrowserWindow
): Promise<ResponseMessage> {
  const dispatch = mainStore.dispatch;
  switch (message.type) {
    case "MainReadTextFile":
      // --- A client want to read the contents of a text file
      try {
        const fullPath = resolveMessagePath(message.path, message.resolveIn);
        const contents = fs.readFileSync(fullPath, {
          encoding: (message.encoding ?? "utf8") as BufferEncoding
        });
        return textContentsResponse(contents);
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainReadBinaryFile":
      // --- A client want to read the contents of a binary file
      try {
        const fullPath = resolveMessagePath(message.path, message.resolveIn);
        const contents = fs.readFileSync(fullPath);
        return binaryContentsResponse(contents);
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainDisplayMessageBox":
      // --- A client wants to display an error message.
      // --- We intentionally do not wait for confirmation.
      dispatch(dimMenuAction(true));
      try {
        await dialog.showMessageBox(window, {
          type: message.messageType ?? "none",
          title: message.title,
          message: message.message
        });
      } finally {
        dispatch(dimMenuAction(false));
      }
      break;

    case "MainGetDirectoryContent":
      const filter = await getProjectDirectoryContentFilter();
      const folderContent = await getDirectoryContent(
        message.directory, filter);
      return {
        type: "MainGetDirectoryContentResponse",
        contents: folderContent
      };

    case "MainGloballyExcludedProjectItems":
      return textContentsResponse(appSettings.excludedProjectItems?.join(path.delimiter));

    case "MainAddGloballyExcludedProjectItems": {
      const excludedItems = message.files.map(p => p.trim().replace(path.sep, "/"));
      appSettings.excludedProjectItems = (
          appSettings.excludedProjectItems?.concat(excludedItems)
            ?? excludedItems
        ).filter((v,i,a) => a.indexOf(v) === i)
      mainStore.dispatch(refreshExcludedProjectItemsAction());
      return textContentsResponse(appSettings.excludedProjectItems.join(path.delimiter));
    }

    case "MainSetGloballyExcludedProjectItems": {
      appSettings.excludedProjectItems = message.files;
      mainStore.dispatch(refreshExcludedProjectItemsAction());
      return textContentsResponse(appSettings.excludedProjectItems?.join(path.delimiter));
    }

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
      const createFolderResponse = await createKliveProject(
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

    case "MainShowOpenFolderDialog": {
      const selectedFolder = await displayOpenFolderDialog(
        window,
        message.title,
        message.settingsId
      );
      return {
        type: "MainShowOpenFolderDialogResponse",
        folder: selectedFolder
      } as MainShowOpenFolderDialogResponse;
    }

    case "MainShowOpenFileDialog":
      const selectedFile = await displayOpenFileDialog(
        window,
        message.title,
        message.settingsId
      );
      return {
        type: "MainShowOpenFileDialogResponse",
        file: selectedFile
      } as MainShowOpenFileDialogResponse;

    case "MainSaveTextFile":
      try {
        const filePath = resolveMessagePath(message.path, message.resolveIn);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, message.data, { flag: "w" });
        return {
          type: "MainSaveFileResponse",
          path: filePath
        };
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainSaveBinaryFile":
      try {
        //throw new Error("Fake Error");
        const filePath = resolveMessagePath(message.path, message.resolveIn);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, message.data, { flag: "w" });
        return {
          type: "MainSaveFileResponse",
          path: filePath
        };
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainSaveProject":
      await saveKliveProject();
      break;

    case "MainSaveSettings":
      saveAppSettings();
      break;

    case "MainCompileFile":
      const compiler = getCompiler(message.language);
      try {
        const result = (await compiler.compileFile(
          message.filename
        )) as KliveCompilerOutput;
        return {
          type: "MainCompileFileResponse",
          result,
          failed: (result as SimpleAssemblerOutput).failed
        };
      } catch (err) {
        return {
          type: "MainCompileFileResponse",
          result: { errors: [] },
          failed: err.toString()
        };
      }

    case "MainShowItemInFolder":
      shell.showItemInFolder(path.normalize(message.itemPath));
      break;

    case "MainExitApp":
      app.quit();
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
    case "EmuGetPsgState":
    case "EmuEraseAllBreakpoints":
    case "EmuListBreakpoints":
    case "EmuSetBreakpoint":
    case "EmuRemoveBreakpoint":
    case "EmuEnableBreakpoint":
    case "EmuGetMemory":
    case "EmuGetSysVars":
    case "EmuInjectCode":
    case "EmuRunCode":
    case "EmuResolveBreakpoints":
    case "EmuScrollBreakpoints":
    case "EmuNormalizeBreakpoints":
    case "EmuGetNecUpd765State":
      return await sendFromMainToEmu(message);
  }
  return defaultResponse();
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

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function displayOpenFileDialog (
  browserWindow: BrowserWindow,
  title?: string,
  settingsId?: string
): Promise<string> {
  const defaultPath =
    appSettings?.folders?.[settingsId ?? ""] || app.getPath("home");
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: title ?? "Open File",
    defaultPath,
    properties: ["openFile"],
    filters: [
      { name: "Tape files", extensions: ["tap", "tzx"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Read the file
  const selectedFile = dialogResult.filePaths[0];

  // --- Save the folder into settings
  if (settingsId) {
    appSettings.folders ??= {};
    appSettings.folders[settingsId] = selectedFile;
    saveAppSettings();
  }

  return selectedFile;
}

function resolveMessagePath (inputPath: string, resolveIn?: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;

  const segments = resolveIn?.split(":");
  if (!segments || segments.length === 0) {
    inputPath = resolvePublicFilePath(inputPath);
  } else {
    if (segments.length > 1) inputPath = path.join(segments[1], inputPath);
    switch (segments[0]) {
      case "home":
        inputPath = resolveHomeFilePath(inputPath);
        break;
      case "project":
        inputPath = getKliveProjectFolder(inputPath);
        break;
      default:
        inputPath = resolvePublicFilePath(inputPath);
        break;
    }
  }
  return inputPath;
}
