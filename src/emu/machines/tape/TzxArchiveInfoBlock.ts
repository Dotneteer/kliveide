import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { Tzx3ByteBlockBase } from "./Tzx3ByteBlockBase";
import { TzxText } from "./TzxText";

/**
 * Represents the archive info block in a TZX file
 */
export class TzxArchiveInfoBlock extends Tzx3ByteBlockBase {
  /**
   * Length of the whole block (without these two bytes)
   */
  length: number;

  /**
   * Number of text strings
   */
  stringCount: number;

  /**
   * List of text strings
   */
  textStrings: TzxText[];

  /**
   * The ID of the block
   */
  get blockId (): number {
    return 0x32;
  }

  readFrom (reader: BinaryReader): void {
    this.length = reader.readUint16();
    this.stringCount = reader.readByte();
    this.textStrings = [];
    for (let i = 0; i < this.stringCount; i++) {
      const text = new TzxText();
      text.readFrom(reader);
      this.textStrings[i] = text;
    }
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.length);
    writer.writeByte(this.stringCount);
    if (!this.textStrings) return;
    for (const text of this.textStrings) {
      text.writeTo(writer);
    }
  }
}
