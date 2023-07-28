import { BinaryReader } from "@/common/utils/BinaryReader";
import { BinaryWriter } from "@/common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

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

  get blockId (): number {
    return 0x20;
  }

  readFrom (reader: BinaryReader): void {
    this.duration = reader.readUint16();
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.duration);
  }
}
