// --- Headers used in a DSK file
const NORMAL_DISK_HEADER = "MV - CPCEMU Disk-File\r\n"; // --- from 0x00-0x16, 23 bytes
const EXTENDED_DISK_HEADER = "EXTENDED CPC DSK File\r\n"; // --- from 0x00-0x16, 23 bytes
const GAP_MINIMAL_FM = 0;
const GAP_MINIMAL_MFM = 1;

// --- Constant values used for disk file index calculations
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
    let idx: { value: number };
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
    if (compareData(0, NORMAL_DISK_HEADER)) {
      this.diskFormat = FloppyDiskFormat.Cpc;
    } else if (compareData(0, EXTENDED_DISK_HEADER)) {
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
      if (bufferAvailable() >= 12 && !compareData(0, "Track-Info\r\n")) {
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
      if (bufferAvailable() < 256 || !compareData(0, "Track-Info")) {
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
        bpt += this.calcSectorLen(seclen > idlen ? idlen : seclen, gap);

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

      // --- Reset sector padding
      sector_pad = 0;

      // --- Iterate through all tracks
      for (j = 0; j < hdrb.get(0x15); j++) {
        seclen =
          this.diskFormat === FloppyDiskFormat.CpcExtended
            ? // --- Data length in Extended CPC format
              hdrb.get(0x1e + 8 * j) + 256 * hdrb.get(0x1f + 8 * j)
            : // --- Sector length from the ID
              0x80 << hdrb.get(0x1b + 8 * j);

        // --- Sector length from the ID
        idlen = 0x80 << hdrb.get(0x1b + 8 * j);
        if (idlen === 0 || idlen > 0x80 << 0x08) {
          // There is an error in sector length code, ignore it
          idlen = seclen;
        }

        if (i < 84 && fix[i] === CPC_ISSUE_2 && j === 0) {
          // --- Reposition the dummy track
          this.indexPos = 8;
        }

        // --- Add CHRN information with gap, and sign CRC error, if the FDC register status requires
        this.idAdd(
          hdrb.get(0x19 + 8 * j),
          hdrb.get(0x18 + 8 * j),
          hdrb.get(0x1a + 8 * j),
          hdrb.get(0x1b + 8 * j),
          gap,
          !!(hdrb.get(0x1c + 8 * j) & 0x20) && !(hdrb.get(0x1d + 8 * j) & 0x20)
        );

        // --- Calculate flag values
        const ddam = !!(hdrb.get(0x1d + 8 * j) & 0x40);
        const crcError =
          !!(hdrb.get(0x1c + 8 * j) & 0x20) &&
          !!(hdrb.get(0x1d + 8 * j) & 0x20);

        // --- Add data, data marks, and gaps according to the ZX Spectrum +3 issue to fix
        if (i < 84 && fix[i] === CPC_ISSUE_1 && j === 0) {
          // --- 6144
          this.dataAdd(buffer, null, seclen, ddam, gap, crcError, 0x00);
        } else if (i < 84 && fix[i] === CPC_ISSUE_2 && j === 0) {
          // --- 6144, 10x512
          this.dataMarkAdd(ddam, gap);
          this.gapAdd(2, gap);
          buffer.index += seclen;
        } else if (i < 84 && fix[i] === CPC_ISSUE_3) {
          // --- 128, 256, 512, ... 4096k
          this.dataAdd(buffer, null, 128, ddam, gap, crcError, 0x00);
          buffer.index += seclen - 128;
        } else if (i < 84 && fix[i] === CPC_ISSUE_4) {
          // --- Nx8192 (max 6384 byte )
          this.dataAdd(buffer, null, 6384, ddam, gap, crcError, 0x00);
          buffer.index += seclen - 6384;
        } else if (i < 84 && fix[i] === CPC_ISSUE_5) {
          // --- 9x512
          // ---  512 256 512 256 512 256 512 256 512 */
          if (idlen === 256) {
            this.dataAdd(
              null,
              new BufferWithPosition(buffer.data, buffer.index),
              512,
              ddam,
              gap,
              crcError,
              0x00
            );
            buffer.index += idlen;
          } else {
            this.dataAdd(buffer, null, idlen, ddam, gap, crcError, 0x00);
          }
        } else {
          this.dataAdd(
            buffer,
            null,
            seclen > idlen ? idlen : seclen,
            ddam,
            gap,
            crcError,
            0x00,
            idx
          );
          if (seclen > idlen) {
            // --- A weak sector with multiple copy
            this.cpcSetWeakRange(
              idx,
              buffer,
              Math.floor(seclen / idlen),
              idlen
            );
            buffer.index += (Math.floor(seclen / idlen) - 1) * idlen;
          }
        }
        if (seclen % 0x100) {
          // --- Add sector padding
          sector_pad++;
        }
      }
      this.gap4Add(gap);
      buffer.index += sector_pad * 0x80;
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

    function diskTrackLength (bpt: number): number {
      return Math.floor(bpt / 8) + (bpt % 8 ? 1 : 0);
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

  // --- Sets the index structures to the specified track index
  private setTrackIndex (trackNo: number): void {
    this.trackData = new BufferWithPosition(this.data, 3 + trackNo * this.tlen);
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

  // --- Adds gaps to the surface data
  private gapAdd (gap: number, gaptype: number): boolean {
    const g = gaps[gaptype];
    if (this.indexPos + g.len[gap] >= this.bytesPerTrack)
      // --- Too many data bytes
      return true;

    // --- Create GAP data
    for (let i = 0; i < g.len[gap]; i++) {
      this.trackData.set(this.indexPos + i, g.gap);
    }
    this.indexPos += g.len[gap];
    return false;
  }

  // --- Adds GAP 4 data
  private gap4Add (gaptype: number): boolean {
    const len = this.bytesPerTrack - this.indexPos;
    const g = gaps[gaptype];

    if (len < 0) {
      return true;
    }

    // --- Create GAP 4 data
    for (let i = 0; i < len; i++) {
      this.trackData.set(this.indexPos + i, g.gap);
    }
    this.indexPos = this.bytesPerTrack;
    return false;
  }

  private idAdd (
    h: number,
    t: number,
    s: number,
    l: number,
    gaptype: number,
    crc_error: boolean
  ): boolean {
    let crc = 0xffff;
    const g = gaps[gaptype];
    if (
      this.indexPos + g.sync_len + (g.mark >= 0 ? 3 : 0) + 7 >=
      this.bytesPerTrack
    ) {
      return true;
    }

    // --- Sync
    for (let i = 0; i < g.sync_len; i++) {
      this.trackData.set(this.indexPos + i, g.sync);
    }
    this.indexPos += g.sync_len;
    if (g.mark >= 0) {
      for (let i = 0; i < 3; i++) {
        this.trackData.set(this.indexPos + i, g.mark);
      }
      this.bitmapSet(this.clockData, this.indexPos);
      this.indexPos++;
      crc = this.crcFdc(crc, g.mark);
      this.bitmapSet(this.clockData, this.indexPos);
      this.indexPos++;
      crc = this.crcFdc(crc, g.mark);
      this.bitmapSet(this.clockData, this.indexPos);
      this.indexPos++;
      crc = this.crcFdc(crc, g.mark);
    }
    // --- Mark
    if (g.mark < 0) {
      // --- FM, set clock mark
      this.bitmapSet(this.clockData, this.indexPos);
    }
    this.trackData.set(this.indexPos++, 0xfe);
    crc = this.crcFdc(crc, 0xfe);
    // --- Header
    this.trackData.set(this.indexPos++, t);
    crc = this.crcFdc(crc, t);
    this.trackData.set(this.indexPos++, h);
    crc = this.crcFdc(crc, h);
    this.trackData.set(this.indexPos++, s);
    crc = this.crcFdc(crc, s);
    this.trackData.set(this.indexPos++, l);
    crc = this.crcFdc(crc, l);
    this.trackData.set(this.indexPos++, crc >>> 8);
    if (crc_error) {
      // --- Record a CRC error
      this.trackData.set(this.indexPos++, ~crc & 0xff);
    } else {
      // --- Record valid CRC
      this.trackData.set(this.indexPos++, crc & 0xff);
    }

    // --- GAP 2
    return this.gapAdd(2, gaptype);
  }

  // --- Sets a bit in a bitmap stream
  private bitmapSet (stream: BufferWithPosition, n: number): void {
    const offset = Math.floor(n / 8);
    stream.set(offset, stream.get(offset) | (1 << n % 8));
  }

  // --- Calculates new CRC value
  private crcFdc (crc: number, data: number): number {
    return ((crc << 8) ^ crcFdcTable[((crc >> 8) ^ data) & 0xff]) & 0xffff;
  }

  // --- Adds disk data segment
  private dataAdd (
    buffer: BufferWithPosition | null,
    data: BufferWithPosition | null,
    len: number,
    ddam: boolean,
    gaptype: number,
    crc_error: boolean,
    autofill: number,
    start_data?: { value: number }
  ): boolean {
    let length: number;
    let crc = 0xffff;
    const g = gaps[gaptype];

    if (this.dataMarkAdd(ddam, gaptype)) {
      return true;
    }

    if (g.mark >= 0) {
      crc = this.crcFdc(crc, g.mark);
      crc = this.crcFdc(crc, g.mark);
      crc = this.crcFdc(crc, g.mark);
    }

    // --- Deleted or normal
    crc = this.crcFdc(crc, ddam ? 0xf8 : 0xfb);
    if (len < 0) {
      // --- CRC error
      return this.gapAdd(3, gaptype);
    }
    if (this.indexPos + len + 2 >= this.bytesPerTrack) {
      // --- Too many data bytes
      return true;
    }

    // --- Data
    if (start_data) {
      // --- Record data start position */
      start_data.value = this.indexPos;
    }

    if (buffer === null) {
      for (let i = 0; i < len; i++) {
        this.trackData.set(this.indexPos + i, data.get(i));
      }
      length = len;
    } else {
      length = buffer.data.length - buffer.index;
      if (length > len) {
        length = len;
      }
      this.bufferRead(this.trackData, this.indexPos, length, buffer);
    }
    if (length < len) {
      // --- autofill
      if (autofill < 0) {
        return true;
      }
      while (length < len) {
        this.trackData.set(this.indexPos + length++, autofill);
      }
    }
    length = 0;
    while (length < len) {
      // --- calculate CRC
      crc = this.crcFdc(crc, this.trackData.get(this.indexPos++));
      length++;
    }
    if (crc_error) {
      // --- Mess up CRC
      crc ^= 1;
    }

    // --- Write out the CRC value
    this.trackData.set(this.indexPos++, crc >>> 8);
    this.trackData.set(this.indexPos++, crc & 0xff);

    // --- GAP 3
    header_crc_error: return this.gapAdd(3, gaptype);
  }

  // --- Reads from the disk buffer and writes data into the surface image
  private bufferRead (
    data: BufferWithPosition,
    dataOffset: number,
    len: number,
    buffer: BufferWithPosition
  ): boolean {
    if (len > buffer.data.length - buffer.index) {
      return false;
    }
    for (let i = 0; i < len; i++) {
      data.set(dataOffset + i, buffer.get(0));
    }
    buffer.index += len;
    return true;
  }

  private dataMarkAdd (ddam: boolean, gaptype: number): boolean {
    const g = gaps[gaptype];
    if (
      this.indexPos + g.len[2] + g.sync_len + (g.mark >= 0 ? 3 : 0) + 1 >=
      this.bytesPerTrack
    ) {
      return true;
    }

    // --- Sync
    for (let i = 0; i < g.sync_len; i++) {
      this.trackData.set(this.indexPos + i, g.sync);
    }
    this.indexPos += g.sync_len;
    if (g.mark >= 0) {
      for (let i = 0; i < 3; i++) {
        this.trackData.set(this.indexPos, g.mark);
      }
      this.bitmapSet(this.clockData, this.indexPos++);
      this.bitmapSet(this.clockData, this.indexPos++);
      this.bitmapSet(this.clockData, this.indexPos++);
    }

    // --- Mark
    if (g.mark < 0) {
      // --- FM, set clock mark
      this.bitmapSet(this.clockData, this.indexPos);
    }
    this.trackData.set(this.indexPos++, ddam ? 0xf8 : 0xfb);
    return false;
  }

  private cpcSetWeakRange (
    idx: { value: number },
    buffer: BufferWithPosition,
    n: number,
    len: number
  ): void {
    const t = new BufferWithPosition(
      this.trackData.data,
      this.trackData.index + idx.value
    );
    const w = new BufferWithPosition(buffer.data, buffer.index);

    let first = -1;
    let last = -1;

    for (let i = 0; i < len; i++, t.index++, w.index++) {
      for (let j = 0; j < n - 1; j++) {
        if (t.get() !== w.get(j * len)) {
          if (first === -1) {
            first = idx.value + i;
          }
          last = idx.value + i;
        }
      }
    }
    if (first === -1 || last === -1) {
      return;
    }
    for (; first <= last; first++) {
      this.bitmapSet(this.weakData, first);
    }
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

export const crcFdcTable = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108,
  0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef, 0x1231, 0x0210,
  0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6, 0x9339, 0x8318, 0xb37b,
  0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401,
  0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee,
  0xf5cf, 0xc5ac, 0xd58d, 0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6,
  0x5695, 0x46b4, 0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d,
  0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5,
  0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc,
  0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a, 0x6ca6, 0x7c87, 0x4ce4,
  0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd,
  0xad2a, 0xbd0b, 0x8d68, 0x9d49, 0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13,
  0x2e32, 0x1e51, 0x0e70, 0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a,
  0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e,
  0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1,
  0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb,
  0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d, 0x34e2, 0x24c3, 0x14a0,
  0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8,
  0xe75f, 0xf77e, 0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657,
  0x7676, 0x4615, 0x5634, 0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9,
  0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882,
  0x28a3, 0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
  0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92, 0xfd2e,
  0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07,
  0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1, 0xef1f, 0xff3e, 0xcf5d,
  0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74,
  0x2e93, 0x3eb2, 0x0ed1, 0x1ef0
];
