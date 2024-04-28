import { IFileProvider } from "@renderer/core/IFileProvider";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";

/**
 * This class implements a file provider to read and write files throught the main process
 */
export class FileProvider implements IFileProvider {
  constructor (private readonly messenger: MessengerBase) {}
  /**
   * Read an text file from the specified path with the given encoding
   * @param path Absolute path, or one relative to the dist/assets (public) folder
   * @param encoding Text encoding ("utf8", by default)
   * @returns The contents of a file as a string
   */
  async readTextFile (path: string, encoding?: string): Promise<string> {
    const response = await this.messenger.sendMessage({
      type: "MainReadTextFile",
      path,
      encoding
    });
    if (response.type === "ErrorResponse") {
      reportMessagingError(`MainReadTextFile call failed: ${response.message}`);
      return null;
    } else if (response.type !== "TextContents") {
      reportUnexpectedMessageType(response.type);
      return null;
    } else {
      return response.contents;
    }
  }

  /**
   * Read a binary file from the specified path
   * @param path Absolute path, or one relative to the dist/assets (public) folder
   * @returns The contents of a file as an Uint8Array instance
   */
  async readBinaryFile (path: string): Promise<Uint8Array> {
    const response = await this.messenger.sendMessage({
      type: "MainReadBinaryFile",
      path
    });
    if (response.type === "ErrorResponse") {
      reportMessagingError(`MainBinaryTextFile call failed: ${response.message}`);
      return null;
    } else if (response.type !== "BinaryContents") {
      reportUnexpectedMessageType(response.type);
      return null;
    } else {
      return response.contents;
    }
  }

  /**
   * Writes a text file to the specified path
   * @param _path Absolute path, or one relative to the user's home folder
   * @param _contents File contents to write
   * @param _encoding Text encoding ("utf8", by default)
   */
  writeTextFile (
    _path: string,
    _contents: string,
    _encoding?: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  /**
   * Writes a binary file to the specified path
   * @param _path Absolute path, or one relative to the user's home folder
   * @param _contents File contents to write
   */
  writeBinaryFile (_path: string, _contents: Uint8Array): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
