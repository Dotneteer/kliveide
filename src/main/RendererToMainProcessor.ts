import path from "path";
import fs from "fs";
import _ from "lodash";
import type { ScriptStartInfo } from "@abstractions/ScriptStartInfo";
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
import { AppSettings, KLIVE_HOME_FOLDER } from "./settings";
import { mainStore } from "./main-store";
import {
  applyProjectSettingAction,
  dimMenuAction,
  refreshExcludedProjectItemsAction,
  saveProjectSettingAction,
  saveUserSettingAction,
  setBuildRootAction
} from "@state/actions";
import { createCompilerRegistry } from "./compiler-integration/compiler-registry";
import { getDirectoryContent, getProjectDirectoryContentFilter } from "./directory-content";
import { KLIVE_GITHUB_PAGES } from "./app-menu";
import { checkZ88SlotFile } from "./machine-menus/z88-menus";
import {
  MEDIA_DISK_A,
  MEDIA_DISK_B,
  MEDIA_TAPE,
  PROJECT_TEMPLATES
} from "@common/structs/project-const";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { createDiskFile } from "@common/utils/create-disk-file";
import { mainScriptManager } from "./ksx-runner/MainScriptManager";
import { collectedBuildTasks } from "./build";
import { Dispatch } from "react";
import { Action } from "@common/state/Action";
import { MessageBoxType } from "@common/messaging/MainApi";
import { CompilerOptions, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import { DEFAULT_SD_CARD_FILE, getSdCardHandler } from "./machine-menus/zx-next-menus";
import { setSelectedTapeFile } from "./machine-menus/zx-specrum-menus";
import { appSettings, saveAppSettings, setSettingValue } from "./settings-utils";
import { runBackgroundCompileWorker } from "./compiler-integration/runWorker";
import { CimFile } from "./fat32/CimFileManager";
import { Fat32Volume } from "./fat32/Fat32Volume";
import { FileManager } from "./fat32/FileManager";
import { O_RDONLY } from "./fat32/Fat32Types";
import type { IRecordingBackend } from "./recording/IRecordingBackend";
import { FfmpegRecordingBackend } from "./recording/FfmpegRecordingBackend";
import { resolveRecordingPath } from "./recording/outputPath";

const compilerRegistry = createCompilerRegistry();

// Module-level so it survives across per-message MainMessageProcessor instances.
let _recordingBackend: IRecordingBackend | null = null;

class MainMessageProcessor {
  /**
   * Constructs the MainMessageProcessor.
   * @param window The Electron BrowserWindow instance.
   * @param dispatch The Redux dispatch function for actions.
   */
  constructor(
    private readonly window: BrowserWindow,
    private readonly dispatch: Dispatch<Action>
  ) {}

  /**
   * Reads a text file from disk and returns its contents as a string.
   * @param path The file path to read.
   * @param encoding The text encoding to use (default: utf8).
   * @param resolveIn Optional base path context.
   */
  readTextFile(path: string, encoding?: string, resolveIn?: string) {
    if (typeof path !== "string" || !path.trim()) {
      throw new Error("Invalid file path");
    }
    // --- Input validated
    const fullPath = resolveMessagePath(path, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error("File does not exist");
    }
    return fs.readFileSync(fullPath, {
      encoding: (encoding ?? "utf8") as BufferEncoding
    });
  }

  /**
   * Reads a binary file from disk and returns its contents as a Uint8Array.
   * @param path The file path to read.
   * @param resolveIn Optional base path context.
   */
  readBinaryFile(path: string, resolveIn?: string) {
    if (typeof path !== "string" || !path.trim()) {
      throw new Error("Invalid file path");
    }
    // --- Input validated
    const fullPath = resolveMessagePath(path, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error("File does not exist");
    }
    return new Uint8Array(fs.readFileSync(fullPath));
  }

  /**
   * Displays a message box dialog in the main window.
   * @param messageType The type of message box to display.
   * @param title The dialog title.
   * @param message The dialog message.
   */
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

  /**
   * Opens a folder selection dialog and returns the selected folder path.
   * @param settingsId Optional settings key for default path.
   */
  showOpenFolderDialog(settingsId?: string) {
    return displayOpenFolderDialog(this.window, settingsId);
  }

  /**
   * Opens a file selection dialog and returns the selected file path.
   * @param filters Optional file filters for the dialog.
   * @param settingsId Optional settings key for default path.
   */
  showOpenFileDialog(filters?: { name: string; extensions: string[] }[], settingsId?: string) {
    return displayOpenFileDialog(this.window, filters, settingsId);
  }

  /**
   * Creates a new disk file of the specified type in the given folder.
   * @param diskFolder The folder to create the disk in.
   * @param filename The name of the disk file.
   * @param diskType The type of disk to create.
   */
  createDiskFile(diskFolder: string, filename: string, diskType: string) {
    return createDiskFile(diskFolder, filename, diskType);
  }

  /**
   * Gets the directory content, filtered as needed for the project.
   * @param directory The directory path to list.
   */
  async getDirectoryContent(directory: string) {
    const filter = await getProjectDirectoryContentFilter();
    return await getDirectoryContent(directory, filter);
  }

  /**
   * Opens a folder in the IDE or by path, returns error message or null.
   * @param folder Optional folder path to open.
   * @returns Error message or null if successful.
   */
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

  /**
   * Creates a new Klive project and returns its path.
   * @param machineId The machine type ID.
   * @param projectName The name of the new project.
   * @param folder Optional folder to create the project in.
   * @param modelId Optional model ID.
   * @param templateId Optional template ID.
   */
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

  /**
   * Checks a Z88 card file and returns its status or content.
   * @param path The card file path.
   * @param expectedSize Optional expected size of the card.
   */
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

  /**
   * Returns a string of globally excluded project items.
   */
  getGloballyExcludedProjectItems() {
    return appSettings.excludedProjectItems?.join(path.delimiter);
  }

  /**
   * Adds items to the global exclusion list and returns the updated list.
   * @param files The files or folders to exclude.
   */
  addGlobalExcludedProjectItem(files: string[]) {
    const excludedItems = files.map((p: any) => p.trim().replace(path.sep, "/"));
    appSettings.excludedProjectItems = (
      appSettings.excludedProjectItems?.concat(excludedItems) ?? excludedItems
    ).filter((v: any, i: any, a: string | any[]) => a.indexOf(v) === i);
    this.dispatch(refreshExcludedProjectItemsAction());
    return appSettings.excludedProjectItems.join(path.delimiter);
  }

  /**
   * Sets the global exclusion list to the provided files.
   * @param files The new exclusion list.
   */
  setGloballyExcludedProjectItems(files: string[]) {
    appSettings.excludedProjectItems = files;
    this.dispatch(refreshExcludedProjectItemsAction());
    return appSettings.excludedProjectItems?.join(path.delimiter);
  }

  /**
   * Deletes a file or folder from disk.
   * @param isFolder True if the target is a folder, false for a file.
   * @param name The file or folder name.
   */
  deleteFileEntry(isFolder: boolean, name: string) {
    if (typeof name !== "string" || !name.trim()) {
      throw new Error("Invalid file or folder name");
    }
    // --- Input validated
    if (!fs.existsSync(name)) {
      throw new Error(`File or folder does not exist: ${name}`);
    }
    if (isFolder) {
      if (!fs.statSync(name).isDirectory()) {
        throw new Error(`${name} is not a directory`);
      }
      fs.rmdirSync(name, { recursive: true });
    } else {
      if (!fs.statSync(name).isFile()) {
        throw new Error(`${name} is not a file`);
      }
      fs.unlinkSync(name);
    }
  }

  /**
   * Adds a new file or folder to the specified location.
   * @param name The name of the new file or folder.
   * @param isFolder True to create a folder, false for a file.
   * @param folder Optional parent folder path.
   */
  async addNewFileEntry(name: string, isFolder?: boolean, folder?: string): Promise<void> {
    if (typeof name !== "string" || !name.trim()) {
      throw new Error("Invalid file or folder name");
    }
    if (folder && (typeof folder !== "string" || !folder.trim())) {
      throw new Error("Invalid folder path");
    }
    // --- Input validated
    const newItemName = folder ? path.join(folder, name) : name;
    if (fs.existsSync(newItemName)) {
      throw new Error(`${newItemName} already exists`);
    }
    if (isFolder) {
      fs.mkdirSync(newItemName);
    } else {
      fs.closeSync(fs.openSync(newItemName, "w"));
    }
  }

  /**
   * Renames a file or folder on disk.
   * @param oldName The current name of the file or folder.
   * @param newName The new name for the file or folder.
   */
  renameFileEntry(oldName: string, newName: string) {
    if (
      typeof oldName !== "string" ||
      !oldName.trim() ||
      typeof newName !== "string" ||
      !newName.trim()
    ) {
      throw new Error("Invalid old or new file name");
    }
    // --- Input validated
    if (!fs.existsSync(oldName)) {
      throw new Error(`Source file or folder does not exist: ${oldName}`);
    }
    if (fs.existsSync(newName)) {
      throw new Error(`Target file or folder already exists: ${newName}`);
    }
    fs.renameSync(oldName, newName);
  }

  /**
   * Saves text data to a file and returns the file path.
   * @param savePath The file path to save to.
   * @param data The text data to write.
   * @param resolveIn Optional base path context.
   */
  saveTextFile(savePath: string, data: string, resolveIn?: string) {
    if (typeof savePath !== "string" || !savePath.trim()) {
      throw new Error("Invalid file path");
    }
    if (typeof data !== "string") {
      throw new Error("Data must be a string");
    }
    // --- Input validated
    const filePath = resolveMessagePath(savePath, resolveIn);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { flag: "w" });
    return filePath;
  }

  /**
   * Saves binary data to a file and returns the file path.
   * @param savePath The file path to save to.
   * @param data The binary data to write.
   * @param resolveIn Optional base path context.
   */
  saveBinaryFile(savePath: string, data: Uint8Array, resolveIn?: string) {
    if (typeof savePath !== "string" || !savePath.trim()) {
      throw new Error("Invalid file path");
    }
    if (!(data instanceof Uint8Array)) {
      throw new Error("Data must be a Uint8Array");
    }
    // --- Input validated
    const filePath = resolveMessagePath(savePath, resolveIn);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { flag: "w" });
    return filePath;
  }

  /**
   * Copies the specified file to the SD card image.
   * @param srcFile
   * @param destFile The destination file path on the SD card image.
   */
  async copyToSdCard(srcFile: string, destFile: string) {
    const sdCardPath = path.join(app.getPath("home"), KLIVE_HOME_FOLDER, DEFAULT_SD_CARD_FILE);
    if (!fs.existsSync(sdCardPath)) {
      // --- The folder does not exist, we cannot proceed
      console.error("SD card path does not exist:", sdCardPath);
      return;
    }

    const cimFile = new CimFile(sdCardPath);
    const vol = new Fat32Volume(cimFile);
    vol.init();
    const fm = new FileManager(vol);
    fm.copyFile(srcFile, destFile);
  }

  /**
   * Saves the current project state to disk.
   */
  async saveProject() {
    await new Promise((resolve) => setTimeout(resolve, 200));
    saveKliveProject();
  }

  /**
   * Saves application settings to disk.
   */
  saveSettings() {
    saveAppSettings();
  }

  /**
   * Returns the current user settings object.
   */
  getUserSettings() {
    return appSettings.userSettings ?? {};
  }

  /**
   * Returns the current project settings object.
   */
  getProjectSettings() {
    return mainStore.getState().projectSettings ?? {};
  }

  /**
   * Applies a user setting and saves it.
   * @param key The setting key.
   * @param value The value to set (omit to remove).
   */
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

  /**
   * Applies a project setting and saves it.
   * @param key The setting key.
   * @param value The value to set.
   */
  applyProjectSettings(key: string, value?: any) {
    if (key) {
      this.dispatch(applyProjectSettingAction(key, value));
      saveKliveProject();
    }
  }

  /**
   * Moves or copies settings between user and project scopes.
   * @param pull True to move from user to project, false for the reverse.
   * @param copy True to copy, false to merge.
   */
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

  /**
   * Compiles a file using the specified language and options.
   * @param filename The file to compile.
   * @param language The language to use.
   * @param options Optional compiler options.
   */
  async compileFile(filename: string, language: string, options?: CompilerOptions) {
    const compiler = compilerRegistry.getCompiler(language);
    if (!compiler) {
      throw new Error(
        `No compiler is registered for build root file ${filename}. ` +
          "Are you sure you use the right file extension?"
      );
    }

    compiler?.setAppState(mainStore.getState());
    return (await compiler.compileFile(filename, options)) as KliveCompilerOutput;
  }

  /**
   * Starts a background compilation process for a file using the specified language and options.
   * This method initiates compilation but does not wait for it to complete.
   * Returns true if compilation was started, or false if a background compilation is already in progress.
   * @param filename The file to compile in the background.
   * @param language The language to use for compilation.
   * @param options Optional compiler options.
   * @returns True if compilation started, false if already in progress.
   */
  async startBackgroundCompile(
    filename: string,
    language: string,
    options?: CompilerOptions
  ): Promise<boolean> {
    // --- Do not strat,if already in progress
    if (mainStore.getState().compilation?.backgroundInProgress) {
      return false;
    }

    // --- We start the background compilation in a fire-and-forget way.
    // --- The result will be sent to the store by the worker
    // --- and the store will notify the UI.
    runBackgroundCompileWorker({
      state: mainStore.getState(),
      filePath: filename,
      language,
      options
    });
    return true;
  }

  /**
   * Determines if a line in a file can have a breakpoint.
   * @param line The line of code to check.
   * @param language The language of the file.
   */
  async canLineHaveBreakpoint(line: string, language: string) {
    const compiler = compilerRegistry.getCompiler(language);
    if (!compiler) {
      return false;
    }
    return await compiler.lineCanHaveBreakpoint(line);
  }

  /**
   * Shows a file or folder in the system's file explorer.
   * @param itemPath The path to show in the file explorer.
   */
  async showItemInFolder(itemPath: string) {
    shell.showItemInFolder(path.normalize(itemPath));
  }

  /**
   * Exits the application.
   */
  async exitApp() {
    app.quit();
  }

  /**
   * Opens the Klive website in the default browser.
   */
  async showWebsite() {
    shell.openExternal(KLIVE_GITHUB_PAGES);
  }

  /**
   * Saves changes to a disk image file.
   * @param diskIndex The index of the disk to save.
   * @param changes The sector changes to write.
   */
  async saveDiskChanges(diskIndex: number, changes: SectorChanges) {
    return saveDiskChanges(diskIndex, changes);
  }

  /**
   * Returns the list of template directories for a machine.
   * @param machineId The machine type ID.
   */
  async getTemplateDirectories(machineId: string) {
    return getTemplateDirs(machineId);
  }

  /**
   * Starts a script, optionally with function and text.
   * @param filename The script file to run.
   * @param scriptFunction Optional function to invoke.
   * @param scriptText Optional script text to run.
   * @param speciality Optional script speciality.
   */
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

  /**
   * Stops a running script by ID or filename.
   * @param idOrFilename The script ID or filename.
   */
  stopScript(idOrFilename: number | string) {
    mainScriptManager.stopScript(idOrFilename);
  }

  /**
   * Closes a running script.
   * @param script The script run info object.
   */
  async closeScript(script: ScriptRunInfo) {
    await mainScriptManager.closeScript(script);
  }

  /**
   * Removes completed scripts from the manager.
   */
  removeCompletedScripts() {
    mainScriptManager.removeCompletedScripts();
  }

  /**
   * Resolves a module for a script.
   * @param mainFile The main script file.
   * @param moduleName The module name to resolve.
   */
  resolveModule(mainFile: string, moduleName: string) {
    return mainScriptManager.resolveModule(mainFile, moduleName);
  }

  /**
   * Returns the list of available build function IDs.
   */
  getBuildFunctions() {
    return collectedBuildTasks.map((t) => t.id);
  }

  /**
   * Removes a file from the project's build roots.
   * @param filename The file to remove from build roots.
   */
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

  /**
   * Reads a sector from the SD card and returns its data.
   * @param sectorIndex The sector index to read.
   */
  async readSdCardSector(sectorIndex: number) {
    if (!Number.isInteger(sectorIndex) || sectorIndex < 0) {
      throw new Error("Invalid sector index");
    }
    // --- Input validated
    const sdHandler = getSdCardHandler();
    return sdHandler.readSector(sectorIndex);
  }

  /**
   * Writes data to a sector on the SD card.
   * @param sectorIndex The sector index to write.
   * @param data The data to write to the sector.
   */
  async writeSdCardSector(
    sectorIndex: number,
    data: Uint8Array
  ): Promise<{ success: boolean; persistenceConfirmed: boolean }> {
    if (!Number.isInteger(sectorIndex) || sectorIndex < 0) {
      throw new Error("Invalid sector index");
    }
    if (!(data instanceof Uint8Array)) {
      throw new Error("Data must be a Uint8Array");
    }
    // --- Input validated
    const sdHandler = getSdCardHandler();
    sdHandler.writeSector(sectorIndex, data);

    // --- FIX for ISSUE #8: Explicit persistence confirmation
    // --- Only return success after fsyncSync has completed
    // --- This ensures the response to Z80 is only sent after data is persisted
    return {
      success: true,
      persistenceConfirmed: true // --- fsyncSync completed inside writeSector()
    };
  }

  /**
   * Returns the current application settings object.
   */
  async getAppSettings(): Promise<AppSettings> {
    return appSettings;
  }

  /**
   * Reloads the currently selected tape file.
   */
  async reloadTapeFile() {
    const tapeFile = mainStore.getState().media?.[MEDIA_TAPE];
    if (tapeFile) {
      await setSelectedTapeFile(tapeFile);
    }
  }

  /**
   * Sets a global application setting value.
   * @param settingId The setting key to set.
   * @param value The value to set.
   */
  async setGlobalSettingsValue(settingId: string, value: any): Promise<void> {
    setSettingValue(settingId, value);
  }


  /**
   * Checks if the ZX Spectrum Next files system has an "autoexec.1st" file.
   * @returns True if the "autoexec.1st" file exists, false otherwise.
   */
  async hasNextAutoExec(): Promise<boolean> {
    const sdCardPath = path.join(app.getPath("home"), KLIVE_HOME_FOLDER, DEFAULT_SD_CARD_FILE);
    if (!fs.existsSync(sdCardPath)) {
      return false;
    }

    const cimFile = new CimFile(sdCardPath);
    const vol = new Fat32Volume(cimFile);
    vol.init();
    return vol.open("nextzxos/autoexec.1st", O_RDONLY) !== null;
  }

  // ---------------------------------------------------------------------------
  // Screen recording
  // ---------------------------------------------------------------------------

  /**
   * Starts a new screen recording session using the active backend.
   * Returns the absolute path of the output file.
   */
  async startScreenRecording(width: number, height: number, fps: number, xRatio = 1, yRatio = 1, sampleRate = 44100, crf = 18): Promise<string> {
    const homeDir = app.getPath("home");
    const outputPath = resolveRecordingPath(homeDir, "mp4");
    _recordingBackend = new FfmpegRecordingBackend();
    _recordingBackend.start(outputPath, width, height, fps, xRatio, yRatio, sampleRate, crf);
    return outputPath;
  }

  /**
   * Appends one raw RGBA frame to the active recording.
   */
  async appendRecordingFrame(rgba: Uint8Array): Promise<void> {
    _recordingBackend?.appendFrame(rgba);
  }

  /**
   * Appends interleaved stereo f32le audio samples to the active recording.
   */
  async appendRecordingAudio(samples: Float32Array): Promise<void> {
    _recordingBackend?.appendAudioSamples(samples);
  }

  /**
   * Finalises the recording and returns the path of the finished file.
   */
  async stopScreenRecording(): Promise<string> {
    if (!_recordingBackend) return "";
    try {
      const filePath = await _recordingBackend.finish();
      _recordingBackend = null;
      return filePath;
    } catch (err) {
      _recordingBackend = null;
      return "";
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
