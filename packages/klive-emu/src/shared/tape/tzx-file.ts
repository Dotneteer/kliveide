import { BinaryReader } from "../utils/BinaryReader";
import { BinaryWriter } from "../utils/BinaryWriter";
import {
  TapeFileReader,
  ITapeDataBlock,
  ITapeDataSerialization,
} from "../../renderer/machines/zx-spectrum/tape-data";

/**
 * The signature of a TZX file
 */
const TzxSignature = new Uint8Array([0x5a, 0x58, 0x54, 0x61, 0x70, 0x65, 0x21]);

/**
 * Represents the available TZX data block types
 */
const DataBlockTypes = new Map<number, () => TzxDataBlockBase>([
  [0x10, () => new TzxStandardSpeedDataBlock()],
  [0x11, () => new TzxTurboSpeedDataBlock()],
  [0x12, () => new TzxPureToneDataBlock()],
  [0x13, () => new TzxPulseSequenceDataBlock()],
  [0x14, () => new TzxPureDataBlock()],
  [0x15, () => new TzxDirectRecordingDataBlock()],
  [0x16, () => new TzxC64RomTypeDataBlock()],
  [0x17, () => new TzxC64TurboTapeDataBlock()],
  [0x18, () => new TzxCswRecordingDataBlock()],
  [0x19, () => new TzxGeneralizedDataBlock()],
  [0x20, () => new TzxSilenceDataBlock()],
  [0x21, () => new TzxGroupStartDataBlock()],
  [0x22, () => new TzxGroupEndDataBlock()],
  [0x23, () => new TzxJumpDataBlock()],
  [0x24, () => new TzxLoopStartDataBlock()],
  [0x25, () => new TzxLoopEndDataBlock()],
  [0x26, () => new TzxCallSequenceDataBlock()],
  [0x27, () => new TzxReturnFromSequenceDataBlock()],
  [0x28, () => new TzxSelectDataBlock()],
  [0x2a, () => new TzxStopTheTape48DataBlock()],
  [0x2b, () => new TzxSetSignalLevelDataBlock()],
  [0x30, () => new TzxTextDescriptionDataBlock()],
  [0x31, () => new TzxMessageDataBlock()],
  [0x32, () => new TzxArchiveInfoDataBlock()],
  [0x33, () => new TzxHardwareInfoDataBlock()],
  [0x34, () => new TzxEmulationInfoDataBlock()],
  [0x35, () => new TzxCustomInfoDataBlock()],
  [0x40, () => new TzxSnapshotBlock()],
  [0x5a, () => new TzxGlueDataBlock()],
]);

/**
 * This class implements a reader that can handle TAP files
 */
export class TzxReader extends TapeFileReader {
  /**
   * Reads the contents of the entire file.
   * @returns True, if read was successful; otherwise, false
   */
  readContents(): boolean {
    const header = new TzxHeader();
    try {
      header.readFrom(this.reader);
      if (!header.isValid) {
        throw new Error("Invalid TZX header");
      }
      this.majorVersion = header.majorVersion;
      this.minorVersion = header.minorVersion;

      while (this.reader.position !== this.reader.length) {
        const blockType = this.reader.readByte();
        const type = DataBlockTypes.get(blockType);
        if (!type) {
          throw new Error(`Unkonwn TZX block type: ${blockType}`);
        }

        try {
          const block = type();
          if (block.isDeprecated()) {
            (block as TzxDeprecatedDataBlockBase).readThrough(this.reader);
          } else {
            block.readFrom(this.reader);
          }
          this.tapeFileBlocks.push(block);
        } catch (err) {
          throw new Error(`Cannot read TZX data block ${type}.`);
        }
      }
      return true;
    } catch {
      // --- This exception is intentionally ignored
      return false;
    }
  }
}

/**
 * Represents a generic TZX data block
 */
abstract class TzxDataBlockBase implements ITapeDataBlock {
  /**
   * The ID of the block
   */
  abstract readonly blockId: number;

  /**
   * Block Data
   */
  data = new Uint8Array(0);

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  abstract readFrom(reader: BinaryReader): void;

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  abstract writeTo(writer: BinaryWriter): void;

  /**
   * Reads the specified number of words from the reader.
   * @param reader Reader that represents the stream
   * @param count Number of words to get
   * @returns The array of words read
   */
  static readWords(reader: BinaryReader, count: number): Uint16Array {
    const result = new Uint16Array(count);
    const bytes = reader.readBytes(2 * count);
    for (let i = 0; i < count; i++) {
      result[i] = (bytes[i * 2] + bytes[i * 2 + 1]) << 8;
    }
    return result;
  }

  /**
   * Writes the specified array of words to the writer
   * @param writer Writer that represents the team
   * @param words Word array to write out
   */
  static writeWords(writer: BinaryWriter, words: Uint16Array): void {
    for (const word of words) {
      writer.writeUint16(word);
    }
  }

  /**
   * Converts the provided bytes to an ASCII string
   * @param bytes Bytes to convert
   * @param offset First byte offset
   * @param count Number of bytes
   */
  static toAsciiString(bytes: Uint8Array, offset = 0, count = -1): string {
    if (count < 0) {
      count = bytes.length - offset;
    }

    let sb = "";
    for (let i = offset; i < count; i++) {
      sb += String.fromCharCode(bytes[i]);
    }
    return sb;
  }

  /**
   * Signs if this block is deprecated
   */
  isDeprecated(): boolean {
    return false;
  }

  /**
   * Override this method to check the content of the block
   */
  isValid(): boolean {
    return true;
  }
}

/**
 * Represents the header of the TZX file
 */
export class TzxHeader extends TzxDataBlockBase {
  /**
   * Signature bytes
   */
  signature: Uint8Array;

  /**
   * End of Tape sign
   */
  eot: number;

  /**
   * Major TZX version
   */
  majorVersion: number;

  /**
   * Minor TZX version
   */
  minorVersion: number;

  constructor(majorVersion = 1, minorVersion = 20) {
    super();
    this.signature = new Uint8Array(TzxSignature);
    this.eot = 0x1a;
    this.majorVersion = majorVersion;
    this.minorVersion = minorVersion;
  }

  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x00;
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.signature = new Uint8Array(reader.readBytes(7));
    this.eot = reader.readByte();
    this.majorVersion = reader.readByte();
    this.minorVersion = reader.readByte();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeBytes(this.signature);
    writer.writeByte(this.eot);
    writer.writeByte(this.majorVersion);
    writer.writeByte(this.minorVersion);
  }

  /**
   * Override this method to check the content of the block
   */
  isValid(): boolean {
    return (
      this._equals(this.signature, TzxSignature) &&
      this.eot === 0x1a &&
      this.majorVersion === 1
    );
  }

  /**
   * Compares two Uint8Array instances
   */
  private _equals(buf1: Uint8Array, buf2: Uint8Array) {
    if (buf1.byteLength !== buf2.byteLength) {
      return false;
    }
    var dv1 = new Int8Array(buf1);
    var dv2 = new Int8Array(buf2);
    for (let i = 0; i !== buf1.byteLength; i++) {
      if (dv1[i] !== dv2[i]) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxStandardSpeedDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x10;
  }

  /**
   * Pause after this block (default: 1000ms)
   */
  pauseAfter = 1000;

  /**
   * Lenght of block data
   */
  dataLength = 0;

  /**
   * This contains the playable bytes of the block. If undefined, the
   * block has no bytes to play
   */
  playableBytes: Uint8Array = new Uint8Array(0);

  /**
   * Construct a block from the specified data bytes
   * @param bytes Array of bytes within this block
   */
  constructor(bytes?: Uint8Array) {
    super();
    if (bytes) {
      this.data = bytes;
      this.dataLength = bytes.length;
    }
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.pauseAfter = reader.readUint16();
    this.dataLength = reader.readUint16();
    this.playableBytes = this.data = new Uint8Array(
      reader.readBytes(this.dataLength)
    );
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.blockId);
    writer.writeUint16(this.pauseAfter);
    writer.writeUint16(this.dataLength);
    writer.writeBytes(this.data);
  }
}

/**
 * Base class for all TZX block type with data length of 3 bytes
 */
abstract class Tzx3ByteDataBlockBase extends TzxDataBlockBase {
  /**
   * Used bits in the last byte (other bits should be 0)
   * (e.g. if this is 6, then the bits used(x) in the last byte are:
   * xxxxxx00, where MSb is the leftmost bit, LSb is the rightmost bit)
   */
  lastByteUsedBits = 0;

  /**
   * Length of block data
   */
  dataLength = new Uint8Array(3);

  /**
   * Override this method to check the content of the block
   */
  isValid(): boolean {
    return this.getLength() === this.data.length;
  }

  /**
   * Calculates data length
   */
  protected getLength(): number {
    return (
      ((this.dataLength[0] + this.dataLength[1]) << (8 + this.dataLength[2])) <<
      16
    );
  }
}

/**
 * Represents the turbo speed data block in a TZX file
 */
class TzxTurboSpeedDataBlock extends Tzx3ByteDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x11;
  }

  /**
   * Length of pilot pulse
   */
  pilotPulseLength: number;

  /**
   * Length of the first sync pulse
   */
  sync1PulseLength: number;

  /**
   * Length of the second sync pulse
   */
  sync2PulseLength: number;

  /**
   * Length of the zero bit
   */
  zeroBitPulseLength: number;

  /**
   * Length of the one bit
   */
  oneBitPulseLength: number;

  /**
   * Length of the pilot tone
   */
  pilotToneLength: number;

  /**
   * Pause after this block
   */
  pauseAfter: number;

  constructor() {
    super();
    this.pilotPulseLength = 2168;
    this.sync1PulseLength = 667;
    this.sync2PulseLength = 735;
    this.zeroBitPulseLength = 855;
    this.oneBitPulseLength = 1710;
    this.pilotToneLength = 8063;
    this.lastByteUsedBits = 8;
    this.pauseAfter = 1000;
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.pilotPulseLength = reader.readUint16();
    this.sync1PulseLength = reader.readUint16();
    this.sync2PulseLength = reader.readUint16();
    this.zeroBitPulseLength = reader.readUint16();
    this.oneBitPulseLength = reader.readUint16();
    this.pilotToneLength = reader.readUint16();
    this.lastByteUsedBits = reader.readByte();
    this.pauseAfter = reader.readUint16();
    this.dataLength = new Uint8Array(reader.readBytes(3));
    this.data = new Uint8Array(reader.readBytes(this.getLength()));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.pilotPulseLength);
    writer.writeUint16(this.sync1PulseLength);
    writer.writeUint16(this.sync2PulseLength);
    writer.writeUint16(this.zeroBitPulseLength);
    writer.writeUint16(this.oneBitPulseLength);
    writer.writeUint16(this.pilotToneLength);
    writer.writeByte(this.lastByteUsedBits);
    writer.writeUint16(this.pauseAfter);
    writer.writeBytes(this.dataLength);
    writer.writeBytes(this.data);
  }
}

/**
 * Represents a pure tone data block in a TZX file
 */
class TzxPureToneDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x12;
  }

  /**
   * Pause after this block
   */
  pulseLength = 0;

  /**
   * Lenght of block data
   */
  pulseCount = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.pulseLength = reader.readUint16();
    this.pulseCount = reader.readUint16();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.pulseLength);
    writer.writeUint16(this.pulseCount);
  }
}

/**
 * Represents a data block with pulse sequences
 */
class TzxPulseSequenceDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x13;
  }

  /**
   * Pause after this block
   */
  pulseCount = 0;

  /**
   * Length of block data
   */
  pulseLengths = new Uint16Array(0);

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.pulseCount = reader.readByte();
    this.pulseLengths = TzxDataBlockBase.readWords(reader, this.pulseCount);
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.pulseCount);
    TzxDataBlockBase.writeWords(writer, this.pulseLengths);
  }

  /**
   * Override this method to check the content of the block
   */
  isValid(): boolean {
    return this.pulseCount === this.pulseLengths.length;
  }
}

/**
 * Represents a pure data block
 */
class TzxPureDataBlock extends Tzx3ByteDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x14;
  }

  /**
   * Length of the zero bit
   */
  zeroBitPulseLength = 0;

  /**
   * Length of the one bit
   */
  oneBitPulseLength = 0;

  /**
   * Pause after this block
   */
  pauseAfter = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.zeroBitPulseLength = reader.readUint16();
    this.oneBitPulseLength = reader.readUint16();
    this.lastByteUsedBits = reader.readByte();
    this.pauseAfter = reader.readUint16();
    this.dataLength = new Uint8Array(reader.readBytes(3));
    this.data = new Uint8Array(reader.readBytes(this.getLength()));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.zeroBitPulseLength);
    writer.writeUint16(this.oneBitPulseLength);
    writer.writeByte(this.lastByteUsedBits);
    writer.writeUint16(this.pauseAfter);
    writer.writeBytes(this.dataLength);
    writer.writeBytes(this.data);
  }
}

/**
 * Represents a direct recording data block
 */
class TzxDirectRecordingDataBlock extends Tzx3ByteDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x15;
  }

  /**
   * Number of T-states per sample (bit of data)
   */
  tactsPerSample = 0;

  /**
   * Pause after this block
   */
  pauseAfter = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.tactsPerSample = reader.readUint16();
    this.pauseAfter = reader.readUint16();
    this.lastByteUsedBits = reader.readByte();
    this.dataLength = new Uint8Array(reader.readBytes(3));
    this.data = new Uint8Array(reader.readBytes(this.getLength()));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.tactsPerSample);
    writer.writeUint16(this.pauseAfter);
    writer.writeByte(this.lastByteUsedBits);
    writer.writeBytes(this.dataLength);
    writer.writeBytes(this.data);
  }
}

/**
 * This class represents a deprecated block
 */
abstract class TzxDeprecatedDataBlockBase extends TzxDataBlockBase {
  /**
   * Signs if this block is deprecated
   */
  isDeprecated(): boolean {
    return true;
  }

  /**
   * Reads through the block infromation, and does not store it
   * @param reader Stream to read the block from
   */
  abstract readThrough(reader: BinaryReader): void;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {}

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    throw new Error("Deprecated TZX data blocks cannot be written.");
  }
}

/**
 * This block was created to support the Commodore 64 standard
 * ROM and similar tape blocks.
 */
class TzxC64RomTypeDataBlock extends TzxDeprecatedDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x16;
  }

  /**
   * Reads through the block infromation, and does not store it
   * @param reader Stream to read the block from
   */
  readThrough(reader: BinaryReader): void {
    const length = reader.readUint32();
    reader.readBytes(length - 4);
  }
}

/**
 * This block is made to support another type of encoding that is
 * commonly used by the C64.
 */
class TzxC64TurboTapeDataBlock extends TzxDeprecatedDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x17;
  }

  /**
   * Reads through the block infromation, and does not store it
   * @param reader Stream to read the block from
   */
  readThrough(reader: BinaryReader): void {
    const length = reader.readUint32();
    reader.readBytes(length - 4);
  }
}

/**
 * Represents the CSW recording data block in a TZX file
 */
class TzxCswRecordingDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x18;
  }

  /**
   * Block length (without these four bytes)
   */
  blockLength = 0;

  /**
   * Pause after this block
   */
  pauseAfter = 0;

  /**
   * Sampling rate
   */
  samplingRate = new Uint8Array(0);

  /**
   * Compression type: 0x01=RLE, 0x02=Z-RLE
   */
  compressionType = 0;

  /**
   * Number of stored pulses (after decompression, for validation purposes)
   */
  pulseCount = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.blockLength = reader.readUint32();
    this.pauseAfter = reader.readUint16();
    this.samplingRate = new Uint8Array(reader.readBytes(3));
    this.compressionType = reader.readByte();
    this.pulseCount = reader.readUint32();
    const length =
      this.blockLength -
      4 /* PauseAfter*/ -
      3 /* SamplingRate */ -
      1 /* CompressionType */ -
      4; /* PulseCount */
    this.data = new Uint8Array(reader.readBytes(length));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint32(this.blockLength);
    writer.writeUint16(this.pauseAfter);
    writer.writeBytes(this.samplingRate);
    writer.writeByte(this.compressionType);
    writer.writeUint16(this.pulseCount);
    writer.writeBytes(this.data);
  }

  /**
   * Override this method to check the content of the block
   */
  isValid(): boolean {
    return this.blockLength === 4 + 3 + 1 + 4 + this.data.length;
  }
}

/**
 * This block represents an extremely wide range of data encoding techniques.
 * The basic idea is that each loading component (pilot tone, sync pulses, data)
 * is associated to a specific sequence of pulses, where each sequence (wave) can
 * contain a different number of pulses from the others. In this way we can have
 * a situation where bit 0 is represented with 4 pulses and bit 1 with 8 pulses.
 */
class TzxSymDef implements ITapeDataSerialization {
  /**
   * Bit 0 - Bit 1: Starting symbol polarity:
   * 00: opposite to the current level (make an edge, as usual) - default
   * 01: same as the current level(no edge - prolongs the previous pulse)
   * 10: force low level
   * 11: force high level
   */
  symbolFlags = 0;

  /**
   * The array of pulse lengths
   */
  pulseLengths: Uint16Array;

  /**
   * Initializes the structure
   * @param maxPulses Maximum number of pulses
   */
  constructor(maxPulses: number) {
    this.pulseLengths = new Uint16Array(maxPulses);
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.symbolFlags = reader.readByte();
    this.pulseLengths = TzxDataBlockBase.readWords(
      reader,
      this.pulseLengths.length
    );
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.symbolFlags);
    TzxDataBlockBase.writeWords(writer, this.pulseLengths);
  }
}

/**
 * Symbol repetitions
 */
class TzxPrle {
  /**
   * Symbol represented
   */
  symbol = 0;

  /**
   * Number of repetitions
   */
  repetitions = 0;
}

/**
 * Represents a generalized data block in a TZX file
 */
class TzxGeneralizedDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x19;
  }

  /**
   * Block length (without these four bytes)
   */
  blockLength = 0;

  /**
   * Pause after this block
   */
  pauseAfter = 0;

  /**
   * Total number of symbols in pilot/sync block (can be 0)
   */
  totp = 0;

  /**
   * Maximum number of pulses per pilot/sync symbol
   */
  npp = 0;

  /**
   * Number of pilot/sync symbols in the alphabet table (0=256)
   */
  asp = 0;

  /**
   * Total number of symbols in data stream (can be 0)
   */
  totd = 0;

  /**
   * Maximum number of pulses per data symbol
   */
  npd = 0;

  /**
   * Number of data symbols in the alphabet table (0=256)
   */
  asd = 0;

  /**
   * Pilot and sync symbols definition table.
   * This field is present only if Totp > 0
   */
  pilotSymDef: Array<TzxSymDef> = [];

  /**
   * Pilot and sync data stream.
   * This field is present only if Totd > 0
   */
  pilotStream: Array<TzxPrle> = [];

  /**
   * Data symbols definition table.
   * This field is present only if Totp > 0
   */
  dataSymDef: Array<TzxSymDef> = [];

  /**
   * Data stream
   * This field is present only if Totd > 0
   */
  dataStream: Array<TzxPrle> = [];

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
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
      const symDef = new TzxSymDef(this.npp);
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
      const symDef = new TzxSymDef(this.npd);
      symDef.readFrom(reader);
      this.dataSymDef[i] = symDef;
    }

    this.dataStream = [];
    for (let i = 0; i < this.totd; i++) {
      this.dataStream[i].symbol = reader.readByte();
      this.dataStream[i].repetitions = reader.readUint16();
    }
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
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

/**
 * Pause (silence) or 'Stop the Tape' block
 */
class TzxSilenceDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x20;
  }

  /**
   * Duration of silence.
   * This will make a silence (low amplitude level (0)) for a given time
   * in milliseconds. If the value is 0 then the emulator or utility should
   * (in effect) STOP THE TAPE, i.e. should not continue loading until
   * the user or emulator requests it.
   */
  duration = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.duration = reader.readUint16();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.duration);
  }
}

/**
 * This block marks the start of a group of blocks which are
 * to be treated as one single (composite) block.
 */
class TzxGroupStartDataBlock extends TzxDataBlockBase {
  /**
   * Number of group name
   */
  length = 0;

  /**
   * Group name bytes
   */
  chars = new Uint8Array(0);

  /**
   * Gets the group name
   */
  get groupName() {
    return TzxDataBlockBase.toAsciiString(this.chars);
  }

  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x21;
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.length = reader.readByte();
    this.chars = new Uint8Array(reader.readBytes(this.length));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.length);
    writer.writeBytes(this.chars);
  }
}

/**
 * This class represents a TZX data block with empty body
 */
abstract class TzxBodylessDataBlockBase extends TzxDataBlockBase {
  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {}

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {}
}

/**
 * This indicates the end of a group. This block has no body.
 */
class TzxGroupEndDataBlock extends TzxBodylessDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x22;
  }
}

/**
 * This block will enable you to jump from one block to another within the file.
 * Jump 0 = 'Loop Forever' - this should never happen
 * Jump 1 = 'Go to the next block' - it is like NOP in assembler
 * Jump 2 = 'Skip one block'
 * Jump -1 = 'Go to the previous block'
 */
class TzxJumpDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x23;
  }

  /**
   * Relative jump value
   */
  jump = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.jump = reader.readUint16();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.jump);
  }
}

/**
 * If you have a sequence of identical blocks, or of identical
 * groups of blocks, you can use this block to tell how many
 * times they should be repeated.
 */
class TzxLoopStartDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x24;
  }

  /**
   * Number of repetitions (greater than 1)
   */
  loops = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.loops = reader.readUint16();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.loops);
  }
}

/**
 * It means that the utility should jump back to the start
 * of the loop if it hasn't been run for the specified number
 * of times.
 */
class TzxLoopEndDataBlock extends TzxBodylessDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x25;
  }
}

/**
 * This block is an analogue of the CALL Subroutine statement.
 * It basically executes a sequence of blocks that are somewhere
 * else and then goes back to the next block. Because more than
 * one call can be normally used you can include a list of sequences
 * to be called. The 'nesting' of call blocks is also not allowed
 * for the simplicity reasons. You can, of course, use the CALL
 * blocks in the LOOP sequences and vice versa.
 */
class TzxCallSequenceDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x26;
  }

  /**
   * Number of group name
   */
  numberOfCalls = 0;

  /**
   * Group name bytes
   */
  blockOffsets = new Uint16Array(0);

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.numberOfCalls = reader.readByte();
    this.blockOffsets = TzxDataBlockBase.readWords(reader, this.numberOfCalls);
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.numberOfCalls);
    TzxDataBlockBase.writeWords(writer, this.blockOffsets);
  }
}

/**
 * This block indicates the end of the Called Sequence.
 * The next block played will be the block after the last
 * CALL block
 */
class TzxReturnFromSequenceDataBlock extends TzxBodylessDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x27;
  }
}

/**
 * This block represents select structure
 */
class TzxSelect implements ITapeDataSerialization {
  /**
   * Bit 0 - Bit 1: Starting symbol polarity
   * 00: opposite to the current level (make an edge, as usual) - default
   * 01: same as the current level(no edge - prolongs the previous pulse)
   * 10: force low level
   * 11: force high level
   */
  blockOffset = 0;

  /**
   * Length of the description
   */
  descriptionLength = 0;

  /**
   * The description bytes
   */
  description = new Uint8Array(0);

  /**
   * The string form of description
   */
  get descriptionText(): string {
    return TzxDataBlockBase.toAsciiString(this.description);
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.blockOffset = reader.readUint16();
    this.descriptionLength = reader.readByte();
    this.description = new Uint8Array(reader.readBytes(this.descriptionLength));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.blockOffset);
    writer.writeByte(this.descriptionLength);
    writer.writeBytes(this.description);
  }
}

/**
 * Represents a select data block
 */
class TzxSelectDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x28;
  }

  /**
   * Length of the whole block (without these two bytes)
   */
  length = 0;

  /**
   * Number of selections
   */
  selectionCount = 0;

  /**
   * List of selections
   */
  selections: Array<TzxSelect> = [];

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.length = reader.readUint16();
    this.selectionCount = reader.readByte();
    this.selections = [];
    for (let i = 0; i < this.selectionCount; i++) {
      const selection = new TzxSelect();
      selection.readFrom(reader);
      this.selections[i] = selection;
    }
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint16(this.length);
    writer.writeByte(this.selectionCount);
    for (const selection of this.selections) {
      selection.writeTo(writer);
    }
  }
}

/**
 * When this block is encountered, the tape will stop ONLY if
 * the machine is an 48K Spectrum.
 * This block is to be used for multiloading games that load one
 * level at a time in 48K mode, but load the entire tape at once
 * if in 128K mode. This block has no body of its own, but follows
 * the extension rule.
 */
class TzxStopTheTape48DataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x2a;
  }

  /**
   * Length of the block without these four bytes (0)
   */
  readonly lenght = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    reader.readUint32();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint32(this.lenght);
  }
}

/**
 * This block sets the current signal level to the specified value (high or low).
 */
class TzxSetSignalLevelDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x2b;
  }

  /**
   * Length of the block without these four bytes
   */
  readonly lenght = 1;

  /**
   * Signal level (0=low, 1=high)
   */
  signalLevel = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    reader.readUint32();
    this.signalLevel = reader.readByte();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeUint32(this.lenght);
    writer.writeByte(this.signalLevel);
  }
}

/**
 * This is meant to identify parts of the tape, so you know where level 1 starts,
 * where to rewind to when the game ends, etc.
 * This description is not guaranteed to be shown while the tape is playing,
 * but can be read while browsing the tape or changing the tape pointer.
 */
class TzxTextDescriptionDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x30;
  }

  /**
   * Length of the description
   */
  descriptionLength = 0;

  /**
   * The description bytes
   */
  description = new Uint8Array(0);

  /**
   * The string form of description
   */
  get descriptionText(): string {
    return TzxDataBlockBase.toAsciiString(this.description);
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.descriptionLength = reader.readByte();
    this.description = new Uint8Array(reader.readBytes(this.descriptionLength));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.descriptionLength);
    writer.writeBytes(this.description);
  }
}

/**
 * This will enable the emulators to display a message for a given time.
 * This should not stop the tape and it should not make silence. If the
 * time is 0 then the emulator should wait for the user to press a key.
 */
class TzxMessageDataBlock extends TzxDataBlockBase {
  /**
   * Time (in seconds) for which the message should be displayed
   */
  time = 0;

  /**
   * Length of the description
   */
  messageLength = 0;

  /**
   * The description bytes
   */
  message = new Uint8Array(0);

  /**
   * The string form of description
   */
  get messageText(): string {
    return TzxDataBlockBase.toAsciiString(this.message);
  }

  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x31;
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.time = reader.readByte();
    this.messageLength = reader.readByte();
    this.message = new Uint8Array(reader.readBytes(this.messageLength));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.time);
    writer.writeByte(this.messageLength);
    writer.writeBytes(this.message);
  }
}

/**
 * This is meant to identify parts of the tape, so you know where level 1 starts,
 * where to rewind to when the game ends, etc.
 * This description is not guaranteed to be shown while the tape is playing,
 * but can be read while browsing the tape or changing the tape pointer.
 */
class TzxText implements ITapeDataSerialization {
  /**
   * Text identification byte.
   * 00 - Full title
   * 01 - Software house/publisher
   * 02 - Author(s)
   * 03 - Year of publication
   * 04 - Language
   * 05 - Game/utility type
   * 06 - Price
   * 07 - Protection scheme/loader
   * 08 - Origin
   * FF - Comment(s)
   */
  type = 0;

  /**
   * Length of the description
   */
  length = 0;

  /**
   * The description bytes
   */
  textBytes = new Uint8Array(0);

  /**
   * The string form of description
   */
  get text(): string {
    return TzxDataBlockBase.toAsciiString(this.textBytes);
  }

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.type = reader.readByte();
    this.length = reader.readByte();
    this.textBytes = new Uint8Array(reader.readBytes(this.length));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.type);
    writer.writeByte(this.length);
    writer.writeBytes(this.textBytes);
  }
}

/**
 * Represents an archive information data block
 */
class TzxArchiveInfoDataBlock extends Tzx3ByteDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x32;
  }

  /**
   * Length of the whole block (without these two bytes)
   */
  length = 0;

  /**
   * Number of text strings
   */
  stringCount = 0;

  /**
   * List of text strings
   */
  textStrings: Array<TzxText> = [];

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.length = reader.readUint16();
    this.stringCount = reader.readByte();
    this.textStrings = [];
    for (let i = 0; i < this.stringCount; i++) {
      const text = new TzxText();
      text.readFrom(reader);
      this.textStrings[i] = text;
    }
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.length);
    writer.writeByte(this.stringCount);
    for (const text of this.textStrings) {
      text.writeTo(writer);
    }
  }
}

/**
 * This blocks contains information about the hardware that the programs on this tape use.
 */
class TzxHwInfo implements ITapeDataSerialization {
  /**
   * Hardware type
   */
  hwType = 0;

  /**
   * Hardwer Id
   */
  hwId = 0;

  /**
   * Information about the tape:
   * 00 - The tape RUNS on this machine or with this hardware,
   *      but may or may not use the hardware or special features of the machine.
   * 01 - The tape USES the hardware or special features of the machine,
   *      such as extra memory or a sound chip.
   * 02 - The tape RUNS but it DOESN'T use the hardware
   *      or special features of the machine.
   * 03 - The tape DOESN'T RUN on this machine or with this hardware.
   */
  tapeInfo = 0;

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.hwType = reader.readByte();
    this.hwId = reader.readByte();
    this.tapeInfo = reader.readByte();
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.hwType);
    writer.writeByte(this.hwId);
    writer.writeByte(this.tapeInfo);
  }
}

/**
 * Represents a hardware info data block
 */
class TzxHardwareInfoDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x33;
  }

  /**
   * Number of machines and hardware types for which info is supplied
   */
  hwCount = 0;

  /**
   * List of machines and hardware
   */
  hwInfo: Array<TzxHwInfo> = [];

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.hwCount = reader.readByte();
    this.hwInfo = [];
    for (let i = 0; i < this.hwCount; i++) {
      const hw = new TzxHwInfo();
      hw.readFrom(reader);
      this.hwInfo[i] = hw;
    }
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeByte(this.hwCount);
    for (const hw of this.hwInfo) {
      hw.writeTo(writer);
    }
  }
}

/**
 * This is a special block that would normally be generated only by emulators.
 */
class TzxEmulationInfoDataBlock extends TzxDeprecatedDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x34;
  }

  /**
   * Reads through the block infromation, and does not store it
   * @param reader Stream to read the block from
   */
  readThrough(reader: BinaryReader): void {
    reader.readBytes(8);
  }
}

/**
 * Represents a custom information data block in a TZX file
 */
class TzxCustomInfoDataBlock extends Tzx3ByteDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x35;
  }

  /**
   * Identification string (in ASCII)
   */
  id = new Uint8Array(0);

  /**
   * String representation of the ID
   */
  get IdText() {
    return TzxDataBlockBase.toAsciiString(this.id);
  }

  /**
   * Length of the custom info
   */
  length = 0;

  /**
   * Custom information
   */
  customInfo = new Uint8Array(0);

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.id = new Uint8Array(reader.readBytes(10));
    this.length = reader.readUint32();
    this.customInfo = new Uint8Array(reader.readBytes(this.length));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeBytes(this.id);
    writer.writeUint32(this.length);
    writer.writeBytes(this.customInfo);
  }
}

/**
 * This block was created to support the Commodore 64 standard
 * ROM and similar tape blocks.
 */
class TzxSnapshotBlock extends TzxDeprecatedDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x40;
  }

  /**
   * Reads through the block infromation, and does not store it
   * @param reader Stream to read the block from
   */
  readThrough(reader: BinaryReader): void {
    let length = reader.readUint32();
    length = length & 0x00ffffff;
    reader.readBytes(length);
  }
}

/**
 * This block is generated when you merge two ZX Tape files together.
 * It is here so that you can easily copy the files together and use
 * them. Of course, this means that resulting file would be 10 bytes
 * longer than if this block was not used. All you have to do if
 * you encounter this block ID is to skip next 9 bytes.
 */
class TzxGlueDataBlock extends TzxDataBlockBase {
  /**
   * The ID of the block
   */
  get blockId(): number {
    return 0x5a;
  }

  /**
   * Value: { "XTape!", 0x1A, MajorVersion, MinorVersion }.
   * Just skip these 9 bytes and you will end up on the next ID.
   */
  glue = new Uint8Array(0);

  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void {
    this.glue = new Uint8Array(reader.readBytes(9));
  }

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void {
    writer.writeBytes(this.glue);
  }
}
