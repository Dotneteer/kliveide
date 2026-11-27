import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxPureToneBlock extends TzxBlockBase {
  /**
   * Pause after this block
   */
  pulseLength: number;

  /**
   * Lenght of block data
   */
  pulseCount: number;

  get blockId(): number {
    return 0x12;
  }

  getDataBlock(): TapeDataBlock {
    // --- Pulses: a block with an empty data part plays only its pause in the Spectrum-family player
    const block = new TapeDataBlock();
    block.pulses = [{ length: this.pulseLength, count: this.pulseCount }];
    block.pauseAfter = 0;
    return block;
  }

  readFrom(reader: BinaryReader): void {
    this.pulseLength = reader.readUint16();
    this.pulseCount = reader.readUint16();
  }

  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.pulseLength);
    writer.writeUint16(this.pulseCount);
  }
}
