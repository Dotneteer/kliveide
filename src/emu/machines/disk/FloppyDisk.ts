import { BinaryReader } from "@common/utils/BinaryReader";

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
  constructor (reader: BinaryReader) {
    this.readDiskHeader(reader);
    this.readDiskData(reader);
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

  // --- Length of a track with clock and other marks (bpt + 3/8bpt)
  tlen: number;			

  // --- Current track position within the disk surface data
  trackPos: number;

  // --- Current clock mark bits position
  clockPos: number;

  // --- Current MF/MFM mark bits position
  fmPos: number;

  // --- Current weak marks bits/weak data position
  weakPos: number;

  // --- Disk information header
  header: DiskHeader;

  // --- Tracks
  tracks: TrackHeader[];

  // --- Index for track and clocks
  index: number;

  // ========================================================================================================
  // New implementation

  // --- Allocates the data for the physical surface of the disk
private allocate(): number
{
  if( this.density != DiskDensity.Auto) {
    this.bytesPerTrack = disk_bpt[ this.density ];
  } else if( this.bytesPerTrack > disk_bpt[DiskDensity.DISK_HD] ) {
    return this.status = DiskError.DISK_UNSUP;
  } else if( this.bytesPerTrack > disk_bpt[DiskDensity.DISK_8_DD] ) {
    this.density = DiskDensity.DISK_HD;
    this.bytesPerTrack = disk_bpt[ DiskDensity.DISK_HD ];
  } else if( this.bytesPerTrack > disk_bpt[ DiskDensity.DISK_DD_PLUS ] ) {
    this.density = DiskDensity.DISK_8_DD;
    this.bytesPerTrack = disk_bpt[DiskDensity.DISK_8_DD ];
  } else if( this.bytesPerTrack > disk_bpt[DiskDensity.DISK_DD] ) {
    this.density = DiskDensity.DISK_DD_PLUS;
    this.bytesPerTrack = disk_bpt[ DiskDensity.DISK_DD_PLUS ];
  } else if( this.bytesPerTrack > disk_bpt[ DiskDensity.DISK_8_SD ] ) {
    this.density = DiskDensity.DISK_DD;
    this.bytesPerTrack = disk_bpt[ DiskDensity.DISK_DD ];
  } else if( this.bytesPerTrack > disk_bpt[ DiskDensity.DISK_SD ] ) {
    this.density = DiskDensity.DISK_8_SD;
    this.bytesPerTrack = disk_bpt[DiskDensity.DISK_8_SD ];
  } else if( this.bytesPerTrack > 0 ) {
    this.density = DiskDensity.DISK_SD;
    this.bytesPerTrack = disk_bpt[DiskDensity.DISK_SD ];
  }

  if( this.bytesPerTrack > 0 )
    this.tlen = 4 + this.bytesPerTrack + 3 * diskTrackLength(this.bytesPerTrack);

  // --- Disk length
  const diskLength = this.sides * this.tracksPerSide * this.tlen;	
  if( diskLength === 0 ) return this.status = DiskError.DISK_GEOM;
  this.data = new Uint8Array(diskLength);

  return this.status = DiskError.DISK_OK;
}

// --- Sets the track index positions to the specified track number
private setTrackIdx(trackNo: number ): void {
  this.trackPos = 3 + trackNo * this.tlen;
  this.clockPos = this.bytesPerTrack;
  this.fmPos = diskTrackLength(this.bytesPerTrack);
  this.weakPos = this.fmPos + diskTrackLength(this.bytesPerTrack);
}

  open(buffer: Uint8Array): DiskError {
    let bufferPos = 0;
    let i: number;
    let j: number;
    let seclen: number;
    let idlen: number;
    let gap: number;
    let sector_pad: number;
    let idx: number;
    let bpt: number;
    let max_bpt = 0
    let trlen: number;
    let fix: number[];
    let plus3_fix: number;
    let hdrbPos: number;

    // TODO: Obtain the disk format
    
    // --- Helper functions
    const buff = (idx: number) => buffer[bufferPos + idx];

    const buffavail = () => buffer.length - bufferPos;

    const memcmp = (header: string) => {
      for (let i = 0; i < header.length; i++) {
        if (buff(i) !== header.charCodeAt(i)) {
          return false;
        }
      }
      return true;
    }

    const postindex_len = (gaptype: number) => gaps[ gaptype ].len[1];

    const calc_sectorlen =(sectorLength: number, gaptype: number ) =>
    {
      let len = 0;
      const gap = gaps[gaptype];
      
      // --- ID
      len += gap.sync_len + (gap.mark >= 0 ? 3 : 0 ) + 7;
      // --- GAP II
      len += gap.len[2];
      // --- data
      len += gap.sync_len + (gap.mark >= 0 ? 3 : 0 ) + 1;		// + 1: Data Access Mark
      len += sectorLength;
      len += 2;	// --- CRC bytes
      // --- GAP III
      len += gap.len[3];
      return len;
    }

    // --- Obtain the basic disk geometry from the DSK stream
    this.sides = buff(0x31);
    this.tracksPerSide = buff(0x30);
    if( this.sides < 1 || this.sides > 2 || 
      this.tracksPerSide < 1 || this.tracksPerSide > 85 ) {
        return this.status = DiskError.DISK_GEOM;
    }

    // --- Skip the first 0x100 boundary to reach the actual data part
    bufferPos = 0x100;

    // --- First scan for the longest track
    for(i = 0; i < this.sides * this.tracksPerSide; i++ ) {
      // --- Ignore Sector Offset block
      if( buffavail() >= 13 && !memcmp("Offset-Info\r\n") ) {
        bufferPos = buffer.length;
      }
  
      // --- Sometimes in the header there are more track than in the file */
      if( buffavail() === 0 ) {
        // --- No more data, this is the real cylinder number
        this.tracksPerSide = Math.floor(i / this.sides) + i % this.sides;
        break;
      }

      // --- Check track header
      if( buffavail() < 256 || memcmp("Track-Info")) {
        return this.status = DiskError.DISK_OPEN;
      }
  
      // --- ZX Spectrum +3 fix
      gap = buff(0x16) === 0xff ? GAP_MINIMAL_FM : GAP_MINIMAL_MFM;
      plus3_fix = trlen = 0;
      while( i < buff(0x10) * this.sides + buff(0x11) ) {
        if( i < 84 ) fix[i] = 0;
        i++;
      }

      // --- Problem with track index
      if( i >= this.sides * this.tracksPerSide || 
        i != buff(0x10) * this.sides + buff(0x11))	
        return this.status = DiskError.DISK_OPEN;
  
      bpt = postindex_len(gap) + (gap === GAP_MINIMAL_MFM ? 6 : 3 );
      sector_pad = 0;
      for( j = 0; j < buff(0x15); j++ ) {			
        // --- Each sector
        seclen = this.diskFormat === FloppyDiskFormat.CpcExtended ? buff(0x1e + 8 * j) +
                256 * buff(0x1f + 8 * j)
              : 0x80 << buff(0x1b + 8 * j);
        // --- Sector length from ID     
        idlen = 0x80 << buff(0x1b + 8 * j);
        if( idlen !== 0 && idlen <= ( 0x80 << 0x08 ) && 
            seclen > idlen && seclen % idlen ) {
            return this.status = DiskError.DISK_OPEN;
        }
  
        bpt += calc_sectorlen(seclen > idlen ? idlen : seclen, gap );

        // --- Check which ZX Spectrum +3 fix to apply
        if( i < 84) {
          if( j === 0 && buff(0x1b + 8 * j) === 6 && seclen > 6144)
            {
              plus3_fix = CPC_ISSUE_4;
            }
    else if(j === 0 && buff(0x1b + 8 * j) === 6 )
      plus3_fix = CPC_ISSUE_1;
    else if( j === 0 &&
       buff(0x18) === 0 && buff(0x19) === 0 &&
       buff(0x1a) === 0 && buff(0x1b) === 0 ) 
      plus3_fix = CPC_ISSUE_3;
    else if( j === 1 && plus3_fix === CPC_ISSUE_1 &&
                   buff(0x1b + 8 * j) === 2 )
      plus3_fix = CPC_ISSUE_2;
    else if( i === 38 && j === 0 && buff(0x1b) === 2 )
      plus3_fix = CPC_ISSUE_5;
    else if( j > 1 && plus3_fix === CPC_ISSUE_2 && buff(0x1b + 8 * j) !== 2 )
      plus3_fix = CPC_ISSUE_NONE;
    else if( j > 0 && plus3_fix === CPC_ISSUE_3 &&
       ( buff(0x18 + 8 * j) !== j || buff(0x19 + 8 * j) !== j ||
         buff(0x1a + 8 * j) !== j || buff(0x1b + 8 * j) !== j ) )
      plus3_fix = CPC_ISSUE_NONE;
    else if( j > 10 && plus3_fix === CPC_ISSUE_2 )
      plus3_fix = CPC_ISSUE_NONE;
    else if( i === 38 && j > 0 && plus3_fix === CPC_ISSUE_5 &&
       buff(0x1b + 8 * j) !== 2 - (j & 1) )
      plus3_fix = CPC_ISSUE_NONE;
        }
        trlen += seclen;
        if( seclen % 0x100 )	{
          // --- Every? 128/384/...byte length sector padded
          sector_pad++;
        }	
      }
      if( i < 84 ) {
        fix[i] = plus3_fix;
        if( fix[i] === CPC_ISSUE_4 ) {
          // Type 1 variant DD+ (e.g. Coin Op Hits) */
          bpt = 6500;
        }        
        else if( fix[i] != CPC_ISSUE_NONE ) {
          // --- We assume a standard DD track */
           bpt = 6250;
        }
      }
      bufferPos += trlen + sector_pad * 128 + 256;
      if( bpt > max_bpt )
        max_bpt = bpt;
    }
    if( max_bpt == 0 )
      return this.status = DiskError.DISK_GEOM;
  
    this.density = DiskDensity.Auto;
    this.bytesPerTrack = max_bpt;
    if(this.allocate() !== DiskError.DISK_OK ) {
      return this.status;
    }
  
    this.setTrackIdx(0);

    // --- Rewind to first track
    bufferPos = 0x100;
    for( i = 0; i < this.sides * this.tracksPerSide; i++ ) {
      hdrbPos = bufferPos;
      // --- Skip to data
      bufferPos += 0x100;
      gap = buffer[hdrbPos + 0x16] === 0xff ? GAP_MINIMAL_FM : GAP_MINIMAL_MFM;
      
      // --- Adjust track number
      i = buffer[hdrbPos + 0x10] * this.sides + buffer[hdrbPos + 0x11];
      this.setTrackIdx(i);
      this.index = 0;
      postindex_add( d, gap );
  
      sector_pad = 0;
      for( j = 0; j < buffer[hdrbPos + 0x15]; j++ ) {
        // --- Each sector
        seclen = this.diskFormat == FloppyDiskFormat.CpcExtended ? buffer[hdrbPos + 0x1e + 8 * j ] +	/* data length in sector */
                256 * buffer[hdrbPos + 0x1f + 8 * j ]
              : 0x80 << buffer[hdrbPos + 0x1b + 8 * j ];
        idlen = 0x80 << buffer[hdrbPos + 0x1b + 8 * j ];		/* sector length from ID */
  
        if( idlen === 0 || idlen > ( 0x80 << 0x08 ) ) {
          // --- Error in sector length code -> ignore
          idlen = seclen;
        }    
  
        if( i < 84 && fix[i] == 2 && j == 0 ) {	/* repositionate the dummy track  */
          d->i = 8;
        }
        id_add( d, hdrb[ 0x19 + 8 * j ], hdrb[ 0x18 + 8 * j ],
       hdrb[ 0x1a + 8 * j ], hdrb[ 0x1b + 8 * j ], gap,
                   hdrb[ 0x1c + 8 * j ] & 0x20 && !( hdrb[ 0x1d + 8 * j ] & 0x20 ) ? 
                   CRC_ERROR : CRC_OK );
  
        if( i < 84 && fix[i] == CPC_ISSUE_1 && j == 0 ) {	/* 6144 */
          data_add( d, buffer, NULL, seclen, 
      hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap, 
      hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      CRC_ERROR : CRC_OK, 0x00, NULL );
        } else if( i < 84 && fix[i] == CPC_ISSUE_2 && j == 0 ) {	/* 6144, 10x512 */
          datamark_add( d, hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap );
          gap_add( d, 2, gap );
          buffer->index += seclen;
        } else if( i < 84 && fix[i] == CPC_ISSUE_3 ) {	/* 128, 256, 512, ... 4096k */
          data_add( d, buffer, NULL, 128, 
      hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap, 
      hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      CRC_ERROR : CRC_OK, 0x00, NULL );
          buffer->index += seclen - 128;
        } else if( i < 84 && fix[i] == CPC_ISSUE_4 ) {	/* Nx8192 (max 6384 byte ) */
          data_add( d, buffer, NULL, 6384,
      hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap, 
      hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      CRC_ERROR : CRC_OK, 0x00, NULL );
          buffer->index += seclen - 6384;
        } else if( i < 84 && fix[i] == CPC_ISSUE_5 ) {	/* 9x512 */
        /* 512 256 512 256 512 256 512 256 512 */
          if( idlen == 256 ) {
            data_add( d, NULL, buff, 512,
      hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      CRC_ERROR : CRC_OK, 0x00, NULL );
      buffer->index += idlen;
          } else {
            data_add( d, buffer, NULL, idlen,
      hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      CRC_ERROR : CRC_OK, 0x00, NULL );
    }
        } else {
          data_add( d, buffer, NULL, seclen > idlen ? idlen : seclen,
      hdrb[ 0x1d + 8 * j ] & 0x40 ? DDAM : NO_DDAM, gap,
      hdrb[ 0x1c + 8 * j ] & 0x20 && hdrb[ 0x1d + 8 * j ] & 0x20 ?
      CRC_ERROR : CRC_OK, 0x00, &idx );
          if( seclen > idlen ) {		/* weak sector with multiple copy  */
            cpc_set_weak_range( d, idx, buffer, seclen / idlen, idlen );
            buffer->index += ( seclen / idlen - 1 ) * idlen;
            /* ( ( N * len ) / len - 1 ) * len */
          }
        }
        if( seclen % 0x100 )		/* every? 128/384/...byte length sector padded */
    sector_pad++;
      }
      gap4_add( d, gap );
      buffer->index += sector_pad * 0x80;
    }
    return this.status = DiskError.DISK_OK;
  }





  // ========================================================================================================
  // Old implementation

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

    // protection scheme detector
    // TODO: implement
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
    reader.readByte();
    return {
      trackNo: trackNumber,
      sideNo: sideNumber,
      sectorSize: sectorSize,
      numSectors: numberOfSectors,
      gap3Length: gap3Length,
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
          sectors: []
        });
        continue;
      }

      let trackPointer = this.getTrackPointer(trackIndex);

      this.tracks.push(this.readTrackHeader(reader, trackPointer));

      // add sectors
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

    // copy the data
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

  DISK_LAST_ERROR,
}

export enum DiskDensity {
  Auto = 0,
  DISK_8_SD,		/* 8" SD floppy 5208 MF */
  DISK_8_DD,		/* 8" DD floppy 10416 */
  DISK_SD,		/* 3125 bpt MF */
  DISK_DD,		/* 6250 bpt */
  DISK_DD_PLUS,		/* 6500 bpt e.g. Coin Op Hits */
  DISK_HD,		/* 12500 bpt*/
}

const disk_bpt: number[] = [
  6250,				/* AUTO assumes DD */
  5208,				/* 8" SD */
  10416,			/* 8" DD */
  3125,				/* SD */
  6250,				/* DD */
  6500,				/* DD+ e.g. Coin Op Hits */
  12500,			/* HD */
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
  { gap: 0xff, sync: 0x00, sync_len: 6, mark: 0xff, len: [ 0, 16, 11, 10 ] },
  // --- MINIMAL MFM
  { gap: 0x4e, sync: 0x00, sync_len: 12, mark: 0xa1, len: [ 0, 32, 22, 24 ] },
];

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

  get dataLen (): number {
    return this.containsMultipleWeakSectors
      ? this.actualDataLength /
          (this.actualDataLength / (0x80 << this.sectorSize))
      : this.actualDataLength;
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

function diskTrackLength(bpt: number): number {
  return Math.floor(bpt/8) + (bpt % 8 ? 1 : 0 )
}
