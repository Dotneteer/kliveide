// --- Headers used in a DSK file
const NORMAL_DISK_HEADER = "MV - CPCEMU Disk-File\r\n"; // --- from 0x00-0x16, 23 bytes
const EXTENDED_DISK_HEADER = "EXTENDED CPC DSK File\r\n"; // --- from 0x00-0x16, 23 bytes
const ADDITIONAL_HEADER = "Disk-Info\r\n"; // --- from 0x17-0x21, 11 bytes
const TRACK_HEADER = "Track-Info\r\n"; // --- from 0x00-0x0b, 12 bytes
const GAP_MINIMAL_FM = 0;
const GAP_MINIMAL_MFM = 1;

// --- Constant values used for disk file index calculations
const SECTOR_HEADER_SIZE = 8;
const TRACK_HEADER_SIZE = 24;
const START_DISK_TRACK_POINTER = 0x100;
const StartDiskSectorPointer = 0x100;
const CPC_ISSUE_NONE = 0;
const CPC_ISSUE_1 = 1;
const CPC_ISSUE_2 = 2;
const CPC_ISSUE_3 = 3;
const CPC_ISSUE_4 = 4;
const CPC_ISSUE_5 = 5;

// --- This class describes a logical floppy disk
export class FloppyDisk {
  // --- Initialize this disk contents from the specified stream
  constructor (public readonly diskData: Uint8Array) {
    this.open(diskData);
  }

  // --- Disk format
  diskFormat: FloppyDiskFormat;

  // --- Binary disk data (physical surface)
  data: Uint8Array;

  // --- The number of physical sides
  sides: number;

  // --- Number of tracks per side
  tracksPerSide: number;

  // --- Number of bytes per track
  bytesPerTrack: number;

  // --- Signs whether is write-protect tab on the disk
  isWriteProtected: boolean;

  // --- Disk changed
  dirty = false;

  // --- Disk status
  status: DiskError;

  // --- ???
  flag = false;

  // --- Disk density
  density: DiskDensity;

  // --- Track length
  tlen: number;

  // --- Buffer to track data
  trackData: BufferWithPosition;

  // --- Buffer to clock data
  clockData: BufferWithPosition;

  // --- Buffer to MF/MFM mark bits
  fmData: BufferWithPosition;

  // --- Buffer to weak mark bits/weak data
  weakData: BufferWithPosition;

  // --- Interim index position while processing disk data
  indexPos: number;

  open (diskData: Uint8Array): DiskError {
    let i: number;
    let j: number;
    let seclen: number;
    let idlen: number;
    let gap: number;
    let sector_pad: number;
    let idx: number;
    let bpt: number;
    let max_bpt = 0;
    let trlen: number;
    let fix: number[] = [];
    let plus3_fix: number;
    let hdrb: BufferWithPosition;
    let buffer = new BufferWithPosition(diskData, 0);

    // --- Helper functions
    const buff = (offset = 0) => buffer.get(offset);
    const bufferAvailable = () => buffer.data.length - buffer.index;
    const compareData = (offset: number, data: string): boolean => {
      for (let i = 0; i < data.length; i++) {
        if (buffer.get(offset + i) !== data.charCodeAt(i)) return false;
      }
      return true;
    };

    // --- Set the disk format according to its header
    if (compareData(0, "MV - CPCEMU Disk-File\r\n")) {
      this.diskFormat = FloppyDiskFormat.Cpc;
    } else if (compareData(0, "EXTENDED CPC DSK File\r\n")) {
      this.diskFormat = FloppyDiskFormat.CpcExtended;
    } else {
      return DiskError.DISK_UNSUP;
    }

    // --- Obtain geometry parameters
    this.tracksPerSide = buff(0x30);
    this.sides = buff(0x31);
    if (
      this.sides < 1 ||
      this.sides > 2 ||
      this.tracksPerSide < 1 ||
      this.tracksPerSide > 85
    ) {
      // --- Abort, this geometry does not work
      return (this.status = DiskError.DISK_GEOM);
    }

    // --- Move to track data
    buffer.index = 256;

    // --- First scan for the longest track
    for (let i = 0; i < this.sides * this.tracksPerSide; i++) {
      // --- Ignore Sector Offset block
      if (bufferAvailable() >= 13 && !compareData(0, "Offset-Info\r\n")) {
        buffer.index = buffer.data.length;
      }

      // --- Sometimes in the header there are more track than in the file
      if (bufferAvailable() === 0) {
        // --- No more data, calculate the real track number
        this.tracksPerSide = Math.floor(i / this.sides) + (i % this.sides);

        // --- Now, we now the longest track, abort the search
        break;
      }

      // --- Is the current data valid track information?
      if (bufferAvailable() < 256 || compareData(0, "Track-Info")) {
        // --- Track header does not match
        return (this.status = DiskError.DISK_OPEN);
      }

      // --- Yes, obtain the currently used gap information
      gap = buff(0x16) === 0xff ? GAP_MINIMAL_FM : GAP_MINIMAL_MFM;

      // --- Check which ZX Spectrum +3 fix should be used
      plus3_fix = trlen = 0;

      // --- Calculate the number of tracks
      const numTracks = buff(0x10) * this.sides + buff(0x11);

      // --- Iterate though all tracks (on both sides)
      while (i < numTracks) {
        if (i < 84) {
          // --- No ZX Spectrum +3 fix to use for that particular track
          fix[i] = 0;
        }
        i++;
      }

      // --- Check track number health
      if (i >= this.sides * this.tracksPerSide || i !== numTracks) {
        // --- Problem with track IDs
        return (this.status = DiskError.DISK_OPEN);
      }

      // === We start calculating the bytes per track information
      const gapInfo = gaps[gap];

      // --- Add GAP 4a
      bpt = gapInfo.len[1] + (gap === GAP_MINIMAL_MFM ? 6 : 3); /* gap4 */
      sector_pad = 0;

      // --- Iterate through sectors
      for (j = 0; j < buff(0x15); j++) {
        // --- Sector length
        seclen =
          this.diskFormat === FloppyDiskFormat.CpcExtended
            ? buff(0x1e + 8 * j) + 256 * buff(0x1f + 8 * j)
            : 0x80 << buff(0x1b + 8 * j);

        // --- Sector length according to the track ID info
        idlen = 0x80 << buff(0x1b + 8 * j);

        // --- Check if sector length is healthy
        if (
          idlen !== 0 &&
          idlen <= 0x80 << 0x08 &&
          seclen > idlen &&
          seclen % idlen !== 0
        ) {
          return (this.status = DiskError.DISK_OPEN);
        }

        // --- Add sector length
        bpt += this.calcSectorLen(
          gap == GAP_MINIMAL_MFM,
          seclen > idlen ? idlen : seclen,
          gap
        );

        // --- Apply ZX Spectrum +3 optional fixes
        if (i < 84) {
          if (j === 0 && buff(0x1b + 8 * j) === 6 && seclen > 6144) {
            // --- Sector #0: Sector lenght is set to 8192 bytes in the track header
            // --- and langth is over 6144 byte
            plus3_fix = CPC_ISSUE_4;
          } else if (j === 0 && buff(0x1b + 8 * j) === 6) {
            // --- Sector #0: Sector lenght is set to 8192 bytes in the track header
            plus3_fix = CPC_ISSUE_1;
          } else if (
            j === 0 &&
            // --- Sector 0: CHRN = 0 (all)
            buff(0x18) === 0 &&
            buff(0x19) === 0 &&
            buff(0x1a) === 0 &&
            buff(0x1b) === 0
          ) {
            plus3_fix = CPC_ISSUE_3;
          } else if (
            j === 1 &&
            plus3_fix === CPC_ISSUE_1 &&
            // --- Sector #1: sector length is 512
            buff(0x1b + 8 * j) === 2
          ) {
            plus3_fix = CPC_ISSUE_2;
          } else if (i === 38 && j === 0 && buff(0x1b + 8 * j) === 2) {
            // --- Track #38, Sector #0: sector length is 512
            plus3_fix = CPC_ISSUE_5;
          } else if (
            j > 1 &&
            plus3_fix == CPC_ISSUE_2 &&
            buff(0x1b + 8 * j) !== 2
          ) {
            // --- Sectors above #1 where sector length is not 512
            plus3_fix = CPC_ISSUE_NONE;
          } else if (
            j > 0 &&
            plus3_fix == CPC_ISSUE_3 &&
            (buff(0x18 + 8 * j) !== j ||
              buff(0x19 + 8 * j) !== j ||
              buff(0x1a + 8 * j) !== j ||
              buff(0x1b + 8 * j) !== j)
          ) {
            // --- Sector above #0 where nonoe of CHRN is the sector number
            plus3_fix = CPC_ISSUE_NONE;
          } else if (j > 10 && plus3_fix === CPC_ISSUE_2) {
            plus3_fix = CPC_ISSUE_NONE;
          } else if (
            i === 38 &&
            j > 0 &&
            plus3_fix === CPC_ISSUE_5 &&
            buff(0x1b + 8 * j) !== 2 - (j & 1)
          ) {
            plus3_fix = CPC_ISSUE_NONE;
          }
        }

        // --- Increment track length
        trlen += seclen;
        if (seclen % 0x100) {
          // --- Add sector padding, if the sector length is not a multiple of 256
          sector_pad++;
        }

        // --- Adjust bytes per track according to the specific issue found for this track
        if (i < 84) {
          // --- Mark the fix for the current track
          fix[i] = plus3_fix;
          if (fix[i] === CPC_ISSUE_4) {
            // --- Type 1 variant DD+ (e.g. Coin Op Hits)
            bpt = 6500;
          } else if (fix[i] !== CPC_ISSUE_NONE) {
            // --- we assume a standard DD track
            bpt = 6250;
          }
        }
      }
      // --- Skip paddings, position to the next track
      buffer.index += trlen + sector_pad * 128 + 256;
      if (bpt > max_bpt) {
        max_bpt = bpt;
      }
    }

    // --- Now, all tracks in the disk are processed.
    if (max_bpt === 0) {
      // --- If maximum length is still zero, something is wrong
      return (this.status = DiskError.DISK_GEOM);
    }

    // --- Use auto detection for diskAlloc call
    this.density = DiskDensity.Auto;

    // --- Use the maximum bytes per track
    this.bytesPerTrack = max_bpt;

    // --- Allocate memory for the disk surface data
    if (this.allocate() !== DiskError.DISK_OK) {
      return this.status;
    }

    // --- Set the track index to track 0
    this.setTrackIndex(0);

    // --- Rewind to the first track
    buffer.index = 256;

    // --- Iterate through all tracks
    for (i = 0; i < this.sides * this.tracksPerSide; i++) {
      // --- Point to the track data 
      hdrb = new BufferWithPosition(buffer.data, buffer.index);
      
      // --- Skip to data
      buffer.index += 0x100;

      // --- Obtain GAP 3 length type
      gap = hdrb.get(0x16) === 0xff ? GAP_MINIMAL_FM : GAP_MINIMAL_MFM;

      // --- Adjust track number, as the image may skip blank tracks
      i = hdrb.get(0x10) * this.sides + hdrb.get(0x11);

      // --- Position to the current track
      this.setTrackIndex(i);
      this.indexPos = 0;
      this.gapAdd(1, gap);
      //     sector_pad = 0;
      //     for( j = 0; j < hdrb[0x15]; j++ ) {			/* each sector */
      //       seclen = d->type == DISK_ECPC ? hdrb[ 0x1e + 8 * j ] +	/* data length in sector */
      //               256 * hdrb[ 0x1f + 8 * j ]
      //             : 0x80 << hdrb[ 0x1b + 8 * j ];
      //       idlen = 0x80 << hdrb[ 0x1b + 8 * j ];		/* sector length from ID */
      //       if( idlen == 0 || idlen > ( 0x80 << 0x08 ) )      /* error in sector length code -> ignore */
      //         idlen = seclen;
      //       if( i < 84 && fix[i] == 2 && j == 0 ) {	/* repositionate the dummy track  */
      //         d->i = 8;
      //       }
      //       id_add( d, hdrb[ 0x19 + 8 * j ], hdrb[ 0x18 + 8 * j ],
      //      hdrb[ 0x1a + 8 * j ], hdrb[ 0x1b + 8 * j ], gap,
      //                  hdrb[ 0x1c + 8 * j ] & 0x20 && !( hdrb[ 0x1d + 8 * j ] & 0x20 ) ?
      //                  CRC_ERROR : CRC_OK );
      //       if( i < 84 && fix[i] == CPC_ISSUE_1 && j == 0 ) {	/* 6144 */
      //         data_add( d, buffer, NULL, seclen,
      //     hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      //     hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      //     CRC_ERROR : CRC_OK, 0x00, NULL );
      //       } else if( i < 84 && fix[i] == CPC_ISSUE_2 && j == 0 ) {	/* 6144, 10x512 */
      //         datamark_add( d, hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap );
      //         gap_add( d, 2, gap );
      //         buffer->index += seclen;
      //       } else if( i < 84 && fix[i] == CPC_ISSUE_3 ) {	/* 128, 256, 512, ... 4096k */
      //         data_add( d, buffer, NULL, 128,
      //     hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      //     hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      //     CRC_ERROR : CRC_OK, 0x00, NULL );
      //         buffer->index += seclen - 128;
      //       } else if( i < 84 && fix[i] == CPC_ISSUE_4 ) {	/* Nx8192 (max 6384 byte ) */
      //         data_add( d, buffer, NULL, 6384,
      //     hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      //     hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      //     CRC_ERROR : CRC_OK, 0x00, NULL );
      //         buffer->index += seclen - 6384;
      //       } else if( i < 84 && fix[i] == CPC_ISSUE_5 ) {	/* 9x512 */
      //       /* 512 256 512 256 512 256 512 256 512 */
      //         if( idlen == 256 ) {
      //           data_add( d, NULL, buff, 512,
      //     hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      //     hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      //     CRC_ERROR : CRC_OK, 0x00, NULL );
      //     buffer->index += idlen;
      //         } else {
      //           data_add( d, buffer, NULL, idlen,
      //     hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      //     hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      //     CRC_ERROR : CRC_OK, 0x00, NULL );
      //   }
      //       } else {
      //         data_add( d, buffer, NULL, seclen > idlen ? idlen : seclen,
      //     hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      //     hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      //     CRC_ERROR : CRC_OK, 0x00, &idx );
      //         if( seclen > idlen ) {		/* weak sector with multiple copy  */
      //           cpc_set_weak_range( d, idx, buffer, seclen / idlen, idlen );
      //           buffer->index += ( seclen / idlen - 1 ) * idlen;
      //           /* ( ( N * len ) / len - 1 ) * len */
      //         }
      //       }
      //       if( seclen % 0x100 )		/* every? 128/384/...byte length sector padded */
      //   sector_pad++;
      //     }
      //     gap4_add( d, gap );
      //     buffer->index += sector_pad * 0x80;
    }

    return (this.status = DiskError.DISK_OK);
  }

  // --- Allocates the data for the physical surface of the disk
  private allocate (): number {
    if (this.density != DiskDensity.Auto) {
      this.bytesPerTrack = disk_bpt[this.density];
    } else if (this.bytesPerTrack > disk_bpt[DiskDensity.DISK_HD]) {
      return (this.status = DiskError.DISK_UNSUP);
    } else if (this.bytesPerTrack > disk_bpt[DiskDensity.DISK_8_DD]) {
      this.density = DiskDensity.DISK_HD;
      this.bytesPerTrack = disk_bpt[DiskDensity.DISK_HD];
    } else if (this.bytesPerTrack > disk_bpt[DiskDensity.DISK_DD_PLUS]) {
      this.density = DiskDensity.DISK_8_DD;
      this.bytesPerTrack = disk_bpt[DiskDensity.DISK_8_DD];
    } else if (this.bytesPerTrack > disk_bpt[DiskDensity.DISK_DD]) {
      this.density = DiskDensity.DISK_DD_PLUS;
      this.bytesPerTrack = disk_bpt[DiskDensity.DISK_DD_PLUS];
    } else if (this.bytesPerTrack > disk_bpt[DiskDensity.DISK_8_SD]) {
      this.density = DiskDensity.DISK_DD;
      this.bytesPerTrack = disk_bpt[DiskDensity.DISK_DD];
    } else if (this.bytesPerTrack > disk_bpt[DiskDensity.DISK_SD]) {
      this.density = DiskDensity.DISK_8_SD;
      this.bytesPerTrack = disk_bpt[DiskDensity.DISK_8_SD];
    } else if (this.bytesPerTrack > 0) {
      this.density = DiskDensity.DISK_SD;
      this.bytesPerTrack = disk_bpt[DiskDensity.DISK_SD];
    }

    if (this.bytesPerTrack > 0)
      this.tlen =
        4 + this.bytesPerTrack + 3 * diskTrackLength(this.bytesPerTrack);

    // --- Disk length
    const diskLength = this.sides * this.tracksPerSide * this.tlen;
    if (diskLength === 0) return (this.status = DiskError.DISK_GEOM);
    this.data = new Uint8Array(diskLength);

    return (this.status = DiskError.DISK_OK);
  }

  private calcSectorLen (
    mfm: boolean,
    sector_length: number,
    gaptype: number
  ): number {
    let len = 0;
    const g = gaps[gaptype];

    // --- ID (DAM: 0 or 3, DAM end: 1, CHNR: 4, CRC: 2 )
    len += g.sync_len + (g.mark >= 0 ? 3 : 0) + 7;

    // --- GAP II
    len += g.len[2];

    // --- Data (Sync: 8 or 12, DAM 0 or 3, DAM end: 1, sector length, CRC: 2 )
    len += g.sync_len + (g.mark >= 0 ? 3 : 0) + 1;
    len += sector_length;
    len += 2;
    // --- GAP III
    len += g.len[3];
    return len;
  }

  private setTrackIndex (idx: number): void {
    this.trackData = new BufferWithPosition(this.data, 3 + idx * this.tlen);
    this.clockData = new BufferWithPosition(this.data, this.bytesPerTrack);
    this.fmData = new BufferWithPosition(
      this.data,
      this.clockData.index + marksLength(this.bytesPerTrack)
    );
    this.weakData = new BufferWithPosition(
      this.data,
      this.fmData.index + marksLength(this.bytesPerTrack)
    );

    function marksLength (bpt: number): number {
      return Math.floor(bpt / 8) + (bpt % 8 ? 1 : 0);
    }
  }

  private gapAdd(gap: number, gapType: number): number {
    // TODO: Implement this method
    return 0
  }
}

// === Buffer utilities
class BufferWithPosition {
  constructor (public data: Uint8Array, public index: number = 0) {}

  get (offset = 0): number {
    return this.data[this.index + offset];
  }

  set (offset: number, value: number): void {
    this.data[this.index + offset] = value;
  }
}

// --- Available floppy disk formats
export enum FloppyDiskFormat {
  // --- Standard CPCEMU disk format (used in the built-in +3 disk drive)
  Cpc,

  // --- Extended CPCEMU disk format (used in the built-in +3 disk drive)
  CpcExtended
}

// --- Available disk error types
export enum DiskError {
  DISK_OK = 0,
  DISK_IMPL,
  DISK_MEM,
  DISK_GEOM,
  DISK_OPEN,
  DISK_UNSUP,
  DISK_RDONLY,
  DISK_CLOSE,
  DISK_WRFILE,
  DISK_WRPART,

  DISK_LAST_ERROR
}

export enum DiskDensity {
  Auto = 0,
  DISK_8_SD /* 8" SD floppy 5208 MF */,
  DISK_8_DD /* 8" DD floppy 10416 */,
  DISK_SD /* 3125 bpt MF */,
  DISK_DD /* 6250 bpt */,
  DISK_DD_PLUS /* 6500 bpt e.g. Coin Op Hits */,
  DISK_HD /* 12500 bpt*/
}

const disk_bpt: number[] = [
  6250 /* AUTO assumes DD */, 5208 /* 8" SD */, 10416 /* 8" DD */,
  3125 /* SD */, 6250 /* DD */, 6500 /* DD+ e.g. Coin Op Hits */, 12500 /* HD */
];

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

function diskTrackLength (bpt: number): number {
  return Math.floor(bpt / 8) + (bpt % 8 ? 1 : 0);
}
