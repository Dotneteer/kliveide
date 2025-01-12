import path from "path";
import fs from "fs";
import _ from "lodash";

import type { ScriptStartInfo } from "@abstractions/ScriptStartInfo";
import type { KliveCompilerOutput } from "./compiler-integration/compiler-registry";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";

import { app, BrowserWindow, dialog, shell } from "electron";
import {
  defaultResponse,
  errorResponse,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
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
import { Dispatch } from "react";
import { Action } from "@common/state/Action";

class MainMessageProcessor {
  constructor(
    private readonly window: BrowserWindow,
    private readonly dispatch: Dispatch<Action>
  ) {}

  readTextFile(...args: any[]) {
    const fullPath = resolveMessagePath(args[0], args[2]);
    return fs.readFileSync(fullPath, {
      encoding: (args[1] ?? "utf8") as BufferEncoding
    });
  }

  readBinaryFile(...args: any[]) {
    const fullPath = resolveMessagePath(args[0], args[1]);
    return new Uint8Array(fs.readFileSync(fullPath));
  }

  async displayMessageBox(...args: any[]) {
    try {
      await dialog.showMessageBox(this.window, {
        type: args[0] ?? "none",
        title: args[1],
        message: args[2]
      });
    } finally {
      this.dispatch(dimMenuAction(false));
    }
  }

  showOpenFolderDialog(...args: any[]) {
    return displayOpenFolderDialog(this.window, args[0]);
  }

  showOpenFileDialog(...args: any[]) {
    return displayOpenFileDialog(this.window, args[0], args[1]);
  }

  createDiskFile(...args: any[]) {
    return createDiskFile(args[0], args[1], args[2]);
  }

  async getDirectoryContent(...args: any[]) {
    const filter = await getProjectDirectoryContentFilter();
    return await getDirectoryContent(args[0], filter);
  }

  async openFolder(...args: any[]): Promise<string | null> {
    if (args[0]) {
      const errorMessage = await openFolderByPath(args[0]);
      if (errorMessage) {
        return errorMessage;
      }
    } else {
      openFolder(this.window);
    }
    return null;
  }

  async createKliveProject(...args: any[]): Promise<string> {
    const createFolderResponse = await createKliveProject(
      args[0],
      args[3],
      args[4],
      args[1],
      args[2]
    );
    if (createFolderResponse.errorMessage) {
      throw new Error(createFolderResponse.errorMessage);
    }
    return createFolderResponse.path;
  }

  async checkZ88Card(...args: any[]): Promise<{ message?: string; content?: Uint8Array }> {
    const cardResult = await checkZ88SlotFile(args[0], args[1]);
    if (typeof cardResult === "string") {
      return {
        message: cardResult
      };
    } else {
      return {
        content: cardResult
      };
    }
  }

  getGloballyExcludedProjectItems() {
    return appSettings.excludedProjectItems?.join(path.delimiter);
  }

  addGlobalExcludedProjectItem(...args: any[]) {
    const excludedItems = args[0].map((p: any) => p.trim().replace(path.sep, "/"));
    appSettings.excludedProjectItems = (
      appSettings.excludedProjectItems?.concat(excludedItems) ?? excludedItems
    ).filter((v: any, i: any, a: string | any[]) => a.indexOf(v) === i);
    this.dispatch(refreshExcludedProjectItemsAction());
    return appSettings.excludedProjectItems.join(path.delimiter);
  }

  setGloballyExcludedProjectItems(...args: any[]) {
    appSettings.excludedProjectItems = args[0];
    this.dispatch(refreshExcludedProjectItemsAction());
    return appSettings.excludedProjectItems?.join(path.delimiter);
  }

  deleteFileEntry(...args: any[]) {
    if (args[0]) {
      fs.rmdirSync(args[1], { recursive: true });
    } else {
      fs.unlinkSync(args[1]);
    }
  }

  async addNewFileEntry(...args: any[]): Promise<void> {
    const newItemName = path.join(args[2], args[0]);
    if (fs.existsSync(newItemName)) {
      throw new Error(`${newItemName} already exists`);
    }
    if (args[1]) {
      fs.mkdirSync(newItemName);
    } else {
      fs.closeSync(fs.openSync(newItemName, "w"));
    }
  }

  renameFileEntry(...args: any[]) {
    fs.renameSync(args[0], args[1]);
  }

  saveTextFile(...args: any[]) {
    const filePath = resolveMessagePath(args[0], args[2]);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, args[1], { flag: "w" });
    return filePath;
  }

  saveBinaryFile(...args: any[]) {
    const filePath = resolveMessagePath(args[0], args[2]);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, args[1], { flag: "w" });
    return filePath;
  }

  saveProject() {
    saveKliveProject();
  }

  saveSettings() {
    saveAppSettings();
  }

  getUserSettings() {
    return appSettings.userSettings ?? {};
  }

  getProjectSettings() {
    return mainStore.getState().projectSettings ?? {};
  }

  applyUserSettings(...args: any[]) {
    if (args[0]) {
      appSettings.userSettings ??= {};
      if (args[1] === undefined) {
        _.unset(appSettings.userSettings, args[0]);
      } else {
        _.set(appSettings.userSettings, args[0], args[1]);
      }
      saveAppSettings();
    }
  }

  applyProjectSettings(...args: any[]) {
    if (args[0]) {
      this.dispatch(applyProjectSettingAction(args[0], args[1]));
      saveKliveProject();
    }
  }

  async moveSettings(...args: any[]) {
    if (args[0]) {
      // --- User --> Project
      let projSettings: Record<string, any> = {};
      if (args[1]) {
        projSettings = appSettings.userSettings ?? {};
      } else {
        projSettings = {
          ...(mainStore.getState()?.projectSettings ?? {}),
          ...(appSettings.userSettings ?? {})
        };
      }
      this.dispatch(saveProjectSettingAction(projSettings));
      await saveKliveProject();
    } else {
      // --- Project --> User
      if (args[1]) {
        appSettings.userSettings = mainStore.getState()?.projectSettings ?? {};
      } else {
        appSettings.userSettings = {
          ...(appSettings.userSettings ?? {}),
          ...(mainStore.getState()?.projectSettings ?? {})
        };
        this.dispatch(saveUserSettingAction({ ...appSettings.userSettings }));
        saveAppSettings();
      }
    }
  }

  async compileFile(...args: any[]) {
    const compiler = getCompiler(args[1]);
    return (await compiler.compileFile(args[0], args[2])) as KliveCompilerOutput;
  }

  async showItemInFolder(...args: any[]) {
    shell.showItemInFolder(path.normalize(args[0]));
  }

  async exitApp() {
    app.quit();
  }

  async showWebsite() {
    shell.openExternal(KLIVE_GITHUB_PAGES);
  }

  async saveDiskChanges(...args: any[]) {
    return saveDiskChanges(args[0], args[1]);
  }

  async getTemplateDirectories(...args: any[]) {
    return getTemplateDirs(args[0]);
  }

  async startScript(...args: any[]) {
    let scriptInfo: ScriptStartInfo;
    if (args[2]) {
      // --- Script text specified, run as script text
      scriptInfo = await mainScriptManager.runScriptText(args[2], args[1], args[0], args[3]);
    } else {
      scriptInfo = await mainScriptManager.runScript(args[0]);
    }
    return scriptInfo;
  }

  stopScript(...args: any[]) {
    mainScriptManager.stopScript(args[0]);
  }

  async closeScript(...args: any[]) {
    await mainScriptManager.closeScript(args[0]);
  }

  removeCompletedScripts() {
    mainScriptManager.removeCompletedScripts();
  }

  resolveModule(...args: any[]) {
    return mainScriptManager.resolveModule(args[0], args[1]);
  }

  getBuildFunctions() {
    return collectedBuildTasks.map((t) => t.id);
  }

  checkBuildRoot(...args: any[]) {
    if (!mainStore.getState().project?.buildRoots) {
      return;
    }
    const buildRoots = mainStore.getState().project.buildRoots;
    if (buildRoots.includes(args[0])) {
      buildRoots.splice(buildRoots.indexOf(args[0]), 1);
      this.dispatch(setBuildRootAction(buildRoots));
      saveKliveProject();
    }
  }
}

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processRendererToMainMessages(
  message: RequestMessage,
  window: BrowserWindow
): Promise<any> {
  const dispatch = mainStore.dispatch;
  const mainMessageProcessor = new MainMessageProcessor(window, dispatch);

  if (message.targetId === "emu") {
    return await sendFromMainToEmu(message);
  }
  if (message.targetId === "ide") {
    return await sendFromMainToIde(message);
  }

  switch (message.type) {
    case "MainGeneralRequest":
      // --- We accept only methods defined in the MainMessageProcessor
      const processingMethod = mainMessageProcessor[message.method];
      if (typeof processingMethod === "function") {
        try {
          // --- Call the method with the given arguments. We do not call the
          // --- function through the mainMessageProcessor instance, so we need
          // --- to pass it as the "this" parameter.
          return {
            type: "MainGeneralResponse",
            result: await (processingMethod as Function).call(mainMessageProcessor, ...message.args)
          };
        } catch (err) {
          // --- Report the error
          console.error(`Error processing message: ${err}`);
          return errorResponse(err.toString());
        }
      }
      return errorResponse(`Unknown method ${message.method}`);

    // --- Forward these messages to the emulator
    case "EmuGetNextRegDescriptors":
    case "EmuGetNextRegState":
    case "EmuGetNextMemoryMapping":
    case "EmuParsePartitionLabel":
    case "EmuGetPartitionLabels":
    case "EmuGetCallStack":
    case "EmuSetKeyState":
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
  settingsId?: string
): Promise<string> {
  const defaultPath = appSettings?.folders?.[settingsId ?? ""] || app.getPath("home");
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Open Folder",
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
  filters?: Electron.FileFilter[],
  settingsId?: string
): Promise<string> {
  const defaultPath = appSettings?.folders?.[settingsId ?? ""] || app.getPath("home");
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Open File",
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

  console.log("selectedFile:", selectedFile);
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
    const diskInfo = readDiskData(new Uint8Array(contents));

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
