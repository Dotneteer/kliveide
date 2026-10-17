import { t } from "@common/i18n/i18n";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@utils/BinaryReader";

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
    } catch {
      // --- A block (or its length word) runs past the end of the file: say which one
      return t("media.tape.tapTruncated", { block: this.dataBlocks.length + 1 });
    }
  }
}
