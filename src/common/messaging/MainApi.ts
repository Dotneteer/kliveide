import { MessengerBase } from "@messaging/MessengerBase";
import {
  DefaultResponse,
  ErrorResponse,
  FlagResponse,
  MessageBase,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
import {
  BinaryContentsResponse,
  MainCheckZ88CardResponse,
  MainCompileResponse,
  MainCreateDiskFileResponse,
  MainCreateKliveProjectResponse,
  MainGetDirectoryContentResponse,
  MainGetSettingsResponse,
  MainGetTemplateDirsResponse,
  MainRunScriptResponse,
  MainSaveFileResponse,
  MainShowOpenFileDialogResponse,
  MainShowOpenFolderDialogResponse,
  MessageBoxType,
  TextContentsResponse
} from "./any-to-main";
import { CompilerOptions } from "@abstractions/CompilerInfo";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

/**
 * This interface defines the API exposed by the Emulator
 */
export interface MainApi {
  readTextFile(
    path: string,
    encoding?: string,
    resolveIn?: string
  ): Promise<TextContentsResponse | ErrorResponse>;
  readBinaryFile(path: string, resolveIn?: string): Promise<BinaryContentsResponse | ErrorResponse>;
  displayMessageBox(messageType?: MessageBoxType, title?: string, message?: string): Promise<void>;
  getDirectoryContent(directory: string): Promise<MainGetDirectoryContentResponse>;
  openFolder(folder?: string): Promise<void>;
  createKliveProject(
    machineId: string,
    projectName: string,
    folder?: string,
    modelId?: string,
    templateId?: string
  ): Promise<MainCreateKliveProjectResponse>;
  getGloballyExcludedProjectItems(): Promise<TextContentsResponse>;
  addGlobalExcludedProjectItem(files: string[]): Promise<TextContentsResponse>;
  setGloballyExcludedProjectItems(files: string[]): Promise<TextContentsResponse>;
  deleteFileEntry(isFolder: boolean, name: string): Promise<DefaultResponse | ErrorResponse>;
  addNewFileEntry(
    name: string,
    isFolder?: boolean,
    folder?: string
  ): Promise<DefaultResponse | ErrorResponse>;
  renameFileEntry(oldName: string, newName: string): Promise<DefaultResponse | ErrorResponse>;
  showOpenFolderDialog(settingsId?: string): Promise<MainShowOpenFolderDialogResponse>;
  showOpenFileDialog(
    filters?: { name: string; extensions: string[] }[],
    settingsId?: string
  ): Promise<MainShowOpenFileDialogResponse>;
  saveTextFile(
    path: string,
    data: string,
    resolveIn?: string
  ): Promise<MainSaveFileResponse | ErrorResponse>;
  saveBinaryFile(
    path: string,
    data: Uint8Array,
    resolveIn?: string
  ): Promise<MainSaveFileResponse | ErrorResponse>;
  saveProject(): Promise<void>;
  saveSettings(): Promise<void>;
  getUserSettings(): Promise<MainGetSettingsResponse>;
  getProjectSettings(): Promise<MainGetSettingsResponse>;
  applyUserSettings(key: string, value?: any): Promise<void>;
  applyProjectSettings(key: string, value?: any): Promise<void>;
  moveSettings(pull: boolean, copy: boolean): Promise<void>;
  compileFile(
    filename: string,
    language: string,
    options?: CompilerOptions,
    params?: any
  ): Promise<MainCompileResponse>;
  showItemInFolder(itemPath: string): void;
  exitApp(): void;
  showWebsite(): Promise<void>;
  checkZ88Card(path: string, expectedSize?: number): Promise<MainCheckZ88CardResponse>;
  saveDiskChanges(
    diskIndex: number,
    changes: SectorChanges
  ): Promise<DefaultResponse | ErrorResponse>;
  createDiskFile(
    diskFolder: string,
    filename: string,
    diskType: string
  ): Promise<MainCreateDiskFileResponse | ErrorResponse>;
  getTemplateDirectories(machineId: string): Promise<MainGetTemplateDirsResponse>;
  startScript(
    filename: string,
    scriptFunction?: string,
    scriptText?: string,
    speciality?: string
  ): Promise<MainRunScriptResponse | ErrorResponse>;
  stopScript(idOrFilename: number | string): Promise<FlagResponse>;
  closeScript(script: ScriptRunInfo): Promise<void>;
}

class MainApiImpl implements MainApi {
  constructor(private readonly messenger: MessengerBase) {}

  /**
   * Reads the contents of a text file
   * @param path Path of the file to read
   * @param encoding Encoding of the file
   * @param resolveIn Path to resolve the file in
   */
  async readTextFile(
    path: string,
    encoding?: string,
    resolveIn?: string
  ): Promise<TextContentsResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<TextContentsResponse>({
      type: "MainReadTextFile",
      path,
      encoding,
      resolveIn
    });
  }

  /**
   * Reads the contents of a binary file
   * @param path Path of the file to read
   * @param resolveIn Path to resolve the file in
   */
  async readBinaryFile(
    path: string,
    resolveIn?: string
  ): Promise<BinaryContentsResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<BinaryContentsResponse>({
      type: "MainReadBinaryFile",
      path,
      resolveIn
    });
  }

  /**
   * Displays a message box
   * @param messageType Type of the message box
   * @param title Title of the message box
   * @param message Message to display
   */
  async displayMessageBox(
    messageType?: MessageBoxType,
    title?: string,
    message?: string
  ): Promise<void> {
    await this.sendMessage({
      type: "MainDisplayMessageBox",
      messageType,
      title,
      message
    });
  }

  /**
   * Gets the content of a directory
   * @param directory Directory path
   */
  async getDirectoryContent(directory: string): Promise<MainGetDirectoryContentResponse> {
    return (await this.sendMessage(
      {
        type: "MainGetDirectoryContent",
        directory
      },
      "MainGetDirectoryContentResponse"
    )) as MainGetDirectoryContentResponse;
  }

  /**
   * Opens a folder in the file explorer
   * @param folder Folder path
   */
  async openFolder(folder?: string): Promise<void> {
    await this.sendMessage({
      type: "MainOpenFolder",
      folder
    });
  }

  /**
   * Creates a new Klive project
   * @param machineId Identifier of the machine
   * @param projectName Name of the project
   * @param folder Folder path
   * @param modelId Identifier of the model
   * @param templateId Identifier of the template
   */
  async createKliveProject(
    machineId: string,
    projectName: string,
    folder?: string,
    modelId?: string,
    templateId?: string
  ): Promise<MainCreateKliveProjectResponse> {
    return (await this.sendMessage(
      {
        type: "MainCreateKliveProject",
        machineId,
        projectName,
        folder,
        modelId,
        templateId
      },
      "MainCreateKliveProjectResponse"
    )) as MainCreateKliveProjectResponse;
  }

  /**
   * Gets the list of excluded project items
   */
  async getGloballyExcludedProjectItems(): Promise<TextContentsResponse> {
    return (await this.sendMessage(
      {
        type: "MainGloballyExcludedProjectItems"
      },
      "TextContents"
    )) as TextContentsResponse;
  }

  /**
   * Adds an item to the list of excluded project items
   * @param files Files to add to the list
   */
  async addGlobalExcludedProjectItem(files: string[]): Promise<TextContentsResponse> {
    return (await this.sendMessage(
      {
        type: "MainAddGloballyExcludedProjectItem",
        files
      },
      "TextContents"
    )) as TextContentsResponse;
  }

  /**
   * Sets the list of excluded project items
   * @param files Files to set in the list
   */
  async setGloballyExcludedProjectItems(files: string[]): Promise<TextContentsResponse> {
    return (await this.sendMessage(
      {
        type: "MainSetGloballyExcludedProjectItems",
        files
      },
      "TextContents"
    )) as TextContentsResponse;
  }

  /**
   * Deletes a file entry
   * @param isFolder Indicates if the entry is a folder
   * @param name Name of the entry
   */
  async deleteFileEntry(isFolder: boolean, name: string): Promise<DefaultResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<DefaultResponse>({
      type: "MainDeleteFileEntry",
      isFolder,
      name
    });
  }

  /**
   * Adds a new file entry
   * @param name Name of the entry
   * @param isFolder Indicates if the entry is a folder
   * @param folder Folder path
   */
  async addNewFileEntry(
    name: string,
    isFolder?: boolean,
    folder?: string
  ): Promise<DefaultResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<DefaultResponse>({
      type: "MainAddNewFileEntry",
      name,
      isFolder,
      folder
    });
  }

  /**
   * Renames a file entry
   * @param oldName Old name of the entry
   * @param newName New name of the entry
   */
  async renameFileEntry(
    oldName: string,
    newName: string
  ): Promise<DefaultResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<DefaultResponse>({
      type: "MainRenameFileEntry",
      oldName,
      newName
    });
  }

  /**
   * Shows the open folder dialog
   * @param title Title of the dialog
   * @param settingsId Identifier of the settings
   */
  async showOpenFolderDialog(settingsId?: string): Promise<MainShowOpenFolderDialogResponse> {
    return (await this.sendMessage(
      {
        type: "MainShowOpenFolderDialog",
        settingsId
      },
      "MainShowOpenFolderDialogResponse"
    )) as MainShowOpenFolderDialogResponse;
  }

  /**
   * Shows the open file dialog
   * @param title Title of the dialog
   * @param filters File filters
   * @param settingsId Identifier of the settings
   */
  async showOpenFileDialog(
    filters?: { name: string; extensions: string[] }[],
    settingsId?: string
  ): Promise<MainShowOpenFileDialogResponse> {
    return (await this.sendMessage(
      {
        type: "MainShowOpenFileDialog",
        filters,
        settingsId
      },
      "MainShowOpenFileDialogResponse"
    )) as MainShowOpenFileDialogResponse;
  }

  /**
   * Saves the contents of a text file
   * @param path Path of the file to save
   * @param data Data to save
   * @param resolveIn Path to resolve the file in
   */
  async saveTextFile(
    path: string,
    data: string,
    resolveIn?: string
  ): Promise<MainSaveFileResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<MainSaveFileResponse>({
      type: "MainSaveTextFile",
      path,
      data,
      resolveIn
    });
  }

  /**
   * Saves the contents of a binary file
   * @param path Path of the file to save
   * @param data Data to save
   * @param resolveIn Path to resolve the file in
   */
  async saveBinaryFile(
    path: string,
    data: Uint8Array,
    resolveIn?: string
  ): Promise<MainSaveFileResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<MainSaveFileResponse>({
      type: "MainSaveBinaryFile",
      path,
      data,
      resolveIn
    });
  }

  /**
   * Saves the current project
   */
  async saveProject(): Promise<void> {
    await this.sendMessage({
      type: "MainSaveProject"
    });
  }

  /**
   * Saves the current settings
   */
  async saveSettings(): Promise<void> {
    await this.sendMessage({
      type: "MainSaveSettings"
    });
  }

  /**
   * Gets the user settings
   */
  async getUserSettings(): Promise<MainGetSettingsResponse> {
    return (await this.sendMessage(
      {
        type: "MainGetSettings"
      },
      "MainGetSettingsResponse"
    )) as MainGetSettingsResponse;
  }

  /**
   * Gets the project settings
   */
  async getProjectSettings(): Promise<MainGetSettingsResponse> {
    return (await this.sendMessage(
      {
        type: "MainGetProjectSettings"
      },
      "MainGetSettingsResponse"
    )) as MainGetSettingsResponse;
  }

  /**
   * Applies user settings
   * @param key Key of the setting
   * @param value Value of the setting
   */
  async applyUserSettings(key: string, value?: any): Promise<void> {
    await this.sendMessage({
      type: "MainApplyUserSettings",
      key,
      value
    });
  }

  /**
   * Applies project settings
   * @param key Key of the setting
   * @param value Value of the setting
   */
  async applyProjectSettings(key: string, value?: any): Promise<void> {
    await this.sendMessage({
      type: "MainApplyProjectSettings",
      key,
      value
    });
  }

  /**
   * Moves settings
   * @param pull Pull settings
   * @param copy Copy settings
   */
  async moveSettings(pull: boolean, copy: boolean): Promise<void> {
    await this.sendMessage({
      type: "MainMoveSettings",
      pull,
      copy
    });
  }

  /**
   * Compiles a file
   * @param filename Name of the file
   * @param language Language of the file
   * @param options Compilation options
   * @param params Additional parameters
   */
  async compileFile(
    filename: string,
    language: string,
    options?: CompilerOptions,
    params?: any
  ): Promise<MainCompileResponse> {
    return (await this.sendMessage(
      {
        type: "MainCompileFile",
        filename,
        language,
        options,
        params
      },
      "MainCompileFileResponse"
    )) as MainCompileResponse;
  }

  /**
   * Shows the item in the folder
   * @param itemPath Path of the item
   */
  showItemInFolder(itemPath: string): void {
    this.postMessage({
      type: "MainShowItemInFolder",
      itemPath
    });
  }

  /**
   * Exits the application
   */
  exitApp(): void {
    this.postMessage({
      type: "MainExitApp"
    });
  }

  /**
   * Shows the Klive website
   */
  async showWebsite(): Promise<void> {
    await this.sendMessage({
      type: "MainShowWebsite"
    });
  }

  /**
   * Checks the Z88 card
   * @param path Path of the card
   * @param expectedSize Expected size of the card
   */
  async checkZ88Card(path: string, expectedSize?: number): Promise<MainCheckZ88CardResponse> {
    return (await this.sendMessage(
      {
        type: "MainCheckZ88Card",
        path,
        expectedSize
      },
      "MainCheckZ88CardResponse"
    )) as MainCheckZ88CardResponse;
  }

  /**
   * Saves the changes of a disk
   * @param diskIndex Index of the disk
   * @param changes Changes to save
   */
  async saveDiskChanges(
    diskIndex: number,
    changes: SectorChanges
  ): Promise<DefaultResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<DefaultResponse>({
      type: "MainSaveDiskChanges",
      diskIndex,
      changes
    });
  }

  /**
   * Creates a disk file
   * @param diskFolder Folder of the disk
   * @param filename Name of the file
   * @param diskType Type of the disk
   */
  async createDiskFile(
    diskFolder: string,
    filename: string,
    diskType: string
  ): Promise<MainCreateDiskFileResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<MainCreateDiskFileResponse>({
      type: "MainCreateDiskFile",
      diskFolder,
      filename,
      diskType
    });
  }

  /**
   * Gets the template directories
   * @param machineId Identifier of the machine
   */
  async getTemplateDirectories(machineId: string): Promise<MainGetTemplateDirsResponse> {
    return (await this.sendMessage(
      {
        type: "MainGetTemplateDirs",
        machineId
      },
      "MainGetTemplateDirsResponse"
    )) as MainGetTemplateDirsResponse;
  }

  /**
   * Starts a script
   * @param filename Name of the script file
   * @param scriptFunction Name of the script function
   * @param scriptText Text of the script
   * @param speciality Speciality of the script
   */
  async startScript(
    filename: string,
    scriptFunction?: string,
    scriptText?: string,
    speciality?: string
  ): Promise<MainRunScriptResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<MainRunScriptResponse>({
      type: "MainStartScript",
      filename,
      scriptFunction,
      scriptText,
      speciality
    });
  }

  /**
   * Stops a script
   * @param idOrFilename Identifier or filename of the script
   */
  async stopScript(idOrFilename: number | string): Promise<FlagResponse> {
    return (await this.sendMessage(
      {
        type: "MainStopScript",
        idOrFilename
      },
      "FlagResponse"
    )) as FlagResponse;
  }

  /**
   * Closes a script
   * @param script Script to close
   */
  async closeScript(script: ScriptRunInfo): Promise<void> {
    await this.sendMessage({
      type: "MainCloseScript",
      script
    });
  }

  private async sendMessage(
    message: RequestMessage,
    msgType?: ResponseMessage["type"]
  ): Promise<MessageBase> {
    const response = await this.messenger.sendMessage(message);
    if (response.type === "ErrorResponse") {
      console.log(`Error while sending IPC message: ${response.message}`);
    } else if (msgType && response.type !== msgType) {
      console.log(`Unexpected response type for request type '${message.type}': ${response.type}`);
    }
    return response;
  }

  private async sendMessageWithNoErrorCheck<T extends MessageBase>(
    message: RequestMessage
  ): Promise<T | ErrorResponse> {
    const response = await this.messenger.sendMessage(message);
    return response as T | ErrorResponse;
  }

  private postMessage(message: RequestMessage): void {
    this.messenger.postMessage(message);
  }
}

export function createMainApi(messenger: MessengerBase): MainApi {
  return new MainApiImpl(messenger);
}
