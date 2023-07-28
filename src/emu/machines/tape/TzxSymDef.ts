import { BinaryReader } from "@/common/utils/BinaryReader";
import { BinaryWriter } from "@/common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This block represents an extremely wide range of data encoding techniques.
 *
 * The basic idea is that each loading component (pilot tone, sync pulses, data)
 * is associated to a specific sequence of pulses, where each sequence (wave) can
 * contain a different number of pulses from the others. In this way we can have
 * a situation where bit 0 is represented with 4 pulses and bit 1 with 8 pulses.
 */
export class TzxSymDef {
  /**
   * Bit 0 - Bit 1: Starting symbol polarity
   *
   * 00: opposite to the current level (make an edge, as usual) - default
   * 01: same as the current level(no edge - prolongs the previous pulse)
   * 10: force low level
   * 11: force high level
   */
  symbolFlags: number;

  /**
   * The array of pulse lengths
   */
  pulseLengths: number[];

  constructor () {
    this.pulseLengths = [];
  }

  readFrom (reader: BinaryReader): void {
    this.symbolFlags = reader.readByte();
    this.pulseLengths = TzxBlockBase.readWords(
      reader,
      this.pulseLengths.length
    );
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.symbolFlags);
    TzxBlockBase.writeWords(writer, this.pulseLengths);
  }
}
