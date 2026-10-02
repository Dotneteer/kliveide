import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
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

  /**
   * The packed data stream: `totd` symbols of `ceil(log2(asd))` bits each, most significant bit
   * first. Kept raw - it is a bit stream, not the PRLE pairs `dataStream` once assumed.
   */
  dataBytes: Uint8Array = new Uint8Array(0);

  /**
   * Reads the block as TZX 1.20 describes it.
   *
   * The earlier reader assigned to `pilotStream[i].symbol` on an empty array, read no pulse lengths
   * for a symbol definition, and took the data stream for PRLE pairs, so any file holding a `$19`
   * block failed to open at all. Whatever this reads, the reader always ends at the block's declared
   * end, which keeps the blocks after it readable even if a definition is malformed.
   */
  readFrom (reader: BinaryReader): void {
    this.blockLength = reader.readUint32();
    const end = reader.position + this.blockLength;
    this.pauseAfter = reader.readUint16();
    this.totp = reader.readUint32();
    this.npp = reader.readByte();
    this.asp = reader.readByte();
    this.totd = reader.readUint32();
    this.npd = reader.readByte();
    this.asd = reader.readByte();

    this.pilotSymDef = [];
    this.pilotStream = [];
    if (this.totp > 0) {
      const asp = this.asp || 256;
      for (let i = 0; i < asp; i++) {
        const symDef = new TzxSymDef();
        symDef.readFrom(reader, this.npp);
        this.pilotSymDef[i] = symDef;
      }
      for (let i = 0; i < this.totp; i++) {
        const prle = new TzxPrle();
        prle.symbol = reader.readByte();
        prle.repetitions = reader.readUint16();
        this.pilotStream[i] = prle;
      }
    }

    this.dataSymDef = [];
    this.dataStream = [];
    this.dataBytes = new Uint8Array(0);
    if (this.totd > 0) {
      const asd = this.asd || 256;
      for (let i = 0; i < asd; i++) {
        const symDef = new TzxSymDef();
        symDef.readFrom(reader, this.npd);
        this.dataSymDef[i] = symDef;
      }
      const bitsPerSymbol = Math.max(1, Math.ceil(Math.log2(asd)));
      const byteCount = Math.min(
        Math.ceil((bitsPerSymbol * this.totd) / 8),
        Math.max(0, end - reader.position)
      );
      this.dataBytes = new Uint8Array(reader.readBytes(byteCount));
    }
    reader.seek(end);
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
    for (let i = 0; i < this.pilotSymDef.length; i++) {
      this.pilotSymDef[i].writeTo(writer);
    }

    for (let i = 0; i < this.pilotStream.length; i++) {
      writer.writeByte(this.pilotStream[i].symbol);
      writer.writeUint16(this.pilotStream[i].repetitions);
    }

    for (let i = 0; i < this.dataSymDef.length; i++) {
      this.dataSymDef[i].writeTo(writer);
    }
    writer.writeBytes(this.dataBytes);
  }
}
