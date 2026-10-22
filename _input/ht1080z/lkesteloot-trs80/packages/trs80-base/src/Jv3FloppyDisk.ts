import {toHexByte} from "z80-base";
import {
    Density,
    FloppyDisk,
    FloppyDecodeOptions,
    FloppyDiskGeometry,
    FloppyWrite,
    FormattedTrack,
    SectorData,
    SectorInfo, SectorPosition,
} from "./FloppyDisk.js";
import {ProgramAnnotation} from "./ProgramAnnotation.js";
import {
    DATA_ADDRESS_MARK,
    DELETED_DATA_ADDRESS_MARK,
    isDeletedDataAddressMark,
    USER_DATA_ADDRESS_MARK_F9,
    USER_DATA_ADDRESS_MARK_FA,
} from "./TrackBytes.js";
import {TRS80_BASE_LOGGER} from "trs80-logger";

// The JV3 file consists of sectors of different sizes all bunched together. Before that
// comes a directory of these sectors, with three bytes per directory entry (cylinder,
// sector, and flags), mapping in order to the subsequent sectors.
//
// https://www.tim-mann.org/trs80/dskspec.html

// The directory is in this header:
const HEADER_SIZE = 34*256;

// Size of each directory entry:
const DIR_ENTRY_SIZE = 3;

// We can fit this many 3-byte records into it, with one byte to spare:
const RECORD_COUNT = Math.floor(HEADER_SIZE/DIR_ENTRY_SIZE);

// Flags for Jv3SectorInfo.
enum Flags {
    SIZE_CODE_MASK = 0x03, // See calculation in constructor of Jv3SectorInfo.
    NON_IBM = 0x04, // 0 = normal, 1 = short.
    BAD_CRC = 0x08, // 0 = good CRC, 1 = bad CRC.
    SIDE = 0x10, // 0 = front, 1 = back.

    DAM_MASK = 0x60, // Data address mark mask.

    // Single-density.
    DAM_SD_FB = 0x00, // Normal sector.
    DAM_SD_FA = 0x20, // Unknown DAM.
    DAM_SD_F9 = 0x40, // Unknown DAM.
    DAM_SD_F8 = 0x60, // Deleted sector.

    // Double-density.
    DAM_DD_FB = 0x00, // Normal sector.
    DAM_DD_F8 = 0x20, // Deleted sector.

    DOUBLE_DENSITY = 0x80,
}

// Used in the cylinder and sector bytes.
const FREE = 0xFF;

/**
 * Information captured from the table of contents.
 */
class Jv3SectorInfo {
    public readonly sectorPosition: SectorPosition;
    // Changes when the sector is written.
    public flags: Flags;

    // Offset into the binary of the sector's data.
    public readonly offset: number;

    // Offset into the binary of the flags byte of the sector's directory entry.
    public readonly flagsOffset: number;

    // Number of bytes in sector.
    public readonly size: number;

    constructor(cylinderNumber: number, sectorNumber: number, flags: Flags, offset: number, flagsOffset: number) {
        const side = (flags & Flags.SIDE) === 0 ? 0 : 1;
        this.sectorPosition = SectorPosition.make(cylinderNumber, side, sectorNumber);
        this.flags = flags;
        this.offset = offset;
        this.flagsOffset = flagsOffset;

        // In used sectors: 0=256,1=128,2=1024,3=512
        // In free sectors: 0=512,1=1024,2=128,3=256
        const sizeCode = (flags & Flags.SIZE_CODE_MASK) ^ (this.isFree() ? 0x02 : 0x01);
        this.size = 128 << sizeCode;
    }

    /**
     * See whether the sector's position is plausible.
     */
    public isPlausible(): boolean {
        return this.isFree() || this.sectorPosition.isPlausible();
    }

    /**
     * Return the flags as a string, for debugging.
     */
    public flagsToString(): string {
        const parts: string[] = [];

        parts.push(this.size + " bytes");
        if (this.isFree()) {
            parts.push("free");
        } else {
            if ((this.flags & Flags.NON_IBM) !== 0) {
                parts.push("non-IBM");
            }
            if (this.hasCrcError()) {
                parts.push("bad CRC");
            }
            parts.push("side " + this.sectorPosition.side);
            if (this.isDoubleDensity()) {
                parts.push("double density");
            } else {
                parts.push("single density");
            }
        }

        return parts.join(", ");
    }

    /**
     * Whether the sector entry is free (doesn't represent real space in the file).
     */
    public isFree(): boolean {
        return this.sectorPosition.cylinderNumber === FREE && this.sectorPosition.sectorNumber === FREE;
    }

    /**
     * Whether the sector is encoded with MFM (instead of FM).
     */
    public isDoubleDensity(): boolean {
        return (this.flags & Flags.DOUBLE_DENSITY) !== 0;
    }

    /**
     * Return the density of this sector.
     */
    public getDensity(): Density {
        return this.isDoubleDensity() ? Density.DOUBLE : Density.SINGLE;
    }

    /**
     * Whether the sector's data is invalid.
     *
     * Normally FB is normal and F8 is deleted, but the single-density version has
     * two other values (F9 and FA), which we also consider deleted, to match xtrs.
     */
    public isDeleted(): boolean {
        const dam = this.flags & Flags.DAM_MASK;
        return this.isDoubleDensity() ? dam === Flags.DAM_DD_F8 : dam !== Flags.DAM_SD_FB;
    }

    /**
     * The sector's data address mark. Single density records all four; double density only
     * has normal and deleted.
     */
    public getDataAddressMark(): number {
        const dam = this.flags & Flags.DAM_MASK;
        if (this.isDoubleDensity()) {
            return dam === Flags.DAM_DD_F8 ? DELETED_DATA_ADDRESS_MARK : DATA_ADDRESS_MARK;
        }

        switch (dam) {
            case Flags.DAM_SD_FB:
            default:
                return DATA_ADDRESS_MARK;
            case Flags.DAM_SD_FA:
                return USER_DATA_ADDRESS_MARK_FA;
            case Flags.DAM_SD_F9:
                return USER_DATA_ADDRESS_MARK_F9;
            case Flags.DAM_SD_F8:
                return DELETED_DATA_ADDRESS_MARK;
        }
    }

    /**
     * The flags for this sector once it's written in the given density with the given
     * data address mark, and so with a good CRC. Double density can only record normal and
     * deleted marks, so the others become whichever they mean.
     */
    public flagsAfterWrite(doubleDensity: boolean, dataAddressMark: number): Flags {
        let flags = this.flags & ~(Flags.BAD_CRC | Flags.DAM_MASK | Flags.DOUBLE_DENSITY);

        if (doubleDensity) {
            const deleted = isDeletedDataAddressMark(dataAddressMark);
            flags |= Flags.DOUBLE_DENSITY | (deleted ? Flags.DAM_DD_F8 : Flags.DAM_DD_FB);
        } else {
            switch (dataAddressMark) {
                case DATA_ADDRESS_MARK:
                default:
                    flags |= Flags.DAM_SD_FB;
                    break;
                case USER_DATA_ADDRESS_MARK_FA:
                    flags |= Flags.DAM_SD_FA;
                    break;
                case USER_DATA_ADDRESS_MARK_F9:
                    flags |= Flags.DAM_SD_F9;
                    break;
                case DELETED_DATA_ADDRESS_MARK:
                    flags |= Flags.DAM_SD_F8;
                    break;
            }
        }

        return flags as Flags;
    }

    /**
     * Whether the floppy had a bar CRC when reading it.
     */
    public hasCrcError(): boolean {
        return (this.flags & Flags.BAD_CRC) !== 0;
    }

    /**
     * Convert this object to a standard SectorInfo object.
     */
    public toSectorInfo(): SectorInfo {
        const sectorInfo = new SectorInfo(this.sectorPosition, this.getDensity(), this.size);
        sectorInfo.deleted = this.isDeleted();
        sectorInfo.dataAddressMark = this.getDataAddressMark();
        sectorInfo.crcError = this.hasCrcError();
        return sectorInfo;
    }

    /**
     * Convert this object to a standard SectorData object.
     */
    public toSectorData(data: Uint8Array): SectorData {
        const sectorData = new SectorData(data, this.sectorPosition, this.getDensity());
        sectorData.deleted = this.isDeleted();
        sectorData.dataAddressMark = this.getDataAddressMark();
        sectorData.crcError = this.hasCrcError();
        return sectorData;
    }
}

/**
 * Floppy disk in the JV3 format.
 */
export class Jv3FloppyDisk extends FloppyDisk {
    public readonly className = "Jv3FloppyDisk";
    private readonly sectorInfos: Jv3SectorInfo[];
    public readonly writeProtected: boolean;
    // Rebuilt when a track is formatted.
    private geometry: FloppyDiskGeometry;
    // From sector position key string to our sector info.
    private readonly sectorInfoMap: Map<string,Jv3SectorInfo>;

    constructor(binary: Uint8Array, error: string | undefined, annotations: ProgramAnnotation[],
                jv3SectorInfos: Jv3SectorInfo[], writeProtected: boolean,
                geometry: FloppyDiskGeometry, sectorInfoMap: Map<string,Jv3SectorInfo>) {

        super(binary, error, annotations);
        this.sectorInfos = jv3SectorInfos;
        this.writeProtected = writeProtected;
        this.geometry = geometry;
        this.sectorInfoMap = sectorInfoMap;
    }

    public getDescription(): string {
        return "Floppy disk (JV3)";
    }

    public getGeometry(): FloppyDiskGeometry {
        return this.geometry;
    }

    public isWriteProtected(): boolean {
        // Our file's state or the mounted state.
        return this.writeProtected || this.mountedWriteProtected;
    }

    /**
     * Read a sector, or return undefined if the disk doesn't have it or the file is truncated.
     */
    public readSector(sectorPosition: SectorPosition): SectorData | undefined {
        const sectorInfo = this.findSectorInfo(sectorPosition);
        if (sectorInfo === undefined) {
            return undefined;
        }
        const endOffset = sectorInfo.offset + sectorInfo.size;
        if (endOffset > this.binary.length) {
            // Don't log this. The file systems report it as damage to the files that use the sector.
            return undefined;
        }

        const data = this.binary.subarray(sectorInfo.offset, endOffset);

        return sectorInfo.toSectorData(data);
    }

    /**
     * Write a sector's data, and record its data address mark and good CRC in its directory
     * entry. The data must be the sector's size.
     */
    public writeSector(sectorPosition: SectorPosition, data: SectorData) {
        if (this.isWriteProtected()) {
            // Shouldn't happen, failure upstream.
            throw new Error("tried to write sector to JV3 but it's write protected");
        }

        const sectorInfo = this.findSectorInfo(sectorPosition);
        if (sectorInfo === undefined) {
            // Not sure how to handle this.
            TRS80_BASE_LOGGER.warn(`JV3 write sector not found ${sectorPosition.key()}`);
            return;
        }

        if (sectorInfo.size !== data.data.length) {
            throw new Error(`size mismatch when writing sector (${sectorInfo.size} vs. ${data.data.length}`);
        }

        this.write(new FloppyWrite(data.data, sectorInfo.offset));
        this.setFlags(sectorInfo, sectorInfo.flagsAfterWrite(sectorInfo.isDoubleDensity(), data.getDataAddressMark()));

        // Keep the geometry's copy in sync. The density didn't change, so the rest of the
        // geometry is still right.
        const geometrySectorInfo = this.geometry.sectorMap.get(sectorPosition.key());
        if (geometrySectorInfo !== undefined) {
            geometrySectorInfo.deleted = sectorInfo.isDeleted();
            geometrySectorInfo.dataAddressMark = sectorInfo.getDataAddressMark();
            geometrySectorInfo.crcError = sectorInfo.hasCrcError();
        }
    }

    /**
     * Format a track. Since we can't change the directory's entries, this only works if the
     * new track has the same sectors as the old one, which is the case when reformatting a disk
     * the same way.
     *
     * @return whether successful.
     */
    public formatTrack(formattedTrack: FormattedTrack): boolean {
        if (this.isWriteProtected()) {
            return false;
        }

        // We can't add, remove, or resize directory entries, so the new track must have
        // exactly the sectors (positions and sizes) that the old one did. JV3 records each
        // sector's ID field as its position, so the IDs must also match where the track is.
        const oldSectorCount = this.sectorInfos.filter(info =>
            !info.isFree() && info.sectorPosition.trackPosition.equals(formattedTrack.trackPosition)).length;
        if (formattedTrack.sectors.length !== oldSectorCount) {
            return false;
        }
        const matches: {sectorInfo: Jv3SectorInfo, sector: SectorData}[] = [];
        const keys = new Set<string>();
        for (const sector of formattedTrack.sectors) {
            const sectorInfo = this.findSectorInfo(sector.sectorPosition);
            if (!sector.sectorPosition.trackPosition.equals(formattedTrack.trackPosition) ||
                sectorInfo === undefined ||
                sectorInfo.size !== sector.data.length) {

                return false;
            }
            matches.push({sectorInfo, sector});
            keys.add(sector.sectorPosition.key());
        }
        if (keys.size !== matches.length) {
            // Duplicate sector IDs.
            return false;
        }

        for (const {sectorInfo, sector} of matches) {
            this.write(new FloppyWrite(sector.data, sectorInfo.offset));
            this.setFlags(sectorInfo, sectorInfo.flagsAfterWrite(formattedTrack.doubleDensity, sector.getDataAddressMark()));
        }

        // The density may have changed, so rebuild the geometry.
        const geometry = makeGeometry(this.sectorInfos);
        if (geometry !== undefined) {
            this.geometry = geometry;
        }

        return true;
    }

    /**
     * Update a sector's flags in its directory entry.
     */
    private setFlags(sectorInfo: Jv3SectorInfo, flags: Flags): void {
        if (flags !== sectorInfo.flags) {
            sectorInfo.flags = flags;
            this.write(new FloppyWrite(new Uint8Array([flags]), sectorInfo.flagsOffset));
        }
    }

    /**
     * Find the sector for the specified cylinder and side.
     */
    private findSectorInfo(sectorPosition: SectorPosition): Jv3SectorInfo | undefined {
        return this.sectorInfoMap.get(sectorPosition.key());
    }
}

/**
 * Make the geometry from the sectors, or undefined if there are no used sectors (or none with a valid
 * geometry). The geometry's boot track may be undefined.
 */
function makeGeometry(sectorInfos: Jv3SectorInfo[]): FloppyDiskGeometry | undefined {
    // Only consider used (non-free) sectors.
    const usedSectors = sectorInfos.filter(info => !info.isFree());

    const cylinderCount = Math.max(-1, ... usedSectors.map(info => info.sectorPosition.cylinderNumber)) + 1;
    const sideCount = Math.max(-1, ... usedSectors.map(info => info.sectorPosition.side)) + 1;
    return FloppyDiskGeometry.make(cylinderCount, sideCount, usedSectors.map(info => info.toSectorInfo()));
}

/**
 * Decode a JV3 floppy disk file.
 *
 * @param options how strict to be; see FloppyDecodeOptions.
 */
export function decodeJv3FloppyDisk(binary: Uint8Array, options: FloppyDecodeOptions): Jv3FloppyDisk | undefined {
    let error: string | undefined;
    let writeProtected = false;
    const annotations: ProgramAnnotation[] = [];
    const sectorInfos: Jv3SectorInfo[] = [];

    // Keep reading blocks of directory/data pairs. In practice there are at most two of these.
    let blockOffset = 0;
    while (blockOffset < binary.length) {
        // Position of the sector data in the file.
        let sectorOffset = blockOffset + HEADER_SIZE;
        if (sectorOffset > binary.length) {
            // Truncated directory.
            return undefined;
        }

        // Read the directory.
        for (let i = 0; i < RECORD_COUNT; i++) {
            const dirOffset = blockOffset + i * DIR_ENTRY_SIZE;
            const cylinderNumber = binary[dirOffset];
            const sectorNumber = binary[dirOffset + 1];
            const flags = binary[dirOffset + 2] as Flags;

            const sectorInfo = new Jv3SectorInfo(cylinderNumber, sectorNumber, flags, sectorOffset, dirOffset + 2);

            // See if we have a plausible disk, instead of a file that just happens to be large enough.
            if (!sectorInfo.isPlausible()) {
                return undefined;
            }

            sectorOffset += sectorInfo.size;

            if (!sectorInfo.isFree() && sectorOffset > binary.length) {
                // Should we return undefined?
                error = `Sector ${sectorInfo.sectorPosition.key()} is truncated`;
            }

            annotations.push(new ProgramAnnotation("Cylinder " + sectorInfo.sectorPosition.cylinderNumber + ", sector " +
                sectorInfo.sectorPosition.sectorNumber + ", " + sectorInfo.flagsToString(), dirOffset, dirOffset + DIR_ENTRY_SIZE));

            sectorInfos.push(sectorInfo);
        }

        const writableOffset = blockOffset + RECORD_COUNT * DIR_ENTRY_SIZE;
        let message: string;
        if (blockOffset === 0) {
            // Last byte of directory of first block is write-protected marker.
            const writable = binary[writableOffset];
            if (writable !== 0 && writable !== 0xFF) {
                error = "Invalid \"writable\" byte: 0x" + toHexByte(writable);
            }
            writeProtected = writable === 0;
            message = writeProtected ? "Write protected" : "Writable";
        } else {
            // The last byte of the directory is unused in subsequent blocks.
            message = "Reserved";
        }
        annotations.push(new ProgramAnnotation(message, writableOffset, writableOffset + 1));

        blockOffset = sectorOffset;
    }

    // Annotate the sectors themselves.
    for (const sectorInfo of sectorInfos) {
        // File is allowed to be truncated at trailing free sectors.
        if (sectorInfo.offset < binary.length) {
            if (sectorInfo.isFree()) {
                annotations.push(new ProgramAnnotation("Unused sector",
                    sectorInfo.offset, sectorInfo.offset + sectorInfo.size));
            } else {
                annotations.push(new ProgramAnnotation("Cylinder " + sectorInfo.sectorPosition.cylinderNumber +
                    ", sector " + sectorInfo.sectorPosition.sectorNumber,
                    sectorInfo.offset, sectorInfo.offset + sectorInfo.size));
            }
        }
    }


    const geometry = makeGeometry(sectorInfos);
    if (geometry === undefined) {
        return undefined;
    }
    if (options.requireBootTrack && geometry.bootTrack === undefined) {
        return undefined;
    }

    // Only consider used (non-free) sectors.
    const usedSectors = sectorInfos.filter(info => !info.isFree());

    // Build our map.
    const sectorInfoMap = new Map(usedSectors.map(info => [info.sectorPosition.key(), info]));
    if (sectorInfoMap.size !== usedSectors.length) {
        // Some JV3 sectors had duplicate positions. Might want to be more flexible here, for copy protection tricks.
        return undefined;
    }

    return new Jv3FloppyDisk(binary, error, annotations, sectorInfos, writeProtected, geometry, sectorInfoMap);
}
