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

  async checkZ88Card(_path: string, _expectedSize?: number): Promise<any> {
    throw new Error(NO_PROXY_ERROR);
  }
}

export type MainApiAlt = MainApiAltImpl;

export function createMainAltApi(messenger: MessengerBase): MainApiAltImpl {
  return buildMessagingProxy(new MainApiAltImpl(), messenger);
}
