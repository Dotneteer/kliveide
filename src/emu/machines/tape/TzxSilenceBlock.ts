import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";
import { TapeDataBlock } from "../../../common/structs/TapeDataBlock";

/**
 * Pause (silence) or 'Stop the Tape' block
 */
export class TzxSilenceBlock extends TzxBlockBase {
  /**
   * Duration of silence
   *
   * This will make a silence (low amplitude level (0)) for a given time
   * in milliseconds. If the value is 0 then the emulator or utility should
   * (in effect) STOP THE TAPE, i.e. should not continue loading until
   * the user or emulator requests it.
   */
  duration: number;

  get blockId(): number {
    return 0x20;
  }

  /**
   * Returns the data block this TZX block represents
   */
  getDataBlock(): TapeDataBlock {
    const block = new TapeDataBlock();
    block.data = new Uint8Array(0); // No data for silence block
    block.pauseAfter = this.duration;
    block.pilotPulseLength = 0; // No pilot pulse for silence block
    block.sync1PulseLength = 0; // No sync pulse for silence block
    block.sync2PulseLength = 0; // No sync pulse for silence block
    block.zeroBitPulseLength = 0; // No zero bit for silence block
    block.oneBitPulseLength = 0; // No one bit for silence block
    block.endSyncPulseLength = 0; // No end sync for silence block
    block.lastByteUsedBits = 0; // No bits used in silence block

    return block;
  }

  readFrom(reader: BinaryReader): void {
    this.duration = reader.readUint16();
  }

  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.duration);
  }
}
