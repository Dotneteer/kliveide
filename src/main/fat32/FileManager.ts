import * as fs from "fs";
import * as path from "path";
import { Fat32Volume } from "./Fat32Volume";
import { O_RDONLY } from "./Fat32Types";

const CHUNK_SIZE = 64 * 1024; // 64 KBimport { Fat32Volume } from "./Fat32Volume";

/**
 * This class is responsible for copying files and directories to and from the FAT32 volume.
 */
export class FileManager {
  constructor(public readonly volume: Fat32Volume) {}

  async copyFiles(sourcePath: string, targetPath: string) {
    // Define how you want to handle folders and files
    const handleFolder = async (fullPath: string) => {
      console.log(`Creating folder: ${fullPath}`);
      this.volume.mkdir(path.join(targetPath, fullPath));
    };

    const handleFile = async (fullPath: string) => {
      console.log(`Copying file: ${fullPath}`);
      const sourceFilename = path.join(sourcePath, fullPath);
      const targetFile = this.volume.createFile(path.join(targetPath, fullPath));
      const fileHandle = await fs.promises.open(sourceFilename, "r");
      const buffer = new Uint8Array(CHUNK_SIZE);

      let bytesRead = 0;
      let position = 0; // Tracks where in the file we are

      do {
        // Read up to CHUNK_SIZE from the file
        const { bytesRead: read } = await fileHandle.read(
          buffer,
          0, // Write offset in the buffer
          CHUNK_SIZE, // Number of bytes to read
          position // Position in the file to start reading
        );

        bytesRead = read;
        position += read;

        if (read > 0) {
          // --- Extract the valid slice of data
          const chunk = buffer.slice(0, read);
          targetFile.writeFileData(chunk);
        }
      } while (bytesRead > 0);
      await fileHandle.close();
      targetFile.close();
    };

    // Start reading a given directory
    await this.readDirectoryRecursive(sourcePath, "", handleFile, handleFolder);
  }

  async copyFile(sourceFilePath: string, targetFilePath: string) {
    // Create the target directory if it doesn't exist
    const targetDir = this.volume.open(targetFilePath, O_RDONLY);
    if (!targetDir) {
      const dirPath = path.dirname(targetFilePath);
      this.volume.mkdir(dirPath);
    }

    // Create the target file in the FAT32 volume
    this.volume.remove(targetFilePath); // Remove if it already exists
    const targetFile = this.volume.createFile(targetFilePath);
    const fileHandle = await fs.promises.open(sourceFilePath, "r");
    const buffer = new Uint8Array(CHUNK_SIZE);

    let bytesRead = 0;
    let position = 0; // Tracks where in the file we are

    try {
      do {
        // Read up to CHUNK_SIZE from the file
        const { bytesRead: read } = await fileHandle.read(
          buffer,
          0, // Write offset in the buffer
          CHUNK_SIZE, // Number of bytes to read
          position // Position in the file to start reading
        );

        bytesRead = read;
        position += read;

        if (read > 0) {
          // --- Extract the valid slice of data
          const chunk = buffer.slice(0, read);
          targetFile.writeFileData(chunk);
        }
      } while (bytesRead > 0);
    } finally {
      await fileHandle.close();
      targetFile?.close();
    }
  }

  private async readDirectoryRecursive(
    root: string,
    subpath: string,
    handleFile: (fullPath: string) => Promise<void> | void,
    handleFolder: (fullPath: string) => Promise<void> | void
  ): Promise<void> {
    let entries: fs.Dirent[];
    const directory = path.join(root, subpath);

    try {
      // Read the directory contents with Dirent objects
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch (err) {
      console.error(`Error reading directory "${directory}":`, err);
      return;
    }

    // Loop over each entry in the current directory
    for (const entry of entries) {
      // Build the full path from the root
      const fullPath = path.join(subpath, entry.name);

      if (entry.isDirectory()) {
        // If it's a folder, call handleFolder
        await handleFolder(fullPath);

        // Recurse into subfolder
        await this.readDirectoryRecursive(root, fullPath, handleFile, handleFolder);
      } else if (entry.isFile()) {
        // If it's a file, call handleFile
        await handleFile(fullPath);
      }
    }
  }
}
