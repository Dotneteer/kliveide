import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * If you have a sequence of identical blocks, or of identical
 * groups of blocks, you can use this block to tell how many
 * times they should be repeated.
 */
export class TzxLoopStartBlock extends TzxBlockBase {
  /**
   * Number of repetitions (greater than 1)
   */
  loops: number;

  get blockId (): number {
    return 0x24;
  }

  readFrom (reader: BinaryReader): void {
    this.loops = reader.readUint16();
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.loops);
  }
}
