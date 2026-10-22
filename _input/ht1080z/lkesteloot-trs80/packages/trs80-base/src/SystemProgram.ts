/**
 * Tools for dealing with SYSTEM (machine language) programs.
 *
 * http://www.trs-80.com/wordpress/zaps-patches-pokes-tips/tape-and-file-formats-structures/
 */

import {ByteReader, concatByteArrays, EOF} from "teamten-ts-utils";
import {hi, lo, toHexByte, toHexWord} from "z80-base";
import {ProgramAnnotation} from "./ProgramAnnotation.js";
import {AbstractTrs80File} from "./Trs80File.js";
import {
    CmdLoadBlockChunk,
    CmdLoadModuleHeaderChunk,
    CmdProgram,
    CmdTransferAddressChunk,
    encodeCmdProgram
} from "./CmdProgram.js";
import {ProgramBuilder} from "./ProgramBuilder.js";
import {disasmForTrs80} from "./Disasm.js";

const FILE_HEADER = 0x55;
const DATA_HEADER = 0x3C;
const END_OF_FILE_MARKER = 0x78;
const FILENAME_LENGTH = 6;
export const MAX_SYSTEM_CHUNK_DATA_SIZE = 256;

/**
 * Represents a chunk of bytes from the file, with a checksum.
 */
export class SystemChunk {
    public readonly loadAddress: number;
    public readonly data: Uint8Array;
    public readonly checksum: number;

    constructor(loadAddress: number, data: Uint8Array, checksum?: number) {
        if (data.length > MAX_SYSTEM_CHUNK_DATA_SIZE) {
            throw new Error("system chunks can at most hold " + MAX_SYSTEM_CHUNK_DATA_SIZE + " bytes");
        }
        if (data.length === 0) {
            throw new Error("system chunk cannot have no data");
        }
        this.loadAddress = loadAddress;
        this.data = data;
        this.checksum = checksum ?? SystemChunk.computeChecksum(loadAddress, data);
    }

    /**
     * Whether the checksum supplied on tape matches what we compute.
     */
    public isChecksumValid(): boolean {
        return SystemChunk.computeChecksum(this.loadAddress, this.data) === this.checksum;
    }

    /**
     * Compute the chunk checksum of load address and its data.
     */
    private static computeChecksum(loadAddress: number, data: Uint8Array): number {
        let checksum = 0;

        // Include load address and data.
        checksum += (loadAddress >> 8) & 0xFF;
        checksum += loadAddress & 0xFF;
        for (const b of data) {
            checksum += b;
        }

        return checksum & 0xFF;
    }
}

/**
 * Class representing a SYSTEM (machine language) program. If the "error" field is set, then something
 * went wrong with the program and the data may be partially loaded.
 */
export class SystemProgram extends AbstractTrs80File {
    public readonly className = "SystemProgram";
    public readonly filename: string;
    public readonly chunks: SystemChunk[];
    public readonly entryPointAddress: number;
    public readonly annotations: ProgramAnnotation[];

    constructor(binary: Uint8Array, error: string | undefined, filename: string, chunks: SystemChunk[],
                entryPointAddress: number, annotations: ProgramAnnotation[]) {

        super(binary, error, annotations);
        this.filename = clipSystemProgramFilename(filename);
        this.chunks = chunks;
        this.entryPointAddress = entryPointAddress;
        this.annotations = annotations;
    }

    public getDescription(): string {
        let description = "System program (" + this.filename;

        if (this.entryPointAddress === 0) {
            const address = this.guessEntryAddress();
            if (address !== undefined) {
                description += ", /" + address;
            }
        }

        description += ")";

        return description;
    }

    /**
     * Guess an entry address in case one wasn't specified in the program.
     */
    public guessEntryAddress(): number | undefined {
        // For now just take the address of the first chunk. We may want to do something more clever,
        // like find the minimum load address that's not in video memory. I suspect that programs
        // without load addresses probably aren't doing clever things like that.
        return this.chunks.length === 0 ? undefined : this.chunks[0].loadAddress;
    }

    /**
     * Convert an address in memory to the original byte offset in the binary. Returns undefined if
     * not found in any chunk.
     */
    public addressToByteOffset(address: number): number | undefined {
        // Skip file header and block header.
        let offset = 1 + FILENAME_LENGTH + 4;

        for (const chunk of this.chunks) {
            if (address >= chunk.loadAddress && address < chunk.loadAddress + chunk.data.length) {
                return offset + (address - chunk.loadAddress);
            }

            // Skip checksum and block header of the next block.
            offset += chunk.data.length + 5;
        }

        return undefined;
    }

    /**
     * Create the CMD version of this system program.
     *
     * @param filename name to use in case the system program doesn't have one.
     */
    public toCmdProgram(filename?: string): CmdProgram {
        const cmdChunks = [];

        const cmdFilename = this.filename !== "" ? this.filename : (filename ?? "");
        if (cmdFilename !== "") {
            cmdChunks.push(CmdLoadModuleHeaderChunk.fromFilename(cmdFilename));
        }

        for (const chunk of this.chunks) {
            cmdChunks.push(CmdLoadBlockChunk.fromData(chunk.loadAddress, chunk.data));
        }

        cmdChunks.push(CmdTransferAddressChunk.fromEntryPointAddress(this.entryPointAddress));

        const binary = encodeCmdProgram(cmdChunks);
        return new CmdProgram(binary, undefined, [], cmdChunks, this.filename, this.entryPointAddress);
    }

    /**
     * Create a new system program just like this one, but with the specified entry point address.
     * @param entryPointAddress
     */
    public withEntryPointAddress(entryPointAddress: number): SystemProgram {
        return new SystemProgram(encodeSystemProgram(this.filename, this.chunks, entryPointAddress),
            this.error, this.filename, this.chunks, entryPointAddress, this.annotations);
    }
}

/**
 * Decodes a system program from the binary. If the binary is not at all a system
 * program, returns undefined. If it's a system program with decoding errors, returns
 * partially-decoded binary and sets the "error" field.
 */
export function decodeSystemProgram(binary: Uint8Array, disassemble: boolean): SystemProgram | undefined {
    const chunks: SystemChunk[] = [];
    const annotations: ProgramAnnotation[] = [];
    let entryPointAddress = 0;

    const b = new ByteReader(binary);

    const headerByte = b.read();
    if (headerByte === EOF) {
        return undefined;
    }
    if (headerByte !== FILE_HEADER) {
        return undefined;
    }
    annotations.push(new ProgramAnnotation("System file header", b.addr() - 1, b.addr()));

    let filename = b.readString(FILENAME_LENGTH);

    // Make a SystemProgram object with what we have so far.
    const makeSystemProgram = (error?: string) => {
        const programBinary = binary.subarray(0, b.addr());
        return new SystemProgram(programBinary, error, filename, chunks, entryPointAddress, annotations);
    };

    if (filename.length < FILENAME_LENGTH) {
        // Binary is truncated.
        return makeSystemProgram("File is truncated at filename");
    }
    filename = filename.trim();
    annotations.push(new ProgramAnnotation(`Filename "${filename}"`,
        b.addr() - FILENAME_LENGTH, b.addr()));

    while (true) {
        const marker = b.read();
        if (marker === EOF) {
            return makeSystemProgram("File is truncated at start of block");
        }
        if (marker === END_OF_FILE_MARKER) {
            annotations.push(new ProgramAnnotation("End of file marker", b.addr() - 1, b.addr()));
            break;
        }
        if (marker !== DATA_HEADER) {
            // Here if the marker is 0x55, we could guess that it's a high-speed cassette header.
            return makeSystemProgram("Unexpected byte " + toHexByte(marker) + " at start of block");
        }
        annotations.push(new ProgramAnnotation("Data chunk marker", b.addr() - 1, b.addr()));

        let length = b.read();
        if (length === EOF) {
            return makeSystemProgram("File is truncated at block length");
        }
        // 0 means 256.
        if (length === 0) {
            length = 256;
        }
        annotations.push(new ProgramAnnotation(`Length (${length} byte${length === 1 ? "" : "s"})`,
            b.addr() - 1, b.addr()));

        const loadAddress = b.readShort(false);
        if (loadAddress === EOF) {
            return makeSystemProgram("File is truncated at load address");
        }
        annotations.push(new ProgramAnnotation(`Address (0x${toHexWord(loadAddress)})`,
            b.addr() - 2, b.addr()));

        const dataStartAddr = b.addr();
        const data = b.readBytes(length);
        if (data.length < length) {
            return makeSystemProgram("File is truncated at data");
        }
        const dataAnnotation = new ProgramAnnotation(`Chunk data`, dataStartAddr, b.addr());
        annotations.push(dataAnnotation);

        if (disassemble) {
            // Disassemble the data, for optional display.
            const disasm = disasmForTrs80();
            disasm.addChunk(binary.subarray(dataAnnotation.begin, dataAnnotation.end), loadAddress);
            disasm.addEntryPoint(loadAddress);
            disasm.setCreateLabels(false);
            const instructions = disasm.disassemble();
            if (instructions.length > 0) {
                // Repeat header so we can put a control on it.
                dataAnnotation.nestedAnnotations.push(new ProgramAnnotation("Chunk data", dataStartAddr, dataStartAddr));
            }
            for (const instruction of instructions) {
                const text = "  " + toHexWord(instruction.address) + "  " + instruction.toText(false);
                const begin = instruction.address - loadAddress + dataAnnotation.begin;
                dataAnnotation.nestedAnnotations.push(new ProgramAnnotation(text, begin, begin + instruction.bin.length));
            }
        }

        const checksum = b.read();
        if (checksum === EOF) {
            return makeSystemProgram("File is truncated at checksum");
        }

        const systemChunk = new SystemChunk(loadAddress, data, checksum);
        chunks.push(systemChunk);

        annotations.push(new ProgramAnnotation(
            `Checksum (0x${toHexByte(checksum)}, ${systemChunk.isChecksumValid() ? "" : "in"}valid)`,
            b.addr() - 1, b.addr()));
    }

    entryPointAddress = b.readShort(false);
    if (entryPointAddress === EOF) {
        entryPointAddress = 0;
        return makeSystemProgram("File is truncated at entry point address");
    }
    annotations.push(new ProgramAnnotation(`Jump address (0x${toHexWord(entryPointAddress)})`,
        b.addr() - 2, b.addr()));

    return makeSystemProgram();
}

/**
 * Return a filename that can fit into a system program. The returned string is not padded.
 */
function clipSystemProgramFilename(filename: string): string {
    return filename.slice(0, FILENAME_LENGTH);
}

/**
 * Generate a binary for the specified parts of a system program.
 * @param filename a six-character max filename, preferably in upper case.
 * @param chunks a list of chunks to load into memory.
 * @param entryPointAddress where to launch the program.
 */
export function encodeSystemProgram(filename: string, chunks: SystemChunk[], entryPointAddress: number): Uint8Array {
    const binaryParts: Uint8Array[] = [];

    binaryParts.push(new Uint8Array([FILE_HEADER]));

    filename = clipSystemProgramFilename(filename).toUpperCase();
    filename = filename.padEnd(FILENAME_LENGTH, " ");
    binaryParts.push(new TextEncoder().encode(filename));

    for (const chunk of chunks) {
        let length = chunk.data.length;
        if (length === 256) {
            length = 0;
        }

        binaryParts.push(new Uint8Array([DATA_HEADER, length,
            lo(chunk.loadAddress), hi(chunk.loadAddress),
            ... chunk.data, chunk.checksum]));
    }

    binaryParts.push(new Uint8Array([END_OF_FILE_MARKER,
        lo(entryPointAddress), hi(entryPointAddress)]));

    return concatByteArrays(binaryParts);
}

/**
 * Builds a system program from chunks of memory.
 */
export class SystemProgramBuilder extends ProgramBuilder {
    /**
     * Get system chunks for the bytes given so far.
     */
    public getChunks(): SystemChunk[] {
        // Sort blocks by address.
        this.blocks.sort((a, b) => a.address - b.address);

        return this.blocks
            .flatMap(block => block.breakInto(MAX_SYSTEM_CHUNK_DATA_SIZE))
            .map(block => new SystemChunk(block.address, new Uint8Array(block.bytes)));
    }
}
