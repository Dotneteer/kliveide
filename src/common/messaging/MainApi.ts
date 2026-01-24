import { ProjectNodeWithChildren } from "@abstractions/ProjectNode";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { CompilerOptions, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { ScriptStartInfo } from "@abstractions/ScriptStartInfo";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import { AppSettings } from "@main/settings";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

export type MessageBoxType = "none" | "info" | "error" | "question" | "warning";

/**
 * This class defines the shape of the main process API that can be called from
 * the Emu and Ide processes. The methods are called through a JavaScript proxy.
 */
class MainApiImpl {
  /**
   * Reads a text file from disk and returns its contents as a string.
   * @param _path The file path to read.
   * @param _encoding The text encoding to use (default: utf8).
   * @param _resolveIn Optional base path context.
   */
  async readTextFile(_path: string, _encoding?: string, _resolveIn?: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Reads a binary file from disk and returns its contents as a Uint8Array.
   * @param _path The file path to read.
   * @param _resolveIn Optional base path context.
   */
  async readBinaryFile(_path: string, _resolveIn?: string): Promise<Uint8Array> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Displays a message box dialog in the main window.
   * @param _messageType The type of message box to display.
   * @param _title The dialog title.
   * @param _message The dialog message.
   */
  async displayMessageBox(_messageType?: MessageBoxType, _title?: string, _message?: string) {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Creates a new disk file of the specified type in the given folder.
   * @param _diskFolder The folder to create the disk in.
   * @param _filename The name of the disk file.
   * @param _diskType The type of disk to create.
   */
  async createDiskFile(_diskFolder: string, _filename: string, _diskType: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Opens a folder selection dialog and returns the selected folder path.
   * @param _settingsId Optional settings key for default path.
   */
  async showOpenFolderDialog(_settingsId?: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Opens a file selection dialog and returns the selected file path.
   * @param _filters Optional file filters for the dialog.
   * @param _settingsId Optional settings key for default path.
   */
  async showOpenFileDialog(
    _filters?: { name: string; extensions: string[] }[],
    _settingsId?: string
  ): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the directory content, filtered as needed for the project.
   * @param _directory The directory path to list.
   */
  async getDirectoryContent(_directory: string): Promise<ProjectNodeWithChildren> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Opens a folder in the IDE or by path, returns error message or null.
   * @param _folder Optional folder path to open.
   * @returns Error message or null if successful.
   */
  async openFolder(_folder?: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Checks a Z88 card file and returns its status or content.
   * @param _path The card file path.
   * @param _expectedSize Optional expected size of the card.
   */
  async checkZ88Card(_path: string, _expectedSize?: number): Promise<any> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Creates a new Klive project and returns its path.
   * @param _machineId The machine type ID.
   * @param _projectName The name of the new project.
   * @param _folder Optional folder to create the project in.
   * @param _modelId Optional model ID.
   * @param _templateId Optional template ID.
   */
  async createKliveProject(
    _machineId: string,
    _projectName: string,
    _folder?: string,
    _modelId?: string,
    _templateId?: string
  ): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Returns a string of globally excluded project items.
   */
  async getGloballyExcludedProjectItems(): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Adds items to the global exclusion list and returns the updated list.
   * @param _files The files or folders to exclude.
   */
  async addGlobalExcludedProjectItem(_files: string[]): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the global exclusion list to the provided files.
   * @param _files The new exclusion list.
   */
  async setGloballyExcludedProjectItems(_files: string[]): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Deletes a file or folder from disk.
   * @param _isFolder True if the target is a folder, false for a file.
   * @param _name The file or folder name.
   */
  async deleteFileEntry(_isFolder: boolean, _name: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Adds a new file or folder to the specified location.
   * @param _name The name of the new file or folder.
   * @param _isFolder True to create a folder, false for a file.
   * @param _folder Optional parent folder path.
   */
  async addNewFileEntry(_name: string, _isFolder?: boolean, _folder?: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Renames a file or folder on disk.
   * @param _oldName The current name of the file or folder.
   * @param _newName The new name for the file or folder.
   */
  async renameFileEntry(_oldName: string, _newName: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves text data to a file and returns the file path.
   * @param _path The file path to save to.
   * @param _data The text data to write.
   * @param _resolveIn Optional base path context.
   */
  async saveTextFile(_path: string, _data: string, _resolveIn?: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves binary data to a file and returns the file path.
   * @param _path The file path to save to.
   * @param _data The binary data to write.
   * @param _resolveIn Optional base path context.
   */
  async saveBinaryFile(_path: string, _data: Uint8Array, _resolveIn?: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves the current project state to disk.
   */
  async saveProject(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Copies the specified file to the SD card image.
   * @param _srcFile
   * @param _destFile The destination file path on the SD card image.
   */
  async copyToSdCard(_srcFile: string, _destFile: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves application settings to disk.
   */
  async saveSettings(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Returns the current user settings object.
   */
  async getUserSettings(): Promise<Record<string, any>> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Returns the current project settings object.
   */
  async getProjectSettings(): Promise<Record<string, any>> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Applies a user setting and saves it.
   * @param _key The setting key.
   * @param _value The value to set (omit to remove).
   */
  async applyUserSettings(_key: string, _value?: any): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Applies a project setting and saves it.
   * @param _key The setting key.
   * @param _value The value to set.
   */
  async applyProjectSettings(_key: string, _value?: any): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Moves or copies settings between user and project scopes.
   * @param _pull True to move from user to project, false for the reverse.
   * @param _copy True to copy, false to merge.
   */
  async moveSettings(_pull: boolean, _copy: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Compiles a file using the specified language and options.
   * @param _filename The file to compile.
   * @param _language The language to use.
   * @param _options Optional compiler options.
   * @param _params Optional additional parameters.
   */
  async compileFile(
    _filename: string,
    _language: string,
    _options?: CompilerOptions,
    _params?: any
  ): Promise<KliveCompilerOutput> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Starts a background compilation process for a file using the specified language and options.
   * This method initiates compilation but does not wait for it to complete.
   * @param _filename The file to compile in the background.
   * @param _language The language to use for compilation.
   * @param _options Optional compiler options.
   * @param _params Optional additional parameters for the compiler.
   * @returns A boolean indicating whether the background compilation was started.
   * Returns false if the compilation is already in progress.
   */
  async startBackgroundCompile(
    _filename: string,
    _language: string,
    _options?: CompilerOptions,
    _params?: any
  ): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Determines if a line in a file can have a breakpoint.
   * @param _line The line of code to check.
   * @param _language The language of the file.
   */
  async canLineHaveBreakpoint(_line: string, _language: string): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Shows a file or folder in the system's file explorer.
   * @param _itemPath The path to show in the file explorer.
   */
  async showItemInFolder(_itemPath: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Exits the application.
   */
  async exitApp(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Opens the Klive website in the default browser.
   */
  async showWebsite(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves changes to a disk image file.
   * @param _diskIndex The index of the disk to save.
   * @param _changes The sector changes to write.
   */
  async saveDiskChanges(_diskIndex: number, _changes: SectorChanges): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Returns the list of template directories for a machine.
   * @param _machineId The machine type ID.
   */
  async getTemplateDirectories(_machineId: string): Promise<string[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Starts a script, optionally with function and text.
   * @param _filename The script file to run.
   * @param _scriptFunction Optional function to invoke.
   * @param _scriptText Optional script text to run.
   * @param _speciality Optional script speciality.
   */
  async startScript(
    _filename: string,
    _scriptFunction?: string,
    _scriptText?: string,
    _speciality?: string
  ): Promise<ScriptStartInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Stops a running script by ID or filename.
   * @param _idOrFilename The script ID or filename.
   */
  async stopScript(_idOrFilename: number | string): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Closes a running script.
   * @param _script The script run info object.
   */
  async closeScript(_script: ScriptRunInfo): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Removes completed scripts from the manager.
   */
  async removeCompletedScripts(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Resolves a module for a script.
   * @param _mainFile The main script file.
   * @param _moduleName The module name to resolve.
   */
  async resolveModule(_mainFile: string, _moduleName: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Returns the list of available build function IDs.
   */
  async getBuildFunctions(): Promise<string[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Removes a file from the project's build roots.
   * @param _filename The file to remove from build roots.
   */
  async checkBuildRoot(_filename: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Reads a sector from the SD card and returns its data.
   * @param _sectorIndex The sector index to read.
   */
  async readSdCardSector(_sectorIndex: number): Promise<Uint8Array> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Writes data to a sector on the SD card.
   * @param _sectorIndex The sector index to write.
   * @param _data The data to write to the sector.
   * @returns Object with success status and persistence confirmation flag.
   */
  async writeSdCardSector(_sectorIndex: number, _data: Uint8Array): Promise<{ success: boolean; persistenceConfirmed: boolean }> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Opens a file or folder with the system shell.
   * @param _path The path to open.
   * @returns An object with the opened path or error.
   */
  async openWithShell(_path: string): Promise<{ path?: string; error?: string }> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Returns the current application settings object.
   */
  async getAppSettings(): Promise<AppSettings> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Reloads the currently selected tape file.
   */
  async reloadTapeFile(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets a global application setting value.
   * @param _settingId The setting key to set.
   * @param _value The value to set.
   */
  async setGlobalSettingsValue(_settingId: string, _value: any): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }
}

export type MainApi = MainApiImpl;

export function createMainApi(messenger: MessengerBase): MainApiImpl {
  return buildMessagingProxy(new MainApiImpl(), messenger, "main");
}
