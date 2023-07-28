import { TapeDataBlock } from "@/common/structs/TapeDataBlock";
import { BinaryReader } from "@/common/utils/BinaryReader";
import { BinaryWriter } from "@/common/utils/BinaryWriter";

/**
 * This class describes a generic TZX Block
 */
export abstract class TzxBlockBase {
  /**
   * The ID of the block
   */
  abstract get blockId(): number;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  abstract readFrom(reader: BinaryReader): void;

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  abstract writeTo(writer: BinaryWriter): void;

  /**
   * Override this method to check the content of the block
   */
  get isValid (): boolean {
    return true;
  }

  /**
   * Returns the data block this TZX block represents
   * @returns Data block, if the TZX block represents one; otherwise, undefined
   */
  getDataBlock (): TapeDataBlock | undefined {
    return undefined;
  }

  /// <summary>
  /// Reads the specified number of words from the reader.
  /// </summary>
  /// <param name="reader">Reader to obtain the input from</param>
  /// <param name="count">Number of words to get</param>
  /// <returns>Word array read from the input</returns>
  static readWords (reader: BinaryReader, count: number): number[] {
    const result: number[] = [];
    const bytes = reader.readBytes(2 * count);
    for (let i = 0; i < count; i++) {
      result[i] = (bytes[i * 2] + bytes[i * 2 + 1]) << 8;
    }
    return result;
  }

  /**
   * Writes the specified array of words to the writer
   * @param writer Output
   * @param words Word array
   */
  static writeWords (writer: BinaryWriter, words: number[]): void {
    for (const word of words) {
      writer.writeUint16(word);
    }
  }

  /**
   * Converts the provided bytes to an ASCII string
   * @param bytes Bytes to convert
   * @param offset First byte offset
   * @param count Number of bytes
   * @returns ASCII string representation
   */
  static toAsciiString (bytes: Uint8Array, offset = 0, count = -1): string {
    if (count < 0) count = bytes.length - offset;
    let sb = "";
    for (let i = 0; i < count; i++) {
      sb += String.fromCharCode(bytes[i + offset]);
    }
    return sb;
  }
}
