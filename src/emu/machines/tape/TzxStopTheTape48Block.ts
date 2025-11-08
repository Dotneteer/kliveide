import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * When this block is encountered, the tape will stop ONLY if the machine is an 48K Spectrum.
 *
 * This block is to be used for multiloading games that load one
 * level at a time in 48K mode, but load the entire tape at once
 * if in 128K mode. This block has no body of its own, but follows
 * the extension rule.
 */
export class TzxStopTheTape48Block extends TzxBlockBase {
  /**
   * Length of the block without these four bytes (0)
   */
  length = 0;

  /**
   * The ID of the block
   */
  get blockId (): number {
    return 0x2a;
  }

  readFrom (reader: BinaryReader): void {
    reader.readUint32();
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint32(this.length);
  }
}
