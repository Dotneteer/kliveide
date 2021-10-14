import { BinaryReader } from "@core/utils/BinaryReader";
import { BinaryWriter } from "@core/utils/BinaryWriter";
import { TapeFileReader, ITapeDataBlock } from "./tape-data";

/**
 * This class implements a reader that can handle TAP files
 */
export class TapReader extends TapeFileReader {
  /**
   * Reads the contents of the entire file.
   * @returns True, if read was successful; otherwise, false
   */
  readContents(): boolean {
    try {
      while (this.reader.position !== this.reader.length) {
        const tapBlock = new TapDataBlock();
        tapBlock.readFrom(this.reader);
        this.tapeFileBlocks.push(tapBlock);
      }
      return true;
    } catch (err) {
      // --- This exception is intentionally ignored
      return false;
    }
  }
}

/**
 * This class represents a generic TAP block
 */
class TapDataBlock implements ITapeDataBlock {
  /**
   * Block Data
   */
  data = new Uint8Array(0);

  /**
   * Pause after this block (given in milliseconds)
   */
  pauseAfter = 1000;

  /**
   * This contains the playable bytes of the block. If undefined, the
   * block has no bytes to play
   */
  playableBytes: Uint8Array = new Uint8Array(0);

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    const length = reader.readUint16();
    this.playableBytes = this.data = new Uint8Array(reader.readBytes(length));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.data.length);
    writer.writeBytes(this.data);
  }
}
