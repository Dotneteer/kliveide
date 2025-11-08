import type { DiskInformation, SectorInformation } from "./DiskInformation";
import { FloppyDiskFormat } from "@emuabstr/FloppyDiskFormat";
import { BinaryReader } from "@common/utils/BinaryReader";

/**
 * Reads disk information from the specified disk contents
 * @param contents Binary disk contents to parse
 * @returns Disk information
 */
export function readDiskData (contents: Uint8Array): DiskInformation {
  return readDsk(contents);
}

// --- Headers used in a DSK file
const DSK_NORMAL_DISK_HEADER = "MV - CPC"; // --- from 0x00-0x16, 23 bytes
const DSK_EXTENDED_DISK_HEADER = "EXTENDED CPC"; // --- from 0x00-0x16, 23 bytes
const DSK_ADDITIONAL_HEADER = "Disk-Info\r\n"; // --- from 0x17-0x21, 11 bytes
const DSK_TRACK_HEADER = "Track-Info\r\n"; // --- from 0x00-0x0b, 12 bytes
const DSK_START_DISK_TRACK_POINTER = 0x100;
const DSK_START_DISK_SECTOR_POINTER = 0x100;
const DSK_SECTOR_HEADER_SIZE = 8;
const DSK_TRACK_HEADER_SIZE = 24;

// --- Read .DSK contents
function readDsk (contents: Uint8Array): DiskInformation {
  const reader = new BinaryReader(contents);

  // --- Read the disk header
  // --- Read the disk information block
  const header = reader.readBytes(23);

  // --- Compare with normal disk header
  let diskFormat = FloppyDiskFormat.Cpc;
  if (!compareHeader(header, DSK_NORMAL_DISK_HEADER)) {
    // --- Compare with extended disk header

    if (!compareHeader(header, DSK_EXTENDED_DISK_HEADER)) {
      throw new Error(`Not a valid DSK format`);
    }
    diskFormat = FloppyDiskFormat.CpcExtended;
  }

  // --- Check header suffix
  const headerSuffix = reader.readBytes(11);

  // --- Compare with normal disk header
  if (!compareHeader(headerSuffix, DSK_ADDITIONAL_HEADER)) {
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

  // --- Read the disk geometry
  const numberOfTracks = reader.readByte();
  const numberOfSides = reader.readByte();
  const trackSize = reader.readUint16();
  const trackSizes: number[] = [];
  if (diskFormat === FloppyDiskFormat.CpcExtended) {
    const msbBytes = reader.readBytes(204);
    for (let i = 0; i < numberOfTracks * numberOfSides; i++) {
      trackSizes[i] =
        diskFormat === FloppyDiskFormat.CpcExtended
          ? msbBytes[i] << 8
          : trackSize;
    }
  } else {
    for (let i = 0; i < numberOfTracks * numberOfSides; i++) {
      trackSizes[i] = trackSize;
    }
  }

  // --- Now, we have the disk header.
  const diskInformation: DiskInformation = {
    diskFormat,
    creator: diskCreator,
    numTracks: numberOfTracks,
    numSides: numberOfSides,
    tracks: []
  };

  // --- Check disk geometry
  if (numberOfSides > 2) {
    throw new Error("Disk image cannot have more than two sides.");
  } else if (numberOfTracks > 42) {
    throw new Error(
      "Disk image file could not be parsed. This is incompatible with the +3 disk drive format (up to 42 tracks in one side)"
    );
  }

  // --- Iterate through tracks
  for (
    let trackIndex = 0;
    trackIndex < numberOfTracks * numberOfSides;
    trackIndex++
  ) {
    // --- Check for unformatted track
    if (trackSizes[trackIndex] === 0) {
      diskInformation.tracks.push({
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

      // --- Unformatted track, no more information to read
      continue;
    }

    // --- Read the track header of a formatted track
    reader.seek(getTrackPosition(trackIndex));
    const trackHeader = reader.readBytes(12);
    if (!compareHeader(trackHeader, DSK_TRACK_HEADER)) {
      throw new Error("Invalid DSK track header");
    }

    // --- Skip unused bytes
    reader.readBytes(4);

    // --- Read and store the track information
    diskInformation.tracks.push({
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
    });

    // ---- Iterate through the sectors of the track
    for (
      let sectorIndex = 0;
      sectorIndex < diskInformation.tracks[trackIndex].sectorCount;
      sectorIndex++
    ) {
      // --- Point to the beginning of the sector header
      const sectorPointer =
        getTrackPosition(trackIndex) +
        DSK_TRACK_HEADER_SIZE +
        sectorIndex * DSK_SECTOR_HEADER_SIZE;
      let sectorSize: number;

      // --- Obtain sector size information
      if (diskFormat === FloppyDiskFormat.Cpc) {
        // --- Get sector size for the CPC format
        reader.seek(sectorPointer + 3);
        const size = reader.readByte();

        if (size === 0 || size > 6) {
          sectorSize = trackSizes[trackIndex];
        } else if (size === 6) {
          sectorSize = 0x1800;
        } else {
          sectorSize = 0x80 << size;
        }
      } else {
        // --- Get sector size for the Extended CPC format
        reader.seek(sectorPointer + 6);
        sectorSize = reader.readUint16();
      }

      // --- Go back to the beginning of the sector header and read sector header
      reader.seek(sectorPointer);
      const sectorDataPosition = getSectorDataPosition(trackIndex, sectorIndex);
      const sector: SectorInformation = {
        C: reader.readByte(),
        H: reader.readByte(),
        R: reader.readByte(),
        N: reader.readByte(),
        SR1: reader.readByte(),
        SR2: reader.readByte(),
        actualLength: sectorSize,
        sectorData: new Uint8Array(sectorSize),
        sectorDataPosition
      };

      // --- Test if the format has multiple weak sector
      let multipleWeakSectors = false;
      if (diskFormat === FloppyDiskFormat.CpcExtended) {
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
      reader.seek(sectorDataPosition);
      const sectorData = reader.readBytes(sector.actualLength);
      for (let i = 0; i < sector.actualLength; i++) {
        sector.sectorData[i] = sectorData[i];
      }

      diskInformation.tracks[trackIndex].sectors.push(sector);
    }
  }

  // --- Done.
  return diskInformation;

  // --- Gets the stream index to the beginning of the specified track's data
  function getTrackPosition (trackIndex: number): number {
    return (
      DSK_START_DISK_TRACK_POINTER +
      (trackIndex
        ? trackSizes.slice(0, trackIndex).reduce((a, b) => a + b, 0)
        : 0)
    );
  }

  // --- Gets the stream index that points to the beginning of the specified sector's data
  function getSectorDataPosition (
    trackIndex: number,
    sectorIndex: number
  ): number {
    const startSectorPointer =
      DSK_START_DISK_SECTOR_POINTER +
      (sectorIndex == 0
        ? 0
        : diskInformation.tracks[trackIndex].sectors
            .slice(0, sectorIndex)
            .map(item => item.actualLength)
            .reduce((a, b) => a + b, 0));
    return getTrackPosition(trackIndex) + startSectorPointer;
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
