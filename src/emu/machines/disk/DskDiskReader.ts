import { BinaryReader } from "@common/utils/BinaryReader";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";

// --- Headers used in a DSK file
const NORMAL_DISK_HEADER = "MV - CPC"; // --- from 0x00-0x16, 23 bytes
const EXTENDED_DISK_HEADER = "EXTENDED CPC"; // --- from 0x00-0x16, 23 bytes
const ADDITIONAL_HEADER = "Disk-Info\r\n"; // --- from 0x17-0x21, 11 bytes
const TRACK_HEADER = "Track-Info\r\n"; // --- from 0x00-0x0b, 12 bytes

const START_DISK_TRACK_POINTER = 0x100;
const START_DISK_SECTOR_POINTER = 0x100;
const SECTOR_HEADER_SIZE = 8;
const TRACK_HEADER_SIZE = 24;

// --- Describes the DSK disk information
export type DskDiskInformationBlock = {
  creator: string;
  numTracks: number;
  numSides: number;
  trackSizes: number[];
};

// --- Describes the DSK track information
export type DskTrackInformationBlock = {
  unformatted: boolean;
  trackNumber: number;
  sideNumber: number;
  dataRate: number;
  recordingMode: number;
  sectorSize: number;
  sectorCount: number;
  gap3: number;
  filler: number;
  sectors: DskSectorInformationBlock[];
};

// --- Describes the DSK sector information
export type DskSectorInformationBlock = {
  C: number;
  H: number;
  R: number;
  N: number;
  SR1: number;
  SR2: number;
  actualLength: number;
  sectorData: Uint8Array;
  multipleWeakSectors?: boolean;
};

// --- DSK Disk information
export class DskDiskReader {
  diskFormat: FloppyDiskFormat;
  header: DskDiskInformationBlock;
  tracks: DskTrackInformationBlock[];

  // --- Initialize this disk contents from the specified stream
  constructor (public readonly contents: Uint8Array) {
    const reader = new BinaryReader(contents);
    this.readDiskHeader(reader);
    this.readDiskData(reader);
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
    if (this.diskFormat === FloppyDiskFormat.CpcExtended) {
      const msbBytes = reader.readBytes(204);
      for (let i = 0; i < numberOfTracks * numberOfSides; i++) {
        trackSizes[i] =
          this.diskFormat === FloppyDiskFormat.CpcExtended
            ? msbBytes[i] << 8
            : trackSize;
      }
    } else {
      for (let i = 0; i < numberOfTracks * numberOfSides; i++) {
        trackSizes[i] = trackSize;
      }
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

    if (this.header.numSides > 2) {
      throw new Error("Disk image cannot have more than two sides.");
    } else if (this.header.numTracks > 42) {
      throw new Error(
        "Disk image file could not be parsed. This is incompatible with the +3 disk drive format (up to 42 tracks in one side)"
      );
    }
    this.readTracks(reader);
  }

  // --- Read all track's data from the stream
  private readTracks (reader: BinaryReader): void {
    // -- Parse each track
    for (
      let trackIndex = 0;
      trackIndex < this.header.numTracks * this.header.numSides;
      trackIndex++
    ) {
      // --- Check for unformatted track
      if (this.header.trackSizes[trackIndex] === 0) {
        this.tracks.push({
          unformatted: true,
          trackNumber: 0,
          sideNumber: 0,
          dataRate: 0,
          recordingMode: 0,
          sectorSize: 0,
          sectorCount: 0,
          gap3: 0,
          filler: 0,
          sectors: []
        });
        continue;
      }

      this.tracks.push(
        this.readTrackHeader(reader, this.getTrackPointer(trackIndex))
      );

      // ---- Add sectors
      for (
        let sectorIndex = 0;
        sectorIndex < this.tracks[trackIndex].sectorCount;
        sectorIndex++
      ) {
        this.tracks[trackIndex].sectors.push(
          this.readSector(reader, trackIndex, sectorIndex)
        );
      }
    }
  }

  // --- Reads the track header from the specified position of the stream
  private readTrackHeader (
    reader: BinaryReader,
    trackPointer: number
  ): DskTrackInformationBlock {
    reader.seek(trackPointer);
    const trackHeader = reader.readBytes(12);
    if (!compareHeader(trackHeader, TRACK_HEADER)) {
      throw new Error("Invalid DSK track header");
    }

    // --- Skip unused bytes
    reader.readBytes(4);

    // --- Read and retrieve the track information
    return {
      unformatted: false,
      trackNumber: reader.readByte(),
      sideNumber: reader.readByte(),
      dataRate: reader.readByte(),
      recordingMode: reader.readByte(),
      sectorSize: reader.readByte(),
      sectorCount: reader.readByte(),
      gap3: reader.readByte(),
      filler: reader.readByte(),
      sectors: []
    };
  }

  // --- Reads the specified sector's data from the stream
  private readSector (
    reader: BinaryReader,
    trackIndex: number,
    sectorIndex: number
  ): DskSectorInformationBlock {
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
        sectorSize = 0x80 << size;
      }
    } else {
      reader.seek(sectorPointer + 6);
      sectorSize = reader.readUint16();
    }

    reader.seek(sectorPointer);
    const sector: DskSectorInformationBlock = {
      C: reader.readByte(),
      H: reader.readByte(),
      R: reader.readByte(),
      N: reader.readByte(),
      SR1: reader.readByte(),
      SR2: reader.readByte(),
      actualLength: sectorSize,
      sectorData: new Uint8Array(sectorSize)
    };

    // --- Test if the format has multiple weak sector
    let multipleWeakSectors = false;
    if (this.diskFormat === FloppyDiskFormat.CpcExtended) {
      // --- Check for multiple weak/random sectors stored
      if (sectorSize <= 7) {
        // --- sectorSize n=8 is equivilent to n=0 - FDC will use DTL for length
        const specifiedSize = 0x80 << sectorSize;
        if (specifiedSize < sector.actualLength) {
          // --- More data stored than sectorsize defines
          // --- Check for multiple weak/random copies
          if (sector.actualLength % specifiedSize != 0) {
            multipleWeakSectors = true;
          }
        }
      }
    }

    sector.multipleWeakSectors = multipleWeakSectors;

    // --- Copy the data
    const sectorDataPointer = this.getSectorDataPointer(
      trackIndex,
      sectorIndex
    );
    reader.seek(sectorDataPointer);
    const sectorData = reader.readBytes(sector.actualLength);
    for (let i = 0; i < sector.actualLength; i++) {
      sector.sectorData[i] = sectorData[i];
    }

    return sector;
  }

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
      START_DISK_SECTOR_POINTER +
      (sectorIndex == 0
        ? 0
        : this.tracks[trackIndex].sectors
            .slice(0, sectorIndex)
            .map(item => item.actualLength)
            .reduce((a, b) => a + b, 0));
    const startTrackPointer = this.getTrackPointer(trackIndex);

    return startTrackPointer + startSectorPointer;
  }
}

// --- Compares the specified input with the header
function compareHeader (input: number[], header: string): boolean {
  for (let i = 0; i < header.length; i++) {
    if (input[i] !== header.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}
