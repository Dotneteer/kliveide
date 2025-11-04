import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

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
