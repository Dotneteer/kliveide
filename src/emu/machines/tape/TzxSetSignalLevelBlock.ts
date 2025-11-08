import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This block sets the current signal level to the specified value (high or low).
 */
export class TzxSetSignalLevelBlock extends TzxBlockBase {
  /**
   * Length of the block without these four bytes
   */
  length = 1;

  /**
   * Signal level (0=low, 1=high)
   */
  signalLevel: number;

  get blockId (): number {
    return 0x2b;
  }

  readFrom (reader: BinaryReader): void {
    reader.readUint32();
    this.signalLevel = reader.readByte();
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint32(this.length);
    writer.writeByte(this.signalLevel);
  }
}
