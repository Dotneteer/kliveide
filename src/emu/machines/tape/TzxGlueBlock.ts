import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This block is generated when you merge two ZX Tape files together.
 *
 * It is here so that you can easily copy the files together and use
 * them. Of course, this means that resulting file would be 10 bytes
 * longer than if this block was not used. All you have to do if
 * you encounter this block ID is to skip next 9 bytes.
 */
export class TzxGlueBlock extends TzxBlockBase {
  /**
   * Value: { "XTape!", 0x1A, MajorVersion, MinorVersion }
   *
   * Just skip these 9 bytes and you will end up on the next ID.
   */
  glue: Uint8Array;

  get blockId (): number {
    return 0x5a;
  }

  readFrom (reader: BinaryReader): void {
    this.glue = new Uint8Array(reader.readBytes(9));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeBytes(this.glue);
  }
}
