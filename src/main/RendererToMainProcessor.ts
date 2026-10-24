import path from "path";
import os from "os";
import { checkSourceAnnotations } from "@common/utils/source-annotations";
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
import { getIdeApi, sendFromMainToIde } from "@messaging/MainToIdeMessenger";
import { openEmulatorFile } from "./open-file";
import { runUiAction } from "./ui-actions";
import type { UiActionId } from "@common/settings/ui-action-ids";
import {
  createKliveProject,
  getKliveProjectFolder,
  openFolder,
  openFolderByPath,
  resolveHomeFilePath,
  resolveKliveHomeFilePath,
  resolvePublicFilePath,
  resolveSavedFilePath,
  saveKliveProject
} from "./projects";
import { AppSettings, KLIVE_HOME_FOLDER } from "./settings";
import { getKliveHomeBase } from "./portable";
import { mainStore } from "./main-store";
import { KLIVE_APP_VERSION } from "./app-version";
import { createHash } from "node:crypto";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import type { SdCardFingerprint } from "@common/machineState/machineStateTypes";
import {
  applyProjectSettingAction,
  dimMenuAction,
  refreshExcludedProjectItemsAction,
  saveProjectSettingAction,
  saveUserSettingAction,
  setBuildRootAction,
  startBackgroundCompileAction
} from "@state/actions";
import { createCompilerRegistry } from "./compiler-integration/compiler-registry";
import { getDirectoryContent, getProjectDirectoryContentFilter } from "./directory-content";
import { KLIVE_GITHUB_PAGES } from "./menus/help-menu";
import { checkZ88SlotFile } from "./machine-menus/z88-menus";
import { displaySaveFileDialog } from "./save-file-dialog";
import {
  MEDIA_DISK_A,
  MEDIA_DISK_B,
  MEDIA_SD_CARD,
  MEDIA_TAPE,
  PROJECT_TEMPLATES
} from "@common/structs/project-const";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { DSK_WHOLE_IMAGE_KEY, dskSectorWrites } from "@emu/machines/disk/disk-changes";
import { createDiskFile } from "@common/utils/create-disk-file";
import { beginDiskImageEdit, cancelDiskImageEdit, commitDiskImageEdit } from "./disk-image-edit";
import { createHardDiskImage, hardDiskFileClusters, queryHardDisk, readHardDiskFile } from "./hard-disk-images";
import { copyFolderToHardDiskSafely, editHardDiskSafely } from "./hard-disk-edit";
import type { DiskEdit } from "@common/diskfs/edit";
import type { DiskImageEditStart } from "@common/messaging/MainApi";
import { mainScriptManager } from "./ksx-runner/MainScriptManager";
import { collectedBuildTasks } from "./build";
import { Dispatch } from "react";
import { Action } from "@common/state/Action";
import type { MessageBoxType, ZxNextStorageCopyRequest } from "@common/messaging/MainApi";
import { CompileProfile, CompilerOptions, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import {
  activeSdCardFile,
  DEFAULT_SD_CARD_FILE,
  getSdCardDevice,
  invalidateSdCardHandler
} from "./machine-menus/zx-next-menus";
import { withSdCardAccess } from "./sd-card-access";
import { focusEmuWindow as bringEmuWindowToFront } from ".";
import {
  ejectMediaFile as ejectMachineMedia,
  selectMediaFile as selectMachineMedia,
  setSelectedTapeFile
} from "./machine-menus/zx-specrum-menus";
import { appSettings, applyUserSetting, saveAppSettings, setSettingValue } from "./settings-utils";
import { showSourceExportSaveDialog } from "./source-export-folder";
import { tapAutomationOutput } from "./automation/automation-controller";
import { relayedRequest } from "@messaging/MessengerBase";
import { runBackgroundCompileWorker } from "./compiler-integration/runWorker";
import { CimFile } from "./fat32/CimFileManager";
import { Fat32Volume } from "./fat32/Fat32Volume";
import { FileManager } from "./fat32/FileManager";
import { O_RDONLY } from "./fat32/Fat32Types";
import type { IRecordingBackend } from "./recording/IRecordingBackend";
import { FfmpegRecordingBackend } from "./recording/FfmpegRecordingBackend";
import { StubRecordingBackend } from "./recording/StubRecordingBackend";
import { isFFmpegAvailable } from "./recording/ffmpegAvailable";
import { resolveRecordingPath } from "./recording/outputPath";
import {
  appendWindowRecordingAudio,
  isWindowRecordingActive
} from "./recording/window-recording/windowRecordingController";
import type { RecordingFormat } from "@common/state/AppState";
import { copyZxNextStorageFile as copyZxNextStorageFileOnHost } from "./zx-next-storage-copy";
import { applyEmuContentSizeHints } from "./emu-window-sizing";
import { AnnotationFileWatcher } from "./annotation-file-watcher";
import { emuMachineSizeStore } from "./emu-machine-sizes";
import type { UnitTestRunRequest, UnitTestRunResponse } from "@common/unit-tests/unitTestTypes";
import { addUnitTestSupport, type AddUnitTestSupportResult } from "./unit-tests/addUnitTestSupport";
import { cancelUnitTestRun, rememberCompilation, runUnitTestsInWorker } from "./unit-tests/unitTestService";
import type { EmuContentSizeHints } from "@common/utils/emu-window-size";
import type {
  SjasmplusIntegrationApplyRequest,
  SjasmplusReleaseDownloadRequest,
  SjasmplusReleaseListRequest
} from "@common/messaging/SjasmplusIntegration";
import {
  downloadSjasmplusRelease,
  getSjasmplusPathSuggestions,
  listSjasmplusReleases,
  probeSjasmplusPath,
  validateSjasmplusExecutable
} from "./sjasmp-integration/sjasmplus-integration-service";
import type { BorielSetupDecision } from "@common/messaging/BorielIntegration";
import {
  borielSetupStatus,
  installBorielKit,
  recordBorielSetupDecision,
  setEffectiveBasicCompiler,
  useExistingBorielInstallation
} from "./boriel-integration/boriel-main";
import {
  SJASMP_EXECUTABLE_PATH,
  SJASMP_INSTALL_FOLDER,
  SJASMP_VERSION
} from "./sjasmp-integration/sjasmp-config";
import type {
  Z88dkIntegrationApplyRequest,
  Z88dkReleaseDownloadRequest
} from "@common/messaging/Z88dkIntegration";
import {
  cancelZ88dkDownload,
  downloadZ88dkRelease,
  getZ88dkDownloadProgress,
  getZ88dkPathSuggestions,
  listZ88dkReleases,
  probeZ88dkPath,
  validateZ88dkInstall
} from "./z88dk-integration/z88dk-integration-service";
import { Z88DK_INSTALL_FOLDER, Z88DK_VERSION } from "./z88dk-integration/z88dk-config";
import { t } from "@common/i18n/i18n";

const compilerRegistry = createCompilerRegistry();

// Module-level so it survives across per-message MainMessageProcessor instances.
let _recordingBackend: IRecordingBackend | null = null;

// --- One watcher for the app: the IDE follows the sidecars its annotation sessions hold open
const annotationFileWatcher = new AnnotationFileWatcher((filePath) => {
  void Promise.resolve()
    .then(() => getIdeApi().annotationFileChanged(filePath))
    .catch(() => {
      // --- No IDE window to tell: it reads the file afresh when it opens it
    });
});

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
   * Asks the user to confirm an action that cannot be undone (see `MainApi.confirmAction`)
   */
  async confirmAction(title: string, message: string, detail: string | undefined, confirmLabel: string): Promise<boolean> {
    try {
      const result = await dialog.showMessageBox(this.window, {
        type: "question",
        buttons: [confirmLabel, t("common.button.cancel")],
        defaultId: 1,
        cancelId: 1,
        title,
        message,
        detail
      });
      return result.response === 0;
    } finally {
      this.dispatch(dimMenuAction(false));
    }
  }

  /**
   * Asks the user to confirm overwriting an existing file.
   * @param targetPath The target path that would be overwritten.
   */
  async confirmFileOverwrite(targetPath: string): Promise<boolean> {
    try {
      const result = await dialog.showMessageBox(this.window, {
        type: "question",
        buttons: [t("common.button.overwrite"), t("common.button.cancel")],
        defaultId: 1,
        cancelId: 1,
        title: t("messages.file.overwriteTitle"),
        message: t("messages.file.overwriteConfirm", { file: targetPath })
      });
      return result.response === 0;
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
   * Opens a save dialog and returns the chosen path (see `MainApi.showSaveFileDialog`).
   */
  /** "Export as source"'s save dialog (`MainApi.showSourceExportDialog`) */
  async showSourceExportDialog(options: {
    title: string;
    defaultName: string;
    filters: { name: string; extensions: string[] }[];
  }): Promise<string | undefined> {
    try {
      return await showSourceExportSaveDialog(this.window, options);
    } finally {
      this.dispatch(dimMenuAction(false));
    }
  }

  async showSaveFileDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
    settingsId?: string;
  }) {
    try {
      return await displaySaveFileDialog(this.window, options ?? {});
    } finally {
      this.dispatch(dimMenuAction(false));
    }
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

  async beginDiskImageEdit(filePath: string) {
    // Input validation
    if (typeof filePath !== "string" || !filePath) throw new Error("A disk image path is required");
    // --- Input validated
    return beginDiskImageEdit(filePath);
  }

  async commitDiskImageEdit(filePath: string, contents: Uint8Array, start?: Omit<DiskImageEditStart, "contents">) {
    // Input validation
    if (typeof filePath !== "string" || !filePath) throw new Error("A disk image path is required");
    if (!(contents instanceof Uint8Array)) throw new Error("The disk image must be bytes");
    // --- Input validated
    await commitDiskImageEdit(filePath, contents, start ?? {});
  }

  queryHardDisk(filePath: string, options?: { partition?: number; dir?: string; deleted?: boolean }) {
    // Input validation
    if (typeof filePath !== "string" || !filePath) throw new Error("A disk image path is required");
    // --- Input validated
    return queryHardDisk(filePath, options ?? {});
  }

  readHardDiskFile(filePath: string, name: string, partition?: number) {
    // Input validation
    if (typeof filePath !== "string" || typeof name !== "string") throw new Error("An image and a file name are required");
    // --- Input validated
    return readHardDiskFile(filePath, name, partition);
  }

  hardDiskFileClusters(filePath: string, name: string, partition?: number) {
    // Input validation
    if (typeof filePath !== "string" || typeof name !== "string") throw new Error("An image and a file name are required");
    // --- Input validated
    return hardDiskFileClusters(filePath, name, partition);
  }

  async editHardDisk(filePath: string, edit: DiskEdit, partition?: number) {
    // Input validation
    if (typeof filePath !== "string" || !edit || typeof edit.kind !== "string") throw new Error("An image and an edit are required");
    // --- Input validated
    await editHardDiskSafely(filePath, edit, partition);
  }

  async copyFolderToHardDisk(filePath: string, hostFolder: string, targetDir?: string, partition?: number) {
    // Input validation
    if (typeof filePath !== "string" || typeof hostFolder !== "string") throw new Error("An image and a folder are required");
    // --- Input validated
    return copyFolderToHardDiskSafely(filePath, hostFolder, targetDir, partition);
  }

  createHardDiskImage(filePath: string, options: { sizeMb: number; fatType: 16 | 32; label?: string; partitioned?: boolean }) {
    // Input validation
    if (typeof filePath !== "string" || !options || !Number.isInteger(options.sizeMb) || ![16, 32].includes(options.fatType)) {
      throw new Error("A path, a size in MB and a FAT type (16 or 32) are required");
    }
    // --- Input validated
    createHardDiskImage(filePath, options);
    return filePath;
  }

  async cancelDiskImageEdit(start?: Omit<DiskImageEditStart, "contents">) {
    // --- Nothing to validate beyond the flags, read as booleans
    await cancelDiskImageEdit({ resume: !!start?.resume, debug: !!start?.debug });
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
    // --- `split`/`join` converts EVERY separator. `replace` with a plain string only converted
    // --- the first one, so a nested path such as "build\temp" was stored half-converted on
    // --- Windows and then never matched anything.
    const excludedItems = files.map((p: any) => p.trim().split(path.sep).join("/"));
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
    // --- The entry can still disappear between the check above and the work below (an external
    // --- tool, a sync client, the user's shell). Report that as the same "does not exist" error
    // --- rather than leaking a raw ENOENT, so the outcome does not depend on the exact moment it
    // --- vanished.
    try {
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
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        throw new Error(`File or folder does not exist: ${name}`);
      }
      throw err;
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
    // --- Create exclusively, so an entry that appears between the check above and the creation
    // --- below fails instead of being silently overwritten. `mkdirSync` already refuses to
    // --- clobber; the "wx" flag gives a plain file the same guarantee ("w" alone would truncate
    // --- whatever appeared in the meantime).
    try {
      if (isFolder) {
        fs.mkdirSync(newItemName);
      } else {
        fs.closeSync(fs.openSync(newItemName, "wx"));
      }
    } catch (err: any) {
      if (err?.code === "EEXIST") {
        throw new Error(`${newItemName} already exists`);
      }
      throw err;
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
    // --- KNOWN LIMITATION: `renameSync` overwrites an existing target on POSIX, so a target that
    // --- appears between the check above and this call is replaced rather than reported. Node
    // --- offers no portable no-clobber rename (a link+unlink workaround does not cover
    // --- directories), and the window is a few microseconds inside the user's own project folder,
    // --- so the check above is deliberately left as the guard.
    try {
      fs.renameSync(oldName, newName);
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        throw new Error(`Source file or folder does not exist: ${oldName}`);
      }
      throw err;
    }
  }

  /**
   * Saves text data to a file and returns the file path.
   * @param savePath The file path to save to.
   * @param data The text data to write.
   * @param resolveIn Optional base path context.
   */
  /** The absolute path of a file inside the Klive home folder (`MainApi.resolveKliveHomePath`) */
  resolveKliveHomePath(relative: string) {
    if (typeof relative !== "string") {
      throw new Error("Invalid file path");
    }
    return path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, relative);
  }

  /** Assembles source held in memory (`MainApi.assembleText`, source export's verification) */
  async assembleText(source: string) {
    if (typeof source !== "string") throw new Error("Invalid source");
    const output = await new Z80Assembler().compile(source, new AssemblerOptions());
    return {
      errors: output.errors.map((e) => ({ line: e.line, message: e.message, isWarning: e.isWarning })),
      segments: output.segments.map((segment) => ({
        startAddress: segment.startAddress,
        ...(segment.bank !== undefined ? { bank: segment.bank } : {}),
        emittedCode: [...segment.emittedCode]
      }))
    };
  }

  /** Assembles lines one by one at their addresses (`MainApi.assembleLines`, a SkoolKit import's byte check) */
  async assembleLines(lines: { text: string; address: number }[], z80n: boolean) {
    if (!Array.isArray(lines)) throw new Error("Invalid lines");
    const options = new AssemblerOptions();
    options.allowNextInstructions = !!z80n;
    const results: ({ bytes: number[] } | { error: string })[] = [];
    for (const line of lines) {
      const output = await new Z80Assembler().compile(`  .org ${line.address & 0xffff}\n  ${line.text}\n`, options);
      results.push(
        output.errorCount > 0
          ? { error: output.errors.find((e) => !e.isWarning)?.message ?? "does not assemble" }
          : { bytes: output.segments.flatMap((segment) => segment.emittedCode) }
      );
    }
    return results;
  }

  /** Follow a sidecar for outside changes (`MainApi.watchAnnotationFile`) */
  watchAnnotationFile(filePath: string) {
    return annotationFileWatcher.watch(filePath);
  }

  /** Release one follow of a sidecar (`MainApi.unwatchAnnotationFile`) */
  unwatchAnnotationFile(filePath: string) {
    annotationFileWatcher.unwatch(filePath);
  }

  /** Whether the folder of a file is writable (`MainApi.canWriteBeside`) */
  canWriteBeside(filePath: string) {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath)) return false;
    try {
      fs.accessSync(path.dirname(filePath), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

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
    const sdCardPath = path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, DEFAULT_SD_CARD_FILE);
    if (!fs.existsSync(sdCardPath)) {
      // --- The folder does not exist, we cannot proceed
      console.error("SD card path does not exist:", sdCardPath);
      return;
    }

    // --- Hold exclusive access for the whole operation. This copy invalidates the cached handler
    // --- and then yields on I/O; without the lock, a sector read/write arriving in that window
    // --- would lazily open a second, independent handler on the same image and the two writers
    // --- would corrupt it.
    await withSdCardAccess(async () => {
      // --- Invalidate the cached CimHandler before modifying the .cim file,
      // --- so its stale file handle doesn't conflict with the CimFile writes.
      invalidateSdCardHandler();

      const cimFile = new CimFile(sdCardPath);
      try {
        const vol = new Fat32Volume(cimFile);
        vol.init();
        const fm = new FileManager(vol);
        await fm.copyFile(srcFile, destFile);
      } finally {
        // --- Always close the CimFile to release its file descriptor and flush data, even if the
        // --- copy failed part-way through.
        cimFile.close();
      }
    });
  }

  /**
   * Copies a file between the host filesystem and ZX Spectrum Next storage.
   * @param request Copy direction, storage target, host path, and storage path.
   */
  async copyZxNextStorageFile(request: ZxNextStorageCopyRequest) {
    const appState = mainStore.getState();
    const currentStoragePath =
      appState.media?.[MEDIA_SD_CARD] ??
      path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, DEFAULT_SD_CARD_FILE);

    return await copyZxNextStorageFileOnHost(request, {
      projectFolder: appState.project?.folderPath,
      currentStoragePath,
      invalidateCurrentStorage: invalidateSdCardHandler
    });
  }

  /**
   * Saves the current project state to disk.
   */
  async saveProject() {
    await new Promise((resolve) => setTimeout(resolve, 200));
    // --- Await the save: the caller treats this call resolving as "the project has been saved",
    // --- and a follow-up operation must not race the write.
    await saveKliveProject();
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
    applyUserSetting(key, value);
  }

  /**
   * Applies a project setting and saves it.
   * @param key The setting key.
   * @param value The value to set.
   */
  async applyProjectSettings(key: string, value?: any) {
    if (key) {
      this.dispatch(applyProjectSettingAction(key, value));
      await saveKliveProject();
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

  probeSjasmplusPath(itemPath: string) {
    return probeSjasmplusPath(
      itemPath,
      mainStore.getState().isWindows ?? (process.platform === "win32")
    );
  }

  getSjasmplusPathSuggestions() {
    return getSjasmplusPathSuggestions(
      process.env.PATH ?? "",
      mainStore.getState().isWindows ?? (process.platform === "win32")
    );
  }

  async listSjasmplusReleases(request?: SjasmplusReleaseListRequest) {
    return await listSjasmplusReleases(request);
  }

  async downloadSjasmplusRelease(request: SjasmplusReleaseDownloadRequest) {
    return await downloadSjasmplusRelease(request, {
      isWindows: mainStore.getState().isWindows ?? (process.platform === "win32")
    });
  }

  async validateSjasmplusExecutable(executablePath: string) {
    return await validateSjasmplusExecutable(executablePath);
  }

  async applySjasmplusIntegration(request: SjasmplusIntegrationApplyRequest) {
    if (!request || typeof request !== "object") {
      throw new Error("Invalid SJASMPLUS integration request.");
    }
    const { scope, installFolder, executablePath, version } = request;
    if (scope !== "user" && scope !== "project") {
      throw new Error("Invalid SJASMPLUS integration scope.");
    }
    if (!installFolder || !executablePath) {
      throw new Error("SJASMPLUS install folder and executable path are required.");
    }

    if (scope === "project" && !mainStore.getState().project?.isKliveProject) {
      throw new Error("You need a Klive project loaded to save SJASMPLUS project settings.");
    }

    if (scope === "user") {
      appSettings.userSettings ??= {};
      _.set(appSettings.userSettings, SJASMP_INSTALL_FOLDER, installFolder);
      _.set(appSettings.userSettings, SJASMP_EXECUTABLE_PATH, executablePath);
      if (version) {
        _.set(appSettings.userSettings, SJASMP_VERSION, version);
      } else {
        _.unset(appSettings.userSettings, SJASMP_VERSION);
      }
      this.dispatch(saveUserSettingAction({ ...appSettings.userSettings }));
      saveAppSettings();
      return;
    }

    this.dispatch(applyProjectSettingAction(SJASMP_INSTALL_FOLDER, installFolder));
    this.dispatch(applyProjectSettingAction(SJASMP_EXECUTABLE_PATH, executablePath));
    this.dispatch(applyProjectSettingAction(SJASMP_VERSION, version));
    await saveKliveProject();
  }

  probeZ88dkPath(itemPath: string) {
    return probeZ88dkPath(itemPath, mainStore.getState().isWindows ?? process.platform === "win32");
  }

  async getZ88dkPathSuggestions() {
    return await getZ88dkPathSuggestions(process.env, {
      isWindows: mainStore.getState().isWindows ?? process.platform === "win32"
    });
  }

  async listZ88dkReleases(request?: { refresh?: boolean }) {
    return await listZ88dkReleases({ refresh: !!request?.refresh });
  }

  async downloadZ88dkRelease(request: Z88dkReleaseDownloadRequest) {
    return await downloadZ88dkRelease(request, {
      isWindows: mainStore.getState().isWindows ?? process.platform === "win32"
    });
  }

  getZ88dkDownloadProgress() {
    return getZ88dkDownloadProgress();
  }

  cancelZ88dkDownload() {
    cancelZ88dkDownload();
  }

  getZ88dkDefaultDownloadFolder() {
    return path.join(os.homedir(), "KliveTools", "z88dk").replaceAll("\\", "/");
  }

  async validateZ88dkInstall(root: string) {
    return await validateZ88dkInstall(root, mainStore.getState().isWindows ?? process.platform === "win32");
  }

  async applyZ88dkIntegration(request: Z88dkIntegrationApplyRequest) {
    if (!request || typeof request !== "object") throw new Error("Invalid z88dk integration request.");
    const { scope, root, version } = request;
    if (scope !== "user" && scope !== "project") throw new Error("Invalid z88dk integration scope.");
    if (!root) throw new Error("The z88dk install folder is required.");
    if (scope === "project" && !mainStore.getState().project?.isKliveProject) {
      throw new Error("You need a Klive project loaded to save z88dk project settings.");
    }
    if (scope === "user") {
      appSettings.userSettings ??= {};
      _.set(appSettings.userSettings, Z88DK_INSTALL_FOLDER, root);
      if (version) _.set(appSettings.userSettings, Z88DK_VERSION, version);
      else _.unset(appSettings.userSettings, Z88DK_VERSION);
      this.dispatch(saveUserSettingAction({ ...appSettings.userSettings }));
      saveAppSettings();
      return;
    }
    this.dispatch(applyProjectSettingAction(Z88DK_INSTALL_FOLDER, root));
    this.dispatch(applyProjectSettingAction(Z88DK_VERSION, version));
    await saveKliveProject();
  }

  async getBorielSetupStatus() {
    return await borielSetupStatus();
  }

  async installBoriel(folder: string) {
    if (typeof folder !== "string") throw new Error("Invalid Boriel BASIC installation folder.");
    return await installBorielKit(folder);
  }

  async useExistingBoriel(itemPath: string) {
    if (typeof itemPath !== "string") throw new Error("Invalid Boriel BASIC path.");
    return await useExistingBorielInstallation(itemPath);
  }

  async setBasicCompiler(choice: "klive" | "boriel") {
    if (choice !== "klive" && choice !== "boriel") throw new Error("Invalid BASIC compiler choice.");
    // --- The compiler that builds now: the project's choice when it has one, as the Settings row does
    await setEffectiveBasicCompiler(choice);
  }

  async recordBorielSetupDecision(decision: BorielSetupDecision) {
    if (decision !== "declined" && decision !== "postponed") {
      throw new Error("Invalid Boriel BASIC setup decision.");
    }
    recordBorielSetupDecision(decision);
  }

  /**
   * Compiles a file using the specified language and options.
   * @param filename The file to compile.
   * @param language The language to use.
   * @param options Optional compiler options.
   */
  async compileFile(filename: string, language: string, options?: CompilerOptions, params?: { profile?: CompileProfile }) {
    const compiler = compilerRegistry.getCompiler(language);
    if (!compiler) {
      throw new Error(
        `No compiler is registered for build root file ${filename}. ` +
          "Are you sure you use the right file extension?"
      );
    }

    compiler?.setAppState(mainStore.getState());
    const output = (await compiler.compileFile(filename, options, params?.profile)) as KliveCompilerOutput;
    // --- `LOGPOINT` comments that cannot be used become build warnings (`.plans/LOGPOINTS_PLAN.md` L13)
    const checked = checkSourceAnnotations(output);
    // --- The unit-test runner takes the last build (`.plans/Z80_UNIT_TESTS_PLAN.md` D15)
    rememberCompilation(filename, language, checked);
    return checked;
  }

  /** Runs the last build's unit tests in a worker (`.plans/Z80_UNIT_TESTS_PLAN.md` D6) */
  async runUnitTests(request: UnitTestRunRequest): Promise<UnitTestRunResponse> {
    return runUnitTestsInWorker(request, (action) => this.dispatch(action));
  }

  /** Stops the unit-test run in progress */
  async cancelUnitTests(): Promise<void> {
    cancelUnitTestRun();
  }

  /** Adds Klive's unit-test include to the build root (D4, D5) */
  async addUnitTestSupport(buildRoot: string, language: string): Promise<AddUnitTestSupportResult> {
    return addUnitTestSupport(buildRoot, language);
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
    options?: CompilerOptions,
    params?: { basicActiveFile?: string }
  ): Promise<boolean> {
    // --- One background compile at a time: the caller retries when the running one ends
    if (mainStore.getState().compilation?.backgroundInProgress) {
      return false;
    }

    // --- Mark it running here, where the flag is checked: the renderer's own START is local to it.
    // --- The worker's END (success, error or exit) clears it.
    mainStore.dispatch(startBackgroundCompileAction());

    // --- We start the background compilation in a fire-and-forget way.
    // --- The result will be sent to the store by the worker
    // --- and the store will notify the UI.
    runBackgroundCompileWorker({
      state: mainStore.getState(),
      filePath: filename,
      language,
      options,
      ...(params?.basicActiveFile ? { basicActiveFile: params.basicActiveFile } : {})
    }).catch(() => {
      // --- A failed worker has already ended the compile in the store
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
  /**
   * The Next's SD card image and a fingerprint of its content (see `MainApi.getSdCardFingerprint`).
   * The fingerprint hashes the image's size and its first 8 MB, where the FAT32 boot sector, the
   * allocation tables and the root directory of every card Klive makes live, so any file change
   * shows; it ignores the modification time, so a copied card still matches.
   */
  async getSdCardFingerprint(): Promise<SdCardFingerprint | undefined> {
    const fileName = activeSdCardFile();
    if (!fileName || !fs.existsSync(fileName)) return undefined;
    return withSdCardAccess(() => {
      const size = fs.statSync(fileName).size;
      const hash = createHash("sha256");
      hash.update(String(size));
      const fd = fs.openSync(fileName, "r");
      try {
        const chunk = Buffer.alloc(1024 * 1024);
        for (let offset = 0; offset < Math.min(size, 8 * 1024 * 1024); offset += chunk.length) {
          const read = fs.readSync(fd, chunk, 0, chunk.length, offset);
          if (read <= 0) break;
          hash.update(chunk.subarray(0, read));
        }
      } finally {
        fs.closeSync(fd);
      }
      return { fileName, size, fingerprint: hash.digest("hex").slice(0, 32) };
    });
  }

  /**
   * The Klive version (see `MainApi.getAppVersion`).
   */
  async getAppVersion(): Promise<string> {
    return KLIVE_APP_VERSION;
  }

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
  async showWebsite(docsPath?: string) {
    // --- Only a path inside the site: the renderer names a page, it never supplies a URL
    const page =
      typeof docsPath === "string" && /^\/[A-Za-z0-9\-/#_.]*$/.test(docsPath) && !docsPath.includes("..")
        ? docsPath
        : "";
    shell.openExternal(`${KLIVE_GITHUB_PAGES}${page}`);
  }

  /**
   * Saves changes to a disk image file.
   * @param diskIndex The index of the disk to save.
   * @param changes The sector changes to write.
   */
  async saveDiskChanges(diskIndex: number, changes: SectorChanges) {
    const response = saveDiskChanges(diskIndex, changes);
    // --- An open Disk Explorer shows the disk as the machine left it
    const diskFile = mainStore.getState().media?.[diskIndex ? MEDIA_DISK_B : MEDIA_DISK_A]?.diskFile;
    if (typeof diskFile === "string") void getIdeApi().diskImageChanged(diskFile).catch(() => {});
    return response;
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
  async checkBuildRoot(filename: string) {
    if (!mainStore.getState().project?.buildRoots) {
      return;
    }
    const buildRoots = mainStore.getState().project.buildRoots;
    if (buildRoots.includes(filename)) {
      buildRoots.splice(buildRoots.indexOf(filename), 1);
      this.dispatch(setBuildRootAction(buildRoots));
      await saveKliveProject();
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
    return withSdCardAccess(() => getSdCardDevice().readSector(sectorIndex));
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
    await withSdCardAccess(() => getSdCardDevice().writeSector(sectorIndex, data));

    // --- FIX for ISSUE #8: Explicit persistence confirmation
    // --- Only return success after fsyncSync has completed
    // --- This ensures the response to Z80 is only sent after data is persisted
    return {
      success: true,
      persistenceConfirmed: true // --- fsyncSync completed inside writeSector()
    };
  }

  /**
   * Returns the total number of 512-byte sectors on the mounted SD card image.
   */
  async getSdCardInfo(): Promise<{ totalSectors: number }> {
    return withSdCardAccess(() => ({ totalSectors: getSdCardDevice().totalSectors }));
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
   * Inserts a tape file, as the "Select Tape File..." menu does (`.plans/TAPE_VIEWER_PLAN.md` D6).
   * @returns The failure's message, or undefined when the tape was inserted
   */
  async setTapeFile(filename: string): Promise<string | undefined> {
    const error = await setSelectedTapeFile(filename, false);
    // --- As the menu does: the project remembers its tape
    if (!error) await saveKliveProject();
    return error;
  }

  /**
   * Opens a file dropped onto the emulator window (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.10).
   * @param filename The dropped file's full path
   */
  async openDroppedFile(filename: string): Promise<string | undefined> {
    return await openEmulatorFile(BrowserWindow.getFocusedWindow() ?? undefined, filename, t("messages.file.droppedTitle"));
  }

  /**
   * Runs a UI action (`src/main/ui-actions.ts`).
   */
  async runUiAction(actionId: UiActionId, value?: unknown): Promise<string | undefined> {
    return await runUiAction(actionId, value);
  }

  /**
   * Brings the emulator window to the front and gives it the keyboard focus.
   */
  async focusEmuWindow(): Promise<void> {
    bringEmuWindowToFront();
  }

  /**
   * Inserts a tape or disk through the open-file dialog, as the Machine menu does.
   * @param mediaId MEDIA_TAPE, MEDIA_DISK_A or MEDIA_DISK_B
   */
  async selectMediaFile(mediaId: string): Promise<void> {
    await selectMachineMedia(this.window, mediaId);
  }

  /**
   * Ejects a tape (after confirmation) or a disk, as the Machine menu does.
   * @param mediaId MEDIA_TAPE, MEDIA_DISK_A or MEDIA_DISK_B
   */
  async ejectMediaFile(mediaId: string): Promise<void> {
    await ejectMachineMedia(mediaId);
  }

  /**
   * Opens a ZX Spectrum Next inspector in the IDE (the pixel probe's click, LAYER_COMPOSITION_PLAN D7).
   * @param inspector Which inspector
   */
  async openNextInspector(inspector: "sprites" | "tilemap" | "layer2" | "layers"): Promise<void> {
    const commands = {
      sprites: "show-sprites",
      tilemap: "show-tilemap",
      layer2: "show-layer2",
      layers: "show-layers"
    } as const;
    const command = commands[inspector];
    if (!command) return;
    await getIdeApi().executeCommand(command);
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
   * Applies the emulator window's content size hints (issue #1377).
   * @param hints The sizes, in CSS pixels, and the machine they are for
   */
  async setEmuContentSizeHints(hints: EmuContentSizeHints): Promise<void> {
    applyEmuContentSizeHints(this.window, hints, emuMachineSizeStore);
  }


  /**
   * Checks if the ZX Spectrum Next files system has an "autoexec.1st" file.
   * @returns True if the "autoexec.1st" file exists, false otherwise.
   */
  async hasNextAutoExec(): Promise<boolean> {
    const sdCardPath = path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, DEFAULT_SD_CARD_FILE);
    if (!fs.existsSync(sdCardPath)) {
      return false;
    }

    // --- This opens its own handle on the SD card image, so it must not overlap with a copy or a
    // --- reset that is rewriting that image.
    return withSdCardAccess(() => {
      const cimFile = new CimFile(sdCardPath);
      try {
        const vol = new Fat32Volume(cimFile);
        vol.init();
        return vol.open("nextzxos/autoexec.1st", O_RDONLY) !== null;
      } finally {
        // --- Release the file descriptor. Without this, every ZX Next code injection leaked one.
        cimFile.close();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Screen recording
  // ---------------------------------------------------------------------------

  /**
   * Starts a new screen recording session using the active backend.
   * Returns the absolute path of the output file.
   */
  async startScreenRecording(width: number, height: number, fps: number, xRatio = 1, yRatio = 1, sampleRate = 44100, crf = 18, format: RecordingFormat = "mp4"): Promise<string> {
    // --- One recording at a time: the IDE + Emulator recording is running
    if (isWindowRecordingActive()) {
      throw new Error("An IDE + Emulator recording is in progress.");
    }
    const homeDir = getKliveHomeBase();
    const ext = format === "webm" ? "webm" : format === "mkv" ? "mkv" : "mp4";
    const outputPath = resolveRecordingPath(homeDir, ext);
    _recordingBackend = isFFmpegAvailable()
      ? new FfmpegRecordingBackend()
      : new StubRecordingBackend();
    _recordingBackend.start(outputPath, width, height, fps, xRatio, yRatio, sampleRate, crf, format);
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
   * Appends emulator sound to the running IDE + Emulator recording.
   */
  async appendWindowRecordingAudio(samples: Float32Array): Promise<void> {
    appendWindowRecordingAudio(samples);
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
      // --- A recording that produced no file must not end as quietly as one that did (issue #1374)
      await this.displayMessageBox(
        "error",
        "Screen recording failed",
        `The recording could not be saved.\n\n${(err as Error)?.message ?? err}`
      );
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
    return await sendFromMainToEmu(relayedRequest(message));
  }
  if (message.targetId === "ide") {
    // --- Emulator and Log pane output, for automation's `ide.output` (COMMAND_LINE_AUTOMATION_PLAN D11)
    if (
      message.type === "ApiMethodRequest" &&
      (message.method === "displayOutput" || message.method === "displayOutputBatch")
    ) {
      tapAutomationOutput(message.args?.[0]);
    }
    return await sendFromMainToIde(relayedRequest(message));
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
    title: t("messages.file.openFolder"),
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
    title: t("messages.file.openFile"),
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
      case "kliveHome":
        inputPath = resolveKliveHomeFilePath(inputPath);
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

  // --- TR-DOS disks (the Pentagon's Beta 128): a `.trd` takes each change at its file sector; an
  // --- `.scl` is a container, never written back (`.plans/BETA128_TRDOS_PLAN.md` Q4)
  const extension = path.extname(diskFile).toLowerCase();
  if (extension === ".scl") {
    return defaultResponse();
  }
  if (extension === ".trd") {
    try {
      const handle = fs.openSync(diskFile, "r+");
      try {
        for (const [fileSector, data] of changes) {
          fs.writeSync(handle, data, 0, data.length, fileSector * 256);
        }
      } finally {
        fs.closeSync(handle);
      }
    } catch (err) {
      return errorResponse(`Saving disk changes failed: ${err.message}`);
    }
    return defaultResponse();
  }

  // --- A DSK whose layout the guest changed (a format): the whole new image replaces the file,
  // --- written beside it and renamed over it, so a failed write leaves the old disk intact
  const whole = changes.get(DSK_WHOLE_IMAGE_KEY);
  if (whole) {
    try {
      const temporary = `${diskFile}.klive-tmp`;
      fs.writeFileSync(temporary, whole);
      fs.renameSync(temporary, diskFile);
    } catch (err) {
      return errorResponse(`Saving disk changes failed: ${err.message}`);
    }
    return defaultResponse();
  }

  // --- A DSK: each change lands at its sector's physical position (`dskSectorWrites`)
  try {
    const contents = fs.readFileSync(diskFile);
    const writes = dskSectorWrites(readDiskData(new Uint8Array(contents)), changes);

    const handle = fs.openSync(diskFile, "r+");
    try {
      for (const { position, data } of writes) {
        fs.writeSync(handle, data, 0, data.length, position);
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
  // --- A machine with no template folder (the C64) has no templates: an empty list, not an error
  if (!fs.existsSync(templateFolder) || !fs.statSync(templateFolder).isDirectory()) {
    return [];
  }

  // --- Ok, read the subfolders of the machine template folder
  return fs
    .readdirSync(templateFolder)
    .filter((f) => fs.statSync(path.join(templateFolder, f)).isDirectory());
}
