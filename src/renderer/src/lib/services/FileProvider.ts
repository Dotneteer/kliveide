import { IFileProvider } from "@abstr/IFileProvider";
import { MessengerBase } from "@messaging/MessengerBase";
import { reportMessagingError } from "./reportError";
import { createMainApi } from "@messaging/MainApi";

/**
 * This class implements a file provider to read and write files throught the main process
 */
export class FileProvider implements IFileProvider {
  constructor(private readonly messenger: MessengerBase) {}
  /**
   * Read an text file from the specified path with the given encoding
   * @param path Absolute path, or one relative to the dist/assets (public) folder
   * @param encoding Text encoding ("utf8", by default)
   * @returns The contents of a file as a string
   */
  async readTextFile(path: string, encoding?: string): Promise<string | null> {
    try {
      return await createMainApi(this.messenger).readTextFile(path, encoding);
    } catch (err: any) {
      reportMessagingError(`readTextFile call failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Read a binary file from the specified path
   * @param path Absolute path, or one relative to the dist/assets (public) folder
   * @returns The contents of a file as an Uint8Array instance
   */
  async readBinaryFile(path: string): Promise<Uint8Array | null> {
    try {
      const mainApi = createMainApi(this.messenger);
      return await mainApi.readBinaryFile(path);
    } catch (err: any) {
      reportMessagingError(`readBinaryFile call failed: ${err.message}`);
      return null;
    } 
  }

  /**
   * Writes a text file to the specified path
   * @param _path Absolute path, or one relative to the user's home folder
   * @param _contents File contents to write
   * @param _encoding Text encoding ("utf8", by default)
   */
  writeTextFile(_path: string, _contents: string, _encoding?: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  /**
   * Writes a binary file to the specified path
   * @param _path Absolute path, or one relative to the user's home folder
   * @param _contents File contents to write
   */
  writeBinaryFile(_path: string, _contents: Uint8Array): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
