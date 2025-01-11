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
  MainCompileResponse,
  MainGetBuildFunctionsResponse,
  MainGetSettingsResponse,
  MainGetTemplateDirsResponse,
  MainResolveModuleResponse,
  MainRunScriptResponse,
} from "./any-to-main";
import { CompilerOptions } from "@abstractions/CompilerInfo";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

/**
 * This interface defines the API exposed by the Emulator
 */
export interface MainApi {
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
  saveDiskChanges(
    diskIndex: number,
    changes: SectorChanges
  ): Promise<DefaultResponse | ErrorResponse>;
  getTemplateDirectories(machineId: string): Promise<MainGetTemplateDirsResponse>;
  startScript(
    filename: string,
    scriptFunction?: string,
    scriptText?: string,
    speciality?: string
  ): Promise<MainRunScriptResponse | ErrorResponse>;
  stopScript(idOrFilename: number | string): Promise<FlagResponse>;
  closeScript(script: ScriptRunInfo): Promise<void>;
  removeCompletedScripts(): Promise<void>;
  resolveModule(mainFile: string, moduleName: string): Promise<MainResolveModuleResponse>;
  getBuildFunctions(): Promise<MainGetBuildFunctionsResponse | ErrorResponse>;
  checkBuildRoot(filename: string): Promise<void>;
}

class MainApiImpl implements MainApi {
  constructor(private readonly messenger: MessengerBase) {}

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

  /**
   * Removes completed scripts
   */
  async removeCompletedScripts(): Promise<void> {
    await this.sendMessage({
      type: "MainRemoveCompletedScripts"
    });
  }

  /**
   * Resolves a module
   * @param mainFile Main file
   * @param moduleName Name of the module
   */
  async resolveModule(mainFile: string, moduleName: string): Promise<MainResolveModuleResponse> {
    return (await this.sendMessage(
      {
        type: "MainResolveModule",
        mainFile,
        moduleName
      },
      "MainResolveModuleResponse"
    )) as MainResolveModuleResponse;
  }

  /**
   * Gets the build functions
   */
  async getBuildFunctions(): Promise<MainGetBuildFunctionsResponse | ErrorResponse> {
    return await this.sendMessageWithNoErrorCheck<MainGetBuildFunctionsResponse>({
      type: "MainGetBuildFunctions"
    });
  }

  /**
   * Checks the build root
   * @param filename Name of the file
   */
  async checkBuildRoot(filename: string): Promise<void> {
    await this.sendMessage({
      type: "MainCheckBuildRoot",
      filename
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
