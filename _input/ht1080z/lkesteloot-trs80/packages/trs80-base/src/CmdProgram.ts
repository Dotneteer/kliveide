/**
 * Tools for dealing with CMD (machine language) programs.
 *
 * https://www.trs-80.com/wordpress/tips/formats/#cmdfile
 */

import {ByteReader, concatByteArrays, EOF} from "teamten-ts-utils";
import {hi, lo, toHexByte, toHexWord, word} from "z80-base";
import {ProgramAnnotation} from "./ProgramAnnotation.js";
import {AbstractTrs80File} from "./Trs80File.js";
import {
    encodeSystemProgram,
    MAX_SYSTEM_CHUNK_DATA_SIZE,
    SystemChunk,
    SystemProgram
} from "./SystemProgram.js";
import {ProgramBuilder} from "./ProgramBuilder.js";
import {TRS80_SCREEN_BEGIN, TRS80_SCREEN_END} from "./Constants.js";

// Chunk types.
export const CMD_EASTER_EGG = 0x00;
export const CMD_LOAD_BLOCK = 0x01;
export const CMD_TRANSFER_ADDRESS = 0x02;
export const CMD_END_OF_FILE = 0x03;
export const CMD_END_OF_PDS_MEMBER = 0x04;
export const CMD_LOAD_MODULE_HEADER = 0x05;
export const CMD_PATCH_NAME_HEADER = 0x07;
export const CMD_ISAM_DIRECTORY_ENTRY = 0x08;
export const CMD_PDS_DIRECTORY_ENTRY = 0x0C;
export const CMD_YANKED_LOAD_BLOCK = 0x10;
export const CMD_MAX_TYPE = 0x1F;

export const MAX_CMD_CHUNK_DATA_SIZE = 256;

/**
 * A friendly (not so technical) name for the block type.
 * See page 43 of The LDOS Quarterly, Volume 1, Number 4.
 * https://www.tim-mann.org/trs80/doc/ldosq1-4.pdf
 * http://www.vintagecomputer.net/fjkraan/comp/trs80/doc/Trscmdff.txt
 * https://tim-mann.org/trs80/doc/gocmd.pdf
 * http://www.manmrk.net/tutorials/TRS80/Software/ldos/trs80/doc/ldosq1-4.txt
 */
export const CMD_CHUNK_TYPE_NAME = new Map<number, string>([
    [CMD_EASTER_EGG, "easter egg"], // Used by Model I TRSDOS BOOT/SYS easter egg.
    [CMD_LOAD_BLOCK, "data"], // Originally "object code".
    [CMD_TRANSFER_ADDRESS, "jump address"], // Originally "transfer address".
    [CMD_END_OF_FILE, "end of file"], // No transfer address, length not even necessary.
    [CMD_END_OF_PDS_MEMBER, "end of PDS member"],
    [CMD_LOAD_MODULE_HEADER, "header"], // Originally "load module header".
    [0x06, "PDS header"],
    [CMD_PATCH_NAME_HEADER, "patch name header"],
    [CMD_ISAM_DIRECTORY_ENTRY, "ISAM directory entry"],
    [0x0A, "end of ISAM directory"],
    [CMD_PDS_DIRECTORY_ENTRY, "PDS directory entry"],
    [0x0E, "end of PDS directory"],
    [CMD_YANKED_LOAD_BLOCK, "yanked load block"],
    [0x1F, "copyright block"],
]);

/**
 * Decode the name inside a chunk.
 */
function decodeName(data: Uint8Array): string {
    if (data.length >= 2) {
        const location = word(data[1], data[0]);
        if (location >= TRS80_SCREEN_BEGIN && location < TRS80_SCREEN_END) {
            // We've seen headers that contain graphic characters that are meant to be
            // displayed on the screen at a particular location. This is not useful
            // as a name, even the text is too verbose to extract anything useful from.
            //
            // For an example of this, see SCRIPSIT.CMD.
            return "";
        }
    }

    return new TextDecoder().decode(data).trim().replace(/ +/g, " ");
}
/**
 * Represents a chunk of bytes from the file.
 */
abstract class CmdAbstractChunk {
    public abstract readonly className: string;
    public abstract readonly type: number;
    public readonly offset: number; // Within the file.
    public readonly rawData: Uint8Array;

    protected constructor(offset: number, data: Uint8Array) {
        this.offset = offset;
        this.rawData = data;
    }

    /**
     * Add annotations about this chunk, assuming its data is at "addr".
     */
    public abstract fillAnnotations(annotations: ProgramAnnotation[], addr: number): void;
}

/**
 * A chunk for loading data into memory.
 */
export class CmdLoadBlockChunk extends CmdAbstractChunk {
    public readonly className = "CmdLoadBlockChunk";
    public readonly type: number;
    public readonly address: number;
    public readonly loadData: Uint8Array;

    constructor(type: number, offset: number, data: Uint8Array) {
        super(offset, data);
        this.type = type;
        this.address = word(data[1], data[0]);
        this.loadData = data.slice(2);
    }

    /**
     * Make a chunk from the data to load into memory.
     */
    public static fromData(address: number, chunkData: Uint8Array): CmdLoadBlockChunk {
        if (chunkData.length > MAX_CMD_CHUNK_DATA_SIZE) {
            throw new Error("cmd chunks can at most hold " + MAX_CMD_CHUNK_DATA_SIZE + " bytes");
        }
        const data = new Uint8Array([lo(address), hi(address), ... chunkData]);
        return new CmdLoadBlockChunk(CMD_LOAD_BLOCK, 0, data);
    }

    public override fillAnnotations(annotations: ProgramAnnotation[], addr: number): void {
        annotations.push(new ProgramAnnotation("Load address (0x" + toHexWord(this.address) + ")", addr, addr + 2));
        annotations.push(new ProgramAnnotation("Data (" + this.loadData.length + " byte" +
            (this.loadData.length === 1 ? "" : "s") + ")", addr + 2, addr + 2 + this.loadData.length));
    }
}

/**
 * A chunk for jumping to the start of the program.
 */
export class CmdTransferAddressChunk extends CmdAbstractChunk {
    public readonly className = "CmdTransferAddressChunk";
    public readonly type = CMD_TRANSFER_ADDRESS;
    public readonly address: number;

    constructor(offset: number, data: Uint8Array) {
        super(offset, data);
        this.address = data.length === 2 ? word(data[1], data[0]) : 0;
    }

    /**
     * Make a chunk from an entry point address.
     */
    public static fromEntryPointAddress(entryPointAddress: number): CmdTransferAddressChunk {
        const data = new Uint8Array([lo(entryPointAddress), hi(entryPointAddress)]);
        return new CmdTransferAddressChunk(0, data);
    }

    public override fillAnnotations(annotations: ProgramAnnotation[], addr: number): void {
        annotations.push(new ProgramAnnotation("Jump address (0x" + toHexWord(this.address) + ")", addr, addr + 2));
    }
}

/**
 * A header chunk for the filename.
 */
export class CmdLoadModuleHeaderChunk extends CmdAbstractChunk {
    public readonly className = "CmdLoadModuleHeaderChunk";
    public readonly type = CMD_LOAD_MODULE_HEADER;
    public readonly filename: string;

    constructor(offset: number, data: Uint8Array) {
        super(offset, data);
        this.filename = decodeName(data);
    }

    /**
     * Make a chunk from the filename.
     */
    public static fromFilename(filename: string): CmdLoadModuleHeaderChunk {
        const data = new TextEncoder().encode(filename.toUpperCase());
        return new CmdLoadModuleHeaderChunk(0, data);
    }

    public override fillAnnotations(annotations: ProgramAnnotation[], addr: number): void {
        annotations.push(new ProgramAnnotation("Name (" + this.filename + ")", addr, addr + this.rawData.length));
    }
}

/**
 * Not sure what this is, seems embedded between data chunks in SYS6 of VTOS. Has names like "SYS6C2".
 */
export class CmdPatchNameHeaderChunk extends CmdAbstractChunk {
    public readonly className = "CmdPatchNameHeaderChunk";
    public readonly type = CMD_PATCH_NAME_HEADER;
    public readonly filename: string;

    constructor(offset: number, data: Uint8Array) {
        super(offset, data);
        this.filename = decodeName(data);
    }

    public override fillAnnotations(annotations: ProgramAnnotation[], addr: number): void {
        annotations.push(new ProgramAnnotation("Name (" + this.filename + ")", addr, addr + this.rawData.length));
    }
}

/**
 * Describes an entry point and chunk of code internal to the file.
 */
export class CmdIsamDirectoryEntryChunk extends CmdAbstractChunk {
    public static readonly MIN_DATA_SIZE = 6;
    public readonly className = "CmdIsamDirectoryEntryChunk";
    public readonly type = CMD_ISAM_DIRECTORY_ENTRY;
    public readonly key: number; // AKA ISAM entry number.
    public readonly transferAddress: number;
    public readonly sectorNumber: number;
    public readonly sectorOffset: number; // Within the sector.

    constructor(offset: number, data: Uint8Array) {
        super(offset, data);

        // Data is guaranteed to be the minimum length.
        this.key = data[0];
        this.transferAddress = word(data[2], data[1]);
        this.sectorNumber = word(data[4], data[3]);
        this.sectorOffset = data[5];
        // Some later models have three more bytes, another NRN/offset pair for the end of the data.
    }

    public override fillAnnotations(annotations: ProgramAnnotation[], addr: number): void {
        annotations.push(new ProgramAnnotation("Key (0x" + toHexByte(this.key) + ")", addr, addr + 1));
        annotations.push(new ProgramAnnotation("Jump address (0x" + toHexWord(this.transferAddress) + ")", addr + 1, addr + 3));
        annotations.push(new ProgramAnnotation("Sector (0x" + toHexWord(this.sectorNumber) + ")", addr + 3, addr + 5));
        annotations.push(new ProgramAnnotation("Offset (0x" + toHexByte(this.sectorOffset) + ")", addr + 5, addr + 6));
    }
}

/**
 * A chunk of unknown meaning.
 */
export class CmdUnknownChunk extends CmdAbstractChunk {
    public readonly className = "CmdUnknownChunk";
    public readonly type: number;

    constructor(type: number, offset: number, data: Uint8Array) {
        super(offset, data);
        this.type = type;
    }

    public override fillAnnotations(annotations: ProgramAnnotation[], addr: number): void {
        // Nothing for unknown chunks.
    }
}

/**
 * One of the possible kinds of blocks.
 */
export type CmdChunk = CmdLoadBlockChunk |
    CmdTransferAddressChunk |
    CmdLoadModuleHeaderChunk |
    CmdPatchNameHeaderChunk |
    CmdIsamDirectoryEntryChunk |
    CmdUnknownChunk;

/**
 * Class representing a CMD (machine language) program. If the "error" field is set, then something
 * went wrong with the program and the data may be partially loaded.
 */
export class CmdProgram extends AbstractTrs80File {
    public readonly className = "CmdProgram";
    public chunks: CmdChunk[];
    public filename: string | undefined;
    public entryPointAddress: number | undefined;

    constructor(binary: Uint8Array, error: string | undefined, annotations: ProgramAnnotation[],
                chunks: CmdChunk[], filename: string | undefined, entryPointAddress: number | undefined) {

        super(binary, error, annotations);
        this.chunks = chunks;
        this.filename = filename;
        this.entryPointAddress = entryPointAddress;
    }

    public getDescription(): string {
        return "CMD program" + (this.filename !== undefined ? ` (${this.filename})` : "");
    }

    /**
     * Does some sanity checks to see if we accidentally parsed this file as CMD.
     */
    public isProbablyCmdProgram(): boolean {
        if (this.error !== undefined) {
            return false;
        }
        for (const chunk of this.chunks) {
            if (CMD_CHUNK_TYPE_NAME.get(chunk.type) === undefined) {
                return false;
            }
        }
        return true;
    }

    /**
     * Convert an address in memory to the original byte offset in the binary. Returns undefined if
     * not found in any chunk.
     */
    public addressToByteOffset(address: number): number | undefined {
        // Offset in the binary of first byte of chunk.
        let offset = 0;

        for (const chunk of this.chunks) {
            if (chunk.className === "CmdLoadBlockChunk") {
                if (address >= chunk.address && address < chunk.address + chunk.loadData.length) {
                    // Skip type, length, and address.
                    return offset + 4 + (address - chunk.address);
                }
            }

            // Skip type, length and data.
            offset += 2 + chunk.rawData.length;
        }

        return undefined;
    }

    /**
     * Convert the Command program to an equivalent system program, dropping any
     * chunks that can't be encoded in system programs.
     *
     * @param filename optional filename to use for system program, in case the
     * command program doesn't have one.
     */
    public toSystemProgram(filename?: string): SystemProgram {
        // Prefer the filename in the command program.
        if (this.filename !== undefined && this.filename !== "") {
            filename = this.filename;
        } else if (filename === undefined || filename === "") {
            filename = "CMD";
        }

        const systemChunks: SystemChunk[] = [];
        let firstChunkAddress = 0;
        for (const chunk of this.chunks) {
            switch (chunk.className) {
                case "CmdLoadBlockChunk":
                    if (firstChunkAddress === 0) {
                        firstChunkAddress = chunk.address;
                    }
                    // CMD chunks can hold more than system program chunks can (by two bytes!) so
                    // we have to split them up.
                    let begin = 0;
                    while (begin < chunk.loadData.length) {
                        const length = Math.min(chunk.loadData.length - begin, MAX_SYSTEM_CHUNK_DATA_SIZE);
                        systemChunks.push(new SystemChunk(chunk.address + begin,
                            chunk.loadData.subarray(begin, begin + length)));
                        begin += length;
                    }
                    break;

                case "CmdTransferAddressChunk":
                case "CmdLoadModuleHeaderChunk":
                case "CmdUnknownChunk":
                    // Drop it.
                    break;
            }
        }

        const entryPointAddress = this.entryPointAddress ?? firstChunkAddress;
        const binary = encodeSystemProgram(filename, systemChunks, entryPointAddress);
        return new SystemProgram(binary, undefined, filename, systemChunks, entryPointAddress, []);
    }
}

/**
 * Decodes a CMD program from the binary. If the binary is not at all a CMD
 * program, returns undefined. If it's a CMD program with decoding errors, returns
 * partially-decoded binary and sets the "error" field.
 */
export function decodeCmdProgram(binary: Uint8Array): CmdProgram | undefined {
    let error: string | undefined;
    const annotations: ProgramAnnotation[] = [];
    const chunks: CmdChunk[] = [];
    let filename: string | undefined;
    let entryPointAddress: number | undefined;
    const b = new ByteReader(binary);

    // Read each chunk.
    while (error === undefined) {
        // Offset into the file.
        const offset = b.addr();

        // First byte is type of chunk.
        const type = b.read();

        // End of file or invalid type?
        if (type === EOF || type > CMD_MAX_TYPE) {
            break;
        }

        annotations.push(new ProgramAnnotation("Type of chunk (" +
            (CMD_CHUNK_TYPE_NAME.get(type) ?? "unknown") + ")", b.addr() - 1, b.addr()));

        // Second byte is length, in bytes.
        let length = b.read();
        if (length === EOF) {
            if (type === CMD_END_OF_FILE) {
                // Length not needed. Don't bother making a chunk.
                break;
            }
            error = "File is truncated at length";
            break;
        }

        // Adjust load block length.
        if ((type === CMD_LOAD_BLOCK || type === CMD_YANKED_LOAD_BLOCK) && length <= 2) {
            length += 256;
        } else if (length === 0) {
            length = 256;
        }

        annotations.push(new ProgramAnnotation("Length of chunk (" + length +
            " byte" + (length === 1 ? "" : "s") + ")", b.addr() - 1, b.addr()));

        // Read the raw bytes.
        const dataAddr = b.addr();
        const data = b.readBytes(length);
        if (data.length < length) {
            error = "File is truncated";
            // We continue so we can create a partial chunk. The loop will stop at the top of the next
            // iteration. Not sure this is the right thing to do.
        }

        // Create type-specific chunk objects.
        let chunk: CmdChunk;
        switch (type) {
            case CMD_LOAD_BLOCK:
            case CMD_YANKED_LOAD_BLOCK:
                chunk = new CmdLoadBlockChunk(type, offset, data);
                break;

            case CMD_TRANSFER_ADDRESS: {
                const cmdTransferAddressChunk = new CmdTransferAddressChunk(offset, data);
                entryPointAddress = cmdTransferAddressChunk.address;
                chunk = cmdTransferAddressChunk;
                break;
            }

            case CMD_LOAD_MODULE_HEADER: {
                const cmdLoadModuleHeaderChunk = new CmdLoadModuleHeaderChunk(offset, data);
                filename = cmdLoadModuleHeaderChunk.filename;
                if (filename === "") {
                    filename = undefined;
                }
                chunk = cmdLoadModuleHeaderChunk;
                break;
            }

            case CMD_PATCH_NAME_HEADER:
                chunk = new CmdPatchNameHeaderChunk(offset, data);
                break;

            case CMD_ISAM_DIRECTORY_ENTRY:
                if (data.length < CmdIsamDirectoryEntryChunk.MIN_DATA_SIZE) {
                    error = "ISAM directory entry is truncated";
                    chunk = new CmdUnknownChunk(type, offset, data);
                } else {
                    chunk = new CmdIsamDirectoryEntryChunk(offset, data);
                }
                break;

            default:
                chunk = new CmdUnknownChunk(type, offset, data);
                break;
        }

        chunk.fillAnnotations(annotations, dataAddr);
        chunks.push(chunk);

        // Just saw jump? There's typically junk after this and it can make it seem like there's an error.
        if (chunk.type === CMD_TRANSFER_ADDRESS || chunk.type === CMD_END_OF_FILE) {
            break;
        }
    }

    if (chunks.length === 0) {
        // Not a CMD file.
        return undefined;
    }
    return new CmdProgram(binary.subarray(0, b.addr()), error, annotations, chunks, filename, entryPointAddress);
}

/**
 * Create the binary version of a Cmd program from a list of chunks.
 */
export function encodeCmdProgram(chunks: CmdChunk[]): Uint8Array {
    const binaryParts: Uint8Array[] = [];

    for (const chunk of chunks) {
        binaryParts.push(new Uint8Array([chunk.type, chunk.rawData.length % 256]));
        binaryParts.push(chunk.rawData);
    }

    return concatByteArrays(binaryParts);
}

/**
 * Builds a command program from chunks of memory.
 */
export class CmdProgramBuilder extends ProgramBuilder {
    /**
     * Get command load block chunks for the bytes given so far.
     */
    public getChunks(): CmdLoadBlockChunk[] {
        // Sort blocks by address.
        this.blocks.sort((a, b) => a.address - b.address);

        return this.blocks
            .flatMap(block => block.breakInto(MAX_CMD_CHUNK_DATA_SIZE))
            .map(block => CmdLoadBlockChunk.fromData(block.address, new Uint8Array(block.bytes)));
    }
}

