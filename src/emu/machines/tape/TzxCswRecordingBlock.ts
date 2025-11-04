import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxCswRecordingBlock extends TzxBlockBase {
  /**
   * Block length (without these four bytes)
   */
  blockLength: number;

  /**
   * Pause after this block
   */
  pauseAfter: number;

  /**
   * Sampling rate
   */
  samplingRate: Uint8Array;

  /**
   * Compression type
   * 0x01=RLE, 0x02=Z-RLE
   */
  compressionType: number;

  /**
   * Number of stored pulses (after decompression, for validation purposes)
   */
  pulseCount: number;

  /**
   * CSW data, encoded according to the CSW file format specification
   */
  data: Uint8Array;

  get blockId (): number {
    return 0x18;
  }

  readFrom (reader: BinaryReader): void {
    this.blockLength = reader.readUint32();
    this.pauseAfter = reader.readUint16();
    this.samplingRate = new Uint8Array(reader.readBytes(3));
    this.compressionType = reader.readByte();
    this.pulseCount = reader.readUint32();
    const length =
      this.blockLength -
      4 /* PauseAfter*/ -
      3 /* SamplingRate */ -
      1 /* CompressionType */ -
      4; /* PulseCount */
    this.data = new Uint8Array(reader.readBytes(length));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint32(this.blockLength);
    writer.writeUint16(this.pauseAfter);
    writer.writeBytes(this.samplingRate);
    writer.writeByte(this.compressionType);
    writer.writeUint32(this.pulseCount);
    writer.writeBytes(this.data);
  }

  get isValid (): boolean {
    return this.blockLength == 4 + 3 + 1 + 4 + this.data.length;
  }
}
