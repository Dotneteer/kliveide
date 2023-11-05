import { BinaryReader } from "@common/utils/BinaryReader";
import { FloppyDiskFormat } from "./FloppyDisk";

// --- Headers used in a DSK file
const NORMAL_DISK_HEADER = "MV - CPCEMU Disk-File\r\n"; // --- from 0x00-0x16, 23 bytes
const EXTENDED_DISK_HEADER = "EXTENDED CPC DSK File\r\n"; // --- from 0x00-0x16, 23 bytes
const ADDITIONAL_HEADER = "Disk-Info\r\n"; // --- from 0x17-0x21, 11 bytes
const TRACK_HEADER = "Track-Info\r\n"; // --- from 0x00-0x0b, 12 bytes

// --- Constant values used for disk file index calculations
const SECTOR_HEADER_SIZE = 8;
const TRACK_HEADER_SIZE = 24;
const START_DISK_TRACK_POINTER = 0x100;
const StartDiskSectorPointer = 0x100;

// --- This class describes a logical floppy disk
export class DskDiskReader {
  // --- Initialize this disk contents from the specified stream
  constructor (public readonly contents: Uint8Array) {
    const reader = new BinaryReader(contents);
    this.readDiskHeader(reader);
    this.readDiskData(reader);
  }

  // --- Disk format
  diskFormat: FloppyDiskFormat;

  // --- Disk information header
  header: DiskHeader;

  // --- Tracks
  tracks: TrackHeader[];

  // --- Gets the stream index to the beginning of the specified track's data
  private getTrackPointer (trackIndex: number): number {
    return (
      START_DISK_TRACK_POINTER +
      (trackIndex === 0
        ? 0
        : this.header.trackSizes
            .slice(0, trackIndex)
            .reduce((a, b) => a + b, 0))
    );
  }

  // --- Gets the stream index that points to the beginning of the specified sector's data
  private getSectorDataPointer (
    trackIndex: number,
    sectorIndex: number
  ): number {
    const startSectorPointer =
      StartDiskSectorPointer +
      (sectorIndex == 0
        ? 0
        : this.tracks[trackIndex].sectors
            .slice(0, sectorIndex)
            .map(item => item.actualDataLength)
            .reduce((a, b) => a + b, 0));
    const startTrackPointer = this.getTrackPointer(trackIndex);

    return startTrackPointer + startSectorPointer;
  }

  // --- Read out the disk header
  private readDiskHeader (reader: BinaryReader): void {
    // --- Read the disk information block
    const header = reader.readBytes(23);

    // --- Compare with normal disk header
    this.diskFormat = FloppyDiskFormat.Cpc;
    if (!compareHeader(header, NORMAL_DISK_HEADER)) {
      // --- Compare with extended disk header

      if (!compareHeader(header, EXTENDED_DISK_HEADER)) {
        throw new Error(`Not a valid DSK format`);
      }
      this.diskFormat = FloppyDiskFormat.CpcExtended;
    }

    // --- Check header suffix
    const headerSuffix = reader.readBytes(11);

    // --- Compare with normal disk header
    if (!compareHeader(headerSuffix, ADDITIONAL_HEADER)) {
      throw new Error(`Invalid DSK header`);
    }

    // --- Read the disk information
    const creator = reader.readBytes(14);
    let diskCreator = "";
    for (let i = 0; i < creator.length; i++) {
      if (creator[i]) {
        diskCreator += String.fromCharCode(creator[i]);
      }
    }

    const numberOfTracks = reader.readByte();
    const numberOfSides = reader.readByte();
    const trackSize = reader.readUint16();
    const trackSizes = [];
    const msbBytes = reader.readBytes(204);
    for (let i = 0; i < numberOfTracks * numberOfSides; i++) {
      trackSizes[i] =
        this.diskFormat === FloppyDiskFormat.CpcExtended
          ? msbBytes[i] << 8
          : trackSize;
    }

    // --- Done
    this.header = {
      creator: diskCreator,
      numTracks: numberOfTracks,
      numSides: numberOfSides,
      trackSizes: trackSizes
    };
  }

  // --- Read the disk data from the specified stream
  private readDiskData (reader: BinaryReader): void {
    this.tracks = [];

    if (this.header.numSides > 1) {
      throw new Error(
        "Disk image contains multiple sides, this is currently not supported"
      );
    } else if (this.header.numTracks > 42) {
      throw new Error(
        "Disk image file could not be parsed. This is incompatible with the +3 disk drive format (up to 42 tracks in one side)"
      );
    }

    this.readTracks(reader);
  }

  // --- Reads the track header from the specified position of the stream
  private readTrackHeader (
    reader: BinaryReader,
    trackPointer: number
  ): TrackHeader {
    reader.seek(trackPointer);
    const trackHeader = reader.readBytes(12);
    if (!compareHeader(trackHeader, TRACK_HEADER)) {
      throw new Error("Invalid DSK track header");
    }

    reader.readBytes(4);
    const trackNumber = reader.readByte();
    const sideNumber = reader.readByte();
    reader.readUint16();
    const sectorSize = reader.readByte();
    const numberOfSectors = reader.readByte();
    const gap3Length = reader.readByte();
    const filler = reader.readByte();
    return {
      trackNo: trackNumber,
      sideNo: sideNumber,
      sectorSize: sectorSize,
      numSectors: numberOfSectors,
      gap3Length: gap3Length,
      filler,
      sectors: []
    };
  }

  // --- Read all track's data from the stream
  private readTracks (reader: BinaryReader): void {
    // parse each track
    for (
      let trackIndex = 0;
      trackIndex < this.header.numTracks * this.header.numSides;
      trackIndex++
    ) {
      // check for unformatted track
      if (this.header.trackSizes[trackIndex] === 0) {
        this.tracks.push({
          trackNo: 0,
          sideNo: 0,
          sectorSize: 0,
          numSectors: 0,
          gap3Length: 0,
          filler: 0,
          sectors: []
        });
        continue;
      }

      let trackPointer = this.getTrackPointer(trackIndex);

      this.tracks.push(this.readTrackHeader(reader, trackPointer));

      // ---- Add sectors
      for (
        let sectorIndex = 0;
        sectorIndex < this.tracks[trackIndex].numSectors;
        sectorIndex++
      ) {
        this.tracks[trackIndex].sectors.push(
          this.readSector(reader, trackIndex, sectorIndex)
        );
      }
    }
  }

  // --- Reads the specified sector's data from the stream
  private readSector (
    reader: BinaryReader,
    trackIndex: number,
    sectorIndex: number
  ): Sector {
    const sectorPointer =
      this.getTrackPointer(trackIndex) +
      TRACK_HEADER_SIZE +
      sectorIndex * SECTOR_HEADER_SIZE;
    let sectorSize: number;

    if (this.diskFormat === FloppyDiskFormat.Cpc) {
      reader.seek(sectorPointer + 3);
      const size = reader.readByte();

      if (size === 0 || size > 6) {
        sectorSize = this.header.trackSizes[trackIndex];
      } else if (size === 6) {
        sectorSize = 0x1800;
      } else {
        sectorSize = 0x80 << sectorSize;
      }
    } else {
      reader.seek(sectorPointer + 6);
      sectorSize = reader.readUint16();
    }

    const sector = new Sector();
    reader.seek(sectorPointer);
    sector.trackNo = reader.readByte();
    sector.sideNo = reader.readByte();
    sector.sectorId = reader.readByte();
    sector.sectorSize = reader.readByte();
    sector.fdcStatus1 = reader.readByte();
    sector.fdcStatus2 = reader.readByte();
    sector.actualDataLength = sectorSize;
    sector.sectorData = new Uint8Array(sectorSize);

    // --- Test if the format has multiple weak sector
    let multipleWeakSectors = false;
    if (this.diskFormat === FloppyDiskFormat.CpcExtended) {
      // check for multiple weak/random sectors stored
      if (sectorSize <= 7) {
        // sectorsize n=8 is equivilent to n=0 - FDC will use DTL for length
        let specifiedSize = 0x80 << sectorSize;

        if (specifiedSize < sector.actualDataLength) {
          // more data stored than sectorsize defines
          // check for multiple weak/random copies
          if (sector.actualDataLength % specifiedSize != 0) {
            multipleWeakSectors = true;
          }
        }
      }
    }

    sector.containsMultipleWeakSectors = multipleWeakSectors;

    // --- Copy the data
    const sectorDataPointer = this.getSectorDataPointer(
      trackIndex,
      sectorIndex
    );
    reader.seek(sectorDataPointer);
    const sectorData = reader.readBytes(sector.actualDataLength);
    for (let i = 0; i < sector.actualDataLength; i++) {
      sector.sectorData[i] = sectorData[i];
    }

    return sector;
  }
}

// --- Describes the disk header information
export type DiskHeader = {
  creator: string;
  numTracks: number;
  numSides: number;
  trackSizes: number[];
};

// --- Describes a track header
export type TrackHeader = {
  trackNo: number;
  sideNo: number;
  sectorSize: number;
  numSectors: number;
  gap3Length: number;
  filler: number;
  sectors: Sector[];
};

// --- Describes a sector and provides a few sector operations
export class Sector {
  trackNo: number;
  sideNo: number;
  sectorId: number;
  sectorSize: number;
  fdcStatus1: number;
  fdcStatus2: number;
  actualDataLength: number;
  sectorData: Uint8Array;
  containsMultipleWeakSectors: boolean;

  weakReadIndex = 0;

  sectorReadCompleted (): void {
    if (this.containsMultipleWeakSectors) {
      this.weakReadIndex++;
    }
  }

  get actualData (): Uint8Array {
    if (!this.containsMultipleWeakSectors) {
      // check whether filler bytes are needed
      let size = 0x80 << this.sectorSize;
      if (size > this.actualDataLength) {
        let result = new Uint8Array(size);
        for (let i = 0; i < this.actualDataLength; i++) {
          result[i] = this.sectorData[i];
        }
        const lastValue = this.sectorData[this.sectorData.length - 1];
        for (let i = 0; i < size - this.actualDataLength; i++) {
          result[i + this.actualDataLength] = lastValue;
        }
        return result;
      }
      return this.sectorData;
    }
    // weak read neccessary
    let copies = this.actualDataLength / (0x80 << this.sectorSize);

    // handle index wrap-around
    if (this.weakReadIndex > copies - 1) {
      this.weakReadIndex = copies - 1;
    }

    // get the sector data based on the current weakreadindex
    const step = this.weakReadIndex * (0x80 << this.sectorSize);
    let res = new Uint8Array(0x80 << this.sectorSize);
    for (let i = 0; i < 0x80 << this.sectorSize; i++) {
      res[i] = this.sectorData[i + step];
    }
    return res;
  }
}

function compareHeader (input: number[], header: string): boolean {
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== header.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}
