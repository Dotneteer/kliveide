import path from "path";
import fs from "fs";
import _ from "lodash";

import type { ScriptStartInfo } from "@abstractions/ScriptStartInfo";
import type {
  MainCreateKliveProjectResponse,
  MainShowOpenFolderDialogResponse,
  MainShowOpenFileDialogResponse
} from "@messaging/any-to-main";
import type {
  KliveCompilerOutput,
  SimpleAssemblerOutput
} from "./compiler-integration/compiler-registry";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";

import { app, BrowserWindow, dialog, shell } from "electron";
import {
  defaultResponse,
  errorResponse,
  flagResponse,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
import { textContentsResponse, binaryContentsResponse } from "@messaging/any-to-main";
import { sendFromMainToEmu } from "@messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "@messaging/MainToIdeMessenger";
import {
  createKliveProject,
  getKliveProjectFolder,
  openFolder,
  openFolderByPath,
  resolveHomeFilePath,
  resolvePublicFilePath,
  resolveSavedFilePath,
  saveKliveProject
} from "./projects";
import { appSettings, saveAppSettings } from "./settings";
import { mainStore } from "./main-store";
import {
  applyProjectSettingAction,
  applyUserSettingAction,
  dimMenuAction,
  refreshExcludedProjectItemsAction,
  saveProjectSettingAction,
  saveUserSettingAction,
  setBuildRootAction
} from "@state/actions";
import { getCompiler } from "./compiler-integration/compiler-registry";
import { getDirectoryContent, getProjectDirectoryContentFilter } from "./directory-content";
import { KLIVE_GITHUB_PAGES } from "./app-menu";
import { checkZ88SlotFile } from "./machine-menus/z88-menus";
import { MEDIA_DISK_A, MEDIA_DISK_B, PROJECT_TEMPLATES } from "@common/structs/project-const";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { createDiskFile } from "@common/utils/create-disk-file";
import { mainScriptManager } from "./ksx-runner/MainScriptManager";
import { collectedBuildTasks } from "./build";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processRendererToMainMessages(
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
      const folderContent = await getDirectoryContent(message.directory, filter);
      return {
        type: "MainGetDirectoryContentResponse",
        contents: folderContent
      };

    case "MainGloballyExcludedProjectItems":
      return textContentsResponse(appSettings.excludedProjectItems?.join(path.delimiter));

    case "MainAddGloballyExcludedProjectItems": {
      const excludedItems = message.files.map((p) => p.trim().replace(path.sep, "/"));
      appSettings.excludedProjectItems = (
        appSettings.excludedProjectItems?.concat(excludedItems) ?? excludedItems
      ).filter((v, i, a) => a.indexOf(v) === i);
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
        const openError = await openFolderByPath(message.folder);
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
        message.modelId,
        message.templateId,
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
        message.filters,
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

    case "MainGetUserSettings":
      return {
        type: "MainGetSettingsResponse",
        settings: appSettings.userSettings ?? {}
      };

    case "MainGetProjectSettings":
      return {
        type: "MainGetSettingsResponse",
        settings: mainStore.getState()?.projectSettings ?? {}
      };

    case "MainApplyUserSettings":
      if (message.key) {
        appSettings.userSettings ??= {};
        if (message.value === undefined) {
          _.unset(appSettings.userSettings, message.key);
        } else {
          _.set(appSettings.userSettings, message.key, message.value);
        }
        saveAppSettings();
        dispatch(applyUserSettingAction(message.key, message.value));
      }
      break;

    case "MainApplyProjectSettings":
      if (message.key) {
        dispatch(applyProjectSettingAction(message.key, message.value));
        await saveKliveProject();
      }
      break;

    case "MainMoveSettings":
      if (message.pull) {
        // --- User --> Project
        let projSettings: Record<string, any> = {};
        if (message.copy) {
          projSettings = appSettings.userSettings ?? {};
        } else {
          projSettings = {
            ...(mainStore.getState()?.projectSettings ?? {}),
            ...(appSettings.userSettings ?? {})
          };
        }
        mainStore.dispatch(saveProjectSettingAction(projSettings));
        await saveKliveProject();
      } else {
        // --- Project --> User
        if (message.copy) {
          appSettings.userSettings = mainStore.getState()?.projectSettings ?? {};
        } else {
          appSettings.userSettings = {
            ...(appSettings.userSettings ?? {}),
            ...(mainStore.getState()?.projectSettings ?? {})
          };
          mainStore.dispatch(saveUserSettingAction({ ...appSettings.userSettings }));
          saveAppSettings();
        }
      }
      break;

    case "MainCompileFile":
      const compiler = getCompiler(message.language);
      try {
        const result = (await compiler.compileFile(
          message.filename,
          message.options
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

    case "MainShowWebsite":
      shell.openExternal(KLIVE_GITHUB_PAGES);
      break;

    case "MainCheckZ88Card":
      const cardResult = await checkZ88SlotFile(message.path, message.expectedSize);
      if (typeof cardResult === "string") {
        return {
          type: "MainCheckZ88CardResponse",
          message: cardResult
        };
      } else {
        return {
          type: "MainCheckZ88CardResponse",
          content: cardResult
        };
      }

    case "MainSaveDiskChanges":
      return saveDiskChanges(message.diskIndex, message.changes);

    case "MainCreateDiskFile":
      const diskCreated = createDiskFile(message.diskFolder, message.filename, message.diskType);
      return {
        type: "MainCreateDiskFileResponse",
        path: diskCreated
      };

    case "MainGetTemplateDirs":
      try {
        return {
          type: "MainGetTemplateDirsResponse",
          dirs: getTemplateDirs(message.machineId)
        };
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainStartScript": {
      let scriptInfo: ScriptStartInfo;
      if (message.scriptText) {
        // --- Script text specified, run as script text
        scriptInfo = await mainScriptManager.runScriptText(
          message.scriptText,
          message.scriptFunction,
          message.filename,
          message.speciality
        );
      } else {
        scriptInfo = await mainScriptManager.runScript(message.filename);
      }
      return {
        type: "MainRunScriptResponse",
        id: scriptInfo.id,
        target: scriptInfo.target,
        contents: scriptInfo.contents,
        hasParseError: scriptInfo.hasParseError
      };
    }

    case "MainStopScript":
      return flagResponse(await mainScriptManager.stopScript(message.idOrFilename));

    case "MainCloseScript":
      await mainScriptManager.closeScript(message.script);
      break;

    case "MainRemoveCompletedScripts":
      mainScriptManager.removeCompletedScripts();
      break;

    case "MainResolveModule":
      const resolvedModule = await mainScriptManager.resolveModule(
        message.mainFile,
        message.moduleName
      );
      return {
        type: "MainResolveModuleResponse",
        contents: resolvedModule
      };

    case "MainGetBuildFunctions":
      return {
        type: "MainGetBuildFunctionsResponse",
        functions: collectedBuildTasks.map((t) => t.id)
      };

    case "MainCheckBuildRoot":
      if (!mainStore.getState().project?.buildRoots) {
        break;
      }
      const buildRoots = mainStore.getState().project.buildRoots;
      if (buildRoots.includes(message.filename)) {
        buildRoots.splice(buildRoots.indexOf(message.filename), 1);
        dispatch(setBuildRootAction(buildRoots));
        await saveKliveProject();
      }
      break;

    case "IdeDisplayOutput":
    case "IdeExecuteCommand":
    case "IdeScriptOutput":
      // --- A client wants to display an output message
      return await sendFromMainToIde(message);

    // --- Forward these messages to the emulator
    case "EmuMachineCommand":
    case "EmuGetCpuState":
    case "EmuGetUlaState":
    case "EmuGetPsgState":
    case "EmuGetBlinkState":
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
    case "EmuStartScript":
    case "EmuStopScript":
    case "EmuGetNextRegDescriptors":
    case "EmuGetNextRegState":
    case "EmuGetNextMemoryMapping":
    case "EmuParsePartitionLabel":
    case "EmuGetPartitionLabels":  
    case "EmuGetCallStack":
      return await sendFromMainToEmu(message);
  }
  return defaultResponse();
}

/**
 * Sets the tape file to use with the machine
 * @param browserWindow Host browser window
 * @returns The data blocks read from the tape, if successful; otherwise, undefined.
 */
async function displayOpenFolderDialog(
  browserWindow: BrowserWindow,
  title?: string,
  settingsId?: string
): Promise<string> {
  const defaultPath = appSettings?.folders?.[settingsId ?? ""] || app.getPath("home");
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: title ?? "Open Folder",
    defaultPath,
    properties: ["openDirectory"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return null;

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
async function displayOpenFileDialog(
  browserWindow: BrowserWindow,
  title?: string,
  filters?: Electron.FileFilter[],
  settingsId?: string
): Promise<string> {
  const defaultPath = appSettings?.folders?.[settingsId ?? ""] || app.getPath("home");
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: title ?? "Open File",
    defaultPath,
    properties: ["openFile"],
    filters
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return null;

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

function resolveMessagePath(inputPath: string, resolveIn?: string): string {
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
      case "saveFolder":
        inputPath = resolveSavedFilePath(inputPath);
        break;
      default:
        inputPath = resolvePublicFilePath(inputPath);
        break;
    }
  }
  return inputPath;
}

// --- Save disk changes to their corresponding disk file
function saveDiskChanges(diskIndex: number, changes: SectorChanges): ResponseMessage {
  // --- Get the disk file from the store
  const diskFile = mainStore.getState().media?.[diskIndex ? MEDIA_DISK_B : MEDIA_DISK_A]?.diskFile;

  // --- The disk file must exist
  if (!diskFile) {
    return errorResponse(`No disk file found for disk ${diskIndex}`);
  }

  try {
    const contents = fs.readFileSync(diskFile);
    const diskInfo = readDiskData(contents);

    const handle = fs.openSync(diskFile, "r+");
    try {
      for (const change of changes.keys()) {
        const trackIndex = Math.floor(change / 100);
        const sectorIndex = change % 100;
        const track = diskInfo.tracks[trackIndex];
        const sector = track.sectors.find((s) => s.R === sectorIndex);
        if (!sector) {
          throw Error(`Sector with index #${sectorIndex} cannot be found on track #${trackIndex}`);
        }
        const data = changes.get(change);
        fs.writeSync(handle, data, 0, data.length, sector.sectorDataPosition);
      }
    } finally {
      fs.closeSync(handle);
    }
  } catch (err) {
    return errorResponse(`Saving disk changes failed: ${err.message}`);
  }

  // --- Done.
  return defaultResponse();
}

function getTemplateDirs(machineId: string): string[] {
  // --- Check if we have a template folder for the machine at all
  const templateFolder = path.join(resolvePublicFilePath(PROJECT_TEMPLATES), machineId);
  if (fs.existsSync(templateFolder) && !fs.statSync(templateFolder).isDirectory()) {
    return [];
  }

  // --- Ok, read the subfolders of the machine template folder
  return fs
    .readdirSync(templateFolder)
    .filter((f) => fs.statSync(path.join(templateFolder, f)).isDirectory());
}
