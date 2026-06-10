import {
  BIT_0_PL,
  BIT_1_PL,
  PILOT_PL,
  SYNC_1_PL,
  SYNC_2_PL,
  TERM_SYNC
} from "./tape-const";

export type TapeFormat = "tap" | "tzx";

export type TapeDataBlock = {
  data: Uint8Array;
  pauseAfter: number;
  pilotPulseLength: number;
  sync1PulseLength: number;
  sync2PulseLength: number;
  zeroBitPulseLength: number;
  oneBitPulseLength: number;
  endSyncPulseLength: number;
  lastByteUsedBits?: number;
  pilotPulseCount?: number;
};

export type Sp48TapeBlock = TapeDataBlock;

export type TapeParseResult = {
  format: TapeFormat;
  blocks: TapeDataBlock[];
  warnings: string[];
};

const TZX_SIGNATURE = "ZXTape!";

export function parseTapeFile(contents: Uint8Array): TapeParseResult {
  if (isTzx(contents)) {
    return parseTzxFile(contents);
  }

  try {
    return parseTapFile(contents);
  } catch (tapError) {
    try {
      return parseTzxFile(contents);
    } catch (tzxError) {
      throw new Error(
        `Cannot parse tape file as TAP (${messageOf(tapError)}) or TZX (${messageOf(tzxError)}).`
      );
    }
  }
}

export function createTapeDataBlock(data: Uint8Array = new Uint8Array(0)): TapeDataBlock {
  return {
    data,
    pauseAfter: 1000,
    pilotPulseLength: PILOT_PL,
    sync1PulseLength: SYNC_1_PL,
    sync2PulseLength: SYNC_2_PL,
    zeroBitPulseLength: BIT_0_PL,
    oneBitPulseLength: BIT_1_PL,
    endSyncPulseLength: TERM_SYNC
  };
}

function parseTapFile(contents: Uint8Array): TapeParseResult {
  const reader = new BinaryReader(contents);
  const blocks: TapeDataBlock[] = [];

  while (!reader.eof) {
    const length = reader.readUint16();
    if (reader.remaining < length) {
      throw new Error("TAP block length exceeds file size.");
    }
    blocks.push(createTapeDataBlock(reader.readUint8Array(length)));
  }

  if (blocks.length === 0) {
    throw new Error("TAP file contains no blocks.");
  }

  return {
    format: "tap",
    blocks,
    warnings: []
  };
}

function parseTzxFile(contents: Uint8Array): TapeParseResult {
  const reader = new BinaryReader(contents);
  const signature = reader.readString(7);
  const endOfText = reader.readByte();
  const majorVersion = reader.readByte();
  const minorVersion = reader.readByte();

  if (signature !== TZX_SIGNATURE || endOfText !== 0x1a || majorVersion !== 1) {
    throw new Error("Invalid TZX header.");
  }

  const blocks: TapeDataBlock[] = [];
  const warnings: string[] = [];

  while (!reader.eof) {
    const blockType = reader.readByte();
    switch (blockType) {
      case 0x10:
        blocks.push(readStandardSpeedBlock(reader));
        break;

      case 0x11:
        blocks.push(readTurboSpeedBlock(reader));
        break;

      case 0x14:
        blocks.push(readPureDataBlock(reader));
        break;

      case 0x20:
        blocks.push(readSilenceBlock(reader));
        break;

      default:
        if (skipKnownMetadataBlock(reader, blockType)) {
          warnings.push(`Skipped non-data TZX block $${toHexByte(blockType)}.`);
        } else {
          throw new Error(`Unsupported TZX block type: $${toHexByte(blockType)}.`);
        }
    }
  }

  if (blocks.length === 0) {
    throw new Error(`TZX ${majorVersion}.${minorVersion} contains no playable data blocks.`);
  }

  return {
    format: "tzx",
    blocks,
    warnings
  };
}

function readStandardSpeedBlock(reader: BinaryReader): TapeDataBlock {
  const pauseAfter = reader.readUint16();
  const dataLength = reader.readUint16();
  return {
    ...createTapeDataBlock(reader.readUint8Array(dataLength)),
    pauseAfter
  };
}

function readTurboSpeedBlock(reader: BinaryReader): TapeDataBlock {
  const block = createTapeDataBlock();
  block.pilotPulseLength = reader.readUint16();
  block.sync1PulseLength = reader.readUint16();
  block.sync2PulseLength = reader.readUint16();
  block.zeroBitPulseLength = reader.readUint16();
  block.oneBitPulseLength = reader.readUint16();
  block.pilotPulseCount = reader.readUint16();
  block.lastByteUsedBits = reader.readByte();
  block.pauseAfter = reader.readUint16();
  block.data = reader.readUint8Array(reader.readUint24());
  return block;
}

function readPureDataBlock(reader: BinaryReader): TapeDataBlock {
  const block = createTapeDataBlock();
  block.pilotPulseLength = 0;
  block.sync1PulseLength = 0;
  block.sync2PulseLength = 0;
  block.zeroBitPulseLength = reader.readUint16();
  block.oneBitPulseLength = reader.readUint16();
  block.lastByteUsedBits = reader.readByte();
  block.pauseAfter = reader.readUint16();
  block.data = reader.readUint8Array(reader.readUint24());
  return block;
}

function readSilenceBlock(reader: BinaryReader): TapeDataBlock {
  const duration = reader.readUint16();
  return {
    ...createTapeDataBlock(),
    pauseAfter: duration,
    pilotPulseLength: 0,
    sync1PulseLength: 0,
    sync2PulseLength: 0,
    zeroBitPulseLength: 0,
    oneBitPulseLength: 0,
    endSyncPulseLength: 0,
    lastByteUsedBits: 0
  };
}

function skipKnownMetadataBlock(reader: BinaryReader, blockType: number): boolean {
  switch (blockType) {
    case 0x21:
      reader.skip(reader.readByte());
      return true;
    case 0x22:
      return true;
    case 0x30:
      reader.skip(reader.readByte());
      return true;
    case 0x31:
      reader.skip(1);
      reader.skip(reader.readByte());
      return true;
    case 0x32:
      reader.skip(reader.readUint16());
      return true;
    case 0x33:
      reader.skip(reader.readByte() * 3);
      return true;
    case 0x35:
      reader.skip(16 + reader.readUint32());
      return true;
    case 0x5a:
      reader.skip(9);
      return true;
    default:
      return false;
  }
}

function isTzx(contents: Uint8Array): boolean {
  if (contents.byteLength < 10) {
    return false;
  }
  for (let i = 0; i < TZX_SIGNATURE.length; i++) {
    if (contents[i] !== TZX_SIGNATURE.charCodeAt(i)) {
      return false;
    }
  }
  return contents[7] === 0x1a;
}

function toHexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class BinaryReader {
  private position = 0;

  constructor(private readonly buffer: Uint8Array) {}

  get eof(): boolean {
    return this.position >= this.buffer.byteLength;
  }

  get remaining(): number {
    return this.buffer.byteLength - this.position;
  }

  readByte(): number {
    this.ensureAvailable(1);
    return this.buffer[this.position++];
  }

  readUint16(): number {
    return this.readByte() | (this.readByte() << 8);
  }

  readUint24(): number {
    return this.readByte() | (this.readByte() << 8) | (this.readByte() << 16);
  }

  readUint32(): number {
    return (
      this.readByte() |
      (this.readByte() << 8) |
      (this.readByte() << 16) |
      (this.readByte() << 24)
    ) >>> 0;
  }

  readString(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(this.readByte());
    }
    return result;
  }

  readUint8Array(length: number): Uint8Array {
    this.ensureAvailable(length);
    const result = this.buffer.slice(this.position, this.position + length);
    this.position += length;
    return result;
  }

  skip(length: number): void {
    this.ensureAvailable(length);
    this.position += length;
  }

  private ensureAvailable(length: number): void {
    if (length < 0 || this.remaining < length) {
      throw new Error("Unexpected end of tape file.");
    }
  }
}
