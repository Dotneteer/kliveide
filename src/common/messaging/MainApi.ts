import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";

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

}

export type MainApi = MainApiImpl;

export function createMainApi(messenger: MessengerBase): MainApiImpl {
  return buildMessagingProxy(new MainApiImpl(), messenger, "main");
}
