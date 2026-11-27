import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { Tzx3ByteBlockBase } from "./Tzx3ByteBlockBase";
import { TapeDataBlock, type TapePulses } from "@common/structs/TapeDataBlock";

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

  /**
   * The samples (one a bit, most significant first) as pulses: each run of equal samples is one pulse. A
   * player makes an edge at every pulse's end, so the block's levels are kept relative: if the level before it
   * differs from its first sample, the whole block plays inverted (a loader timing edges does not see it).
   */
  getDataBlock (): TapeDataBlock {
    const pulses: TapePulses[] = [];
    let level = -1;
    let run = 0;
    for (let i = 0; i < this.data.length; i++) {
      const bits = i === this.data.length - 1 && this.lastByteUsedBits > 0 ? this.lastByteUsedBits : 8;
      for (let b = 0; b < bits; b++) {
        const sample = (this.data[i] >> (7 - b)) & 1;
        if (sample !== level && run > 0) {
          pulses.push({ length: run * this.tactsPerSample, count: 1 });
          run = 0;
        }
        level = sample;
        run++;
      }
    }
    if (run > 0) pulses.push({ length: run * this.tactsPerSample, count: 1 });
    const block = new TapeDataBlock();
    block.pulses = pulses;
    block.pauseAfter = this.pauseAfter;
    return block;
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
