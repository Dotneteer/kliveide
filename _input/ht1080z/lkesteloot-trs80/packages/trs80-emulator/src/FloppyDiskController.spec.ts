import {describe, expect, it} from "vitest";
import {
    CRC_16_CCITT,
    CRC_PRESET,
    DATA_ADDRESS_MARK,
    DELETED_DATA_ADDRESS_MARK,
    decodeTrs80File,
    FloppyDisk,
    FM_GAP,
    ID_ADDRESS_MARK,
    INDEX_ADDRESS_MARK,
    MFM_GAP,
    MFM_SYNC,
    SectorPosition,
    TrackPosition,
    USER_DATA_ADDRESS_MARK_F9,
    USER_DATA_ADDRESS_MARK_FA,
} from "trs80-base";
import {LogLevel, TRS80_MAIN_SINK} from "trs80-logger";
import {hi, lo} from "z80-base";
import {CassettePlayer} from "./CassettePlayer.js";
import {Config, ModelType} from "./Config.js";
import {EventScheduler} from "./EventScheduler.js";
import {FdcChip, FloppyDiskController} from "./FloppyDiskController.js";
import {Keyboard} from "./Keyboard.js";
import {Machine} from "./Machine.js";
import {SilentSoundPlayer} from "./SoundPlayer.js";
import {Trs80} from "./Trs80.js";
import {Trs80Screen} from "./Trs80Screen.js";

// Commands.
const RESTORE = 0x00;
const SEEK = 0x10;
const STEP = 0x20;
const STEP_IN = 0x40;
const STEP_IN_UPDATE = 0x50;
const STEP_OUT_UPDATE = 0x70;
const READ = 0x80;
const READ_MULTIPLE = 0x90;
const WRITE = 0xA0;
const WRITE_DELETED = 0xA1;
// Type II command bits that differ between the chips.
const WD1791_SIDE_1 = 0x08;
const WD1791_COMPARE_SIDE = 0x02;
const WD1771_IBM_SIZES = 0x08;
const WRITE_MULTIPLE = 0xB0;
const READ_ADDRESS = 0xC0;
const READ_TRACK = 0xE0;
const WRITE_TRACK = 0xF0;
const FORCE_INTERRUPT = 0xD0;
const VERIFY = 0x04;

// Status bits.
const BUSY = 0x01;
const TRACK_ZERO = 0x04;
const NOT_FOUND = 0x10;
const SEEK_ERROR = 0x10;
const DELETED = 0x20;
const RECORD_TYPE = 0x60;
const FAULT = 0x20;
const WRITE_PROTECTED = 0x40;

// Drive select bits.
const SELECT_DRIVE_0 = 0x01;
const SELECT_MFM = 0x80;

// Values written during WRITE_TRACK that the controller replaces.
const WRITE_TRACK_MFM_SYNC = 0xF5;
const WRITE_TRACK_MFM_INDEX_SYNC = 0xF6;
const WRITE_TRACK_CRC = 0xF7;

// What a DOS fills new sectors with.
const FORMAT_FILL = 0xE5;

// DMK header flag, and track header pointer bit.
const DMK_SINGLE_SIDED = 0x10;
const DMK_POINTER_DOUBLE_DENSITY = 0x8000;

/**
 * Just enough of a machine for the controller.
 */
class FakeMachine implements Machine {
    public clockHz = 2_000_000;
    public tStateCount = 0;
    public eventScheduler = new EventScheduler();
    public intrq = false;
    public drq = false;

    diskIntrqInterrupt(state: boolean): void {
        this.intrq = state;
    }

    diskMotorOffInterrupt(state: boolean): void {
        // Nothing.
    }

    diskDrqInterrupt(state: boolean): void {
        this.drq = state;
    }

    /**
     * Let time pass.
     */
    public run(clocks: number): void {
        this.tStateCount += clocks;
        this.eventScheduler.dispatch(this.tStateCount);
    }
}

/**
 * A controller with a disk in drive 0, which is selected.
 */
class Setup {
    public readonly machine = new FakeMachine();
    public readonly fdc = new FloppyDiskController(this.machine);

    constructor(public readonly disk: FloppyDisk, select = SELECT_DRIVE_0, chip = FdcChip.WD1791) {
        this.fdc.setChip(chip);
        this.fdc.loadFloppyDisk(disk, 0);
        this.fdc.writeSelect(select);
    }

    /**
     * The status, without clearing the interrupt as reading it would.
     */
    public status(): number {
        return this.fdc.save().status;
    }

    public isBusy(): boolean {
        return (this.status() & BUSY) !== 0;
    }

    /**
     * Run until the command is done.
     */
    public finish(): void {
        for (let i = 0; i < 100_000 && this.isBusy(); i++) {
            this.machine.run(16);
        }
        expect(this.isBusy()).to.be.false;
    }

    /**
     * Issue a command and run until it's done.
     */
    public command(cmd: number): void {
        this.fdc.writeCommand(cmd);
        this.finish();
    }

    /**
     * Move the head to the track.
     */
    public seek(track: number): void {
        this.fdc.writeData(track);
        this.command(SEEK);
    }

    /**
     * Issue a command and read every byte it gives, until it's done.
     */
    public read(cmd: number): number[] {
        const bytes: number[] = [];
        this.fdc.writeCommand(cmd);
        for (let i = 0; i < 1_000_000; i++) {
            if (this.machine.drq) {
                bytes.push(this.fdc.readData());
            } else if (this.isBusy()) {
                this.machine.run(16);
            } else {
                break;
            }
        }
        return bytes;
    }

    /**
     * Issue a command and write bytes while it asks for them, padding with the given byte.
     *
     * @return the number of bytes written.
     */
    public write(cmd: number, bytes: number[], pad = 0x00): number {
        let count = 0;
        this.fdc.writeCommand(cmd);
        for (let i = 0; i < 1_000_000; i++) {
            if (this.machine.drq) {
                this.fdc.writeData(count < bytes.length ? bytes[count] : pad);
                count++;
            } else if (this.isBusy()) {
                this.machine.run(16);
            } else {
                break;
            }
        }
        return count;
    }

    /**
     * The physical track of drive 0's head.
     */
    public physicalTrack(): number {
        return this.fdc.save().physicalTracks[0];
    }
}

/**
 * A single-density JV1 disk whose every byte is its track number times 10 plus its sector number.
 */
function makeJv1(trackCount = 5): FloppyDisk {
    const binary = new Uint8Array(trackCount*10*256);
    for (let i = 0; i < binary.length; i++) {
        binary[i] = Math.floor(i/256);
    }
    return decode(binary, "test.jv1");
}

/**
 * A single-density JV3 disk with ten 256-byte sectors (0 to 9) per track, filled like makeJv1().
 */
function makeJv3(trackCount = 2): FloppyDisk {
    const header = new Uint8Array(34*256).fill(0xFF);
    for (let track = 0; track < trackCount; track++) {
        for (let sector = 0; sector < 10; sector++) {
            const entry = (track*10 + sector)*3;
            header[entry] = track;
            header[entry + 1] = sector;
            // Single density, normal mark, side 0, 256 bytes.
            header[entry + 2] = 0x00;
        }
    }
    const data = new Uint8Array(trackCount*10*256);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(i/256);
    }
    const binary = new Uint8Array(header.length + data.length);
    binary.set(header);
    binary.set(data, header.length);
    return decode(binary, "test.jv3");
}

/**
 * A single-sided, double-density DMK disk with sectors 1 to sectorCount of 256 bytes on
 * each track, filled with the track number.
 */
function makeDmk(trackCount = 2, sectorCount = 18): FloppyDisk {
    const trackLength = 0x1900;
    const binary = new Uint8Array(16 + trackCount*trackLength);
    binary[1] = trackCount;
    binary[2] = lo(trackLength);
    binary[3] = hi(trackLength);
    binary[4] = DMK_SINGLE_SIDED;

    for (let track = 0; track < trackCount; track++) {
        const trackOffset = 16 + track*trackLength;
        const bytes: number[] = [];
        const pointers: number[] = [];
        const syncBytes = [MFM_SYNC, MFM_SYNC, MFM_SYNC];
        const sync = (): void => {
            bytes.push(...new Array(12).fill(0x00), ...syncBytes);
        };
        for (let sector = 1; sector <= sectorCount; sector++) {
            sync();
            pointers.push(128 + bytes.length);
            const idField = [ID_ADDRESS_MARK, track, 0, sector, 1];
            bytes.push(...idField, ...crcBytes([...syncBytes, ...idField]));
            bytes.push(...new Array(22).fill(MFM_GAP));
            sync();
            const dataField = [DATA_ADDRESS_MARK, ...new Array(256).fill(track)];
            bytes.push(...dataField, ...crcBytes([...syncBytes, ...dataField]));
            bytes.push(...new Array(16).fill(MFM_GAP));
        }
        for (let i = 0; i < pointers.length; i++) {
            const pointer = pointers[i] | DMK_POINTER_DOUBLE_DENSITY;
            binary[trackOffset + i*2] = lo(pointer);
            binary[trackOffset + i*2 + 1] = hi(pointer);
        }
        binary.set(bytes, trackOffset + 128);
    }

    return decode(binary, "test.dmk");
}

/**
 * The two CRC bytes of the bytes.
 */
function crcBytes(bytes: number[]): number[] {
    let crc = CRC_PRESET;
    for (const b of bytes) {
        crc = CRC_16_CCITT.update(crc, b);
    }
    return [hi(crc), lo(crc)];
}

/**
 * Decode a disk image, which must be a floppy.
 */
function decode(binary: Uint8Array, filename: string): FloppyDisk {
    const file = decodeTrs80File(binary, {filename});
    if (!(file instanceof FloppyDisk)) {
        throw new Error("didn't decode " + filename + ", got " + file.className);
    }
    return file;
}

/**
 * The bytes a DOS writes to format a track: the given sector numbers, of 256 bytes filled
 * with FORMAT_FILL, with ID fields for the given cylinder. (Doesn't include the gap to the index
 * pulse, which comes from padding.)
 */
function makeFormat(doubleDensity: boolean, cylinder: number, sectorNumbers: number[]): number[] {
    const bytes: number[] = [];
    const repeat = (value: number, count: number): void => {
        for (let i = 0; i < count; i++) {
            bytes.push(value);
        }
    };
    if (doubleDensity) {
        repeat(MFM_GAP, 80);
        repeat(0x00, 12);
        repeat(WRITE_TRACK_MFM_INDEX_SYNC, 3);
        bytes.push(INDEX_ADDRESS_MARK);
        repeat(MFM_GAP, 50);
        for (const sector of sectorNumbers) {
            repeat(0x00, 12);
            repeat(WRITE_TRACK_MFM_SYNC, 3);
            bytes.push(ID_ADDRESS_MARK, cylinder, 0, sector, 1, WRITE_TRACK_CRC);
            repeat(MFM_GAP, 22);
            repeat(0x00, 12);
            repeat(WRITE_TRACK_MFM_SYNC, 3);
            bytes.push(DATA_ADDRESS_MARK);
            repeat(FORMAT_FILL, 256);
            bytes.push(WRITE_TRACK_CRC);
            repeat(MFM_GAP, 16);
        }
    } else {
        repeat(FM_GAP, 16);
        for (const sector of sectorNumbers) {
            repeat(0x00, 6);
            bytes.push(ID_ADDRESS_MARK, cylinder, 0, sector, 1, WRITE_TRACK_CRC);
            repeat(FM_GAP, 11);
            repeat(0x00, 6);
            bytes.push(DATA_ADDRESS_MARK);
            repeat(FORMAT_FILL, 256);
            bytes.push(WRITE_TRACK_CRC);
            repeat(FM_GAP, 12);
        }
    }
    return bytes;
}

/**
 * The integers from begin (inclusive) to end (exclusive).
 */
function range(begin: number, end: number): number[] {
    return Array.from({length: end - begin}, (_, i) => begin + i);
}

/**
 * Run the function, and return what it logged as warnings instead of printing them.
 */
function captureWarnings(f: () => void): string[] {
    const warnings: string[] = [];
    const savedSinks = TRS80_MAIN_SINK.delegatedSinks.splice(0);
    TRS80_MAIN_SINK.delegatedSinks.push((level, message) => {
        if (level === LogLevel.WARN) {
            warnings.push(message);
        }
    });
    try {
        f();
    } finally {
        TRS80_MAIN_SINK.delegatedSinks.splice(0, Infinity, ...savedSinks);
    }
    return warnings;
}

describe("read sector", () => {
    it("reads a sector", () => {
        const setup = new Setup(makeJv1());
        setup.seek(2);
        setup.fdc.writeSector(3);
        expect(setup.read(READ)).to.eql(new Array(256).fill(23));
        expect(setup.status() & NOT_FOUND).to.equal(0);
        expect(setup.machine.intrq).to.be.true;
    });
    it("doesn't find a missing sector", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.writeSector(12);
        expect(setup.read(READ)).to.eql([]);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
        expect(setup.machine.intrq).to.be.true;
    });
    it("doesn't find a sector whose ID doesn't match the track register", () => {
        const setup = new Setup(makeJv1());
        setup.seek(1);
        setup.fdc.writeTrack(2);
        setup.fdc.writeSector(0);
        expect(setup.read(READ)).to.eql([]);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
    });
    it("reads multiple sectors until one isn't found", () => {
        const setup = new Setup(makeJv1());
        setup.seek(1);
        setup.fdc.writeSector(7);
        expect(setup.read(READ_MULTIPLE)).to.eql([
            ...new Array(256).fill(17), ...new Array(256).fill(18), ...new Array(256).fill(19)]);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
    });
});

describe("write sector", () => {
    it("writes the sector under the head", () => {
        const disk = makeJv1();
        const setup = new Setup(disk);
        setup.seek(1);
        setup.fdc.writeSector(4);
        expect(setup.write(WRITE, new Array(256).fill(0xAA))).to.equal(256);
        expect(setup.status() & (NOT_FOUND | FAULT)).to.equal(0);
        expect(Array.from(disk.readSector(SectorPosition.make(1, 0, 4))!.data)).to.eql(new Array(256).fill(0xAA));
    });
    it("doesn't write when the ID doesn't match the track register", () => {
        // This used to write to track 2, where the track register said, instead of failing
        // to find the sector on track 1, where the head was.
        const disk = makeJv1();
        const setup = new Setup(disk);
        setup.seek(1);
        setup.fdc.writeTrack(2);
        setup.fdc.writeSector(4);
        expect(setup.write(WRITE, new Array(256).fill(0xAA))).to.equal(0);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
        expect(disk.readSector(SectorPosition.make(1, 0, 4))!.data[0]).to.equal(14);
        expect(disk.readSector(SectorPosition.make(2, 0, 4))!.data[0]).to.equal(24);
    });
    it("reports a write-protected disk with an interrupt", () => {
        const disk = makeJv1();
        disk.setMountedWriteProtected(true);
        const setup = new Setup(disk);
        setup.fdc.writeSector(0);
        expect(setup.write(WRITE, [1, 2, 3])).to.equal(0);
        expect(setup.status() & WRITE_PROTECTED).to.equal(WRITE_PROTECTED);
        expect(setup.machine.intrq).to.be.true;
    });
    it("writes multiple sectors until one isn't found", () => {
        const disk = makeJv1();
        const setup = new Setup(disk);
        setup.fdc.writeSector(8);
        expect(setup.write(WRITE_MULTIPLE, [], 0x55)).to.equal(512);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
        expect(disk.readSector(SectorPosition.make(0, 0, 8))!.data[0]).to.equal(0x55);
        expect(disk.readSector(SectorPosition.make(0, 0, 9))!.data[0]).to.equal(0x55);
        expect(disk.readSector(SectorPosition.make(0, 0, 7))!.data[0]).to.equal(7);
    });
    for (const [name, makeDisk, sector] of [["JV3", makeJv3, 2], ["DMK", makeDmk, 2]] as const) {
        it("writes a deleted data mark on " + name, () => {
            const disk = makeDisk();
            const setup = new Setup(disk, SELECT_DRIVE_0 | (name === "DMK" ? SELECT_MFM : 0));
            setup.fdc.writeSector(sector);
            setup.write(WRITE_DELETED, [], 0x11);
            expect(disk.readSector(SectorPosition.make(0, 0, sector))!.deleted).to.be.true;
            expect(setup.read(READ)).to.eql(new Array(256).fill(0x11));
            expect(setup.status() & DELETED).to.equal(DELETED);

            // And back again.
            setup.write(WRITE, [], 0x22);
            const sectorData = disk.readSector(SectorPosition.make(0, 0, sector))!;
            expect(sectorData.deleted).to.be.false;
            expect(sectorData.crcError).to.be.false;
            expect(sectorData.data[0]).to.equal(0x22);
        });
    }
});

describe("head movement", () => {
    it("steps in and out", () => {
        const setup = new Setup(makeJv1());
        setup.command(STEP_IN);
        expect(setup.physicalTrack()).to.equal(1);
        expect(setup.fdc.readTrack()).to.equal(0);
        setup.command(STEP_IN_UPDATE);
        expect(setup.physicalTrack()).to.equal(2);
        expect(setup.fdc.readTrack()).to.equal(1);
        // Same direction as last time.
        setup.command(STEP);
        expect(setup.physicalTrack()).to.equal(3);
        setup.command(STEP_OUT_UPDATE);
        expect(setup.physicalTrack()).to.equal(2);
        expect(setup.fdc.readTrack()).to.equal(0);
        setup.command(STEP);
        expect(setup.physicalTrack()).to.equal(1);
    });
    it("stops at track 0", () => {
        const setup = new Setup(makeJv1());
        setup.command(STEP_OUT_UPDATE);
        expect(setup.physicalTrack()).to.equal(0);
        expect(setup.status() & TRACK_ZERO).to.equal(TRACK_ZERO);
    });
    it("verifies against the ID fields", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.writeData(3);
        setup.command(SEEK | VERIFY);
        expect(setup.status() & SEEK_ERROR).to.equal(0);
        // Restoring with the wrong track in the register finds track 0's ID fields anyway.
        setup.command(RESTORE | VERIFY);
        expect(setup.status() & SEEK_ERROR).to.equal(0);
        // Past the end of the disk.
        setup.fdc.writeData(20);
        setup.command(SEEK | VERIFY);
        expect(setup.status() & SEEK_ERROR).to.equal(SEEK_ERROR);
    });
    it("keeps the head position across save and restore", () => {
        const setup = new Setup(makeJv1());
        setup.seek(3);
        const state = setup.fdc.save();
        setup.seek(1);
        setup.fdc.restore(state);
        expect(setup.physicalTrack()).to.equal(3);
        setup.fdc.writeSector(5);
        expect(setup.read(READ)[0]).to.equal(35);
    });
});

describe("read address and read track", () => {
    it("reads each ID field in turn", () => {
        const setup = new Setup(makeJv1());
        setup.seek(2);
        expect(setup.read(READ_ADDRESS)).to.eql([2, 0, 0, 1, ...crcBytes([ID_ADDRESS_MARK, 2, 0, 0, 1])]);
        // The controller copies the cylinder to the sector register.
        expect(setup.fdc.readSector()).to.equal(2);
        expect(setup.read(READ_ADDRESS).slice(0, 4)).to.eql([2, 0, 1, 1]);
    });
    it("reads a track", () => {
        const setup = new Setup(makeJv1());
        setup.seek(2);
        const bytes = setup.read(READ_TRACK);
        expect(bytes.length).to.equal(3125);
        const text = String.fromCharCode(...bytes);
        expect(text.includes(String.fromCharCode(ID_ADDRESS_MARK, 2, 0, 9, 1))).to.be.true;
        expect(text.includes(String.fromCharCode(DATA_ADDRESS_MARK, ...new Array(10).fill(29)))).to.be.true;
    });
});

describe("write track (format)", () => {
    it("formats a double-density DMK track", () => {
        const disk = makeDmk(2, 10);
        const setup = new Setup(disk, SELECT_DRIVE_0 | SELECT_MFM);
        setup.seek(1);
        setup.write(WRITE_TRACK, makeFormat(true, 1, range(1, 19)), MFM_GAP);
        expect(setup.status() & FAULT).to.equal(0);

        const track = disk.getGeometry().getTrack(new TrackPosition(1, 0))!;
        expect([track.firstSectorNumber, track.lastSectorNumber]).to.eql([1, 18]);
        setup.fdc.writeSector(18);
        expect(setup.read(READ)).to.eql(new Array(256).fill(FORMAT_FILL));
        expect(setup.status() & (NOT_FOUND | 0x08)).to.equal(0);
        // The other track is untouched.
        expect(disk.readSector(SectorPosition.make(0, 0, 10))!.data[0]).to.equal(0);
    });
    it("formats a single-density DMK track", () => {
        const disk = makeDmk(2, 10);
        const setup = new Setup(disk);
        setup.write(WRITE_TRACK, makeFormat(false, 0, range(0, 10)), 0xFF);
        expect(setup.status() & FAULT).to.equal(0);
        setup.fdc.writeSector(9);
        expect(setup.read(READ)).to.eql(new Array(256).fill(FORMAT_FILL));
        expect(setup.status() & (NOT_FOUND | 0x08)).to.equal(0);
    });
    it("formats a JV1 track with JV1's layout", () => {
        const disk = makeJv1();
        const setup = new Setup(disk);
        setup.seek(1);
        // Interleaved, as DOSes do.
        setup.write(WRITE_TRACK, makeFormat(false, 1, [0, 5, 1, 6, 2, 7, 3, 8, 4, 9]), 0xFF);
        expect(setup.status() & FAULT).to.equal(0);
        expect(disk.readSector(SectorPosition.make(1, 0, 6))!.data[0]).to.equal(FORMAT_FILL);
    });
    it("reports a layout that JV1 can't hold as a fault", () => {
        const disk = makeJv1();
        const setup = new Setup(disk, SELECT_DRIVE_0 | SELECT_MFM);
        setup.seek(1);
        const warnings = captureWarnings(() =>
            setup.write(WRITE_TRACK, makeFormat(true, 1, range(1, 19)), MFM_GAP));
        expect(warnings).to.eql(["FDC: Can't format track 1:0 (18 sectors) of a Floppy disk (JV1)"]);
        expect(setup.status() & FAULT).to.equal(FAULT);
        expect(setup.machine.intrq).to.be.true;
        expect(disk.readSector(SectorPosition.make(1, 0, 6))!.data[0]).to.equal(16);
    });
    it("reformats a JV3 track with the same layout", () => {
        const disk = makeJv3();
        const setup = new Setup(disk);
        setup.seek(1);
        setup.write(WRITE_TRACK, makeFormat(false, 1, range(0, 10)), 0xFF);
        expect(setup.status() & FAULT).to.equal(0);
        expect(disk.readSector(SectorPosition.make(1, 0, 3))!.data[0]).to.equal(FORMAT_FILL);
    });
});

describe("force interrupt and drive select", () => {
    it("interrupts on every index pulse", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.writeCommand(FORCE_INTERRUPT | 0x04);
        expect(setup.machine.intrq).to.be.false;
        setup.machine.run(setup.machine.clockHz/5);
        expect(setup.machine.intrq).to.be.true;
        setup.fdc.readStatus();
        expect(setup.machine.intrq).to.be.false;
        setup.machine.run(setup.machine.clockHz/5);
        expect(setup.machine.intrq).to.be.true;

        // A plain Force Interrupt stops that.
        setup.fdc.writeCommand(FORCE_INTERRUPT);
        setup.machine.run(setup.machine.clockHz);
        expect(setup.machine.intrq).to.be.false;
    });
    it("interrupts when the drive becomes not ready", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.writeCommand(FORCE_INTERRUPT | 0x02);
        expect(setup.machine.intrq).to.be.false;
        setup.fdc.writeSelect(0);
        expect(setup.machine.intrq).to.be.true;
    });
    it("interrupts immediately", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.writeCommand(FORCE_INTERRUPT | 0x08);
        expect(setup.machine.intrq).to.be.true;
    });
    it("abandons a command and stops the motor on reset", () => {
        // The machine cancels all scheduled events on reset, so nothing would end the command.
        const setup = new Setup(makeJv1());
        setup.fdc.writeCommand(READ);
        expect(setup.isBusy()).to.be.true;
        setup.machine.eventScheduler.cancelAll();
        setup.fdc.reset();
        expect(setup.isBusy()).to.be.false;
        expect(setup.fdc.save().motorOn).to.be.false;
        // And it works again once the drive is selected.
        setup.fdc.writeSelect(SELECT_DRIVE_0);
        expect(setup.read(READ)[0]).to.equal(0);
    });
    it("handles selecting more than one drive", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.loadFloppyDisk(makeJv3(), 1);
        const warnings = captureWarnings(() => setup.fdc.writeSelect(0x06));
        expect(warnings).to.eql(["FDC: More than one drive selected (0x06), using the lowest"]);
        setup.fdc.writeSector(0);
        // Drive 1 has the JV3, whose sectors are filled the same way.
        expect(setup.read(READ)[0]).to.equal(0);
        expect(setup.fdc.save().currentDrive).to.equal(1);
    });
});

/**
 * A screen that ignores what's written to it.
 */
class NullScreen extends Trs80Screen {
    setConfig(config: Config): void {
        // Nothing.
    }

    writeChar(address: number, value: number): void {
        // Nothing.
    }
}

describe("WD1771 and WD1791", () => {
    it("writes and reports the WD1771's four data address marks", () => {
        const disk = makeJv3();
        const setup = new Setup(disk, SELECT_DRIVE_0, FdcChip.WD1771);
        setup.fdc.writeSector(3);
        const cases = [
            [0x00, DATA_ADDRESS_MARK, 0x00],
            [0x01, USER_DATA_ADDRESS_MARK_FA, 0x20],
            [0x02, USER_DATA_ADDRESS_MARK_F9, 0x40],
            [0x03, DELETED_DATA_ADDRESS_MARK, 0x60],
        ];
        for (const [bits, dataAddressMark, recordType] of cases) {
            setup.write(WRITE | WD1771_IBM_SIZES | bits, [], 0x33);
            expect(disk.readSector(SectorPosition.make(0, 0, 3))!.getDataAddressMark()).to.equal(dataAddressMark);
            expect(setup.read(READ | WD1771_IBM_SIZES)[0]).to.equal(0x33);
            expect(setup.status() & RECORD_TYPE).to.equal(recordType);
        }
    });
    it("reports any mark but 0xFB as deleted on the WD1791", () => {
        const setup = new Setup(makeJv1(20), SELECT_DRIVE_0, FdcChip.WD1771);
        setup.seek(17);
        setup.fdc.writeSector(0);
        // JV1's directory track has the 0xFA mark.
        setup.read(READ);
        expect(setup.status() & RECORD_TYPE).to.equal(0x20);
        setup.fdc.setChip(FdcChip.WD1791);
        setup.read(READ);
        expect(setup.status() & RECORD_TYPE).to.equal(DELETED);
    });
    it("handles double-density sectors as a WD1791 even on a Model I", () => {
        // A WD1771 can't do double density, so these went through an adapter's WD1791,
        // where bit 1 is side compare rather than part of the data address mark.
        const disk = makeDmk();
        const setup = new Setup(disk, SELECT_DRIVE_0 | SELECT_MFM, FdcChip.WD1771);
        setup.fdc.writeSector(5);
        expect(setup.write(WRITE_DELETED | WD1791_COMPARE_SIDE, [], 0x44)).to.equal(256);
        expect(disk.readSector(SectorPosition.make(0, 0, 5))!.getDataAddressMark()).to.equal(DELETED_DATA_ADDRESS_MARK);
        setup.read(READ);
        expect(setup.status() & RECORD_TYPE).to.equal(DELETED);
    });
    it("compares sides on the WD1791 when asked", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.writeSector(2);
        expect(setup.read(READ | WD1791_COMPARE_SIDE | WD1791_SIDE_1)).to.eql([]);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
        expect(setup.read(READ | WD1791_COMPARE_SIDE)[0]).to.equal(2);
    });
    it("doesn't compare sides on the WD1771", () => {
        const setup = new Setup(makeJv1(), SELECT_DRIVE_0, FdcChip.WD1771);
        setup.fdc.writeSector(2);
        expect(setup.read(READ | WD1771_IBM_SIZES | 0x02)[0]).to.equal(2);
    });
    it("follows the machine's model", () => {
        const model1 = Config.makeDefault().edit().withModelType(ModelType.MODEL1).build();
        const trs80 = new Trs80(model1, new NullScreen(), new Keyboard(), new CassettePlayer(), new SilentSoundPlayer());
        expect(trs80.getFdcState().chip).to.equal(FdcChip.WD1771);
        trs80.setConfig(model1.edit().withModelType(ModelType.MODEL3).build());
        expect(trs80.getFdcState().chip).to.equal(FdcChip.WD1791);

        // Restoring a saved state brings back its chip too.
        const model3State = trs80.save();
        trs80.setConfig(model1);
        expect(trs80.getFdcState().chip).to.equal(FdcChip.WD1771);
        trs80.restore(model3State);
        expect(trs80.getFdcState().chip).to.equal(FdcChip.WD1791);
    });
});

describe("density", () => {
    it("finds sectors only in the density selected", () => {
        const setup = new Setup(makeJv1());
        setup.fdc.writeSector(3);
        setup.fdc.writeSelect(SELECT_DRIVE_0 | SELECT_MFM);
        expect(setup.read(READ)).to.eql([]);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
        setup.fdc.writeSelect(SELECT_DRIVE_0);
        expect(setup.read(READ)[0]).to.equal(3);
    });
    it("doesn't write a sector in the wrong density", () => {
        const disk = makeDmk();
        const setup = new Setup(disk);
        setup.fdc.writeSector(4);
        expect(setup.write(WRITE, [], 0x66)).to.equal(0);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
        expect(disk.readSector(SectorPosition.make(0, 0, 4))!.data[0]).to.equal(0);
    });
    it("reads addresses and verifies only in the density selected", () => {
        const setup = new Setup(makeDmk());
        expect(setup.read(READ_ADDRESS)).to.eql([]);
        expect(setup.status() & NOT_FOUND).to.equal(NOT_FOUND);
        setup.fdc.writeData(1);
        setup.command(SEEK | VERIFY);
        expect(setup.status() & SEEK_ERROR).to.equal(SEEK_ERROR);
        setup.fdc.writeSelect(SELECT_DRIVE_0 | SELECT_MFM);
        setup.command(SEEK | VERIFY);
        expect(setup.status() & SEEK_ERROR).to.equal(0);
    });
    it("accepts either density on a Model I, which selects it through an adapter", () => {
        const setup = new Setup(makeDmk(), SELECT_DRIVE_0, FdcChip.WD1771);
        setup.fdc.writeSector(4);
        expect(setup.read(READ | WD1771_IBM_SIZES)[0]).to.equal(0);
        expect(setup.status() & NOT_FOUND).to.equal(0);
    });
});
