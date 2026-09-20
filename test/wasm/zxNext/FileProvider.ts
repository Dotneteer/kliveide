import path from "path";
import fs from "fs";
import { IFileProvider } from "@renderer/core/IFileProvider";

/**
 * This class implements a file provider to read and write files throught the main process
 */
export class FileProvider implements IFileProvider {
  async readTextFile(path: string, encoding?: string): Promise<string> {
    const fullPath = this.resolvePath(path);
    return fs.readFileSync(fullPath, {
      encoding: (encoding ?? "utf8") as BufferEncoding
    });
  }

  /**
   * Read a binary file from the specified path
   * @param path Absolute path, or one relative to the dist/assets (public) folder
   * @returns The contents of a file as an Uint8Array instance
   */
  async readBinaryFile(path: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(path);
    return fs.readFileSync(fullPath);
  }

  writeTextFile(_path: string, _contents: string, _encoding?: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  writeBinaryFile(_path: string, _contents: Uint8Array): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private resolvePath(inputPath: string, resolveIn?: string): string {
    if (path.isAbsolute(inputPath)) return inputPath;

    inputPath = path.join(__dirname, "../../src/public", inputPath);
    return inputPath;
  }
}
