import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";
import { TzxPrle } from "./TzxPrle";
import { TzxSymDef } from "./TzxSymDef";

/**
 * Represents a generalized data block in a TZX file
 */
export class TzxGeneralizedBlock extends TzxBlockBase {
  /**
   * Block length (without these four bytes)
   */
  blockLength: number;

  /**
   * Pause after this block
   */
  pauseAfter: number;

  /**
   * Total number of symbols in pilot/sync block (can be 0)
   */
  totp: number;

  /**
   * Maximum number of pulses per pilot/sync symbol
   */
  npp: number;

  /**
   * Number of pilot/sync symbols in the alphabet table (0=256)
   */
  asp: number;

  /**
   * Total number of symbols in data stream (can be 0)
   */
  totd: number;

  /**
   * Maximum number of pulses per data symbol
   */
  npd: number;

  /**
   * Number of data symbols in the alphabet table (0=256)
   */
  asd: number;

  /**
   * Pilot and sync symbols definition table
   *
   * This field is present only if Totp > 0
   */
  pilotSymDef: TzxSymDef[];

  /**
   * Pilot and sync data stream
   *
   * This field is present only if Totd > 0
   */
  pilotStream: TzxPrle[];

  /**
   * Data symbols definition table
   *
   * This field is present only if Totp > 0
   */
  dataSymDef: TzxSymDef[];

  /**
   * Data stream
   *
   * This field is present only if Totd > 0
   */
  dataStream: TzxPrle[];

  get blockId (): number {
    return 0x19;
  }

  readFrom (reader: BinaryReader): void {
    this.blockLength = reader.readUint32();
    this.pauseAfter = reader.readUint16();
    this.totp = reader.readUint32();
    this.npp = reader.readByte();
    this.asp = reader.readByte();
    this.totd = reader.readUint32();
    this.npd = reader.readByte();
    this.asd = reader.readByte();

    this.pilotSymDef = [];
    for (let i = 0; i < this.asp; i++) {
      const symDef = new TzxSymDef();
      symDef.readFrom(reader);
      this.pilotSymDef[i] = symDef;
    }

    this.pilotStream = [];
    for (let i = 0; i < this.totp; i++) {
      this.pilotStream[i].symbol = reader.readByte();
      this.pilotStream[i].repetitions = reader.readUint16();
    }

    this.dataSymDef = [];
    for (let i = 0; i < this.asd; i++) {
      const symDef = new TzxSymDef();
      symDef.readFrom(reader);
      this.dataSymDef[i] = symDef;
    }

    this.dataStream = [];
    for (let i = 0; i < this.totd; i++) {
      this.dataStream[i].symbol = reader.readByte();
      this.dataStream[i].repetitions = reader.readUint16();
    }
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeUint32(this.blockLength);
    writer.writeUint16(this.pauseAfter);
    writer.writeUint32(this.totp);
    writer.writeByte(this.npp);
    writer.writeByte(this.asp);
    writer.writeUint32(this.totd);
    writer.writeByte(this.npd);
    writer.writeByte(this.asd);
    for (let i = 0; i < this.asp; i++) {
      this.pilotSymDef[i].writeTo(writer);
    }

    for (let i = 0; i < this.totp; i++) {
      writer.writeByte(this.pilotStream[i].symbol);
      writer.writeUint16(this.pilotStream[i].repetitions);
    }

    for (let i = 0; i < this.asd; i++) {
      this.dataSymDef[i].writeTo(writer);
    }

    for (let i = 0; i < this.totd; i++) {
      writer.writeByte(this.dataStream[i].symbol);
      writer.writeUint16(this.dataStream[i].repetitions);
    }
  }
}
