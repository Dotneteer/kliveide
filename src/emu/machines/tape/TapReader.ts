import { TapeDataBlock } from "@/common/structs/TapeDataBlock";
import { BinaryReader } from "@/common/utils/BinaryReader";

/**
 * This class reads a TAP file
 */
export class TapReader {
  /// <summary>
  /// Data blocks of the TAP file
  /// </summary>
  dataBlocks: TapeDataBlock[];

  /**
   * Initializes the player from the specified reader
   * @param reader Reader to use
   */
  constructor (private readonly reader: BinaryReader) {
    this.dataBlocks = [];
  }

  /**
   * Reads in the content of the TAP file so that it can be played
   * @returns True, if read was successful; otherwise, false
   */
  readContent (): string | null {
    try {
      while (this.reader.position !== this.reader.length) {
        const tapBlock = new TapeDataBlock();
        const length = this.reader.readUint16();
        tapBlock.data = new Uint8Array(this.reader.readBytes(length));
        if (tapBlock.data.length !== length) {
          throw new Error("Error when reading TAP data block");
        }
        this.dataBlocks.push(tapBlock);
      }
      return null;
    } catch (err) {
      // --- This exception is intentionally ignored
      return err.message;
    }
  }
}
