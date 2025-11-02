import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This block will enable you to jump from one block to another within the file.
 *
 * Jump 0 = 'Loop Forever' - this should never happen
 * Jump 1 = 'Go to the next block' - it is like NOP in assembler
 * Jump 2 = 'Skip one block'
 * Jump -1 = 'Go to the previous block'
 */
export class TzxJumpBlock extends TzxBlockBase {
  /**
   * Relative jump value
   */
  jump: number;

  get blockId (): number {
    return 0x23;
  }

  readFrom (reader: BinaryReader): void {
    this.jump = reader.readUint16();
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.jump);
  }
}
