import { BinaryReader } from "@core/utils/BinaryReader";
import { BinaryWriter } from "@core/utils/BinaryWriter";
import { WasmMachineApi } from "@ext-core/abstract-vm";
import { MemoryHelper } from "@ext-core/memory-helpers";
import { TAPE_DATA_BUFFER } from "@ext/vm-zx-spectrum/wa-memory-map";

/**
 * Defines the serialization operations of a TZX record
 */
export interface ITapeDataSerialization {
  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void;

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void;
}

/**
 * Represents a data block in a generic tape format
 */
export interface ITapeDataBlock extends ITapeDataSerialization {
  /**
   * Data of the block
   */
  data: Uint8Array;

  /**
   * This contains the playable bytes of the block. If undefined, the
   * block has no bytes to play
   */
  playableBytes?: Uint8Array;
}

/**
 * This class represents abstract class that can read a ZX Spectrum tape
 * file with one or more block.
 */
export abstract class TapeFileReader {
  /**
   * All blocks that belong to the file
   */
  readonly tapeFileBlocks: ITapeDataBlock[];

  /**
   * Major version number of the file
   */
  majorVersion = 0;

  /**
   * Minor version number of the file
   */
  minorVersion = 0;

  /**
   * Instantiates a tape file reader object
   * @param reader Use this reader to obtain the contents of the file
   */
  constructor(public reader: BinaryReader) {
    this.tapeFileBlocks = [];
  }

  /**
   * Reads the contents of the entire file.
   * @returns True, if read was successful; otherwise, false
   */
  abstract readContents(): boolean;

  /**
   * Send the playable contents to the engine
   * @param api API instance to communicate with the machine
   * @returns The number of data blocks sent
   */
  sendTapeFileToEngine(api: WasmMachineApi): number {
    const mh = new MemoryHelper(api, TAPE_DATA_BUFFER);
    let offset = 0;
    let count = 0;
    for (const dataBlock of this.tapeFileBlocks) {
      const playable = dataBlock.playableBytes;
      if (playable && playable.length > 0) {
        mh.writeUint16(offset, playable.length);
        offset += 2;
        for (let i = 0; i < playable.length; i++) {
          mh.writeByte(offset++, playable[i]);
        }
        count++;
      }
    }
    return count;
  }
}
