import { BinaryReader } from "@common/utils/BinaryReader";

const NORMAL_DISK_HEADER = "MV - CPCEMU Disk-File\r\n"; // --- from 0x00-0x16, 23 bytes
const EXTENDED_DISK_HEADER = "EXTENDED CPC DSK File\r\n"; // --- from 0x00-0x16, 23 bytes
const ADDITIONAL_HEADER = "Disk-Info\r\n"; // --- from 0x17-0x21, 11 bytes
const TRACK_HEADER = "Track-Info\r\n"; // --- from 0x00-0x0b, 12 bytes

/**
 * This class represents the contents of a disk file stored in DSK format (normal or extended)
 */
export class DiskContents {
  isExtendedFormat = false;
  diskInformation: DiskInformationBlock;
  tracks: TrackInfo[];

  /**
   * Initializes the contents from the specified reader, if specified
   * @param reader
   */
  constructor (reader?: BinaryReader) {
    if (reader) {
      this.readContents(reader);
    }
  }

  readContents (reader: BinaryReader) {
    // --- Read the disk information block
    const header = reader.readBytes(23);

    // --- Compare with normal disk header
    this.isExtendedFormat = false;
    if (!compareHeader(header, NORMAL_DISK_HEADER)) {
      // --- Compare with extended disk header

      if (!compareHeader(header, EXTENDED_DISK_HEADER)) {
        throw new Error(`Not a valid DSK format`);
      }
      this.isExtendedFormat = true;
    }

    // --- Check header suffix
    const headerSuffix = reader.readBytes(11);

    // --- Compare with normal disk header
    if (!compareHeader(headerSuffix, ADDITIONAL_HEADER)) {
      throw new Error(`Invalid DSK header`);
    }

    // --- Read the disk information
    const creator = reader.readBytes(14);
    this.diskInformation = { creatorName: "", numOfTracks: 0, numOfSides: 0 };
    for (let i = 0; i < creator.length; i++) {
      if (creator[i]) {
        this.diskInformation.creatorName += String.fromCharCode(creator[i]);
      }
    }

    this.diskInformation.numOfTracks = reader.readByte();
    this.diskInformation.numOfSides = reader.readByte();
    this.diskInformation.trackSize = reader.readUint16();
    this.diskInformation.trackMsbs = new Uint8Array(0);
    const msbBytes = reader.readBytes(204);
    if (this.isExtendedFormat) {
      this.diskInformation.trackSize = 0;
      this.diskInformation.trackMsbs = new Uint8Array(204);
      for (let i = 0; i < msbBytes.length; i++) {
        this.diskInformation.trackMsbs[i] = msbBytes[i];
      }
    }

    // --- Read track data one-by-one
    this.tracks = [];
    for (let i = 0; i < this.diskInformation.numOfTracks; i++) {
      if (reader.eof) {
        // --- We have tracks and sectors with empty data
        break;
      }

      // --- Get the track header information
      const trackInfo: TrackInfo = {
        trackNo: 0,
        sideNo: 0,
        sectorSize: 0,
        numOfSectors: 0,
        gap3Length: 0,
        sectorInfo: []
      };
      const trackHeader = reader.readBytes(12);
      if (!compareHeader(trackHeader, TRACK_HEADER)) {
        throw new Error(`Invalid DSK track header (#${i})`);
      }

      reader.readBytes(4);
      trackInfo.trackNo = reader.readByte();
      trackInfo.sideNo = reader.readByte();
      reader.readUint16();
      trackInfo.sectorSize = reader.readByte();
      trackInfo.numOfSectors = reader.readByte();
      trackInfo.gap3Length = reader.readByte();
      reader.readByte();
      this.tracks.push(trackInfo);

      // --- Read sector information (one-by-one)
      for (let j = 0; j < trackInfo.numOfSectors; j++) {
        const sectorInfo: SectorInfo = {
          track: reader.readByte(),
          side: reader.readByte(),
          sector: reader.readByte(),
          sectorSize: reader.readByte(),
          fdcStat1: reader.readByte(),
          fdcStat2: reader.readByte(),
          dataLength: reader.readUint16()
        };
        sectorInfo.data = new Uint8Array(
          this.isExtendedFormat
            ? sectorInfo.dataLength
            : 0x80 << trackInfo.sectorSize
        );
        trackInfo.sectorInfo.push(sectorInfo);
      }

      // --- Navigate to the next 0x100 boundary
      if ((reader.position & 0xff) !== 0) {
        reader.seek((reader.position + 0x100) & 0xffff_ff00);
      }

      // --- Read sector data one-by-one
      for (let j = 0; j < trackInfo.numOfSectors; j++) {
        if (reader.eof) {
          for (let k = 0; k < trackInfo.sectorInfo[j].data.length; k++) {
            trackInfo.sectorInfo[j].data[k] = 0xe5;
          }
        } else {
          const sectorData = reader.readBytes(
            trackInfo.sectorInfo[j].data.length
          );
          for (let k = 0; k < sectorData.length; k++) {
            trackInfo.sectorInfo[j].data[k] = sectorData[k];
          }
        }
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
  }
}

/**
 * Represents the disk information block according to DSK format specification
 */
type DiskInformationBlock = {
  // --- The name of the creator (up to 14 bytes)
  creatorName: string;

  // --- Number of tracks
  numOfTracks: number;

  // --- Number of sides
  numOfSides: number;

  // --- Track size, only for normal format
  trackSize?: number;

  // --- Track size MSBs, only for extended format
  trackMsbs?: Uint8Array;
};

type TrackInfo = {
  trackNo: number;
  sideNo: number;
  sectorSize: number;
  numOfSectors: number;
  gap3Length: number;
  sectorInfo: SectorInfo[];
};

type SectorInfo = {
  track: number;
  side: number;
  sector: number;
  sectorSize: number;
  fdcStat1: number;
  fdcStat2: number;
  dataLength?: number;
  data?: Uint8Array;
};
