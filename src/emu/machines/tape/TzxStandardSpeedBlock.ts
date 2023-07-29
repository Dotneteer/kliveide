import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxStandardSpeedBlock extends TzxBlockBase {
  /**
   * Pause after this block (default: 1000ms)
   */
  pauseAfter = 1000;

  /**
   * Lenght of block data
   */
  dataLength: number;

  /**
   * Block Data
   */
  data: Uint8Array;

  get blockId (): number {
    return 0x10;
  }

  /**
   * Returns the data block this TZX block represents
   */
  getDataBlock (): TapeDataBlock {
    const block = new TapeDataBlock();
    block.data = this.data;
    return block;
  }

  readFrom (reader: BinaryReader): void {
    this.pauseAfter = reader.readUint16();
    this.dataLength = reader.readUint16();
    this.data = new Uint8Array(reader.readBytes(this.dataLength));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.blockId);
    writer.writeUint16(this.pauseAfter);
    writer.writeUint16(this.dataLength);
    writer.writeBytes(this.data);
  }
}
