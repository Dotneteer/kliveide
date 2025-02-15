import { ProjectNodeWithChildren } from "@abstractions/ProjectNode";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { KliveCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { CompilerOptions } from "@abstractions/CompilerInfo";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { ScriptStartInfo } from "@abstractions/ScriptStartInfo";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

export type MessageBoxType = "none" | "info" | "error" | "question" | "warning";

/**
 * This class defines the shape of the main process API that can be called from
 * the Emu and Ide processes. The methods are called through a JavaScript proxy.
 */
class MainApiImpl {
  readTextFile(_path: string, _encoding?: string, _resolveIn?: string): string {
    throw new Error(NO_PROXY_ERROR);
  }
  readBinaryFile(_path: string, _resolveIn?: string): Uint8Array {
    throw new Error(NO_PROXY_ERROR);
  }

  async displayMessageBox(_messageType?: MessageBoxType, _title?: string, _message?: string) {
    throw new Error(NO_PROXY_ERROR);
  }

  async createDiskFile(_diskFolder: string, _filename: string, _diskType: string): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async showOpenFolderDialog(_settingsId?: string): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async showOpenFileDialog(
    _filters?: { name: string; extensions: string[] }[],
    _settingsId?: string
  ): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getDirectoryContent(_directory: string): Promise<ProjectNodeWithChildren> {
    throw new Error(NO_PROXY_ERROR);
  }

  async openFolder(_folder?: string): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async checkZ88Card(_path: string, _expectedSize?: number): Promise<any> {
    throw new Error(NO_PROXY_ERROR);
  }

  async createKliveProject(
    _machineId: string,
    _projectName: string,
    _folder?: string,
    _modelId?: string,
    _templateId?: string
  ): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getGloballyExcludedProjectItems(): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async addGlobalExcludedProjectItem(_files: string[]): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async setGloballyExcludedProjectItems(_files: string[]): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async deleteFileEntry(_isFolder: boolean, _name: string): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async addNewFileEntry(_name: string, _isFolder?: boolean, _folder?: string): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async renameFileEntry(_oldName: string, _newName: string): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async saveTextFile(_path: string, _data: string, _resolveIn?: string): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async saveBinaryFile(_path: string, _data: Uint8Array, _resolveIn?: string): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async saveProject(): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async saveSettings(): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getUserSettings(): Promise<Record<string, any>> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getProjectSettings(): Promise<Record<string, any>> {
    throw new Error(NO_PROXY_ERROR);
  }

  async applyUserSettings(_key: string, _value?: any): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async applyProjectSettings(_key: string, _value?: any): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async moveSettings(_pull: boolean, _copy: boolean): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async compileFile(
    _filename: string,
    _language: string,
    _options?: CompilerOptions,
    _params?: any
  ): Promise<KliveCompilerOutput> {
    throw new Error(NO_PROXY_ERROR);
  }

  async showItemInFolder(_itemPath: string): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async exitApp(): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async showWebsite(): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async saveDiskChanges(_diskIndex: number, _changes: SectorChanges): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getTemplateDirectories(_machineId: string): Promise<string[]> {
    throw new Error(NO_PROXY_ERROR);
  }

  async startScript(
    _filename: string,
    _scriptFunction?: string,
    _scriptText?: string,
    _speciality?: string
  ): Promise<ScriptStartInfo> {
    throw new Error(NO_PROXY_ERROR);
  }

  async stopScript(_idOrFilename: number | string): Promise<boolean> {
    throw new Error(NO_PROXY_ERROR);
  }

  async closeScript(_script: ScriptRunInfo): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async removeCompletedScripts(): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async resolveModule(_mainFile: string, _moduleName: string): Promise<string> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getBuildFunctions(): Promise<string[]> {
    throw new Error(NO_PROXY_ERROR);
  }

  async checkBuildRoot(_filename: string): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async readSdCardSector(_sectorIndex: number): Promise<Uint8Array> {
    throw new Error(NO_PROXY_ERROR);
  }

  async writeSdCardSector(_sectorIndex: number, _data: Uint8Array): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }
}

export type MainApi = MainApiImpl;

export function createMainApi(messenger: MessengerBase): MainApiImpl {
  return buildMessagingProxy(new MainApiImpl(), messenger, "main");
}
