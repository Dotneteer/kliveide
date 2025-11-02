import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This is meant to identify parts of the tape, so you know where level 1 starts, where to rewind to when the game
 * ends, etc.
 *
 * This description is not guaranteed to be shown while the tape is playing, but can be read while browsing the tape or
 * changing the tape pointer.
 */
export class TzxText {
  /**
   * Text identification byte.
   *
   * 00 - Full title
   * 01 - Software house/publisher
   * 02 - Author(s)
   * 03 - Year of publication
   * 04 - Language
   * 05 - Game/utility type
   * 06 - Price
   * 07 - Protection scheme/loader
   * 08 - Origin
   * FF - Comment(s)
   */
  type: number;

  /**
   * Length of the description
   */
  length: number;

  /**
   * The description bytes
   */
  public textBytes: Uint8Array;

  /**
   * The string the bytes of this block represent
   */
  get text (): string {
    return TzxBlockBase.toAsciiString(this.textBytes);
  }

  readFrom (reader: BinaryReader): void {
    this.type = reader.readByte();
    this.length = reader.readByte();
    this.textBytes = new Uint8Array(reader.readBytes(this.length));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.type);
    writer.writeByte(this.length);
    writer.writeBytes(this.textBytes);
  }
}
