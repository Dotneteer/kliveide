import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This is meant to identify parts of the tape, so you know where level 1 starts,
 * where to rewind to when the game ends, etc.
 *
 * This description is not guaranteed to be shown while the tape is playing,
 * but can be read while browsing the tape or changing the tape pointer.
 */
export class TzxTextDescriptionBlock extends TzxBlockBase {
  /**
   * Length of the description
   */
  descriptionLength: number;

  /**
   * The description bytes
   */
  description: Uint8Array;

  /**
   * The string form of description
   */
  get descriptionText (): string {
    return TzxBlockBase.toAsciiString(this.description);
  }

  get blockId (): number {
    return 0x30;
  }

  readFrom (reader: BinaryReader): void {
    this.descriptionLength = reader.readByte();
    this.description = new Uint8Array(reader.readBytes(this.descriptionLength));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.descriptionLength);
    writer.writeBytes(this.description!);
  }
}
