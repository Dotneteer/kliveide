import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TapeDataBlock } from "./abstractions";

/// <summary>
/// This class describes a generic TZX Block
/// </summary>
export abstract class TzxBlockBase {
    /**
     * The ID of the block
     */
    abstract blockId: number;

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
     * Override this method to check the content of the block
     */
    get isValid(): boolean {
        return true;
    }

    /**
     * Returns the data block this TZX block represents
     * @returns Data block, if the TZX block represents one; otherwise, undefined
     */
    getDataBlock(): TapeDataBlock | undefined {
        return undefined;
    }
    
    /// <summary>
    /// Reads the specified number of words from the reader.
    /// </summary>
    /// <param name="reader">Reader to obtain the input from</param>
    /// <param name="count">Number of words to get</param>
    /// <returns>Word array read from the input</returns>
    static readWords(reader: BinaryReader, count: number): number[] {
        const result: number[] = [];
        const bytes = reader.readBytes(2 * count);
        for (let i = 0; i < count; i++) {
            result[i] = bytes[i * 2] + bytes[i * 2 + 1] << 8;
        }
        return result;
    }

    /**
     * Writes the specified array of words to the writer
     * @param writer Output
     * @param words Word array
     */
    static writeWords(writer: BinaryWriter, words: number[]): void {
        for (const word of words) {
            writer.writeUint16(word);
        }
    }

    /**
     * Converts the provided bytes to an ASCII string
     * @param bytes Bytes to convert
     * @param offset First byte offset
     * @param count Number of bytes
     * @returns ASCII string representation
     */
    static toAsciiString(bytes: Uint8Array, offset = 0, count = -1): string {
        if (count < 0) count = bytes.length - offset;
        let sb = "";
        for (let i = 0; i < count; i++) {
            sb += String.fromCharCode(bytes[i + offset]);
        }
        return sb;
    }
}

/**
 * Base class for all TZX block type with data length of 3 bytes
 */
abstract class Tzx3ByteBlockBase extends TzxBlockBase {
    /**
     * Used bits in the last byte (other bits should be 0)
     * 
     * (e.g. if this is 6, then the bits used(x) in the last byte are: 
     * xxxxxx00, where MSb is the leftmost bit, LSb is the rightmost bit)
     */
    lastByteUsedBits: number;

    /**
     * Lenght of block data
     */
    dataLength: number[];

    /**
     * Block Data
     */
    data: number[]

    get isValid(): boolean {
        return this.getLength() === this.data?.length;
    }

    /**
     * Calculates data length
     */
    protected getLength(): number {
        return this.dataLength![0] + (this.dataLength[1] << 8) + (this.dataLength[2] << 16);
    }
}

/**
 * This class represents a TZX data block with empty body
 */
abstract class TzxBodylessBlockBase extends TzxBlockBase
{
    readFrom(reader: BinaryReader): void {
    }

    writeTo(writer: BinaryWriter): void {
    }
}

/**
 * This class represents a deprecated TZX block
 */
abstract class TzxDeprecatedBlockBase extends TzxBlockBase {
    /**
     * Reads through the block infromation, and does not store it
     * @param reader Stream to read the block from
     */
    readThrough(reader: BinaryReader): void {}

    readFrom(reader: BinaryReader): void {
    }

    writeTo(writer: BinaryWriter): void {
        throw new Error("Deprecated TZX data blocks cannot be written.");
    }
}

/**
 * Represents the archive info block in a TZX file
 */
export class TzxArchiveInfoBlock extends Tzx3ByteBlockBase
{
    /**
     * Length of the whole block (without these two bytes)
     */
    length: number;

    /**
     * Number of text strings
     */
    stringCount: number;

    /**
     * List of text strings
     */
    textStrings: TzxText[];

    /**
     * The ID of the block
     */
    get blockId(): number {
        return 0x32;
    }

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

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.length);
        writer.writeByte(this.stringCount);
        if (!this.textStrings) return;
        for (const text of this.textStrings) {
            text.writeTo(writer);
        }
    }
}

/**
 * This block was created to support the Commodore 64 standard 
 * ROM and similar tape blocks.
 */
export class TzxC64RomTypeBlock extends TzxDeprecatedBlockBase
{
    get blockId(): number {
        return 0x16;
    }

    readThrough(reader: BinaryReader): void {
        const length = reader.readUint32();
        reader.readBytes(length - 4);
    }
}

/**
 * This block is made to support another type of encoding that is 
 * commonly used by the C64.
 */
export class TzxC64TurboTapeBlock extends TzxDeprecatedBlockBase {
    get blockId(): number {
        return 0x17;
    }

    readThrough(reader: BinaryReader): void {
        const length = reader.readUint16();
        reader.readBytes(length - 4);
    }
}

/**
 * This block is an analogue of the CALL Subroutine statement.
 * 
 * It basically executes a sequence of blocks that are somewhere else and then goes back to the next block. Because
 * more than one call can be normally used you can include a list of sequences to be called. The 'nesting' of call
 * blocks is also not allowed for the simplicity reasons. You can, of course, use the CALL blocks in the LOOP sequences
 * and vice versa.
 */
export class TzxCallSequenceBlock extends TzxBlockBase {
    /**
     * Number of group name
     */
    numberOfCalls: number;

    /**
     * Group name bytes
     */
    blockOffsets: number[];

    get blockId(): number {
        return 0x26;
    }

    readFrom(reader: BinaryReader): void {
        this.numberOfCalls = reader.readByte();
        this.blockOffsets = TzxBlockBase.readWords(reader, this.numberOfCalls);
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.numberOfCalls);
        if (!this.blockOffsets) return;
        TzxBlockBase.writeWords(writer, this.blockOffsets);
    }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxCustomInfoBlock extends Tzx3ByteBlockBase {
    /**
     * Identification string (in ASCII)
     */
    id: Uint8Array;

    /**
     * String representation of the ID
     */
    get idText(): string {
        return TzxBlockBase.toAsciiString(this.id);
    }

    /**
     * Length of the custom info
     */
    length: number;

    /**
     * Custom information
     */
    customInfo: Uint8Array;

    get blockId(): number {
        return 0x35;
    }

    readFrom(reader: BinaryReader): void {
        this.id = new Uint8Array(reader.readBytes(10));
        this.length = reader.readUint32();
        this.customInfo = new Uint8Array(reader.readBytes(this.length));
    }

    writeTo(writer: BinaryWriter): void
    {
        writer.writeBytes(this.id);
        writer.writeUint32(this.length);
        writer.writeBytes(this.customInfo);
    }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxCswRecordingBlock extends TzxBlockBase {
    /**
     * Block length (without these four bytes)
     */
    blockLength: number;

    /**
     * Pause after this block
     */
    pauseAfter: number

    /**
     * Sampling rate
     */
    samplingRate: Uint8Array;

    /**
     * Compression type
     * 0x01=RLE, 0x02=Z-RLE
     */
    compressionType: number;

    /**
     * Number of stored pulses (after decompression, for validation purposes)
     */
    pulseCount: number;

    /**
     * CSW data, encoded according to the CSW file format specification
     */
    data: Uint8Array;

    get blockId(): number {
        return 0x18;
    }

    readFrom(reader: BinaryReader): void {
        this.blockLength = reader.readUint32();
        this.pauseAfter = reader.readUint16();
        this.samplingRate = new Uint8Array(reader.readBytes(3));
        this.compressionType = reader.readByte();
        this.pulseCount = reader.readUint32();
        const length = this.blockLength - 4 /* PauseAfter*/ - 3 /* SamplingRate */
                     - 1 /* CompressionType */ - 4 /* PulseCount */;
        this.data = new Uint8Array(reader.readBytes(length));
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint32(this.blockLength);
        writer.writeUint16(this.pauseAfter);
        writer.writeBytes(this.samplingRate);
        writer.writeByte(this.compressionType);
        writer.writeUint32(this.pulseCount);
        writer.writeBytes(this.data);
    }

    get isValid(): boolean {
        return this.blockLength == 4 + 3 + 1 + 4 + this.data.length;
    }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxDirectRecordingBlock extends Tzx3ByteBlockBase {
    /**
     * Number of T-states per sample (bit of data)
     */
    tactsPerSample: number;

    /**
     * Pause after this block
     */
    pauseAfter: number;

    get blockId(): number {
        return 0x15;
    }

    readFrom(reader: BinaryReader): void {
        this.tactsPerSample = reader.readUint16();
        this.pauseAfter = reader.readUint16();
        this.lastByteUsedBits = reader.readByte();
        this.dataLength = reader.readBytes(3);
        this.data = reader.readBytes(this.getLength());
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.tactsPerSample);
        writer.writeUint16(this.pauseAfter);
        writer.writeByte(this.lastByteUsedBits);
        writer.writeBytes(new Uint8Array(this.dataLength));
        writer.writeBytes(new Uint8Array(this.data));
    }
}

/**
 * This is a special block that would normally be generated only by emulators.
 */
export class TzxEmulationInfoBlock extends TzxDeprecatedBlockBase
{
    get blockId(): number {
        return 0x34;
    }

    readThrough(reader: BinaryReader): void {
        reader.readBytes(8);
    }
}

/// <summary>
/// Represents a generalized data block in a TZX file
/// </summary>
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

    get blockId(): number {
        return 0x19;
    }

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
 * This block is generated when you merge two ZX Tape files together.
 * 
 * It is here so that you can easily copy the files together and use 
 * them. Of course, this means that resulting file would be 10 bytes 
 * longer than if this block was not used. All you have to do if 
 * you encounter this block ID is to skip next 9 bytes.
 */
export class TzxGlueBlock extends TzxBlockBase {
    /**
     * Value: { "XTape!", 0x1A, MajorVersion, MinorVersion }
     * 
     * Just skip these 9 bytes and you will end up on the next ID.
     */
    glue: Uint8Array;

    get blockId(): number {
        return 0x5A;
    }

    readFrom(reader: BinaryReader): void {
        this.glue = new Uint8Array(reader.readBytes(9));
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeBytes(this.glue);
    }
}

/**
 * This indicates the end of a group. This block has no body.
 */
export class TzxGroupEndBlock extends TzxBodylessBlockBase
{
    get blockId(): number {
        return 0x22;
    }
}

/**
 * This block marks the start of a group of blocks which are 
 * to be treated as one single (composite) block.
 */
export class TzxGroupStartBlock extends TzxBlockBase {
    /**
     * Number of group name
     */
    length: number

    /**
     * Group name bytes
     */
    chars: Uint8Array

    /**
     * Gets the group name
     */
    get groupName(): string {
        return TzxBlockBase.toAsciiString(this.chars);
    } 

    get blockId(): number {
        return 0x21;
    }

    readFrom(reader: BinaryReader): void {
        this.length = reader.readByte();
        this.chars = new Uint8Array(reader.readBytes(this.length));
    }

    writeTo(writer: BinaryWriter) {
        writer.writeByte(this.length);
        writer.writeBytes(this.chars);
    }
}

/**
 * Hardware information block
 */
export class TzxHardwareInfoBlock extends TzxBlockBase
{
    /**
     * Number of machines and hardware types for which info is supplied
     */
    hwCount: number;

    /**
     * List of machines and hardware
     */
    hwInfo: TzxHwInfo[];

    /**
     * The ID of the block
     */
    get blockId(): number {
        return 0x33;
    }

    readFrom(reader: BinaryReader): void {
        this.hwCount = reader.readByte();
        this.hwInfo =[]
        for (let i = 0; i < this.hwCount; i++) {
            const hw = new TzxHwInfo();
            hw.readFrom(reader);
            this.hwInfo[i] = hw;
        }
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.hwCount);
        if (!this.hwInfo) return;
        for (const hw of this.hwInfo) {
            hw.writeTo(writer);
        }
    }
}

/**
 * Represents the header of the TZX file
 */
export class TzxHeader extends TzxBlockBase
{
    static tzxSignature = new Uint8Array([0x5A, 0x58, 0x54, 0x61, 0x70, 0x65, 0x21]);

    signature: Uint8Array;
    eot: number;
    majorVersion: number;
    minorVersion: number

    constructor(majorVersion = 1, minorVersion = 20) {
        super();
        this.signature = new Uint8Array(TzxHeader.tzxSignature);
        this.eot = 0x1A;
        this.majorVersion = majorVersion;
        this.minorVersion = minorVersion;
    }

    get blockId(): number {
        return 0x00;
    }

    readFrom(reader: BinaryReader): void {
        this.signature = new Uint8Array(reader.readBytes(7));
        this.eot = reader.readByte();
        this.majorVersion = reader.readByte();
        this.minorVersion = reader.readByte();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeBytes(this.signature);
        writer.writeByte(this.eot);
        writer.writeByte(this.majorVersion);
        writer.writeByte(this.minorVersion);
    }

    get isValid(): boolean {
        return this.signature === TzxHeader.tzxSignature
        && this.eot === 0x1A
        && this.majorVersion === 1;
    }
}

/**
 * This block will enable you to jump from one block to another within the file.
 * 
 * Jump 0 = 'Loop Forever' - this should never happen
 * Jump 1 = 'Go to the next block' - it is like NOP in assembler
 * Jump 2 = 'Skip one block'
 * Jump -1 = 'Go to the previous block'
 */
export class TzxJumpBlock extends TzxBlockBase {
    /**
     * Relative jump value
     */
    jump: number;

    get blockId(): number {
        return 0x23;
    }

    readFrom(reader: BinaryReader): void {
        this.jump = reader.readUint16();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.jump);
    }
}

/**
 * It means that the utility should jump back to the start 
 * of the loop if it hasn't been run for the specified number 
 * of times.
 */
export class TzxLoopEndBlock extends TzxBodylessBlockBase {
    get blockId(): number {
        return 0x25;
    }
}

/**
 * If you have a sequence of identical blocks, or of identical 
 * groups of blocks, you can use this block to tell how many 
 * times they should be repeated.
 */
export class TzxLoopStartBlock extends TzxBlockBase
{
    /**
     * Number of repetitions (greater than 1)
     */
    loops: number;

    get blockId(): number {
        return 0x24;
    }

    readFrom(reader: BinaryReader): void {
        this.loops = reader.readUint16();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.loops);
    }
}

/**
 * This will enable the emulators to display a message for a given time.
 * 
 * This should not stop the tape and it should not make silence. If the 
 * time is 0 then the emulator should wait for the user to press a key.
 */
export class TzxMessageBlock extends TzxBlockBase { 
    /**
     * Time (in seconds) for which the message should be displayed
     */
    time: number;

    /**
     * Length of the description
     */
    messageLength: number;

    /**
     * The description bytes
     */
    message: Uint8Array;

    /**
     * The string form of description
     */
    get messageText(): string {
        return TzxBlockBase.toAsciiString(this.message);
    }

    get blockId(): number {
        return 0x31;
    }

    readFrom(reader: BinaryReader): void {
        this.time = reader.readByte();
        this.messageLength = reader.readByte();
        this.message = new Uint8Array(reader.readBytes(this.messageLength));
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.time);
        writer.writeByte(this.messageLength);
        writer.writeBytes(this.message);
    }
}

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
    pulseLengths: number[]

    get blockId(): number {
        return 0x13;
    }

    readFrom(reader: BinaryReader): void {
        this.pulseCount = reader.readByte();
        this.pulseLengths = TzxBlockBase.readWords(reader, this.pulseCount);
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.pulseCount);
        TzxBlockBase.writeWords(writer, this.pulseLengths!);
    }

    get isValid(): boolean {
        return this.pulseCount === this.pulseLengths.length;
    }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxPureBlock extends Tzx3ByteBlockBase
{
    /**
     * Length of the zero bit
     */
    zeroBitPulseLength: number;

    /**
     * Length of the one bit
     */
    oneBitPulseLength: number;

    /**
     * Pause after this block
     */
    pauseAfter: number;

    get blockId(): number {
        return 0x14;
    }

    readFrom(reader: BinaryReader): void {
        this.zeroBitPulseLength = reader.readUint16();
        this.oneBitPulseLength = reader.readUint16();
        this.lastByteUsedBits = reader.readByte();
        this.pauseAfter = reader.readUint16();
        this.dataLength = reader.readBytes(3);
        this.data = reader.readBytes(this.getLength());
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.zeroBitPulseLength);
        writer.writeUint16(this.oneBitPulseLength);
        writer.writeByte(this.lastByteUsedBits);
        writer.writeUint16(this.pauseAfter);
        writer.writeBytes(new Uint8Array(this.dataLength));
        writer.writeBytes(new Uint8Array(this.data));
    }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxPureToneBlock extends TzxBlockBase {
    /**
     * Pause after this block
     */
    pulseLength: number;

    /**
     * Lenght of block data
     */
    pulseCount: number;

    get blockId(): number {
        return 0x12;
    }

    readFrom(reader: BinaryReader): void {
        this.pulseLength = reader.readUint16();
        this.pulseCount = reader.readUint16();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.pulseLength);
        writer.writeUint16(this.pulseCount);
    }
}

/**
 * This block indicates the end of the Called Sequence.
 * The next block played will be the block after the last 
 * CALL block
 */
export class TzxReturnFromSequenceBlock extends TzxBodylessBlockBase {
    get blockId(): number {
        return 0x27;
    }
}

/**
 * Pause (silence) or 'Stop the Tape' block
 */
export class TzxSelectBlock extends TzxBlockBase
{
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
    selections: TzxSelect[]

    get blockId(): number {
        return 0x28;
    }

    readFrom(reader: BinaryReader): void {
        this.length = reader.readUint16();
        this.selectionCount = reader.readByte();
        this.selections = [];
        for (let i = 0; i < this.selectionCount; i++)
        {
            const selection = new TzxSelect();
            selection.readFrom(reader);
            this.selections[i] = selection;
        }
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.length);
        writer.writeByte(this.selectionCount);
        if (!this.selections) return;
        for (const selection of this.selections) {
            selection.writeTo(writer);
        }
    }
}

/**
 * This block sets the current signal level to the specified value (high or low).
 */
export class TzxSetSignalLevelBlock extends TzxBlockBase
{
    /**
     * Length of the block without these four bytes
     */
    length = 1;

    /**
     * Signal level (0=low, 1=high)
     */
    signalLevel: number;

    get blockId(): number {
        return 0x2b;
    }

    readFrom(reader: BinaryReader): void {
        reader.readUint32();
        this.signalLevel = reader.readByte();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint32(this.length);
        writer.writeByte(this.signalLevel);
    }
}

/**
 * Pause (silence) or 'Stop the Tape' block
 */
export class TzxSilenceBlock extends TzxBlockBase
{
    /**
     * Duration of silence
     * 
     * This will make a silence (low amplitude level (0)) for a given time 
     * in milliseconds. If the value is 0 then the emulator or utility should 
     * (in effect) STOP THE TAPE, i.e. should not continue loading until 
     * the user or emulator requests it.
     */
    duration: number;

    get blockId(): number {
        return 0x20;
    }

    readFrom(reader: BinaryReader): void {
        this.duration = reader.readUint16();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.duration);
    }
}

/**
 * This block was created to support the Commodore 64 standard 
 * ROM and similar tape blocks.
 */
export class TzxSnapshotBlock extends TzxDeprecatedBlockBase {
    get blockId(): number {
        return 0x40;
    }

    readThrough(reader: BinaryReader): void {
        length = reader.readUint32() & 0x00FFFFFF;
        reader.readBytes(length);
    }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxStandardSpeedBlock extends TzxBlockBase {
    /**
     * Pause after this block (default: 1000ms)
     */
    pauseAfter = 1000;

    /**
     * Lenght of block data
     */
    dataLength: number;

    /**
     * Block Data
     */
    data: Uint8Array;

    get blockId(): number {
        return 0x10;
    }
    
    /**
     * Returns the data block this TZX block represents
     */
    getDataBlock(): TapeDataBlock {
        const block = new TapeDataBlock ();
        block.data = this.data;
        return block;
    }

    readFrom(reader: BinaryReader): void {
        this.pauseAfter = reader.readUint16();
        this.dataLength = reader.readUint16();
        this.data = new Uint8Array(reader.readBytes(this.dataLength));
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.blockId);
        writer.writeUint16(this.pauseAfter);
        writer.writeUint16(this.dataLength);
        writer.writeBytes(this.data);
    }
}

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
    get blockId(): number {
        return 0x2a;
    }

    readFrom(reader: BinaryReader): void {
        reader.readUint32();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint32(this.length);
    }
}

/**
 * This is meant to identify parts of the tape, so you know where level 1 starts, 
 * where to rewind to when the game ends, etc.
 * 
 * This description is not guaranteed to be shown while the tape is playing, 
 * but can be read while browsing the tape or changing the tape pointer.
 */
export class TzxTextDescriptionBlock extends TzxBlockBase {
    /**
     * Length of the description
     */
    descriptionLength: number;

    /**
     * The description bytes
     */
    description: Uint8Array

    /**
     * The string form of description
     */
    get descriptionText(): string {
        return TzxBlockBase.toAsciiString(this.description);
    }

    get blockId(): number {
        return 0x30;
    }

    readFrom(reader: BinaryReader): void {
        this.descriptionLength = reader.readByte();
        this.description = new Uint8Array(reader.readBytes(this.descriptionLength));
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.descriptionLength);
        writer.writeBytes(this.description!);
    }
}

/**
 * Represents the standard speed data block in a TZX file
 */
export class TzxTurboSpeedBlock extends Tzx3ByteBlockBase
{
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
    }

    get blockId(): number {
        return 0x11;
    }

    getDataBlock(): TapeDataBlock {
        const block = new TapeDataBlock();
        block.data = new Uint8Array(this.data);
        return block;
    }

    readFrom(reader: BinaryReader): void {
        this.pilotPulseLength = reader.readUint16();
        this.sync1PulseLength = reader.readUint16();
        this.sync2PulseLength = reader.readUint16();
        this.zeroBitPulseLength = reader.readUint16();
        this.oneBitPulseLength = reader.readUint16();
        this.pilotToneLength = reader.readUint16();
        this.lastByteUsedBits = reader.readByte();
        this.pauseAfter = reader.readUint16();
        this.dataLength = reader.readBytes(3);
        this.data = reader.readBytes(this.getLength());
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.pilotPulseLength);
        writer.writeUint16(this.sync1PulseLength);
        writer.writeUint16(this.sync2PulseLength);
        writer.writeUint16(this.zeroBitPulseLength);
        writer.writeUint16(this.oneBitPulseLength);
        writer.writeUint16(this.pilotToneLength);
        writer.writeByte(this.lastByteUsedBits);
        writer.writeUint16(this.pauseAfter);
        writer.writeBytes(new Uint8Array(this.dataLength));
        writer.writeBytes(new Uint8Array(this.data));
    }
}

/**
 * This blocks contains information about the hardware that the programs on this tape use.
 */
export class TzxHwInfo
{
    /**
     * Hardware type
     */
    hwType: number;

    /**
     * Hardwer Id
     */
    hwId: number;

    /**
     * Information about the tape
     * 
     * 00 - The tape RUNS on this machine or with this hardware,
     *      but may or may not use the hardware or special features of the machine.
     * 01 - The tape USES the hardware or special features of the machine,
     *      such as extra memory or a sound chip.
     * 02 - The tape RUNS but it DOESN'T use the hardware
     *      or special features of the machine.
     * 03 - The tape DOESN'T RUN on this machine or with this hardware.
     */
    tapeInfo: number;

    readFrom(reader: BinaryReader): void {
        this.hwType = reader.readByte();
        this.hwId = reader.readByte();
        this.tapeInfo = reader.readByte();
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.hwType);
        writer.writeByte(this.hwId);
        writer.writeByte(this.tapeInfo);
    }
}

/**
 * This is meant to identify parts of the tape, so you know where level 1 starts, where to rewind to when the game
 * ends, etc.
 * 
 * This description is not guaranteed to be shown while the tape is playing, but can be read while browsing the tape or
 * changing the tape pointer.
 */
export class TzxText {
    /**
     * Text identification byte.
     * 
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
    type: number

    /**
     * Length of the description
     */
    length: number;

    /**
     * The description bytes
     */
    public textBytes: Uint8Array;

    /**
     * The string the bytes of this block represent
     */
    get text(): string {
        return TzxBlockBase.toAsciiString(this.textBytes);
    }

    readFrom(reader: BinaryReader): void {
        this.type = reader.readByte();
        this.length = reader.readByte();
        this.textBytes = new Uint8Array(reader.readBytes(this.length));
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.type);
        writer.writeByte(this.length);
        writer.writeBytes(this.textBytes);
    }
}

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

    constructor() {
        this.pulseLengths = [];
    }

    readFrom(reader: BinaryReader): void {
        this.symbolFlags = reader.readByte();
        this.pulseLengths = TzxBlockBase.readWords(reader, this.pulseLengths.length);
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeByte(this.symbolFlags);
        TzxBlockBase.writeWords(writer, this.pulseLengths);
    }
}

/**
 * Symbol repetitions
 */
export class TzxPrle {
    /**
     * Symbol represented
     */
    symbol: number;

    /**
     * Number of repetitions
     */
    repetitions: number;
}

/**
 * This block represents select structure
 */
export class TzxSelect {
    /**
     * Bit 0 - Bit 1: Starting symbol polarity
     * 
     * 00: opposite to the current level (make an edge, as usual) - default
     * 01: same as the current level(no edge - prolongs the previous pulse)
     * 10: force low level
     * 11: force high level
     */
    blockOffset: number;

    /**
     * Length of the description
     */
    descriptionLength: number;

    /**
     * The description bytes
     */
    description: Uint8Array;

    /**
     * The string form of description
     */
    get descriptionText(): string {
        return TzxBlockBase.toAsciiString(this.description);
    }

    readFrom(reader: BinaryReader): void {
        this.blockOffset = reader.readUint16();
        this.descriptionLength = reader.readByte();
        this.description = new Uint8Array(reader.readBytes(this.descriptionLength));
    }

    writeTo(writer: BinaryWriter): void {
        writer.writeUint16(this.blockOffset);
        writer.writeByte(this.descriptionLength);
        writer.writeBytes(this.description);
    }
}

/**
 * Identified AD or DA converter types
 */
export enum TzxAdOrDaConverterType {
    HarleySystemsAdc8P2 = 0x00,
    BlackboardElectronics = 0x01
}

/**
 * Identified computer types
 */
export enum TzxComputerType {
    ZxSpectrum16 = 0x00,
    ZxSpectrum48OrPlus = 0x01,
    ZxSpectrum48Issue1 = 0x02,
    ZxSpectrum128 = 0x03,
    ZxSpectrum128P2 = 0x04,
    ZxSpectrum128P2AOr3 = 0x05,
    Tc2048 = 0x06,
    Ts2068 = 0x07,
    Pentagon128 = 0x08,
    SamCoupe = 0x09,
    DidaktikM = 0x0A,
    DidaktikGama = 0x0B,
    Zx80 = 0x0C,
    Zx81 = 0x0D,
    ZxSpectrum128Spanish = 0x0E,
    ZxSpectrumArabic = 0x0F,
    Tk90X = 0x10,
    Tk95 = 0x11,
    Byte = 0x12,
    Elwro800D3 = 0x13,
    ZsScorpion256 = 0x14,
    AmstradCpc464 = 0x15,
    AmstradCpc664 = 0x16,
    AmstradCpc6128 = 0x17,
    AmstradCpc464P = 0x18,
    AmstradCpc6128P = 0x19,
    JupiterAce = 0x1A,
    Enterprise = 0x1B,
    Commodore64 = 0x1C,
    Commodore128 = 0x1D,
    InvesSpectrumP = 0x1E,
    Profi = 0x1F,
    GrandRomMax = 0x20,
    Kay1024 = 0x21,
    IceFelixHc91 = 0x22,
    IceFelixHc2000 = 0x23,
    AmaterskeRadioMistrum = 0x24,
    Quorum128 = 0x25,
    MicroArtAtm = 0x26,
    MicroArtAtmTurbo2 = 0x27,
    Chrome = 0x28,
    ZxBadaloc = 0x29,
    Ts1500 = 0x2A,
    Lambda = 0x2B,
    Tk65 = 0x2C,
    Zx97 = 0x2D
}

/**
 * Identified digitizer types
 */
export enum TzxDigitizerType {
    RdDigitalTracer = 0x00,
    DkTronicsLightPen = 0x01,
    MicrographPad = 0x02,
    RomnticRobotVideoface = 0x03
}

/**
 * Identified EPROM programmer types
 */
export enum TzxEpromProgrammerType {
    OrmeElectronics = 0x00
}

/**
 * Identified external storage types
 */
export enum TzxExternalStorageType {
    ZxMicroDrive = 0x00,
    OpusDiscovery = 0x01,
    MgtDisciple = 0x02,
    MgtPlusD = 0x03,
    RobotronicsWafaDrive = 0x04,
    TrDosBetaDisk = 0x05,
    ByteDrive = 0x06,
    Watsford = 0x07,
    Fiz = 0x08,
    Radofin = 0x09,
    DidaktikDiskDrive = 0x0A,
    BsDos = 0x0B,
    ZxSpectrumP3DiskDrive = 0x0C,
    JloDiskInterface = 0x0D,
    TimexFdd3000 = 0x0E,
    ZebraDiskDrive = 0x0F,
    RamexMillenia = 0x10,
    Larken = 0x11,
    KempstonDiskInterface = 0x12,
    Sandy = 0x13,
    ZxSpectrumP3EHardDisk = 0x14,
    ZxAtaSp = 0x15,
    DivIde = 0x16,
    ZxCf = 0x17
}

/**
 * Identified graphics types
 */
export enum TzxGraphicsType {
    WrxHiRes = 0x00,
    G007 = 0x01,
    Memotech = 0x02,
    LambdaColour = 0x03
}

/**
 * Represents the hardware types that can be defined
 */
export enum TzxHwType {
    Computer = 0x00,
    ExternalStorage = 0x01,
    RomOrRamTypeAddOn = 0x02,
    SoundDevice = 0x03,
    Joystick = 0x04,
    Mouse = 0x05,
    OtherController = 0x06,
    SerialPort = 0x07,
    ParallelPort = 0x08,
    Printer = 0x09,
    Modem = 0x0A,
    Digitizer = 0x0B,
    NetworkAdapter = 0x0C,
    Keyboard = 0x0D,
    AdOrDaConverter = 0x0E,
    EpromProgrammer = 0x0F,
    Graphics = 0x10
}

/**
 * Identified joystick types
 */
export enum TzxJoystickType {
    Kempston = 0x00,
    ProtekCursor = 0x01,
    Sinclair2Left = 0x02,
    Sinclair1Right = 0x03,
    Fuller = 0x04
}

/**
 * Identified keyboard and keypad types
 */
export enum TzxKeyboardType {
    KeypadForZxSpectrum128K = 0x00
}

/**
 * Identified modem types
 */
export enum TzxModemTypes {
    PrismVtx5000 = 0x00,
    Westridge2050 = 0x01
}

/**
 * Identified mouse types
 */
export enum TzxMouseType {
    AmxMouse = 0x00,
    KempstonMouse = 0x01
}

/**
 * Identified network adapter types
 */
export enum TzxNetworkAdapterType {
    ZxInterface1 = 0x00
}

/**
 * Identified other controller types
 */
export enum TzxOtherControllerType {
    Trisckstick = 0x00,
    ZxLightGun = 0x01,
    ZebraGraphicTablet = 0x02,
    DefnederLightGun = 0x03
}

/**
 * Identified parallel port types
 */
export enum TzxParallelPortType {
    KempstonS = 0x00,
    KempstonE = 0x01,
    ZxSpectrum3P = 0x02,
    Tasman = 0x03,
    DkTronics = 0x04,
    Hilderbay = 0x05,
    InesPrinterface = 0x06,
    ZxLprintInterface3 = 0x07,
    MultiPrint = 0x08,
    OpusDiscovery = 0x09,
    Standard8255 = 0x0A
}

/**
 * Identified printer types
 */
export enum TzxPrinterType {
    ZxPrinter = 0x00,
    GenericPrinter = 0x01,
    EpsonCompatible = 0x02
}

/**
 * Identifier ROM or RAM add-on types
 */
export enum TzxRomRamAddOnType {
    SamRam = 0x00,
    MultifaceOne = 0x01,
    Multiface128K = 0x02,
    MultifaceP3 = 0x03,
    MultiPrint = 0x04,
    Mb02 = 0x05,
    SoftRom = 0x06,
    Ram1K = 0x07,
    Ram16K = 0x08,
    Ram48K = 0x09,
    Mem8To16KUsed = 0x0A
}

/**
 * Identified serial port types
 */
export enum TzxSerialPortType {
    ZxInterface1 = 0x00,
    ZxSpectrum128 = 0x01
}

/**
 * Identified sound device types
 */
export enum TzxSoundDeviceType {
    ClassicAy = 0x00,
    FullerBox = 0x01,
    CurrahMicroSpeech = 0x02,
    SpectDrum = 0x03,
    MelodikAyAcbStereo = 0x04,
    AyAbcStereo = 0x05,
    RamMusinMachine = 0x06,
    Covox = 0x07,
    GeneralSound = 0x08,
    IntecEdiB8001 = 0x09,
    ZonXAy = 0x0A,
    QuickSilvaAy = 0x0B,
    JupiterAce = 0x0C
}
