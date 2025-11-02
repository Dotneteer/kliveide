import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { Tzx3ByteBlockBase } from "./Tzx3ByteBlockBase";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxCustomInfoBlock extends Tzx3ByteBlockBase {
  /**
   * Identification string (in ASCII)
   */
  id: Uint8Array;

  /**
   * String representation of the ID
   */
  get idText (): string {
    return TzxBlockBase.toAsciiString(this.id);
  }

  /**
   * Length of the custom info
   */
  length: number;

  /**
   * Custom information
   */
  customInfo: Uint8Array;

  get blockId (): number {
    return 0x35;
  }

  readFrom (reader: BinaryReader): void {
    this.id = new Uint8Array(reader.readBytes(10));
    this.length = reader.readUint32();
    this.customInfo = new Uint8Array(reader.readBytes(this.length));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeBytes(this.id);
    writer.writeUint32(this.length);
    writer.writeBytes(this.customInfo);
  }
}
