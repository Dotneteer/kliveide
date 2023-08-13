import { IFileProvider } from "@renderer/core/IFileProvider";
import {
  BinaryContentsResponse,
  TextContentsResponse
} from "@messaging/any-to-main";
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
    } else if (response.type !== "TextContents") {
      reportUnexpectedMessageType(response.type);
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
      reportMessagingError(`MainReadTextFile call failed: ${response.message}`);
    } else if (response.type !== "BinaryContents") {
      reportUnexpectedMessageType(response.type);
    } else {
      return response.contents;
    }
  }

  /**
   * Writes a text file to the specified path
   * @param path Absolute path, or one relative to the user's home folder
   * @param contents File contents to write
   * @param encoding Text encoding ("utf8", by default)
   */
  writeTextFile (
    path: string,
    contents: string,
    encoding?: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  /**
   * Writes a binary file to the specified path
   * @param path Absolute path, or one relative to the user's home folder
   * @param contents File contents to write
   */
  writeBinaryFile (path: string, contents: Uint8Array): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
