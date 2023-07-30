import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This block represents select structure
 */
export class TzxSelect {
  /**
   * Bit 0 - Bit 1: Starting symbol polarity
   *
   * 00: opposite to the current level (make an edge, as usual) - default
   * 01: same as the current level(no edge - prolongs the previous pulse)
   * 10: force low level
   * 11: force high level
   */
  blockOffset: number;

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

  readFrom (reader: BinaryReader): void {
    this.blockOffset = reader.readUint16();
    this.descriptionLength = reader.readByte();
    this.description = new Uint8Array(reader.readBytes(this.descriptionLength));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.blockOffset);
    writer.writeByte(this.descriptionLength);
    writer.writeBytes(this.description);
  }
}
