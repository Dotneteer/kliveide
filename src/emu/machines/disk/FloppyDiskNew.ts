import { IFloppyDisk } from "@emu/abstractions/IFloppyDisk";
import { DiskError } from "@emu/abstractions/DiskError";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { DiskDensity } from "@emu/abstractions/DiskDensity";
import { BufferSpan } from "./BufferSpan";
import { DiskTrackInfo } from "@emu/abstractions/DiskTrackInfo";

// --- Headers used in a DSK file
const NORMAL_DISK_HEADER = "MV - CPCEMU Disk-File\r\n"; // --- from 0x00-0x16, 23 bytes
const EXTENDED_DISK_HEADER = "EXTENDED CPC DSK File\r\n"; // --- from 0x00-0x16, 23 bytes

// --- GAP structure indexes
const GAP_MINIMAL_FM = 0;
const GAP_MINIMAL_MFM = 1;

export class FloppyDisk implements IFloppyDisk {
  // --- Initialize this disk contents from the specified stream
  constructor (public readonly diskData: Uint8Array) {
    this.openDsk(diskData);
  }

  // --- Disk format
  diskFormat: FloppyDiskFormat;

  // --- The disk's representation in a .DSK file
  diskFileData: Uint8Array;

  // --- Binary disk data (physical surface)
  data: Uint8Array;

  // --- The number of physical sides
  sides: number;

  // --- Number of tracks per side
  tracksPerSide: number;

  // --- Number of bytes per track
  bytesPerTrack: number;

  // --- Signs whether is write-protect tab on the disk
  readonly isWriteProtected: boolean;

  // --- Has the disk data changed?
  dirty: boolean;

  // --- Disk status
  status: DiskError;

  // --- Disk density
  density: DiskDensity;

  // --- The disk contains week sectors
  hasWeakSectors: boolean;

  // --- Track length
  trackLength: number;

  // --- Buffer to track data
  trackData: BufferSpan;

  // --- Buffer to clock data
  clockData: BufferSpan;

  // --- Buffer to MF/MFM mark bits
  fmData: BufferSpan;

  // --- Buffer to weak mark bits/weak data
  weakData: BufferSpan;

  // --- Interim index position while processing disk data
  indexPos: number;

  // --- Extra physical info about a track
  trackInfo: DiskTrackInfo[];

  // --- Sets the index structures to the specified track index
  setTrackIndex (trackNo: number): void {
    this.trackData = new BufferSpan(
      this.data,
      trackNo * this.trackLength,
      this.trackLength
    );
    // this.clockData = new BufferSpan(this.data, this.bytesPerTrack, 3);
    // this.fmData = new BufferWithPosition(
    //   this.data,
    //   this.clockData.index + Math.ceil(this.bytesPerTrack / 8)
    // );
    // this.weakData = new BufferWithPosition(
    //   this.data,
    //   this.fmData.index + Math.ceil(this.bytesPerTrack / 8)
    // );
  }

  /**
   * Open the .DSK data and convert it to surface data
   * @param diskData .DSK data
   * @returns Disk status after processing the data
   */
  private openDsk (diskData: Uint8Array): DiskError {
    // --- Span for the entire .DSK file
    let buffer = new BufferSpan(diskData, 0, diskData.length);

    // --- Set the disk format according to its header
    if (compareData(0, NORMAL_DISK_HEADER)) {
      this.diskFormat = FloppyDiskFormat.Cpc;
    } else if (compareData(0, EXTENDED_DISK_HEADER)) {
      this.diskFormat = FloppyDiskFormat.CpcExtended;
    } else {
      return DiskError.UNSUPPORTED;
    }

    // --- Obtain geometry parameters
    this.tracksPerSide = buffer.get(0x30);
    this.sides = buffer.get(0x31);
    if (
      this.sides < 1 ||
      this.sides > 2 ||
      this.tracksPerSide < 1 ||
      this.tracksPerSide > 85
    ) {
      // --- Abort, this geometry does not work
      return (this.status = DiskError.GEOMETRY_ISSUE);
    }

    // --- Move to track data
    buffer = new BufferSpan(diskData, 256, diskData.length - 256);

    // --- First scan for the longest track
    let maxBytesPerTrack = 0;
    let gapType = 0;
    for (let i = 0; i < this.sides * this.tracksPerSide; i++) {
      // --- Ignore Sector Offset block
      if (buffer.length >= 12 && !compareData(0, "Track-Info\r\n")) {
        return (this.status = DiskError.MISSING_TRACK_INFO);
      }

      // --- Sometimes in the header there are more track than in the file
      if (buffer.length === 0) {
        break;
      }

      // --- Is the current data valid track information?
      if (buffer.length < 256 || !compareData(0, "Track-Info")) {
        // --- Track header does not match
        return (this.status = DiskError.MISSING_TRACK_INFO);
      }

      // --- Yes, obtain the currently used gap information
      gapType = buffer.get(0x16) === 0xff ? GAP_MINIMAL_FM : GAP_MINIMAL_MFM;

      // --- Start calculating length
      let trlen = 0;

      // --- Get track index from the file
      const trackIndex = buffer.get(0x10) * this.sides + buffer.get(0x11);

      // --- Detect track number health issues
      if (i >= this.sides * this.tracksPerSide || i !== trackIndex) {
        return DiskError.DISK_IS_OPEN;
      }

      let bytesPerTrack =
        gaps[gapType].len[1] + (gapType === GAP_MINIMAL_MFM ? 6 : 3);
      let sectorPad = 0;

      // --- Iterate through sectors
      for (let j = 0; j < buffer.get(0x15); j++) {
        // --- Sector length
        const seclen =
          this.diskFormat === FloppyDiskFormat.CpcExtended
            ? buffer.get(0x1e + 8 * j) + 256 * buffer.get(0x1f + 8 * j)
            : 0x80 << buffer.get(0x1b + 8 * j);

        // --- Sector length according to the track ID info
        const idlen = 0x80 << buffer.get(0x1b + 8 * j);

        // --- Check if sector length is healthy
        if (
          idlen !== 0 &&
          idlen <= 0x80 << 0x08 &&
          seclen > idlen &&
          seclen % idlen !== 0
        ) {
          return (this.status = DiskError.DISK_IS_OPEN);
        }

        // --- Add sector length
        bytesPerTrack += this.calcSectorLen(
          seclen > idlen ? idlen : seclen,
          gapType
        );

        // --- Increment track length
        trlen += seclen;
        if (seclen % 0x100) {
          // --- Add sector padding, if the sector length is not a multiple of 256
          sectorPad++;
        }
      }

      // --- Skip paddings, position to the next track
      const nextTrackData = buffer.startOffset + trlen + sectorPad * 128 + 256;
      buffer = new BufferSpan(
        diskData,
        nextTrackData,
        diskData.length - nextTrackData
      );

      // --- Store the longest track length
      if (bytesPerTrack > maxBytesPerTrack) {
        maxBytesPerTrack = bytesPerTrack;
      }
    }

    // --- Tracks per side may be modified because of more tracks in the header than in the file
    if (this.tracksPerSide < 1 || this.tracksPerSide > 85) {
      // --- Abort, this geometry does not work
      return (this.status = DiskError.GEOMETRY_ISSUE);
    }

    // --- Now, all tracks in the disk are processed.
    if (!maxBytesPerTrack) {
      // --- If maximum length is still zero, something is wrong
      return (this.status = DiskError.GEOMETRY_ISSUE);
    }

    // --- Use auto detection for diskAlloc call
    this.density = DiskDensity.Auto;

    // --- Use the maximum bytes per track
    this.bytesPerTrack = maxBytesPerTrack;

    // --- Allocate memory for the disk surface data
    if (this.allocateSurfaceSpace(gapType) !== DiskError.OK) {
      return this.status;
    }

    // --- Set the track index to track 0
    this.setTrackIndex(0);

    // // --- Rewind to the first track
    // buffer.index = 256;

    // // --- Iterate through all tracks
    // this.trackInfo = [];
    // for (i = 0; i < this.sides * this.tracksPerSide; i++) {
    //   // --- Point to the track data
    //   hdrb = new BufferWithPosition(buffer.data, buffer.index);

    //   // --- Skip to data
    //   buffer.index += 0x100;

    //   // --- Obtain GAP 3 length type
    //   gap = hdrb.get(0x16) === 0xff ? GAP_MINIMAL_FM : GAP_MINIMAL_MFM;

    //   // --- Adjust track number, as the image may skip blank tracks
    //   i = hdrb.get(0x10) * this.sides + hdrb.get(0x11);

    //   // --- Position to the current track
    //   this.setTrackIndex(i);
    //   this.indexPos = 0;

    //   const headerLen = this.preIndexAdd(gap) + this.gapAdd(1, gap);

    //   // --- Reset sector padding
    //   sector_pad = 0;

    //   // --- Iterate through all sectors
    //   const sectorLengths: number[] = [];
    //   for (j = 0; j < hdrb.get(0x15); j++) {
    //     // --- Get net sector length
    //     seclen =
    //       this.diskFormat === FloppyDiskFormat.CpcExtended
    //         ? // --- Data length in Extended CPC format
    //           hdrb.get(0x1e + 8 * j) + 256 * hdrb.get(0x1f + 8 * j)
    //         : // --- Sector length from the ID
    //           0x80 << hdrb.get(0x1b + 8 * j);

    //     // --- Sector length from the ID
    //     idlen = 0x80 << hdrb.get(0x1b + 8 * j);
    //     if (idlen === 0 || idlen > 0x80 << 0x08) {
    //       // There is an error in sector length code, ignore it
    //       idlen = seclen;
    //     }

    //     // --- Add CHRN information with gap, and sign CRC error, if the FDC register status requires
    //     let sectorLength = this.idAdd(
    //       hdrb.get(0x19 + 8 * j),
    //       hdrb.get(0x18 + 8 * j),
    //       hdrb.get(0x1a + 8 * j),
    //       hdrb.get(0x1b + 8 * j),
    //       gap,
    //       !!(hdrb.get(0x1c + 8 * j) & 0x20) && !(hdrb.get(0x1d + 8 * j) & 0x20)
    //     );

    //     // --- Calculate flag values
    //     const ddam = !!(hdrb.get(0x1d + 8 * j) & 0x40);
    //     const crcError =
    //       !!(hdrb.get(0x1c + 8 * j) & 0x20) &&
    //       !!(hdrb.get(0x1d + 8 * j) & 0x20);

    //     // --- Add data, data marks, and gaps
    //     sectorLength += this.dataAdd(
    //       buffer,
    //       null,
    //       seclen > idlen ? idlen : seclen,
    //       ddam,
    //       gap,
    //       crcError,
    //       0x00,
    //       idx
    //     );
    //     if (seclen > idlen) {
    //       // --- A weak sector with multiple copy
    //       this.cpcSetWeakRange(idx, buffer, Math.floor(seclen / idlen), idlen);
    //       buffer.index += (Math.floor(seclen / idlen) - 1) * idlen;
    //     }

    //     if (seclen % 0x100) {
    //       // --- Add sector padding
    //       sector_pad++;
    //     }

    //     // --- Done
    //     sectorLengths[j] = sectorLength;
    //   }
    //   const gap4Len = this.gap4Add(gap);
    //   buffer.index += sector_pad * 0x80;

    //   // --- Collect track information
    //   this.trackInfo.push({
    //     headerLen,
    //     gap4Len,
    //     sectorLengths
    //   });
    // }

    return (this.status = DiskError.OK);

    // --- Compare the .DSK data with the specified string data
    function compareData (offset: number, data: string): boolean {
      for (let i = 0; i < data.length; i++) {
        if (buffer.get(offset + i) !== data.charCodeAt(i)) return false;
      }
      return true;
    }
  }

  // --- Calculates the number of bytes for the physical sector length
  private calcSectorLen (sectorLength: number, gaptype: number): number {
    let len = 0;
    const g = gaps[gaptype];

    // --- ID (DAM: 0 or 3, DAM end: 1, CHNR: 4, CRC: 2 )
    len += g.sync_len + (g.mark >= 0 ? 3 : 0) + 7;

    // --- GAP II
    len += g.len[2];

    // --- Data (Sync: 8 or 12, DAM 0 or 3, DAM end: 1, sector length, CRC: 2 )
    len += g.sync_len + (g.mark >= 0 ? 3 : 0) + 1;
    len += sectorLength;
    len += 2;

    // --- GAP III
    len += g.len[3];
    return len;
  }

  // --- Allocates the data for the physical surface of the disk
  private allocateSurfaceSpace (gaptype: number): number {
    if (this.density !== DiskDensity.Auto) {
      this.bytesPerTrack = diskBytePerTrackValues[this.density];
    } else if (this.bytesPerTrack > 12500) {
      return (this.status = DiskError.UNSUPPORTED);
    } else if (this.bytesPerTrack > 10416) {
      this.density = DiskDensity.HD;
      this.bytesPerTrack = diskBytePerTrackValues[DiskDensity.HD];
    } else if (this.bytesPerTrack > 6500) {
      this.density = DiskDensity.DD_8;
      this.bytesPerTrack = diskBytePerTrackValues[DiskDensity.DD_8];
    } else if (this.bytesPerTrack > 6250) {
      this.density = DiskDensity.DD_PLUS;
      this.bytesPerTrack = diskBytePerTrackValues[DiskDensity.DD_PLUS];
    } else if (this.bytesPerTrack > 5208) {
      this.density = DiskDensity.DD;
      this.bytesPerTrack = diskBytePerTrackValues[DiskDensity.DD];
    } else if (this.bytesPerTrack > 3125) {
      this.density = DiskDensity.SD_8;
      this.bytesPerTrack = diskBytePerTrackValues[DiskDensity.SD_8];
    } else if (this.bytesPerTrack > 0) {
      this.density = DiskDensity.SD;
      this.bytesPerTrack = diskBytePerTrackValues[DiskDensity.SD];
    }

    if (this.bytesPerTrack > 0) {
      this.trackLength =
        this.calcTrackHeaderLength(gaptype) +
        this.bytesPerTrack +
        3 * Math.ceil(this.bytesPerTrack / 8);
    }

    // --- Disk length
    const diskLength = this.sides * this.tracksPerSide * this.trackLength;
    if (diskLength === 0) return (this.status = DiskError.GEOMETRY_ISSUE);
    this.data = new Uint8Array(diskLength);

    return (this.status = DiskError.OK);
  }

  // --- Calculates the length of the track header
  private calcTrackHeaderLength (gaptype: number): number {
    const g = gaps[gaptype];
    return g.len[0] + g.len[1] + g.sync_len + (g.mark >= 0 ? 3 : 0) + 1;
  }
}

type DiskGap = {
  // --- Gap byte
  gap: number;
  // --- Sync byte
  sync: number;
  // --- Sync length
  sync_len: number;
  // --- Byte 0xa1 for MFM 0xff for MF
  mark: number;
  len: number[];
};

const gaps: DiskGap[] = [
  // --- MINIMAL_FM
  { gap: 0xff, sync: 0x00, sync_len: 6, mark: 0xff, len: [0, 16, 11, 10] },
  // --- MINIMAL MFM
  { gap: 0x4e, sync: 0x00, sync_len: 12, mark: 0xa1, len: [0, 32, 22, 24] }
];

const diskBytePerTrackValues: number[] = [
  6250 /* AUTO assumes DD */, 5208 /* 8" SD */, 10416 /* 8" DD */,
  3125 /* SD */, 6250 /* DD */, 6500 /* DD+ e.g. Coin Op Hits */, 12500 /* HD */
];
