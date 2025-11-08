import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This block is an analogue of the CALL Subroutine statement.
 *
 * It basically executes a sequence of blocks that are somewhere else and then goes back to the next block. Because
 * more than one call can be normally used you can include a list of sequences to be called. The 'nesting' of call
 * blocks is also not allowed for the simplicity reasons. You can, of course, use the CALL blocks in the LOOP sequences
 * and vice versa.
 */
export class TzxCallSequenceBlock extends TzxBlockBase {
  /**
   * Number of group name
   */
  numberOfCalls: number;

  /**
   * Group name bytes
   */
  blockOffsets: number[];

  get blockId (): number {
    return 0x26;
  }

  readFrom (reader: BinaryReader): void {
    this.numberOfCalls = reader.readByte();
    this.blockOffsets = TzxBlockBase.readWords(reader, this.numberOfCalls);
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.numberOfCalls);
    if (!this.blockOffsets) return;
    TzxBlockBase.writeWords(writer, this.blockOffsets);
  }
}
