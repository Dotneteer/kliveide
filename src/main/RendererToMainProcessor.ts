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
import { MessageBoxType } from "@common/messaging/MainApi";
import { CompilerOptions } from "@abstractions/CompilerInfo";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import { getSdCardHandler } from "./machine-menus/zx-next-menus";
import { Z80AssemblyLine } from "./z80-compiler/assembler-tree-nodes";
import { InputStream } from "./z80-compiler/input-stream";
import { TokenStream } from "./z80-compiler/token-stream";
import { Z80AsmParser } from "./z80-compiler/z80-asm-parser";

class MainMessageProcessor {
  constructor(
    private readonly window: BrowserWindow,
    private readonly dispatch: Dispatch<Action>
  ) {}

  readTextFile(path: string, encoding?: string, resolveIn?: string) {
    const fullPath = resolveMessagePath(path, resolveIn);
    return fs.readFileSync(fullPath, {
      encoding: (encoding ?? "utf8") as BufferEncoding
    });
  }

  readBinaryFile(path: string, resolveIn?: string) {
    const fullPath = resolveMessagePath(path, resolveIn);
    return new Uint8Array(fs.readFileSync(fullPath));
  }

  async displayMessageBox(messageType?: MessageBoxType, title?: string, message?: string) {
    try {
      await dialog.showMessageBox(this.window, {
        type: messageType ?? "none",
        title: title,
        message: message
      });
    } finally {
      this.dispatch(dimMenuAction(false));
    }
  }

  showOpenFolderDialog(settingsId?: string) {
    return displayOpenFolderDialog(this.window, settingsId);
  }

  showOpenFileDialog(filters?: { name: string; extensions: string[] }[], settingsId?: string) {
    return displayOpenFileDialog(this.window, filters, settingsId);
  }

  createDiskFile(diskFolder: string, filename: string, diskType: string) {
    return createDiskFile(diskFolder, filename, diskType);
  }

  async getDirectoryContent(directory: string) {
    const filter = await getProjectDirectoryContentFilter();
    return await getDirectoryContent(directory, filter);
  }

  async openFolder(folder?: string): Promise<string | null> {
    if (folder) {
      const errorMessage = await openFolderByPath(folder);
      if (errorMessage) {
        return errorMessage;
      }
    } else {
      openFolder(this.window);
    }
    return null;
  }

  async createKliveProject(
    machineId: string,
    projectName: string,
    folder?: string,
    modelId?: string,
    templateId?: string
  ) {
    const createFolderResponse = await createKliveProject(
      machineId,
      modelId,
      templateId,
      projectName,
      folder
    );
    if (createFolderResponse.errorMessage) {
      throw new Error(createFolderResponse.errorMessage);
    }
    return createFolderResponse.path;
  }

  async checkZ88Card(path: string, expectedSize?: number) {
    const cardResult = await checkZ88SlotFile(path, expectedSize);
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

  addGlobalExcludedProjectItem(files: string[]) {
    const excludedItems = files.map((p: any) => p.trim().replace(path.sep, "/"));
    appSettings.excludedProjectItems = (
      appSettings.excludedProjectItems?.concat(excludedItems) ?? excludedItems
    ).filter((v: any, i: any, a: string | any[]) => a.indexOf(v) === i);
    this.dispatch(refreshExcludedProjectItemsAction());
    return appSettings.excludedProjectItems.join(path.delimiter);
  }

  setGloballyExcludedProjectItems(files: string[]) {
    appSettings.excludedProjectItems = files;
    this.dispatch(refreshExcludedProjectItemsAction());
    return appSettings.excludedProjectItems?.join(path.delimiter);
  }

  deleteFileEntry(isFolder: boolean, name: string) {
    if (isFolder) {
      fs.rmdirSync(name, { recursive: true });
    } else {
      fs.unlinkSync(name);
    }
  }

  async addNewFileEntry(name: string, isFolder?: boolean, folder?: string): Promise<void> {
    const newItemName = path.join(folder, name);
    if (fs.existsSync(newItemName)) {
      throw new Error(`${newItemName} already exists`);
    }
    if (isFolder) {
      fs.mkdirSync(newItemName);
    } else {
      fs.closeSync(fs.openSync(newItemName, "w"));
    }
  }

  renameFileEntry(oldName: string, newName: string) {
    fs.renameSync(oldName, newName);
  }

  saveTextFile(savePath: string, data: string, resolveIn?: string) {
    const filePath = resolveMessagePath(savePath, resolveIn);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { flag: "w" });
    return filePath;
  }

  saveBinaryFile(savePath: string, data: Uint8Array, resolveIn?: string) {
    const filePath = resolveMessagePath(savePath, resolveIn);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { flag: "w" });
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

  applyUserSettings(key: string, value?: any) {
    if (key) {
      appSettings.userSettings ??= {};
      if (value === undefined) {
        _.unset(appSettings.userSettings, key);
      } else {
        _.set(appSettings.userSettings, key, value);
      }
      saveAppSettings();
    }
  }

  applyProjectSettings(key: string, value?: any) {
    if (key) {
      this.dispatch(applyProjectSettingAction(key, value));
      saveKliveProject();
    }
  }

  async moveSettings(pull: boolean, copy: boolean) {
    if (pull) {
      // --- User --> Project
      let projSettings: Record<string, any> = {};
      if (copy) {
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
      if (copy) {
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

  async compileFile(filename: string, language: string, options?: CompilerOptions) {
    const compiler = getCompiler(language);
    return (await compiler.compileFile(filename, options)) as KliveCompilerOutput;
  }

  async showItemInFolder(itemPath: string) {
    shell.showItemInFolder(path.normalize(itemPath));
  }

  async exitApp() {
    app.quit();
  }

  async showWebsite() {
    shell.openExternal(KLIVE_GITHUB_PAGES);
  }

  async saveDiskChanges(diskIndex: number, changes: SectorChanges) {
    return saveDiskChanges(diskIndex, changes);
  }

  async getTemplateDirectories(machineId: string) {
    return getTemplateDirs(machineId);
  }

  async startScript(
    filename: string,
    scriptFunction?: string,
    scriptText?: string,
    speciality?: string
  ) {
    let scriptInfo: ScriptStartInfo;
    if (scriptText) {
      // --- Script text specified, run as script text
      scriptInfo = await mainScriptManager.runScriptText(
        scriptText,
        scriptFunction,
        filename,
        speciality
      );
    } else {
      scriptInfo = await mainScriptManager.runScript(filename);
    }
    return scriptInfo;
  }

  stopScript(idOrFilename: number | string) {
    mainScriptManager.stopScript(idOrFilename);
  }

  async closeScript(script: ScriptRunInfo) {
    await mainScriptManager.closeScript(script);
  }

  removeCompletedScripts() {
    mainScriptManager.removeCompletedScripts();
  }

  resolveModule(mainFile: string, moduleName: string) {
    return mainScriptManager.resolveModule(mainFile, moduleName);
  }

  getBuildFunctions() {
    return collectedBuildTasks.map((t) => t.id);
  }

  checkBuildRoot(filename: string) {
    if (!mainStore.getState().project?.buildRoots) {
      return;
    }
    const buildRoots = mainStore.getState().project.buildRoots;
    if (buildRoots.includes(filename)) {
      buildRoots.splice(buildRoots.indexOf(filename), 1);
      this.dispatch(setBuildRootAction(buildRoots));
      saveKliveProject();
    }
  }

  async readSdCardSector(sectorIndex: number) {
    const sdHandler = getSdCardHandler();
    return sdHandler.readSector(sectorIndex);
  }

  async writeSdCardSector(sectorIndex: number, data: Uint8Array) {
    const sdHandler = getSdCardHandler();
    sdHandler.writeSector(sectorIndex, data);
  }

  async parseZ80Line(line: string): Promise<Z80AssemblyLine | null> {
    const is = new InputStream(line);
    const ts = new TokenStream(is);
    const parser = new Z80AsmParser(ts);
    const parsed = await parser.parseProgram();
    if (parser.errors.length > 0) {
      return null;
    }
    if (parsed.assemblyLines.length === 0) {
      return null;
    }
    return parsed.assemblyLines[0];
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
    case "ApiMethodRequest":
      // --- We accept only methods defined in the MainMessageProcessor
      const processingMethod = mainMessageProcessor[message.method];
      if (typeof processingMethod === "function") {
        try {
          // --- Call the method with the given arguments. We do not call the
          // --- function through the mainMessageProcessor instance, so we need
          // --- to pass it as the "this" parameter.
          return {
            type: "ApiMethodResponse",
            result: await (processingMethod as Function).call(mainMessageProcessor, ...message.args)
          };
        } catch (err) {
          // --- Report the error
          console.error(`Error processing message: ${err}`);
          return errorResponse(err.toString());
        }
      }
      return errorResponse(`Unknown method ${message.method}`);
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
