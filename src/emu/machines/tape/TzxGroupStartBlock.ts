import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This block marks the start of a group of blocks which are
 * to be treated as one single (composite) block.
 */
export class TzxGroupStartBlock extends TzxBlockBase {
  /**
   * Number of group name
   */
  length: number;

  /**
   * Group name bytes
   */
  chars: Uint8Array;

  /**
   * Gets the group name
   */
  get groupName (): string {
    return TzxBlockBase.toAsciiString(this.chars);
  }

  get blockId (): number {
    return 0x21;
  }

  readFrom (reader: BinaryReader): void {
    this.length = reader.readByte();
    this.chars = new Uint8Array(reader.readBytes(this.length));
  }

  writeTo (writer: BinaryWriter) {
    writer.writeByte(this.length);
    writer.writeBytes(this.chars);
  }
}
