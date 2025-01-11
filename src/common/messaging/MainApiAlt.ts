import { ProjectNodeWithChildren } from "@abstractions/ProjectNode";
import { MessageBoxType } from "./any-to-main";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

class MainApiAltImpl {
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
}

export type MainApiAlt = MainApiAltImpl;

export function createMainAltApi(messenger: MessengerBase): MainApiAltImpl {
  return buildMessagingProxy(new MainApiAltImpl(), messenger);
}
