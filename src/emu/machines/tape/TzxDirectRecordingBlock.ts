import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { Tzx3ByteBlockBase } from "./Tzx3ByteBlockBase";

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxDirectRecordingBlock extends Tzx3ByteBlockBase {
  /**
   * Number of T-states per sample (bit of data)
   */
  tactsPerSample: number;

  /**
   * Pause after this block
   */
  pauseAfter: number;

  get blockId (): number {
    return 0x15;
  }

  readFrom (reader: BinaryReader): void {
    this.tactsPerSample = reader.readUint16();
    this.pauseAfter = reader.readUint16();
    this.lastByteUsedBits = reader.readByte();
    this.dataLength = reader.readBytes(3);
    this.data = reader.readBytes(this.getLength());
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.tactsPerSample);
    writer.writeUint16(this.pauseAfter);
    writer.writeByte(this.lastByteUsedBits);
    writer.writeBytes(new Uint8Array(this.dataLength));
    writer.writeBytes(new Uint8Array(this.data));
  }
}
