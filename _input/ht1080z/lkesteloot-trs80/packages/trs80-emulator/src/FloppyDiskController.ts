/**
 * Floppy disk controller for the TRS-80.
 *
 * References:
 *
 * https://hansotten.file-hunter.com/technical-info/wd1793/
 * xtrs's trs_disk.c, for how the WD1771 and WD1791 differ.
 */

import {
    CRC_16_CCITT,
    CRC_PRESET,
    DATA_ADDRESS_MARK,
    DELETED_DATA_ADDRESS_MARK,
    Density,
    FloppyDisk,
    FM_GAP,
    FormattedTrack,
    ID_ADDRESS_MARK,
    isDataAddressMark,
    isDeletedDataAddressMark,
    MFM_GAP,
    MFM_INDEX_SYNC,
    MFM_SYNC,
    MFM_SYNC_COUNT,
    SectorData,
    SectorInfo,
    SectorPosition,
    TrackPosition,
} from "trs80-base";
import {SimpleEventDispatcher} from "strongly-typed-events";
import {Machine} from "./Machine.js";
import {assertNever, hi, lo, toHexByte} from "z80-base";
import {EventType} from "./EventScheduler.js";
import {TRS80_EMULATOR_LOGGER} from "trs80-logger";

// Number of physical drives.
export const FLOPPY_DRIVE_COUNT = 4;

// Width of the index hole as a fraction of the circumference.
const HOLE_WIDTH = 0.01;

// Speed of disk.
const RPM = 300;

// How long the disk motor stays on after drive selected, in seconds.
const MOTOR_TIME_AFTER_SELECT = 2;

// Bytes in a track at 300 RPM: 250 kbps in single density, 500 kbps in double density.
const SINGLE_DENSITY_TRACK_BYTES = 3125;
const DOUBLE_DENSITY_TRACK_BYTES = 6250;

// The most bytes between an ID address mark and its data address mark when parsing a
// formatted track. The usual gaps are about 30 bytes in single density and 50 in double.
const MAX_ID_TO_DATA_GAP = 64;

// Delays, in clock cycles, for how long things take. These are much faster than real
// hardware, which isn't necessary to make software work.
const TYPE_I_DELAY = 2000;
const NOT_FOUND_DELAY = 512;
const DRQ_DELAY = 64;

/**
 * Converts boolean for "back" to a Side.
 */
function booleanToSide(back: boolean): number {
    return back ? 1 : 0;
}

// Type I status bits.
const STATUS_BUSY = 0x01;             // Whether a command is in progress.
const STATUS_INDEX = 0x02;            // The head is currently over the index hole.
const STATUS_TRACK_ZERO = 0x04;       // Head is on track 0.
const STATUS_CRC_ERROR = 0x08;        // CRC error.
const STATUS_SEEK_ERROR = 0x10;       // Seek error.
const STATUS_HEAD_ENGAGED = 0x20;     // Head engaged.
const STATUS_WRITE_PROTECTED = 0x40;  // Write-protected.
const STATUS_NOT_READY = 0x80;        // Disk not ready (motor not running).

// Type II and III status bits.
//    STATUS_BUSY = 0x01;
const STATUS_DRQ = 0x02;                // Data is ready to be read or written.
const STATUS_LOST_DATA = 0x04;          // CPU was too slow to read.
//    STATUS_CRC_ERROR = 0x08;
const STATUS_NOT_FOUND = 0x10;          // Track, sector, or side were not found.
const STATUS_DELETED = 0x20;            // On read by a WD1791: Sector was deleted (0xF8 DAM).
const STATUS_FAULT = 0x20;              // On write: Indicates a write fault.
const STATUS_REC_TYPE = 0x60;           // On read by a WD1771: Which of the four DAMs (see getRecordTypeStatus()).
//    STATUS_WRITE_PROTECTED = 0x40;
//    STATUS_NOT_READY = 0x80;

// Select register bits for writeSelect().
const SELECT_DRIVE_0 = 0x01;
const SELECT_DRIVE_1 = 0x02;
const SELECT_DRIVE_2 = 0x04;
const SELECT_DRIVE_3 = 0x08;
const SELECT_SIDE = 0x10;  // 0 = front, 1 = back.
const SELECT_PRECOMP = 0x20;
const SELECT_WAIT = 0x40; // Controller should block OUT until operation is done.
const SELECT_MFM = 0x80; // Double density.
const SELECT_DRIVE_MASK = SELECT_DRIVE_0 | SELECT_DRIVE_1 | SELECT_DRIVE_2 | SELECT_DRIVE_3;

// Type of command (see below for specific commands in each type).
enum CommandType {
    TYPE_I,
    TYPE_II,
    TYPE_III,
    TYPE_IV,
}

// Commands and various sub-flags.
const COMMAND_MASK = 0xF0;

// Type I commands: cccchvrr, where
//     cccc = command number
//     h = head load
//     v = verify (i.e., read next address to check we're on the right track)
//     rr = step rate:  00=6ms, 01=12ms, 10=20ms, 11=40ms
const COMMAND_RESTORE = 0x00;
const COMMAND_SEEK = 0x10;
const COMMAND_STEP = 0x20; // Doesn't update track register.
const COMMAND_STEPU = 0x30; // Updates track register.
const COMMAND_STEP_IN = 0x40;
const COMMAND_STEP_INU = 0x50;
const COMMAND_STEP_OUT = 0x60;
const COMMAND_STEP_OUTU = 0x70;
const MASK_H = 0x08;
const MASK_V = 0x04;
const MASK_STEP_RATE = 0x03;
const MASK_U = 0x10; // On STEP, STEP_IN, and STEP_OUT: also update the track register.
const STEP_RATE_TO_MS = new Map<number, number>([
    [ 0x00, 6 ],
    [ 0x01, 12 ],
    [ 0x02, 20 ],
    [ 0x03, 40 ],
]);

// Type II commands on the WD1791: ccccbecd, where
//     cccc = command number
//     e = delay for head engage (10ms)
//     b = side expected
//     c = side compare (0=disable, 1=enable)
//     d = select data address mark (writes only, 0 for reads):
//         0=FB (normal), 1=F8 (deleted)
// On the WD1771 they're ccccbeaa, where
//     b = 1 for IBM sector sizes (128 to 1024 bytes); 0 for non-IBM ones, which we don't support
//     aa = select data address mark (writes only, 00 for reads): 00=FB, 01=FA, 10=F9, 11=F8
const COMMAND_READ = 0x80; // Single sector.
const COMMAND_READM = 0x90; // Multiple sectors.
const COMMAND_WRITE = 0xA0;
const COMMAND_WRITEM = 0xB0;
const MASK_B = 0x08; // Side (0 = front, 1 = back).
const MASK_E = 0x04;
const MASK_C = 0x02; // Whether side (MASK_B) is defined.
const MASK_D = 0x01; // Deleted: 0 = Data is valid, DAM is 0xFB; 1 = Data is invalid, DAM is 0xF8.
const MASK_WD1771_DAM = 0x03;

// Type III commands: ccccxxxs (?), where
//     cccc = command number
//     xxx = ?? (usually 010)
//     s = 1=READ_TRACK no synchronize; otherwise 0
const COMMAND_READ_ADDRESS = 0xC0;
const COMMAND_READ_TRACK = 0xE0;
const COMMAND_WRITE_TRACK = 0xF0;

// Values the CPU writes during WRITE_TRACK that the controller writes as something else.
const WRITE_TRACK_MFM_SYNC = 0xF5; // MFM only: an MFM_SYNC byte. The first of a run presets the CRC.
const WRITE_TRACK_MFM_INDEX_SYNC = 0xF6; // MFM only: an MFM_INDEX_SYNC byte.
const WRITE_TRACK_CRC = 0xF7; // The two CRC bytes.
// In FM, these and the values between them are written as address marks, with missing clock
// bits, and preset the CRC.
const WRITE_TRACK_FM_FIRST_MARK = 0xF8;
const WRITE_TRACK_FM_LAST_MARK = 0xFE;

// The CRC after a double-density field's sync bytes, before its address mark.
const MFM_SYNC_CRC = crcOf(new Array<number>(MFM_SYNC_COUNT).fill(MFM_SYNC));

// Type IV command: cccciiii, where
//     cccc = command number
//     iiii = bitmask of events to terminate and interrupt on (unused on TRS-80).
//            0000 for immediate terminate with no interrupt.
const COMMAND_FORCE_INTERRUPT = 0xD0;
const MASK_INTERRUPT_ON_READY = 0x01; // When the drive goes from not ready to ready.
const MASK_INTERRUPT_ON_NOT_READY = 0x02; // When the drive goes from ready to not ready.
const MASK_INTERRUPT_ON_INDEX = 0x04; // On every index pulse.
const MASK_IMMEDIATE_INTERRUPT = 0x08;
const MASK_READY_INTERRUPTS = MASK_INTERRUPT_ON_READY | MASK_INTERRUPT_ON_NOT_READY;

// Set the Percom Doubler into FM mode.
const PERCOM_DOUBLER_FM = 0xFE;
// Set the Percom Doubler into MFM mode.
const PERCOM_DOUBLER_MFM = 0xFF;

const COMMAND_HIGH_NYBBLE_TO_STRING = new Map<number, string>([
    [0x00, "RESTORE"],
    [0x10, "SEEK"],
    [0x20, "STEP"],
    [0x30, "STEPU"],
    [0x40, "STEP_IN"],
    [0x50, "STEP_INU"],
    [0x60, "STEP_OUT"],
    [0x70, "STEP_OUTU"],
    [0x80, "READ"],
    [0x90, "READM"],
    [0xA0, "WRITE"],
    [0xB0, "WRITEM"],
    [0xC0, "READ_ADDRESS"],
    [0xD0, "FORCE_INTERRUPT"],
    [0xE0, "READ_TRACK"],
    [0xF0, "WRITE_TRACK"],
]);

/**
 * Given a command, returns its type.
 */
function getCommandType(command: number): CommandType {
    switch (command & COMMAND_MASK) {
        case COMMAND_RESTORE:
        case COMMAND_SEEK:
        case COMMAND_STEP:
        case COMMAND_STEPU:
        case COMMAND_STEP_IN:
        case COMMAND_STEP_INU:
        case COMMAND_STEP_OUT:
        case COMMAND_STEP_OUTU:
            return CommandType.TYPE_I;

        case COMMAND_READ:
        case COMMAND_READM:
        case COMMAND_WRITE:
        case COMMAND_WRITEM:
            return CommandType.TYPE_II;

        case COMMAND_READ_ADDRESS:
        case COMMAND_READ_TRACK:
        case COMMAND_WRITE_TRACK:
            return CommandType.TYPE_III;

        case COMMAND_FORCE_INTERRUPT:
            return CommandType.TYPE_IV;

        default:
            throw new Error("Unknown command 0x" + toHexByte(command));
    }
}

/**
 * Which controller chip we're emulating. They differ in a few bits of the Type II commands
 * and their status.
 */
export enum FdcChip {
    // The Model I's. Single density only.
    WD1771,
    // The Models III and 4 have a WD1793, which is a WD1791 with an inverted data bus, so
    // the same to software. Double-density adapters for the Model I have a WD1791.
    WD1791,
}

/**
 * The chip's name, like "WD1771".
 */
export function fdcChipToString(chip: FdcChip): string {
    switch (chip) {
        case FdcChip.WD1771:
            return "WD1771";

        case FdcChip.WD1791:
            return "WD1791";

        default:
            assertNever(chip);
    }
}

/**
 * Whether the chip's Type II commands can ask it to check the side in each ID field.
 */
function canCompareSides(chip: FdcChip): boolean {
    switch (chip) {
        case FdcChip.WD1771:
            return false;

        case FdcChip.WD1791:
            return true;

        default:
            assertNever(chip);
    }
}

/**
 * The data address mark that a write command asks for. The WD1771 picks one of four with
 * the command's low two bits. The WD1791 uses bit 1 for side compare, so it only has normal
 * and deleted.
 */
function getWriteDataAddressMark(chip: FdcChip, command: number): number {
    switch (chip) {
        case FdcChip.WD1771:
            // 00, 01, 10, and 11 select 0xFB, 0xFA, 0xF9, and 0xF8.
            return DATA_ADDRESS_MARK - (command & MASK_WD1771_DAM);

        case FdcChip.WD1791:
            return (command & MASK_D) !== 0 ? DELETED_DATA_ADDRESS_MARK : DATA_ADDRESS_MARK;

        default:
            assertNever(chip);
    }
}

/**
 * The status bits with which a read reports the sector's data address mark. The WD1771 says
 * which of the four marks it found. The WD1791 only has a deleted bit, which we set for any
 * mark but 0xFB, the way xtrs does by default. (The real chip doesn't set it for 0xFA, so a
 * Model III can't see Model I TRSDOS's directory marks.)
 */
function getRecordTypeStatus(chip: FdcChip, dataAddressMark: number): number {
    switch (chip) {
        case FdcChip.WD1771:
            // 0xFB, 0xFA, 0xF9, and 0xF8 report 0x00, 0x20, 0x40, and 0x60.
            return ((DATA_ADDRESS_MARK - dataAddressMark) << 5) & STATUS_REC_TYPE;

        case FdcChip.WD1791:
            return dataAddressMark === DATA_ADDRESS_MARK ? 0 : STATUS_DELETED;

        default:
            assertNever(chip);
    }
}

/**
 * Make a string to describe the command.
 */
function getCommandDescription(command: number, chip: FdcChip): string {
    if (command === PERCOM_DOUBLER_FM) {
        return "Percom Doubler to FM";
    }
    if (command === PERCOM_DOUBLER_MFM) {
        return "Percom Doubler to MFM";
    }

    const parts: string[] = [];

    const commandHigh = command & COMMAND_MASK;
    parts.push(COMMAND_HIGH_NYBBLE_TO_STRING.get(commandHigh) as string);

    switch (getCommandType(command)) {
        case CommandType.TYPE_I: {
            if ((command & MASK_H) !== 0) parts.push("head load");
            if ((command & MASK_V) !== 0) parts.push("verify");
            const stepRateMs = STEP_RATE_TO_MS.get(command & MASK_STEP_RATE) as number;
            parts.push(stepRateMs + "ms step rate");
            break;
        }

        case CommandType.TYPE_II:
            if ((command & MASK_E) !== 0) parts.push("delay 10ms for head engage");
            switch (chip) {
                case FdcChip.WD1771:
                    if ((command & MASK_B) === 0) parts.push("non-IBM sector size");
                    break;

                case FdcChip.WD1791:
                    if ((command & MASK_C) !== 0) parts.push("compare side " + ((command & MASK_B) !== 0 ? 1 : 0));
                    break;

                default:
                    assertNever(chip);
            }
            if (isWriteCommand(command)) {
                parts.push("set DAM to " + toHexByte(getWriteDataAddressMark(chip, command)));
            }
            break;

        case CommandType.TYPE_III:
            // I don't understand these, don't display.
            break;

        case CommandType.TYPE_IV:
            if ((command & MASK_IMMEDIATE_INTERRUPT) !== 0) parts.push("immediate interrupt");
            break;
    }

    return parts.join(", ");
}

/**
 * Make a string to describe the status.
 */
function getStatusDescription(command: number, status: number, chip: FdcChip): string {
    const parts: string[] = [];

    if ((status & STATUS_BUSY) !== 0) parts.push("busy");

    switch (getCommandType(command)) {
        case CommandType.TYPE_I:
        case CommandType.TYPE_IV:
            if ((status & STATUS_INDEX) !== 0) parts.push("index");
            if ((status & STATUS_TRACK_ZERO) !== 0) parts.push("track zero");
            if ((status & STATUS_CRC_ERROR) !== 0) parts.push("CRC error");
            if ((status & STATUS_SEEK_ERROR) !== 0) parts.push("seek error");
            if ((status & STATUS_HEAD_ENGAGED) !== 0) parts.push("head engaged");
            break;

        case CommandType.TYPE_II:
        case CommandType.TYPE_III:
            if ((status & STATUS_DRQ) !== 0) parts.push("data ready");
            if ((status & STATUS_LOST_DATA) !== 0) parts.push("lost data");
            if ((status & STATUS_CRC_ERROR) !== 0) parts.push("CRC error");
            if ((status & STATUS_NOT_FOUND) !== 0) parts.push("not found");
            if (isReadCommand(command)) {
                switch (chip) {
                    case FdcChip.WD1771: {
                        const recordType = status & STATUS_REC_TYPE;
                        if (recordType !== 0) parts.push("DAM " + toHexByte(DATA_ADDRESS_MARK - (recordType >> 5)));
                        break;
                    }

                    case FdcChip.WD1791:
                        if ((status & STATUS_DELETED) !== 0) parts.push("deleted");
                        break;

                    default:
                        assertNever(chip);
                }
            }
            if (isWriteCommand(command) && (status & STATUS_FAULT) !== 0) parts.push("fault");
            break;
    }

    // Reads use this bit for the record type instead.
    if ((status & STATUS_WRITE_PROTECTED) !== 0 && !isReadCommand(command)) parts.push("write protected");
    if ((status & STATUS_NOT_READY) !== 0) parts.push("not ready");

    if (parts.length === 0) {
        parts.push("none");
    }

    return parts.join(", ");
}

/**
 * Whether a command is for reading.
 */
function isReadCommand(command: number): boolean {
    switch (command & COMMAND_MASK) {
        case COMMAND_READ:
        case COMMAND_READM:
            return true;

        default:
            return false;
    }
}

/**
 * Whether a command is for writing.
 */
function isWriteCommand(command: number): boolean {
    switch (command & COMMAND_MASK) {
        case COMMAND_WRITE:
        case COMMAND_WRITEM:
            return true;

        default:
            return false;
    }
}

/**
 * Whether a command is for reading or writing.
 */
function isReadWriteCommand(command: number): boolean {
    switch (getCommandType(command)) {
        case CommandType.TYPE_II:
        case CommandType.TYPE_III:
            return true;

        default:
            return false;
    }
}

/**
 * State of a physical drive.
 */
class FloppyDrive {
    public physicalTrack = 0;
    public floppyDisk: FloppyDisk | undefined = undefined;
}


/**
 * Collects what the CPU writes during a Write Track (format) command, interpreting the
 * values that stand for address marks and CRCs, the way the controller does.
 */
class TrackWriter {
    // The bytes as they'd be read back.
    public readonly bytes: number[] = [];
    // Indices into "bytes" of the ID and data address marks.
    private readonly marks: number[] = [];
    // Whether we're writing MFM. Only a guess (single density) until densityKnown is true.
    private doubleDensity: boolean;
    private densityKnown: boolean;
    private crc = CRC_PRESET;
    private previousValue = 0;

    /**
     * @param doubleDensity whether the drive select says double density. On the Model I that
     * comes from a doubler instead, so if this is false we look at what's written.
     */
    constructor(doubleDensity: boolean) {
        this.doubleDensity = doubleDensity;
        this.densityKnown = doubleDensity;
    }

    /**
     * Whether we've written a whole track's worth of bytes.
     */
    public isFull(): boolean {
        return this.bytes.length >= (this.doubleDensity
            ? DOUBLE_DENSITY_TRACK_BYTES
            : SINGLE_DENSITY_TRACK_BYTES);
    }

    /**
     * Handle a byte written by the CPU.
     */
    public write(value: number): void {
        // The first special value tells us the density: MFM formats write sync bytes before
        // their marks, and FM formats write their marks directly.
        if (!this.densityKnown) {
            if (value === WRITE_TRACK_MFM_SYNC || value === WRITE_TRACK_MFM_INDEX_SYNC) {
                this.doubleDensity = true;
                this.densityKnown = true;
            } else if (isFmMark(value)) {
                this.densityKnown = true;
            }
        }

        if (this.doubleDensity) {
            this.writeMfm(value);
        } else {
            this.writeFm(value);
        }
        this.previousValue = value;
    }

    /**
     * Handle a byte written in double density.
     */
    private writeMfm(value: number): void {
        switch (value) {
            case WRITE_TRACK_MFM_SYNC:
                if (this.previousValue !== WRITE_TRACK_MFM_SYNC) {
                    this.crc = CRC_PRESET;
                }
                this.addByte(MFM_SYNC);
                break;

            case WRITE_TRACK_MFM_INDEX_SYNC:
                this.bytes.push(MFM_INDEX_SYNC);
                break;

            case WRITE_TRACK_CRC:
                this.addCrc();
                break;

            default:
                // A mark follows the sync bytes.
                if (this.previousValue === WRITE_TRACK_MFM_SYNC && isSectorMark(value)) {
                    this.marks.push(this.bytes.length);
                }
                this.addByte(value);
                break;
        }
    }

    /**
     * Handle a byte written in single density.
     */
    private writeFm(value: number): void {
        if (value === WRITE_TRACK_CRC) {
            this.addCrc();
            return;
        }

        if (isFmMark(value)) {
            this.crc = CRC_PRESET;
            if (isSectorMark(value)) {
                this.marks.push(this.bytes.length);
            }
        }
        this.addByte(value);
    }

    /**
     * Add a byte to the track and the CRC.
     */
    private addByte(value: number): void {
        this.bytes.push(value);
        this.crc = CRC_16_CCITT.update(this.crc, value);
    }

    /**
     * Add the two CRC bytes.
     */
    private addCrc(): void {
        const crc = this.crc;
        this.bytes.push(hi(crc), lo(crc));
    }

    /**
     * Parse what was written into sectors.
     */
    public makeFormattedTrack(trackPosition: TrackPosition): FormattedTrack {
        const doubleDensity = this.doubleDensity;
        const density = doubleDensity ? Density.DOUBLE : Density.SINGLE;
        const bytes = this.bytes;
        const sectors: SectorData[] = [];

        for (let m = 0; m < this.marks.length; m++) {
            // An ID field: the mark, then cylinder, side, sector, size code, and CRC.
            const idIndex = this.marks[m];
            if (bytes[idIndex] !== ID_ADDRESS_MARK || idIndex + 4 >= bytes.length) {
                continue;
            }

            // Its data field is the next mark, if that's a data address mark, and close enough.
            const dataIndex = this.marks[m + 1];
            if (dataIndex === undefined || bytes[dataIndex] === ID_ADDRESS_MARK || dataIndex - idIndex > MAX_ID_TO_DATA_GAP) {
                continue;
            }
            const size = 128 << (bytes[idIndex + 4] & 0x03);
            if (dataIndex + 1 + size > bytes.length) {
                continue;
            }

            const sector = new SectorData(new Uint8Array(bytes.slice(dataIndex + 1, dataIndex + 1 + size)),
                SectorPosition.make(bytes[idIndex + 1], bytes[idIndex + 2], bytes[idIndex + 3]), density);
            sector.dataAddressMark = bytes[dataIndex];
            sector.deleted = isDeletedDataAddressMark(sector.dataAddressMark);
            sectors.push(sector);
        }

        return {
            trackPosition,
            doubleDensity,
            bytes: new Uint8Array(bytes),
            idamIndices: this.marks.filter(index => bytes[index] === ID_ADDRESS_MARK),
            sectors,
        };
    }
}

/**
 * Snapshot of FDC state, for save() and restore().
 */
export class FdcState {
    constructor(
        // Registers.
        public readonly status: number,
        public readonly track: number,
        public readonly sector: number,
        public readonly data: number,
        // Internal state.
        public readonly currentCommand: number,
        public readonly side: number,
        public readonly doubleDensity: boolean,
        public readonly currentDrive: number,
        public readonly motorOn: boolean,
        public readonly lastReadAddress: number | undefined,
        public readonly dataIndex: number,
        public readonly sectorData: SectorData | undefined,
        public readonly stepDirection: number,
        // Where each drive's head is.
        public readonly physicalTracks: number[],
        public readonly chip: FdcChip) {
    }

    /**
     * User-friendly description of the status.
     */
    public getStatusDescription(): string {
        return getStatusDescription(this.currentCommand, this.status, this.chip);
    }

    /**
     * User-friendly description of the command.
     */
    public getCommandDescription(): string {
        return getCommandDescription(this.currentCommand, this.chip);
    }
}

/**
 * The floppy disk controller. We emulate the Model I's WD1771 and the Model III's WD1791/93.
 */
export class FloppyDiskController {
    private readonly machine: Machine;
    // Which chip, which depends on the model. Set with setChip().
    private chip = FdcChip.WD1791;

    // Registers.
    private status = STATUS_TRACK_ZERO | STATUS_NOT_READY;
    // The track register keeps track of where the FDC thinks the physical head is (which is
    // stored in drive.physicalTrack). These can get out of sync because the track register
    // can be written to directly. The controller never knows where the head really is: it
    // reads and writes whatever sector passes under the head, but only once that sector's
    // ID field matches the track register.
    private track = 0;
    private sector = 0;
    private data = 0;

    // Internal state.
    private currentCommand = COMMAND_RESTORE;
    private side = 0;
    private doubleDensity = false;
    private currentDrive = 0;
    private motorOn = false;
    // Index, into the track's sectors, of the ID field last returned by COMMAND_READ_ADDRESS.
    private lastReadAddress: number | undefined = undefined;
    // Direction of the last step: 1 for in (toward higher tracks), -1 for out.
    private stepDirection = 1;
    // Force Interrupt conditions (MASK_READY_INTERRUPTS) waiting to happen.
    private interruptConditions = 0;

    // State for current command.
    public dataIndex = 0;
    private sectorData: SectorData | undefined = undefined;
    private trackWriter: TrackWriter | undefined = undefined;

    // Floppy drives.
    private readonly drives: FloppyDrive[] = [];

    // Timeout handle for turning off the motor.
    private motorOffTimeoutHandle: number | undefined = undefined;

    // Warnings already given, so that a program repeating something doesn't flood the log.
    private readonly warnOnceSet = new Set<string>();

    // Which drive is currently active, for lighting up an LED.
    public readonly onActiveDrive = new SimpleEventDispatcher<number | undefined>();

    // Event when a drive moves the head this many tracks.
    public readonly onTrackMove = new SimpleEventDispatcher<number>();

    constructor(foo: Machine) {
        this.machine = foo;

        for (let i = 0; i < FLOPPY_DRIVE_COUNT; i++) {
            this.drives.push(new FloppyDrive());
        }
    }

    /**
     * Abandon any command in progress and stop the motor, as when the machine is reset. The
     * machine has already canceled our scheduled events, so nothing would ever finish the
     * command. The drives keep their disks and head positions.
     */
    public reset(): void {
        this.status &= ~(STATUS_BUSY | STATUS_DRQ);
        this.sectorData = undefined;
        this.trackWriter = undefined;
        this.interruptConditions = 0;
        this.motorOffTimeoutHandle = undefined;
        this.machine.diskIntrqInterrupt(false);
        this.machine.diskDrqInterrupt(false);
        this.setReady(false);
        this.setMotorOn(false);
    }

    /**
     * Set which chip to emulate. The machine calls this when its model changes.
     */
    public setChip(chip: FdcChip): void {
        this.chip = chip;
    }

    /**
     * Put a floppy in the specified drive (0 to 3).
     */
    public loadFloppyDisk(floppyDisk: FloppyDisk | undefined, driveNumber: number): void {
        if (driveNumber < 0 || driveNumber >= this.drives.length) {
            throw new Error("Invalid drive number " + driveNumber);
        }

        this.drives[driveNumber].floppyDisk = floppyDisk;
    }

    /**
     * Get the floppy mounted on this (0-based) drive number, or undefined if no floppy is mounted on that drive.
     */
    public getFloppyDisk(driveNumber: number): FloppyDisk | undefined {
        return driveNumber >= 0 && driveNumber < this.drives.length
            ? this.drives[driveNumber].floppyDisk
            : undefined;
    }

    /**
     * Save internal state for restoring with {@link #restore}.
     */
    public save(): FdcState {
        return new FdcState(this.status, this.track, this.sector, this.data, this.currentCommand, this.side,
            this.doubleDensity, this.currentDrive, this.motorOn, this.lastReadAddress,
            this.dataIndex, this.sectorData, this.stepDirection,
            this.drives.map(drive => drive.physicalTrack), this.chip);
    }

    /**
     * Restore internal state saved with {@link #save}.
     */
    public restore(fdcState: FdcState): void {
        this.status = fdcState.status;
        this.track = fdcState.track;
        this.sector = fdcState.sector;
        this.data = fdcState.data;
        this.currentCommand = fdcState.currentCommand;
        this.side = fdcState.side;
        this.doubleDensity = fdcState.doubleDensity;
        this.currentDrive = fdcState.currentDrive;
        this.motorOn = fdcState.motorOn;
        this.lastReadAddress = fdcState.lastReadAddress;
        this.dataIndex = fdcState.dataIndex;
        this.sectorData = fdcState.sectorData;
        this.stepDirection = fdcState.stepDirection;
        this.chip = fdcState.chip;
        for (let i = 0; i < this.drives.length; i++) {
            this.drives[i].physicalTrack = fdcState.physicalTracks[i] ?? 0;
        }
        this.trackWriter = undefined;
        this.interruptConditions = 0;
    }

    /**
     * Read the status register, which also clears the interrupt request.
     */
    public readStatus(): number {
        let status;

        // If no disk was loaded into drive 0, just pretend that we don't
        // have a disk system. Otherwise we have to hold down Break while
        // booting (to get to cassette BASIC) and that's annoying.
        if (this.drives[0].floppyDisk === undefined) {
            status = 0xFF;
        } else {
            this.updateStatus();

            // Clear interrupt.
            this.machine.diskIntrqInterrupt(false);

            status = this.status;
        }

        if (TRS80_EMULATOR_LOGGER.isTraceEnabled()) {
            TRS80_EMULATOR_LOGGER.trace("FDC: readStatus() = " + toHexByte(status) + " "
                + getStatusDescription(this.currentCommand, status, this.chip));
        }

        return status;
    }

    /**
     * Read the track register.
     */
    public readTrack(): number {
        TRS80_EMULATOR_LOGGER.trace("FDC: readTrack() = " + toHexByte(this.track));

        return this.track;
    }

    /**
     * Read the sector register.
     */
    public readSector(): number {
        TRS80_EMULATOR_LOGGER.trace("FDC: readSector() = " + toHexByte(this.sector));

        return this.sector;
    }

    /**
     * Read a byte of data from the sector, ID field, or track being read.
     */
    public readData(): number {
        const drive = this.drives[this.currentDrive];
        const command = this.currentCommand & COMMAND_MASK;

        switch (command) {
            case COMMAND_READ:
            case COMMAND_READM:
            case COMMAND_READ_ADDRESS:
            case COMMAND_READ_TRACK:
                // Keep reading from the buffer.
                if (this.sectorData !== undefined && (this.status & STATUS_DRQ) !== 0 && drive.floppyDisk !== undefined) {
                    this.data = this.sectorData.data[this.dataIndex];
                    TRS80_EMULATOR_LOGGER.trace("FDC: readData(" + this.dataIndex +
                        "/" + this.sectorData.data.length + ") = " + toHexByte(this.data));
                    this.dataIndex++;
                    if (this.dataIndex >= this.sectorData.data.length) {
                        this.sectorData = undefined;
                        this.status &= ~STATUS_DRQ;
                        this.machine.diskDrqInterrupt(false);
                        this.machine.eventScheduler.cancelByEventTypeMask(EventType.DISK_LOST_DATA);
                        if (command === COMMAND_READM && (this.status & STATUS_CRC_ERROR) === 0) {
                            // Go on to the next sector. When there isn't one, the command ends with
                            // "not found", which is how multi-sector reads end.
                            this.machine.eventScheduler.add(EventType.DISK_FIRST_DRQ, this.machine.tStateCount + DRQ_DELAY,
                                () => {
                                    this.sector = (this.sector + 1) & 0xFF;
                                    this.startReadSector(drive);
                                });
                        } else {
                            this.machine.eventScheduler.add(EventType.DISK_DONE, this.machine.tStateCount + DRQ_DELAY,
                                () => this.done(0));
                        }
                    }
                }
                break;

            default:
                // Not sure what do here. Just return data unmodified.
                break;
        }

        return this.data;
    }

    /**
     * Set current command.
     */
    public writeCommand(cmd: number): void {
        if (TRS80_EMULATOR_LOGGER.isTraceEnabled()) {
            TRS80_EMULATOR_LOGGER.trace("FDC: writeCommand(" + toHexByte(cmd) + "), " + getCommandDescription(cmd, this.chip));
        }

        if (cmd === PERCOM_DOUBLER_FM || cmd === PERCOM_DOUBLER_MFM) {
            // Command to Percom Doubler, ignore.
            return;
        }

        // Ignore any command but Force Interrupt while busy.
        const busy = (this.status & STATUS_BUSY) !== 0;
        if (busy && (cmd & COMMAND_MASK) !== COMMAND_FORCE_INTERRUPT) {
            TRS80_EMULATOR_LOGGER.trace("FDC: ignoring command " + toHexByte(cmd) + " while busy");
            return;
        }

        const drive = this.drives[this.currentDrive];

        // Cancel "lost data" event.
        this.machine.eventScheduler.cancelByEventTypeMask(EventType.DISK_LOST_DATA);

        // A new command replaces any Force Interrupt conditions.
        this.machine.eventScheduler.cancelByEventTypeMask(EventType.DISK_INDEX);
        this.interruptConditions = 0;

        this.machine.diskIntrqInterrupt(false);
        this.sectorData = undefined;
        this.trackWriter = undefined;
        this.currentCommand = cmd;

        // Kick off anything that's based on the command.
        switch (getCommandType(cmd)) {
            case CommandType.TYPE_I:
                this.startTypeI(cmd, drive);
                break;

            case CommandType.TYPE_II:
                if (isReadCommand(cmd)) {
                    this.startReadSector(drive);
                } else if (drive.floppyDisk === undefined) {
                    this.endWithError(STATUS_NOT_FOUND, NOT_FOUND_DELAY);
                } else if (drive.floppyDisk.isWriteProtected()) {
                    this.endWithError(STATUS_WRITE_PROTECTED, DRQ_DELAY);
                } else {
                    this.startWriteSector(drive);
                }
                break;

            case CommandType.TYPE_III:
                switch (cmd & COMMAND_MASK) {
                    case COMMAND_READ_ADDRESS:
                        this.startReadAddress(drive);
                        break;

                    case COMMAND_READ_TRACK:
                        this.startReadTrack(drive);
                        break;

                    case COMMAND_WRITE_TRACK:
                        if (drive.floppyDisk === undefined) {
                            this.endWithError(STATUS_NOT_FOUND, NOT_FOUND_DELAY);
                        } else if (drive.floppyDisk.isWriteProtected()) {
                            this.endWithError(STATUS_WRITE_PROTECTED, DRQ_DELAY);
                        } else {
                            this.lastReadAddress = undefined;
                            this.trackWriter = new TrackWriter(this.doubleDensity);
                            this.status = STATUS_BUSY;
                            this.firstDrq(0);
                        }
                        break;
                }
                break;

            case CommandType.TYPE_IV:
                // Stop whatever is going on and forget it.
                this.machine.eventScheduler.cancelByEventTypeMask(EventType.DISK_ALL);
                this.status = 0;
                this.updateStatus();
                this.interruptConditions = cmd & MASK_READY_INTERRUPTS;
                if ((cmd & MASK_INTERRUPT_ON_INDEX) !== 0) {
                    this.scheduleIndexInterrupt();
                }
                this.machine.diskIntrqInterrupt((cmd & MASK_IMMEDIATE_INTERRUPT) !== 0);
                break;
        }
    }

    /**
     * Write the track register.
     */
    public writeTrack(track: number): void {
        TRS80_EMULATOR_LOGGER.trace("FDC: writeTrack(" + toHexByte(track) + ")");

        this.track = track;
    }

    /**
     * Write the sector register.
     */
    public writeSector(sector: number): void {
        TRS80_EMULATOR_LOGGER.trace("FDC: writeSector(" + toHexByte(sector) + ")");

        this.sector = sector;
    }

    /**
     * Write the data register. During a write command this is the next byte of the sector or
     * track being written.
     */
    public writeData(data: number): void {
        const drive = this.drives[this.currentDrive];
        const command = this.currentCommand & COMMAND_MASK;

        switch (command) {
            case COMMAND_WRITE:
            case COMMAND_WRITEM:
                if (this.sectorData !== undefined && this.dataIndex < this.sectorData.data.length) {
                    this.sectorData.data[this.dataIndex] = data;
                    this.dataIndex += 1;
                    if (this.dataIndex === this.sectorData.data.length) {
                        const floppyDisk = drive.floppyDisk;
                        let errorBits = 0;
                        if (floppyDisk !== undefined) {
                            try {
                                floppyDisk.writeSector(this.sectorData.sectorPosition, this.sectorData);
                            } catch (e) {
                                this.warnOnce("FDC: Can't write sector: " + (e instanceof Error ? e.message : String(e)));
                                errorBits = STATUS_FAULT;
                            }
                        }

                        this.sectorData = undefined;
                        this.dataIndex = 0;

                        this.status &= ~STATUS_DRQ;
                        this.machine.diskDrqInterrupt(false);
                        this.machine.eventScheduler.cancelByEventTypeMask(EventType.DISK_LOST_DATA);
                        if (command === COMMAND_WRITEM && errorBits === 0) {
                            // Go on to the next sector. When there isn't one, the command ends with
                            // "not found", which is how multi-sector writes end.
                            this.machine.eventScheduler.add(EventType.DISK_FIRST_DRQ, this.machine.tStateCount + DRQ_DELAY,
                                () => {
                                    this.sector = (this.sector + 1) & 0xFF;
                                    this.startWriteSector(drive);
                                });
                        } else {
                            this.machine.eventScheduler.add(EventType.DISK_DONE, this.machine.tStateCount + DRQ_DELAY,
                                () => this.done(errorBits));
                        }
                    }
                }
                break;

            case COMMAND_WRITE_TRACK:
                if (this.trackWriter !== undefined) {
                    this.trackWriter.write(data);
                    if (this.trackWriter.isFull()) {
                        this.finishWriteTrack(drive, this.trackWriter);
                    }
                }
                break;

            default:
                TRS80_EMULATOR_LOGGER.trace("FDC: writeData(" + toHexByte(data) + ")");
                break;
        }

        this.data = data;
    }

    /**
     * Select a drive.
     */
    public writeSelect(value: number): void {
        TRS80_EMULATOR_LOGGER.trace("FDC: writeSelect(" + toHexByte(value) + ")");

        this.side = booleanToSide((value & SELECT_SIDE) !== 0);
        this.doubleDensity = (value & SELECT_MFM) != 0;
        if ((value & SELECT_WAIT) != 0) {
            // If there was an event pending, simulate waiting until it was due.
            const event = this.machine.eventScheduler.getFirstEvent(EventType.DISK_ALL & ~EventType.DISK_LOST_DATA);
            if (event !== undefined) {
                // This puts the clock ahead immediately, but the main loop of the emulator
                // will then sleep to make the real-time correct.
                // TODO is this legit? Can we use another method?
                this.machine.tStateCount = event.tStateCount;
                this.machine.eventScheduler.dispatch(this.machine.tStateCount);
            }
        }

        // Which drive is being enabled? Selecting more than one is a program error, and would
        // garble reads on real hardware; use the lowest.
        const previousDrive = this.currentDrive;
        const driveBits = value & SELECT_DRIVE_MASK;
        if (driveBits !== 0) {
            if ((driveBits & (driveBits - 1)) !== 0) {
                this.warnOnce("FDC: More than one drive selected (0x" + toHexByte(value) + "), using the lowest");
            }
            for (let drive = 0; drive < FLOPPY_DRIVE_COUNT; drive++) {
                if ((driveBits & (1 << drive)) !== 0) {
                    this.currentDrive = drive;
                    break;
                }
            }
        }
        this.setReady(driveBits !== 0);

        if (this.currentDrive !== previousDrive) {
            this.updateMotorOn();
        }

        // If a drive was selected, turn on its motor.
        if ((this.status & STATUS_NOT_READY) == 0) {
            this.setMotorOn(true);

            // Set timer to later turn off motor.
            if (this.motorOffTimeoutHandle !== undefined) {
                this.machine.eventScheduler.cancel(this.motorOffTimeoutHandle);
            }
            this.motorOffTimeoutHandle = this.machine.eventScheduler.add(undefined,
                this.machine.tStateCount + MOTOR_TIME_AFTER_SELECT*this.machine.clockHz, () => {
                this.motorOffTimeoutHandle = undefined;
                this.setReady(false);
                this.setMotorOn(false);
            });
        }
    }

    /**
     * Start a type I (head movement) command.
     */
    private startTypeI(cmd: number, drive: FloppyDrive): void {
        this.lastReadAddress = undefined;

        // How far to move the head. The controller doesn't know where the head is, it just
        // sends step pulses.
        const commandHigh = cmd & COMMAND_MASK;
        let moveCount: number;
        switch (commandHigh) {
            case COMMAND_RESTORE:
            default:
                // Step out until the drive says it's on track 0.
                moveCount = -drive.physicalTrack;
                this.stepDirection = -1;
                this.track = 0; // trs80gp sets this to 255?
                break;

            case COMMAND_SEEK:
                // Step until the track register matches the data register.
                moveCount = this.data - this.track;
                if (moveCount !== 0) {
                    this.stepDirection = Math.sign(moveCount);
                }
                this.track = this.data;
                break;

            case COMMAND_STEP:
            case COMMAND_STEPU:
                // Same direction as last time.
                moveCount = this.stepDirection;
                break;

            case COMMAND_STEP_IN:
            case COMMAND_STEP_INU:
                moveCount = 1;
                this.stepDirection = 1;
                break;

            case COMMAND_STEP_OUT:
            case COMMAND_STEP_OUTU:
                moveCount = -1;
                this.stepDirection = -1;
                break;
        }

        // The step commands can also update the track register.
        if (commandHigh >= COMMAND_STEP && (cmd & MASK_U) !== 0) {
            this.track = (this.track + this.stepDirection) & 0xFF;
        }

        // The head stops at track 0.
        TRS80_EMULATOR_LOGGER.trace("FDC: before move: track " + this.track +
            ", physical track " + drive.physicalTrack + ", move count " + moveCount);
        const physicalTrack = Math.max(drive.physicalTrack + moveCount, 0);
        if (physicalTrack !== drive.physicalTrack) {
            this.onTrackMove.dispatch(physicalTrack - drive.physicalTrack);
            drive.physicalTrack = physicalTrack;
        }
        TRS80_EMULATOR_LOGGER.trace("FDC: after move: track " + this.track +
            ", physical track " + drive.physicalTrack);

        this.status = STATUS_BUSY | (drive.physicalTrack === 0 ? STATUS_TRACK_ZERO : 0);
        if ((cmd & MASK_V) != 0) {
            this.verify(drive);
        }
        this.machine.eventScheduler.add(EventType.DISK_DONE, this.machine.tStateCount + TYPE_I_DELAY,
            () => this.done(0));
    }

    /**
     * Start reading the sector in the sector register, for a READ or READM command.
     */
    private startReadSector(drive: FloppyDrive): void {
        this.lastReadAddress = undefined;
        this.status = STATUS_BUSY;
        TRS80_EMULATOR_LOGGER.trace("FDC: reading track " + drive.physicalTrack +
            ", side " + this.side + ", sector " + this.sector);

        const sectorData = drive.floppyDisk?.readSector(this.getHeadPosition(drive));
        if (sectorData === undefined || !this.canSee(sectorData) || !this.idMatches(sectorData)) {
            TRS80_EMULATOR_LOGGER.trace(`FDC: Didn't find sector ${this.sector} with track ${this.track} ` +
                `on physical track ${drive.physicalTrack}`);
            this.endWithError(STATUS_NOT_FOUND, NOT_FOUND_DELAY);
            return;
        }

        let newStatus = getRecordTypeStatus(this.getChipFor(sectorData), sectorData.getDataAddressMark());
        if (sectorData.crcError) {
            newStatus |= STATUS_CRC_ERROR;
        }
        this.sectorData = sectorData;
        this.dataIndex = 0;
        this.machine.eventScheduler.add(EventType.DISK_FIRST_DRQ, this.machine.tStateCount + DRQ_DELAY,
            () => this.firstDrq(newStatus));
    }

    /**
     * Start writing the sector in the sector register, for a WRITE or WRITEM command. The
     * caller has checked that there's a writable disk.
     */
    private startWriteSector(drive: FloppyDrive): void {
        this.lastReadAddress = undefined;
        this.status = STATUS_BUSY;

        // Like a read, the controller looks for the sector under the head whose ID field
        // matches the registers, and then writes its data field. It writes the data in
        // whatever size and density the sector was formatted with.
        const position = this.getHeadPosition(drive);
        const existing = drive.floppyDisk?.readSector(position);
        if (existing === undefined || !this.canSee(existing) || !this.idMatches(existing)) {
            TRS80_EMULATOR_LOGGER.trace(`FDC: Didn't find sector ${this.sector} with track ${this.track} ` +
                `on physical track ${drive.physicalTrack} to write`);
            this.endWithError(STATUS_NOT_FOUND, NOT_FOUND_DELAY);
            return;
        }

        this.sectorData = new SectorData(new Uint8Array(existing.data.length), position, existing.density);
        this.sectorData.dataAddressMark = getWriteDataAddressMark(this.getChipFor(existing), this.currentCommand);
        this.sectorData.deleted = isDeletedDataAddressMark(this.sectorData.dataAddressMark);
        this.dataIndex = 0;
        this.firstDrq(0);
    }

    /**
     * Start reading the next ID field under the head, for a READ_ADDRESS command.
     */
    private startReadAddress(drive: FloppyDrive): void {
        this.status = STATUS_BUSY;

        const floppyDisk = drive.floppyDisk;
        const sectorInfos = floppyDisk === undefined ? [] : this.getTrackSectorInfos(floppyDisk, drive);
        if (floppyDisk === undefined || sectorInfos.length === 0) {
            this.endWithError(STATUS_NOT_FOUND, NOT_FOUND_DELAY);
            return;
        }

        // Go around the track one sector at a time.
        this.lastReadAddress = ((this.lastReadAddress ?? -1) + 1) % sectorInfos.length;
        const sectorInfo = sectorInfos[this.lastReadAddress];
        const idField = this.getIdField(floppyDisk, sectorInfo);

        // The controller puts the cylinder from the ID field into the sector register.
        this.sector = idField[0];

        this.sectorData = new SectorData(new Uint8Array(idField), sectorInfo.sectorPosition, sectorInfo.density);
        this.dataIndex = 0;
        const newStatus = sectorInfo.crc !== undefined && !sectorInfo.crc.idCrc.valid() ? STATUS_CRC_ERROR : 0;
        this.machine.eventScheduler.add(EventType.DISK_FIRST_DRQ, this.machine.tStateCount + DRQ_DELAY,
            () => this.firstDrq(newStatus));
    }

    /**
     * Start reading the whole track under the head, for a READ_TRACK command.
     */
    private startReadTrack(drive: FloppyDrive): void {
        this.lastReadAddress = undefined;
        this.status = STATUS_BUSY;

        const floppyDisk = drive.floppyDisk;
        if (floppyDisk === undefined) {
            this.endWithError(STATUS_NOT_FOUND, NOT_FOUND_DELAY);
            return;
        }

        const sectorInfos = this.getTrackSectorInfos(floppyDisk, drive);
        const bytes = this.synthesizeTrack(floppyDisk, sectorInfos);
        this.sectorData = new SectorData(bytes, SectorPosition.make(drive.physicalTrack, this.side, 0),
            this.doubleDensity ? Density.DOUBLE : Density.SINGLE);
        this.dataIndex = 0;
        this.machine.eventScheduler.add(EventType.DISK_FIRST_DRQ, this.machine.tStateCount + DRQ_DELAY,
            () => this.firstDrq(0));
    }

    /**
     * Hand the track that the CPU wrote to the disk.
     */
    private finishWriteTrack(drive: FloppyDrive, trackWriter: TrackWriter): void {
        const trackPosition = new TrackPosition(drive.physicalTrack, this.side);
        const formattedTrack = trackWriter.makeFormattedTrack(trackPosition);
        this.trackWriter = undefined;

        this.status &= ~STATUS_DRQ;
        this.machine.diskDrqInterrupt(false);
        this.machine.eventScheduler.cancelByEventTypeMask(EventType.DISK_LOST_DATA);

        let success = false;
        const floppyDisk = drive.floppyDisk;
        if (floppyDisk !== undefined) {
            try {
                success = floppyDisk.formatTrack(formattedTrack);
            } catch (e) {
                this.warnOnce("FDC: Can't format track: " + (e instanceof Error ? e.message : String(e)));
            }
            if (!success) {
                this.warnOnce(`FDC: Can't format track ${trackPosition.key()} ` +
                    `(${formattedTrack.sectors.length} sectors) of a ${floppyDisk.getDescription()}`);
            }
        }

        this.machine.eventScheduler.add(EventType.DISK_DONE, this.machine.tStateCount + DRQ_DELAY,
            () => this.done(success ? 0 : STATUS_FAULT));
    }

    /**
     * End the current command after a delay with the given error bits.
     */
    private endWithError(bits: number, delay: number): void {
        this.status = STATUS_BUSY;
        this.machine.eventScheduler.add(EventType.DISK_DONE, this.machine.tStateCount + delay,
            () => this.done(bits));
    }

    /**
     * Position of the sector in the sector register on the track under the head.
     */
    private getHeadPosition(drive: FloppyDrive): SectorPosition {
        return SectorPosition.make(drive.physicalTrack, this.side, this.sector);
    }

    /**
     * Whether a sector's ID field matches the track and sector registers, and the side if the
     * command asks for that.
     */
    private idMatches(sectorData: SectorData): boolean {
        const id = sectorData.sectorPosition;

        // A WD1791 can also be asked to check the side.
        const compareSide = canCompareSides(this.getChipFor(sectorData)) && (this.currentCommand & MASK_C) !== 0;
        const expectedSide = (this.currentCommand & MASK_B) !== 0 ? 1 : 0;
        const sideMatches = !compareSide || id.side === expectedSide;

        return id.cylinderNumber === this.track && id.sectorNumber === this.sector && sideMatches;
    }

    /**
     * The chip that reads and writes the sector. On a Model I, a double-density sector can only
     * be from a double-density adapter's WD1791.
     */
    private getChipFor(sectorInfo: SectorInfo): FdcChip {
        switch (sectorInfo.density) {
            case Density.SINGLE:
                return this.chip;

            case Density.DOUBLE:
                return FdcChip.WD1791;

            default:
                assertNever(sectorInfo.density);
        }
    }

    /**
     * The sectors on the track under the head that the controller can see, in the order
     * they're on the track.
     */
    private getTrackSectorInfos(floppyDisk: FloppyDisk, drive: FloppyDrive): SectorInfo[] {
        const trackPosition = new TrackPosition(drive.physicalTrack, this.side);
        return floppyDisk.getGeometry().sectorInfos.filter(sectorInfo =>
            sectorInfo.sectorPosition.trackPosition.equals(trackPosition) && this.canSee(sectorInfo));
    }

    /**
     * Whether the controller can see the sector at all, which it can only in the density
     * that's selected. The Models III and 4 select it in the drive select register. A Model I
     * selects it through a double-density adapter, which we don't emulate, so there we
     * accept either.
     */
    private canSee(sectorInfo: SectorInfo): boolean {
        switch (this.chip) {
            case FdcChip.WD1771:
                return true;

            case FdcChip.WD1791: {
                const selectedDensity = this.doubleDensity ? Density.DOUBLE : Density.SINGLE;
                return sectorInfo.density === selectedDensity;
            }

            default:
                assertNever(this.chip);
        }
    }

    /**
     * The six bytes of a sector's ID field: cylinder, side, sector, size code, and CRC.
     */
    private getIdField(floppyDisk: FloppyDisk, sectorInfo: SectorInfo): number[] {
        // The geometry has where the sector is. What its ID field says comes from reading it.
        const id = floppyDisk.readSector(sectorInfo.sectorPosition)?.sectorPosition ?? sectorInfo.sectorPosition;
        const sizeCode = Math.max(0, Math.min(3, Math.round(Math.log2(sectorInfo.sectorSize/128))));
        const fields = [id.cylinderNumber, id.side, id.sectorNumber, sizeCode];

        let crc: number;
        if (sectorInfo.crc !== undefined) {
            crc = sectorInfo.crc.idCrc.written;
        } else {
            crc = sectorInfo.density === Density.DOUBLE ? MFM_SYNC_CRC : CRC_PRESET;
            crc = crcOf([ID_ADDRESS_MARK, ...fields], crc);
        }

        return [...fields, hi(crc), lo(crc)];
    }

    /**
     * Make the bytes that a READ_TRACK command returns, from the track's sectors. The image
     * formats don't keep the gaps, so we make up the standard ones.
     */
    private synthesizeTrack(floppyDisk: FloppyDisk, sectorInfos: SectorInfo[]): Uint8Array {
        const doubleDensityCount = sectorInfos.filter(info => info.density === Density.DOUBLE).length;
        const doubleDensity = sectorInfos.length === 0 ? this.doubleDensity : doubleDensityCount*2 > sectorInfos.length;
        const trackLength = doubleDensity ? DOUBLE_DENSITY_TRACK_BYTES : SINGLE_DENSITY_TRACK_BYTES;
        const bytes: number[] = [];

        const addGap = (doubleDensity: boolean, count: number): void => {
            for (let i = 0; i < count; i++) {
                bytes.push(doubleDensity ? MFM_GAP : FM_GAP);
            }
        };
        const addSync = (doubleDensity: boolean): void => {
            for (let i = 0; i < (doubleDensity ? 12 : 6); i++) {
                bytes.push(0x00);
            }
            if (doubleDensity) {
                for (let i = 0; i < MFM_SYNC_COUNT; i++) {
                    bytes.push(MFM_SYNC);
                }
            }
        };

        addGap(doubleDensity, doubleDensity ? 32 : 16);
        for (const sectorInfo of sectorInfos) {
            const sectorDoubleDensity = sectorInfo.density === Density.DOUBLE;

            // ID field.
            addSync(sectorDoubleDensity);
            bytes.push(ID_ADDRESS_MARK, ...this.getIdField(floppyDisk, sectorInfo));
            addGap(sectorDoubleDensity, sectorDoubleDensity ? 22 : 11);

            // Data field.
            const sectorData = floppyDisk.readSector(sectorInfo.sectorPosition);
            if (sectorData !== undefined) {
                addSync(sectorDoubleDensity);
                const dam = sectorInfo.getDataAddressMark();
                bytes.push(dam, ...sectorData.data);
                let crc: number;
                if (sectorInfo.crc !== undefined) {
                    crc = sectorInfo.crc.dataCrc.written;
                } else {
                    crc = sectorDoubleDensity ? MFM_SYNC_CRC : CRC_PRESET;
                    crc = crcOf([dam], crc);
                    crc = crcOf(sectorData.data, crc);
                }
                bytes.push(hi(crc), lo(crc));
            }
            addGap(sectorDoubleDensity, sectorDoubleDensity ? 24 : 12);
        }
        addGap(doubleDensity, trackLength - bytes.length);

        return new Uint8Array(bytes.slice(0, trackLength));
    }

    /**
     * Verify that head is on the expected track: some ID field on the track under the head
     * must match the track register. Set STATUS_SEEK_ERROR if none does.
     */
    private verify(drive: FloppyDrive): void {
        const floppyDisk = drive.floppyDisk;
        let found = false;
        if (floppyDisk !== undefined) {
            for (const sectorInfo of this.getTrackSectorInfos(floppyDisk, drive)) {
                if (this.getIdField(floppyDisk, sectorInfo)[0] === this.track) {
                    found = true;
                    break;
                }
            }
        }
        if (found) {
            TRS80_EMULATOR_LOGGER.trace(`FDC: Verify found track ${this.track}`);
        } else {
            this.status |= STATUS_SEEK_ERROR;
            TRS80_EMULATOR_LOGGER.trace(`FDC: Verify failed to find track ${this.track}`);
        }
    }

    /**
     * If we're doing a non-read/write command, update the status with the state
     * of the disk, track, and head position.
     */
    private updateStatus(): void {
        if (isReadWriteCommand(this.currentCommand)) {
            // Don't modify status.
            return;
        }

        const drive = this.drives[this.currentDrive];

        if (drive.floppyDisk === undefined) {
            this.status |= STATUS_INDEX;
        } else {
            // See if we're over the index hole.
            if (this.angle() < HOLE_WIDTH) {
                this.status |= STATUS_INDEX;
            } else {
                this.status &= ~STATUS_INDEX;
            }

            // See if the diskette is write protected.
            if (drive.floppyDisk.isWriteProtected()) {
                this.status |= STATUS_WRITE_PROTECTED;
            } else {
                this.status &= ~STATUS_WRITE_PROTECTED;
            }
        }

        // See if we're on track 0, which for some reason has a special bit.
        if (drive.physicalTrack === 0) {
            this.status |= STATUS_TRACK_ZERO;
        } else {
            this.status &= ~STATUS_TRACK_ZERO;
        }

        // RDY and HLT inputs are wired together on TRS-80 I/III/4/4P.
        if ((this.status & STATUS_NOT_READY) !== 0) {
            this.status &= ~STATUS_HEAD_ENGAGED;
        } else {
            this.status |= STATUS_HEAD_ENGAGED;
        }
    }

    /**
     * Set whether the drive is ready, interrupting if a Force Interrupt asked for that change.
     */
    private setReady(ready: boolean): void {
        const wasReady = (this.status & STATUS_NOT_READY) === 0;
        if (ready) {
            this.status &= ~STATUS_NOT_READY;
        } else {
            this.status |= STATUS_NOT_READY;
        }

        if (ready !== wasReady &&
            (this.interruptConditions & (ready ? MASK_INTERRUPT_ON_READY : MASK_INTERRUPT_ON_NOT_READY)) !== 0) {

            this.machine.diskIntrqInterrupt(true);
        }
    }

    /**
     * Interrupt at the next index pulse, and every one after, until the next command.
     */
    private scheduleIndexInterrupt(): void {
        const clocksPerRevolution = this.getClocksPerRevolution();
        const nextIndex = this.machine.tStateCount + clocksPerRevolution -
            this.machine.tStateCount % clocksPerRevolution;
        this.machine.eventScheduler.add(EventType.DISK_INDEX, nextIndex, () => {
            this.machine.diskIntrqInterrupt(true);
            this.scheduleIndexInterrupt();
        });
    }

    /**
     * Turn motor on or off.
     */
    private setMotorOn(motorOn: boolean): void {
        if (motorOn !== this.motorOn) {
            this.motorOn = motorOn;
            this.machine.diskMotorOffInterrupt(!motorOn);
            this.updateMotorOn();
        }
    }

    /**
     * Dispatch a change to the motor light.
     */
    private updateMotorOn(): void {
        this.onActiveDrive.dispatch(this.motorOn ? this.currentDrive : undefined);
    }

    /**
     * Number of clock cycles in one revolution of the disk.
     */
    private getClocksPerRevolution(): number {
        return Math.round(this.machine.clockHz / (RPM/60));
    }

    // Return a value in [0,1) indicating how far we've rotated
    // from the leading edge of the index hole. For the first HOLE_WIDTH we're
    // on the hole itself.
    private angle(): number {
        // Use simulated time.
        const clocksPerRevolution = this.getClocksPerRevolution();
        return (this.machine.tStateCount % clocksPerRevolution) / clocksPerRevolution;
    }

    /**
     * Event used for delayed command completion.  Clears BUSY,
     * sets any additional bits specified, and generates a command
     * completion interrupt.
     */
    private done(bits: number): void {
        this.status &= ~STATUS_BUSY;
        this.status |= bits;
        this.machine.diskIntrqInterrupt(true);
    }

    /**
     * Event to abort the last command with LOST_DATA if it is
     * still in progress.
     */
    private lostData(cmd: number): void {
        if (this.currentCommand === cmd) {
            this.status &= ~STATUS_BUSY;
            this.status |= STATUS_LOST_DATA;
            this.sectorData = undefined;
            this.trackWriter = undefined;
            this.machine.diskIntrqInterrupt(true);
        }
    }

    /**
     * Event used as a delayed command start. Sets DRQ, generates a DRQ interrupt,
     * sets any additional bits specified, and schedules a lostData() event.
     */
    private firstDrq(bits: number): void {
        this.status |= STATUS_DRQ | bits;
        this.machine.diskDrqInterrupt(true);

        // Evaluate this now, not when the callback is run.
        const currentCommand = this.currentCommand;

        // If we've not finished our work within half a second, trigger a lost data interrupt.
        this.machine.eventScheduler.add(EventType.DISK_LOST_DATA, this.machine.tStateCount + this.machine.clockHz/2,
            () => this.lostData(currentCommand));
    }

    /**
     * Log a warning, but only the first time we see it.
     */
    private warnOnce(message: string): void {
        if (!this.warnOnceSet.has(message)) {
            this.warnOnceSet.add(message);
            TRS80_EMULATOR_LOGGER.warn(message);
        }
    }
}

/**
 * Compute the CRC-16-CCITT of the bytes, starting with the given CRC.
 */
function crcOf(bytes: ArrayLike<number>, crc = CRC_PRESET): number {
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_16_CCITT.update(crc, bytes[i]);
    }
    return crc;
}

/**
 * Whether WRITE_TRACK writes the value as an address mark in FM.
 */
function isFmMark(value: number): boolean {
    return value >= WRITE_TRACK_FM_FIRST_MARK && value <= WRITE_TRACK_FM_LAST_MARK;
}

/**
 * Whether the address mark starts one of a sector's two fields, ID or data.
 */
function isSectorMark(value: number): boolean {
    return value === ID_ADDRESS_MARK || isDataAddressMark(value);
}
