import {SimpleEventDispatcher} from "strongly-typed-events";
import {ProgramAnnotation} from "./ProgramAnnotation.js";
import {AbstractTrs80File} from "./Trs80File.js";
import {DATA_ADDRESS_MARK, DELETED_DATA_ADDRESS_MARK} from "./TrackBytes.js";

// Determined by the floppy controller.
export const BYTES_PER_SECTOR = 256;

// Whether single density (FM) or double density (MFM).
export enum Density {
    SINGLE,
    DOUBLE,
}

/**
 * A lowercase string for the density.
 */
export function densityToString(density: Density): string {
    switch (density) {
        case Density.SINGLE: return "single";
        case Density.DOUBLE: return "double";
    }
}

/**
 * Returns the most common value (and its count) of a list of values. If more than one value is tied for max count,
 * returns the one with the smallest value.
 */
function modeOf(values: number[]): { value: number, count: number } {
    // Map from value to count.
    const counts = new Map<number,number>();

    // Count how many of each.
    for (const value of values) {
        const count = counts.get(value) ?? 0;
        counts.set(value, count + 1);
    }

    // Find the most common one.
    let modalValue: number | undefined = undefined;
    let modalCount = 0;

    for (const [value, count] of counts.entries()) {
        if (modalValue === undefined || count > modalCount || (count === modalCount && value < modalValue)) {
            modalValue = value;
            modalCount = count;
        }
    }

    if (modalValue === undefined) {
        throw new Error("Must have at least one value for modeOf()");
    }

    return { value: modalValue, count: modalCount };
}

/**
 * The largest difference between two consecutive sector numbers on a track that still counts
 * as the same run of numbers. A gap of up to 2 missing numbers stays inside one cluster, while
 * the strays that copy protection writes (such as 124-126 on a track numbered 0-9, or a lone 23
 * on a track numbered 0-18) form their own clusters. Longer gaps from damage are still reported,
 * because a damaged track's expected range is its group's range.
 */
const MAX_SECTOR_NUMBER_GAP = 3;

/**
 * An inclusive range of sector numbers.
 */
export interface SectorNumberRange {
    firstSectorNumber: number;
    lastSectorNumber: number;
}

/**
 * Finds the core of a track's sector numbers, ignoring stray IDs. Splits the numbers into
 * clusters wherever two consecutive ones differ by more than MAX_SECTOR_NUMBER_GAP, and
 * returns the range of the cluster with the most numbers (on a tie, the lower-numbered one).
 *
 * @param sortedSectorNumbers distinct sector numbers in ascending order. Must not be empty.
 */
function coreSectorRange(sortedSectorNumbers: number[]): SectorNumberRange {
    if (sortedSectorNumbers.length === 0) {
        throw new Error("Must have at least one sector number for coreSectorRange()");
    }

    let best: SectorNumberRange | undefined = undefined;
    let bestCount = 0;

    let clusterStart = 0;
    for (let i = 1; i <= sortedSectorNumbers.length; i++) {
        const endOfCluster = i === sortedSectorNumbers.length ||
            sortedSectorNumbers[i] - sortedSectorNumbers[i - 1] > MAX_SECTOR_NUMBER_GAP;
        if (endOfCluster) {
            const count = i - clusterStart;
            // Strictly greater, so that on a tie the earlier (lower-numbered) cluster wins.
            if (count > bestCount) {
                best = {
                    firstSectorNumber: sortedSectorNumbers[clusterStart],
                    lastSectorNumber: sortedSectorNumbers[i - 1],
                };
                bestCount = count;
            }
            clusterStart = i;
        }
    }

    return best!;
}

/**
 * Structure to keep track of a specific track on a disk.
 */
export class TrackPosition {
    /**
     * A cylinder is the set of all the tracks that are "on top" of one another. On a floppy, a cylinder
     * will have 1 or 2 tracks. Cylinder numbering is zero-based.
     */
    public readonly cylinderNumber: number;
    /**
     * Which side this track is on.
     */
    public readonly side: number;

    constructor(cylinderNumber: number, side: number) {
        this.cylinderNumber = cylinderNumber;
        this.side = side;
    }

    /**
     * Whether this position is plausible on a floppy.
     */
    public isPlausible(): boolean {
        return this.cylinderNumber < 100 && this.side <= 1;
    }

    /**
     * Generates a string of the form "cylinder:side", like "4:0", usable for error messages
     * or map keys.
     */
    public key(): string {
        return `${this.cylinderNumber}:${this.side}`;
    }

    /**
     * Whether the two track positions point to the same track.
     */
    public equals(other: TrackPosition): boolean {
        return this.cylinderNumber === other.cylinderNumber && this.side === other.side;
    }

}

/**
 * Compares track positions by cylinder, then side, for sorting.
 */
function compareTrackPositions(a: TrackPosition, b: TrackPosition): number {
    return a.cylinderNumber - b.cylinderNumber || a.side - b.side;
}

/**
 * Structure to keep track of a specific sector position on a disk.
 */
export class SectorPosition {
    /**
     * Which track this sector is on.
     */
    public readonly trackPosition: TrackPosition;
    /**
     * The sector number within the track. This is numbered from 1 on TRSDOS 1.3-based systems, and from
     * 0 on the others. (Sectors mark their own numbers on the floppy, so they're labels not indices.)
     */
    public readonly sectorNumber: number;

    constructor(trackPosition: TrackPosition, sectorNumber: number) {
        this.trackPosition = trackPosition;
        this.sectorNumber = sectorNumber;
    }

    /**
     * Convenience factory that takes all three parameters.
     */
    public static make(cylinderNumber: number, side: number, sectorNumber: number): SectorPosition {
        return new SectorPosition(new TrackPosition(cylinderNumber, side), sectorNumber);
    }

    /**
     * Convenient property to get the cylinder number from the track.
     */
    public get cylinderNumber(): number {
        return this.trackPosition.cylinderNumber;
    }

    /**
     * Convenient property to get the side from the track.
     */
    public get side(): number {
        return this.trackPosition.side;
    }

    /**
     * Whether this position is plausible on a floppy.
     */
    public isPlausible(): boolean {
        // Conservative numbers.
        return this.trackPosition.isPlausible() && this.sectorNumber < 40;
    }

    /**
     * Generates a string of the form "cylinder:side:sector", like "4:0:9", usable for error messages
     * or map keys.
     */
    public key(): string {
        return `${this.trackPosition.key()}:${this.sectorNumber}`;
    }

    /**
     * Whether the two sector positions point to the same sector.
     */
    public equals(other: SectorPosition): boolean {
        return this.trackPosition.equals(other.trackPosition) && this.sectorNumber === other.sectorNumber;
    }
}

/**
 * Byte for filling sector data when reading off the end.
 */
const FILL_BYTE = 0xE5;

/**
 * Info about the CRC of a particular chunk of bytes.
 */
export class CrcInfo {
    /**
     * CRC as written on the floppy.
     */
    public readonly written: number;

    /**
     * CRC as computed from the data.
     */
    public readonly computed: number;

    constructor(written: number, computed: number) {
        this.written = written;
        this.computed = computed;
    }

    public valid(): boolean {
        return this.written === this.computed;
    }
}

/**
 * Info about both sector CRCs (ID and data).
 */
export class SectorCrc {
    /**
     * CRC for the ID data (sector number, etc.).
     */
    public readonly idCrc: CrcInfo;

    /**
     * CRC for the sector data.
     */
    public readonly dataCrc: CrcInfo;

    constructor(idCrc: CrcInfo, dataCrc: CrcInfo) {
        this.idCrc = idCrc;
        this.dataCrc = dataCrc;
    }

    public valid(): boolean {
        return this.idCrc.valid() && this.dataCrc.valid();
    }
}

/**
 * Data from a sector that was read from a disk, except the data.
 */
export class SectorInfo {
    /**
     * Cylinder number, side, and sector number stored in the IDAM.
     */
    public sectorPosition: SectorPosition;

    /**
     * Whether the sector data is invalid. This is indicated on the floppy by having a 0xF8 data
     * address mark (DAM) byte, instead of the normal 0xFB. For JV1 this is set to true for the directory track.
     */
    public deleted = false;

    /**
     * The exact data address mark (0xF8 to 0xFB), if the format records it. Single density has
     * two marks besides normal and deleted, which the Model I's controller can tell apart.
     * Use getDataAddressMark() to read it.
     */
    public dataAddressMark: number | undefined = undefined;

    /**
     * Whether there was a CRC error when reading the physical disk. Sometimes we only have this information
     * without having the actual CRCs.
     */
    public crcError = false;

    /**
     * If available, the written and computed CRCs for the ID and the data.
     */
    public crc: SectorCrc | undefined;

    /**
     * Single or double density.
     */
    public density: Density;

    /**
     * Number of bytes in the sector.
     */
    public sectorSize: number;

    /**
     * Whether a data field (a data address mark and the data) follows the ID field. Some images have
     * IDs whose data mark runs off the end of the track. Formats that store only the sectors that
     * have data always have one.
     */
    public hasDataField = true;

    constructor(sectorPosition: SectorPosition, density: Density, sectorSize: number) {
        this.sectorPosition = sectorPosition;
        this.density = density;
        this.sectorSize = sectorSize;
    }

    /**
     * The data address mark: the exact one if the format records it, otherwise the standard
     * mark for whether the sector is deleted.
     */
    public getDataAddressMark(): number {
        return this.dataAddressMark ?? (this.deleted ? DELETED_DATA_ADDRESS_MARK : DATA_ADDRESS_MARK);
    }

    /**
     * Whether the ID field's CRC is good, or not known to be bad. No controller accepts an ID
     * field whose CRC is bad, and in some images it's data that the imager took for an
     * address mark, with any sector number.
     */
    public hasValidIdCrc(): boolean {
        return this.crc?.idCrc.valid() ?? true;
    }

    /**
     * Whether a data field follows the ID field. See hasDataField.
     */
    public hasData(): boolean {
        return this.hasDataField;
    }
}

/**
 * What laterSectorReplaces() needs to know about a sector.
 */
export interface SectorCopy {
    /**
     * Whether the ID field's CRC is good, or not known to be bad.
     */
    hasValidIdCrc(): boolean;

    /**
     * Whether a data field follows the ID field.
     */
    hasData(): boolean;
}

/**
 * Decides which of two IDs for the same physical sector position the disk keeps. A real controller
 * looking for a sector skips IDs with a bad CRC and finds the one whose data field it can read, but
 * imagers record noise as IDs, and partial re-reads of a sector near the end of a track that have an
 * ID but no data. Neither should hide a good copy. Ranks each copy (good ID CRC counts 2, having
 * data counts 1), and lets the later one replace the earlier one when it ranks at least as high, so
 * that among equals the later one wins.
 *
 * @param earlier the copy already kept.
 * @param later the copy found after it.
 * @return whether the later copy should replace the earlier one.
 */
export function laterSectorReplaces(earlier: SectorCopy, later: SectorCopy): boolean {
    return sectorCopyRank(later) >= sectorCopyRank(earlier);
}

/**
 * How good a copy of a sector is, for laterSectorReplaces().
 */
function sectorCopyRank(sector: SectorCopy): number {
    return (sector.hasValidIdCrc() ? 2 : 0) + (sector.hasData() ? 1 : 0);
}

/**
 * Data from a sector that was read from a disk.
 */
export class SectorData extends SectorInfo {
    /**
     * The sector's data.
     */
    public data: Uint8Array;

    constructor(data: Uint8Array, sectorPosition: SectorPosition, density: Density) {
        super(sectorPosition, density, data.length);
        this.data = data;
    }
}

/**
 * What we know about a track (cylinder/side pair) on a floppy.
 */
export class TrackGeometry {
    public readonly trackPosition: TrackPosition;
    // The lowest and highest sector numbers on the track. These include stray IDs (copy protection
    // sometimes writes a few sectors numbered far outside the track's usual numbering), so they
    // can be much wider than the track's real range. See the core numbers below.
    public readonly firstSectorNumber: number;
    public readonly lastSectorNumber: number;
    // The distinct sector numbers of the sectors with valid ID CRCs, in ascending order.
    public readonly sectorNumbers: number[];
    // The track's own guess at its usual numbering, ignoring stray IDs: the range of the largest
    // cluster of sector numbers.
    public readonly coreFirstSectorNumber: number;
    public readonly coreLastSectorNumber: number;
    public readonly modalDensity: Density;
    public readonly modalSectorSize: number;

    constructor(trackPosition: TrackPosition, firstSectorNumber: number, lastSectorNumber: number,
                sectorNumbers: number[], coreFirstSectorNumber: number, coreLastSectorNumber: number,
                modalDensity: Density, modalSectorSize: number) {

        this.trackPosition = trackPosition;
        this.firstSectorNumber = firstSectorNumber;
        this.lastSectorNumber = lastSectorNumber;
        this.sectorNumbers = sectorNumbers;
        this.coreFirstSectorNumber = coreFirstSectorNumber;
        this.coreLastSectorNumber = coreLastSectorNumber;
        this.modalDensity = modalDensity;
        this.modalSectorSize = modalSectorSize;
    }

    /**
     * Make the geometry of one track from all of its sectors, or return undefined if none of
     * them has a good ID field, which means the track is unformatted and the IDs are noise.
     */
    public static make(sectorInfos: SectorInfo[]): TrackGeometry | undefined {
        if (sectorInfos.length === 0) {
            throw new Error("Must have at least one sector in a track");
        }
        const trackPosition = sectorInfos[0].sectorPosition.trackPosition;
        if (!sectorInfos.every(info => info.sectorPosition.trackPosition.equals(trackPosition))) {
            throw new Error("Sectors of a track must all be on that track");
        }

        // Leave sectors with bad ID fields out of the track's layout.
        const layoutInfos = sectorInfos.filter(info => info.hasValidIdCrc());
        if (layoutInfos.length === 0) {
            return undefined;
        }

        const firstSectorNumber = Math.min(... layoutInfos.map(info => info.sectorPosition.sectorNumber));
        const lastSectorNumber = Math.max(... layoutInfos.map(info => info.sectorPosition.sectorNumber));
        const sectorNumbers = [... new Set(layoutInfos.map(info => info.sectorPosition.sectorNumber))]
            .sort((a, b) => a - b);
        const core = coreSectorRange(sectorNumbers);
        const modalDensity = modeOf(layoutInfos.map(info => info.density)).value;
        const modalSectorSize = modeOf(layoutInfos.map(info => info.sectorSize)).value;

        return new TrackGeometry(trackPosition, firstSectorNumber, lastSectorNumber, sectorNumbers,
            core.firstSectorNumber, core.lastSectorNumber, modalDensity, modalSectorSize);
    }

    public sectorSpan(): number {
        return this.lastSectorNumber - this.firstSectorNumber + 1;
    }

    /**
     * The position of the given sector on this track.
     */
    public sectorPosition(sectorNumber: number): SectorPosition {
        return new SectorPosition(this.trackPosition, sectorNumber);
    }

    /**
     * The position of the lowest-numbered sector on this track, which on the boot track is
     * the boot sector.
     */
    public firstSectorPosition(): SectorPosition {
        return this.sectorPosition(this.firstSectorNumber);
    }

    /**
     * The positions of every sector number from the first to the last. That's the range, not
     * the sectors present: a track can have gaps, so reading some of these may find nothing.
     */
    public sectorPositions(): SectorPosition[] {
        const positions: SectorPosition[] = [];
        for (let sectorNumber = this.firstSectorNumber; sectorNumber <= this.lastSectorNumber; sectorNumber++) {
            positions.push(this.sectorPosition(sectorNumber));
        }
        return positions;
    }

    /**
     * Whether the two tracks are laid out alike (sector range, density, and sector size),
     * wherever they are on the disk.
     */
    public hasSameLayoutAs(other: TrackGeometry): boolean {
        return this.firstSectorNumber === other.firstSectorNumber &&
            this.lastSectorNumber === other.lastSectorNumber &&
            this.modalDensity === other.modalDensity &&
            this.modalSectorSize === other.modalSectorSize;
    }

    // firstSectorNumber, lastSectorNumber
    // sectorCount          // distinct sector numbers actually present
    // sectorSpan           // last - first + 1
    // density, sectorSize  // modal
    // mixedDensity, mixedSize: boolean
    // hasSector(n): boolean
}

/**
 * A set of tracks numbered alike (same density, sector size, and sector range), which the sectors
 * map shows as one table.
 */
export interface SectorNumberGroup {
    /**
     * The sector numbers that each of these tracks is expected to have. A damaged track that lost
     * sectors is in the group whose range contains its own, so that the missing sectors are reported.
     */
    range: SectorNumberRange;
    density: Density;
    sectorSize: number;
    /**
     * The tracks in the group, sorted by cylinder, then side.
     */
    trackPositions: TrackPosition[];
}

/**
 * Options for the floppy decoders.
 */
export interface FloppyDecodeOptions {
    // Whether to reject an image with no readable sectors on cylinder 0 side 0. Set it when
    // guessing the format, since a boot track is part of what tells a disk image from other
    // data. Clear it when the file's extension names the format.
    requireBootTrack: boolean;
}

/**
 * Information about the physical layout of tracks, sides, and sectors on a floppy.
 */
export class FloppyDiskGeometry {
    public readonly cylinderCount: number;
    public readonly sideCount: number;
    public readonly sectorInfos: SectorInfo[];
    // Map from SectorPosition key to SectorInfo.
    public readonly sectorMap = new Map<string,SectorInfo>();
    // Map from TrackPosition key to TrackGeometry.
    public readonly trackMap: Map<string,TrackGeometry>;
    // These include all tracks and all stray IDs, so they can be much wider than any track's
    // usual numbering. See the sector number groups below for displaying tables of sectors.
    public readonly firstSectorNumber: number;
    public readonly lastSectorNumber: number;
    // The tracks grouped by how they're numbered, sorted by each group's first track. Each
    // group's range is what its tracks are expected to have (see getExpectedSectorRange()).
    public readonly sectorNumberGroups: SectorNumberGroup[];
    // Map from TrackPosition key to that track's group.
    private readonly sectorNumberGroupMap = new Map<string,SectorNumberGroup>();
    // Information about the boot track (cylinder 0 side 0). Undefined if nothing on cylinder 0
    // side 0 could be read.
    public readonly bootTrack: TrackGeometry | undefined;
    // Most common values across the side 0 tracks other than the boot track, or of the boot
    // track if it's the only one on side 0 (or of all tracks if there's no boot track and
    // nothing else on side 0).
    public readonly modalDataDensity: Density;
    public readonly modalDataSectorSize: number;
    public readonly modalDataSectorSpan: number;
    // Whether all tracks on side 0 have the same geometry.
    public readonly homogeneous: boolean;
    // Whether cylinder 0 has different density or number of sectors than most other tracks.
    public readonly cylinder0Differs: boolean;

    // hasCylinder(n), getSectorInfo(position)
    // isHomogeneous()           // every track matches dataTrack

    /**
     * Make the geometry of a disk from all of its sectors, or return undefined if no track has
     * a geometry (no sectors anywhere, or only ones with bad ID fields), as with a blank or
     * unformatted disk. A disk with no readable sectors on cylinder 0 side 0 still gets a
     * geometry, with an undefined boot track. Readers that want to reject such disks must check
     * for that themselves.
     */
    public static make(cylinderCount: number, sideCount: number, sectorInfos: SectorInfo[]): FloppyDiskGeometry | undefined {
        // Track position key to list of sectors on that track.
        const trackSectorList = new Map<string,SectorInfo[]>();

        for (const sectorInfo of sectorInfos) {
            const trackKey = sectorInfo.sectorPosition.trackPosition.key();
            let sectorList = trackSectorList.get(trackKey);
            if (sectorList === undefined) {
                sectorList = [];
                trackSectorList.set(trackKey, sectorList);
            }
            sectorList.push(sectorInfo);
        }

        // Map from TrackPosition key to TrackGeometry.
        const trackMap = new Map<string,TrackGeometry>();
        for (const [trackKey, sectors] of trackSectorList.entries()) {
            const trackGeometry = TrackGeometry.make(sectors);
            if (trackGeometry !== undefined) {
                trackMap.set(trackKey, trackGeometry);
            }
        }

        if (trackMap.size === 0) {
            return undefined;
        }

        const bootTrack = trackMap.get(new TrackPosition(0, 0).key());

        return new FloppyDiskGeometry(cylinderCount, sideCount, sectorInfos, trackMap, bootTrack);
    }

    private constructor(cylinderCount: number, sideCount: number, sectorInfos: SectorInfo[],
                        trackMap: Map<string,TrackGeometry>, bootTrack: TrackGeometry | undefined) {

        this.cylinderCount = cylinderCount;
        this.sideCount = sideCount;
        this.sectorInfos = sectorInfos;
        this.trackMap = trackMap;
        this.bootTrack = bootTrack;

        // A later sector with the same position replaces an earlier one unless it's worse (see
        // laterSectorReplaces()). The DMK reader picks the same way.
        for (const sectorInfo of sectorInfos) {
            const key = sectorInfo.sectorPosition.key();
            const existing = this.sectorMap.get(key);
            const replace = existing === undefined || laterSectorReplaces(existing, sectorInfo);
            if (replace) {
                this.sectorMap.set(key, sectorInfo);
            }
        }

        // Every sector belongs to a track, so the min and max over the tracks are the min and max
        // over the whole disk. We have at least one track (make() guarantees it).
        const tracks = [... trackMap.values()];
        this.firstSectorNumber = Math.min(... tracks.map(track => track.firstSectorNumber));
        this.lastSectorNumber = Math.max(... tracks.map(track => track.lastSectorNumber));

        this.sectorNumberGroups = this.computeSectorNumberGroups(tracks);

        // Tracks on side 0, which is where every DOS keeps its system tracks. The modal values
        // below are computed from these, so that a disk whose second side is garbage (or holds a
        // different file system, as MultiDOS disks do) still reports the geometry that matters.
        // Sometimes track 1 is garbage or leftover from a previous format. If the boot track is
        // the only one, use it. If there's no boot track and nothing else on side 0, use all the
        // tracks.
        const otherTracks = tracks.filter(track => track.trackPosition.side === 0 && track !== bootTrack);
        let dataTracks: TrackGeometry[];
        if (otherTracks.length > 0) {
            dataTracks = otherTracks;
        } else if (bootTrack !== undefined) {
            dataTracks = [bootTrack];
        } else {
            dataTracks = tracks;
        }
        this.modalDataDensity = modeOf(dataTracks.map(track => track.modalDensity)).value;
        this.modalDataSectorSize = modeOf(dataTracks.map(track => track.modalSectorSize)).value;
        this.modalDataSectorSpan = modeOf(dataTracks.map(track => track.sectorSpan())).value;
        const referenceTrack = bootTrack ?? dataTracks[0];
        this.homogeneous = dataTracks.every(track => track.hasSameLayoutAs(referenceTrack));
        // Without a boot track we can't tell.
        this.cylinder0Differs = bootTrack !== undefined &&
            (bootTrack.modalDensity !== this.modalDataDensity || bootTrack.sectorSpan() !== this.modalDataSectorSpan);
    }

    /**
     * Groups the tracks by how they're numbered, and fills in sectorNumberGroupMap. Tracks have the
     * same key if they have the same density, sector size, and core sector range (the side doesn't
     * matter). Tracks not on cylinder 0 are handled first, most common key first (ties go to the key
     * with the earliest track). A key joins the first existing group of the same density and sector
     * size whose range contains the key's core range, so that a damaged track that lost sectors is
     * numbered like the others and has them reported as missing. Otherwise it starts a group with
     * its own core range, so a complete track numbered 0-17 among tracks numbered 1-18 isn't
     * reported as missing sector 18. Boot tracks often have their own layout, so tracks on cylinder 0
     * join a group only if it has exactly the same density, sector size, and range.
     *
     * @return the groups, with their tracks sorted by cylinder then side, and themselves sorted by
     * their first track.
     */
    private computeSectorNumberGroups(tracks: TrackGeometry[]): SectorNumberGroup[] {
        // Map from key to the tracks with that key, separately for the other cylinders and for cylinder 0.
        const otherKeys = new Map<string,TrackGeometry[]>();
        const cylinder0Keys = new Map<string,TrackGeometry[]>();
        for (const track of tracks) {
            const key = [track.modalDensity, track.modalSectorSize,
                track.coreFirstSectorNumber, track.coreLastSectorNumber].join(",");
            const keys = track.trackPosition.cylinderNumber === 0 ? cylinder0Keys : otherKeys;
            let keyTracks = keys.get(key);
            if (keyTracks === undefined) {
                keyTracks = [];
                keys.set(key, keyTracks);
            }
            keyTracks.push(track);
        }

        const groups: SectorNumberGroup[] = [];

        // Most common key first, and the earliest track for ties.
        const sortedOtherKeys = [... otherKeys.values()].map(keyTracks =>
            keyTracks.sort((a, b) => compareTrackPositions(a.trackPosition, b.trackPosition)));
        sortedOtherKeys.sort((a, b) => b.length - a.length ||
            compareTrackPositions(a[0].trackPosition, b[0].trackPosition));
        for (const keyTracks of sortedOtherKeys) {
            const core = keyTracks[0];
            const group = groups.find(group =>
                group.density === core.modalDensity &&
                group.sectorSize === core.modalSectorSize &&
                group.range.firstSectorNumber <= core.coreFirstSectorNumber &&
                core.coreLastSectorNumber <= group.range.lastSectorNumber);
            this.addTracksToGroup(groups, group, keyTracks);
        }

        for (const keyTracks of cylinder0Keys.values()) {
            const core = keyTracks[0];
            const group = groups.find(group =>
                group.density === core.modalDensity &&
                group.sectorSize === core.modalSectorSize &&
                group.range.firstSectorNumber === core.coreFirstSectorNumber &&
                group.range.lastSectorNumber === core.coreLastSectorNumber);
            this.addTracksToGroup(groups, group, keyTracks);
        }

        for (const group of groups) {
            group.trackPositions.sort(compareTrackPositions);
        }
        groups.sort((a, b) => compareTrackPositions(a.trackPositions[0], b.trackPositions[0]));

        return groups;
    }

    /**
     * Adds tracks that share a key to a group, or to a new group (with the tracks' core range, which
     * is added to "groups") if "group" is undefined. Records the group of each track.
     */
    private addTracksToGroup(groups: SectorNumberGroup[], group: SectorNumberGroup | undefined,
                             keyTracks: TrackGeometry[]): void {

        if (group === undefined) {
            const track = keyTracks[0];
            group = {
                range: {
                    firstSectorNumber: track.coreFirstSectorNumber,
                    lastSectorNumber: track.coreLastSectorNumber,
                },
                density: track.modalDensity,
                sectorSize: track.modalSectorSize,
                trackPositions: [],
            };
            groups.push(group);
        }

        for (const track of keyTracks) {
            group.trackPositions.push(track.trackPosition);
            this.sectorNumberGroupMap.set(track.trackPosition.key(), group);
        }
    }

    /**
     * The range of sector numbers that the track at the given position is expected to have,
     * ignoring stray IDs, or undefined if getTrack() is. This is the range of the track's sector
     * number group. This is for display only; decoding uses the track's first and last sector numbers.
     */
    public getExpectedSectorRange(trackPosition: TrackPosition): SectorNumberRange | undefined {
        return this.getSectorNumberGroup(trackPosition)?.range;
    }

    /**
     * The group of tracks numbered like the track at the given position, or undefined if getTrack() is.
     */
    public getSectorNumberGroup(trackPosition: TrackPosition): SectorNumberGroup | undefined {
        return this.sectorNumberGroupMap.get(trackPosition.key());
    }

    /**
     * The geometry of the track at the given position, or undefined if the disk has no sectors
     * there with good ID fields.
     */
    public getTrack(trackPosition: TrackPosition): TrackGeometry | undefined {
        return this.trackMap.get(trackPosition.key());
    }
}

/**
 * A track as written by the floppy controller's Write Track (format) command.
 */
export interface FormattedTrack {
    // Physical position of the track.
    trackPosition: TrackPosition;
    // Whether the track was written in double density (MFM).
    doubleDensity: boolean;
    // The bytes as they'd be read back, with the controller's special values replaced
    // by the address marks and CRCs they stand for.
    bytes: Uint8Array;
    // Indices into "bytes" of each sector's ID address mark (its 0xFE byte).
    idamIndices: number[];
    // The sectors in the order they were written. Their positions are what their ID
    // fields say, which needn't match where the track is.
    sectors: SectorData[];
}

/**
 * Represents a write to an underlying disk file.
 */
export class FloppyWrite {
    // Data to be written to the underlying file.
    public readonly data: Uint8Array;

    // Offset into the underlying file.
    public readonly offset: number;

    constructor(data: Uint8Array, offset: number) {
        this.data = data;
        this.offset = offset;
    }
}

/**
 * Abstract class for virtual floppy disk file formats.
 */
export abstract class FloppyDisk extends AbstractTrs80File {
    public readonly onWrite = new SimpleEventDispatcher<FloppyWrite>();
    protected mountedWriteProtected = false;
    // Cache for getBootTrackText(), cleared when the disk is written.
    private bootTrackText: string | undefined = undefined;

    protected constructor(binary: Uint8Array,
                          error: string | undefined,
                          annotations: ProgramAnnotation[]) {

        super(binary, error, annotations);
    }

    /**
     * Get the geometry of the floppy. Subclasses should cache this, it may be called often.
     */
    public abstract getGeometry(): FloppyDiskGeometry;

    /**
     * Whether the file was mounted write-protected, at the request of the user.
     */
    public setMountedWriteProtected(mountedWriteProtected: boolean): void {
        this.mountedWriteProtected = mountedWriteProtected;
    }

    /**
     * This can return true to mean that this file format does not
     * support writing at all (the writeSector() method is not implemented),
     * that it's implemented but the file is virtually write-protected,
     * or that the file was mounted write-protected (the mountedWriteProtected field).
     */
    public isWriteProtected(): boolean {
        // The base class does not support writing.
        return true;
    }

    /**
     * Read a sector at the specified position.
     *
     * @return the sector, or undefined if an error occurs.
     */
    public abstract readSector(sectorPosition: SectorPosition): SectorData | undefined;

    /**
     * Whether readSector() would return the sector, without reading it or logging anything,
     * for checking guesses about where things are on the disk.
     */
    public hasSectorData(sectorPosition: SectorPosition): boolean {
        return this.getGeometry().sectorMap.has(sectorPosition.key());
    }

    /**
     * The contents of the boot track as Latin-1 text, one character per byte, for finding strings that
     * FORMAT wrote there, such as the DOS's name. Sectors that can't be read are skipped. Returns
     * an empty string if there's no boot track.
     */
    public getBootTrackText(): string {
        if (this.bootTrackText === undefined) {
            let text = "";
            const bootTrack = this.getGeometry().bootTrack;
            const sectorPositions = bootTrack === undefined ? [] : bootTrack.sectorPositions();
            for (const sectorPosition of sectorPositions) {
                const data = this.readSector(sectorPosition)?.data;
                if (data !== undefined) {
                    for (const b of data) {
                        text += String.fromCharCode(b);
                    }
                }
            }
            this.bootTrackText = text;
        }

        return this.bootTrackText;
    }

    /**
     * Write a sector to the specified position. Throw an exception
     * if writing is not supported, so check first with isWriteProtected().
     */
    public writeSector(_sectorPosition: SectorPosition, _data: SectorData): void {
        throw new Error(this.className + " does not support writing");
    }

    /**
     * Replace a track with a newly formatted one. Check first with isWriteProtected().
     *
     * @return whether successful. A file format that can't represent the new layout,
     * or can't grow to hold it, returns false and leaves the disk unchanged.
     */
    public formatTrack(_formattedTrack: FormattedTrack): boolean {
        return false;
    }

    /**
     * Pad a sector to its full length.
     */
    protected padSector(data: Uint8Array, sectorSize: number): Uint8Array {
        if (data.length < sectorSize) {
            const newData = new Uint8Array(sectorSize);
            newData.set(data);
            newData.fill(FILL_BYTE, data.length);
            data = newData;
        }

        return data;
    }

    /**
     * Modify the underlying file and the in-memory binary.
     */
    protected write(floppyWrite: FloppyWrite): void {
        this.binary.set(floppyWrite.data, floppyWrite.offset);
        this.bootTrackText = undefined;
        this.onWrite.dispatch(floppyWrite);
    }
}
