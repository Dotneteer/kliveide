import * as fs from 'fs';
import { ReadStream } from 'fs';
import { Fat32Volume } from './Fat32Volume';

const CHUNK_SIZE = 64 * 1024; // 64 KBimport { Fat32Volume } from "./Fat32Volume";


/**
 * This class is responsible for copying files and directories to and from the FAT32 volume.
 */
export class FileManager {
  constructor(public readonly volume: Fat32Volume) {
  }

  copyToHostVolume(sourcePath: string, destPath: string): void {
    
  }

  async readFileIn64KBChunks(
    filePath: string,
    onChunk: (chunk: Buffer, index: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let chunkIndex = 0;
  
      // Create a read stream with a highWaterMark = 64 KB
      const readStream: ReadStream = fs.createReadStream(filePath, {
        highWaterMark: CHUNK_SIZE,
      });
  
      // Handle each chunk of data
      readStream.on('data', (chunk: Buffer) => {
        onChunk(chunk, chunkIndex);
        chunkIndex += 1;
      });
  
      // Resolve the promise once the stream ends
      readStream.on('end', () => {
        resolve();
      });
  
      // Reject the promise if there's an error
      readStream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}