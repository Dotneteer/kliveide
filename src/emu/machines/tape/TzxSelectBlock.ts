import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";
import { TzxSelect } from "./TzxSelect";

/**
 * Pause (silence) or 'Stop the Tape' block
 */
export class TzxSelectBlock extends TzxBlockBase {
  /**
   * Length of the whole block (without these two bytes)
   */
  length: number;

  /**
   * Number of selections
   */
  selectionCount: number;

  /**
   * List of selections
   */
  selections: TzxSelect[];

  get blockId (): number {
    return 0x28;
  }

  readFrom (reader: BinaryReader): void {
    this.length = reader.readUint16();
    this.selectionCount = reader.readByte();
    this.selections = [];
    for (let i = 0; i < this.selectionCount; i++) {
      const selection = new TzxSelect();
      selection.readFrom(reader);
      this.selections[i] = selection;
    }
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint16(this.length);
    writer.writeByte(this.selectionCount);
    if (!this.selections) return;
    for (const selection of this.selections) {
      selection.writeTo(writer);
    }
  }
}
