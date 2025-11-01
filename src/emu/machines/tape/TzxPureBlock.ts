import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { Tzx3ByteBlockBase } from "./Tzx3ByteBlockBase";

/**
 * Represents the pure tone block in a TZX file
 */
export class TzxPureBlock extends Tzx3ByteBlockBase {
  /**
   * Length of the zero bit
   */
  zeroBitPulseLength: number;

  /**
   * Length of the one bit
   */
  oneBitPulseLength: number;

  /**
   * Pause after this block
   */
  pauseAfter: number;

  get blockId (): number {
    return 0x14;
  }

  readFrom (reader: BinaryReader): void {
    this.zeroBitPulseLength = reader.readUint16();
    this.oneBitPulseLength = reader.readUint16();
    this.lastByteUsedBits = reader.readByte();
    this.pauseAfter = reader.readUint16();
    this.dataLength = reader.readBytes(3);
    this.data = reader.readBytes(this.getLength());
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.zeroBitPulseLength);
    writer.writeUint16(this.oneBitPulseLength);
    writer.writeByte(this.lastByteUsedBits);
    writer.writeUint16(this.pauseAfter);
    writer.writeBytes(new Uint8Array(this.dataLength));
    writer.writeBytes(new Uint8Array(this.data));
  }
}
