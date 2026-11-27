import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxPulseSequenceBlock extends TzxBlockBase {
  /**
   * Pause after this block
   */
  pulseCount: number;

  /**
   * Lenght of block data
   */
  pulseLengths: number[];

  get blockId (): number {
    return 0x13;
  }

  getDataBlock (): TapeDataBlock {
    const block = new TapeDataBlock();
    block.pulses = this.pulseLengths.map((length) => ({ length, count: 1 }));
    block.pauseAfter = 0;
    return block;
  }

  readFrom (reader: BinaryReader): void {
    this.pulseCount = reader.readByte();
    this.pulseLengths = TzxBlockBase.readWords(reader, this.pulseCount);
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.pulseCount);
    TzxBlockBase.writeWords(writer, this.pulseLengths!);
  }

  get isValid (): boolean {
    return this.pulseCount === this.pulseLengths.length;
  }
}
