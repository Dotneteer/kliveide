import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { Tzx3ByteBlockBase } from "./Tzx3ByteBlockBase";

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxTurboSpeedBlock extends Tzx3ByteBlockBase {
  /**
   * Length of pilot pulse
   */
  pilotPulseLength: number;

  /**
   * Length of the first sync pulse
   */
  sync1PulseLength: number;

  /**
   * Length of the second sync pulse
   */
  sync2PulseLength: number;

  /**
   * Length of the zero bit
   */
  zeroBitPulseLength: number;

  /**
   * Length of the one bit
   */
  oneBitPulseLength: number;

  /**
   * Length of the pilot tone
   */
  pilotToneLength: number;

  /**
   * Pause after this block
   */
  pauseAfter: number;

  constructor () {
    super();
    this.pilotPulseLength = 2168;
    this.sync1PulseLength = 667;
    this.sync2PulseLength = 735;
    this.zeroBitPulseLength = 855;
    this.oneBitPulseLength = 1710;
    this.pilotToneLength = 8063;
    this.lastByteUsedBits = 8;
  }

  get blockId (): number {
    return 0x11;
  }

  getDataBlock (): TapeDataBlock {
    const block = new TapeDataBlock();
    block.data = new Uint8Array(this.data);
    return block;
  }

  readFrom (reader: BinaryReader): void {
    this.pilotPulseLength = reader.readUint16();
    this.sync1PulseLength = reader.readUint16();
    this.sync2PulseLength = reader.readUint16();
    this.zeroBitPulseLength = reader.readUint16();
    this.oneBitPulseLength = reader.readUint16();
    this.pilotToneLength = reader.readUint16();
    this.lastByteUsedBits = reader.readByte();
    this.pauseAfter = reader.readUint16();
    this.dataLength = reader.readBytes(3);
    this.data = reader.readBytes(this.getLength());
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.pilotPulseLength);
    writer.writeUint16(this.sync1PulseLength);
    writer.writeUint16(this.sync2PulseLength);
    writer.writeUint16(this.zeroBitPulseLength);
    writer.writeUint16(this.oneBitPulseLength);
    writer.writeUint16(this.pilotToneLength);
    writer.writeByte(this.lastByteUsedBits);
    writer.writeUint16(this.pauseAfter);
    writer.writeBytes(new Uint8Array(this.dataLength));
    writer.writeBytes(new Uint8Array(this.data));
  }
}
