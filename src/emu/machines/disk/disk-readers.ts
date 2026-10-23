import type { DiskInformation, SectorInformation, TrackInformation } from "./DiskInformation";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { DiskImageError } from "./DiskImageError";

/**
 * The CPC DSK container formats (standard "MV - CPCEMU" and extended "EXTENDED CPC DSK").
 *
 * Layout facts, from the format's public description:
 * - a 256-byte Disk-Info block: signature (34 bytes), creator (14), tracks (1), sides (1), then a
 *   uniform track size (standard, 2 bytes LE) or a table of track-size high bytes (extended, one
 *   byte per track in file order, from offset 0x34; 0 = unformatted track);
 * - each track block starts with a Track-Info header: signature (12), 4 unused, cylinder, side,
 *   data rate, recording mode, sector size code N, sector count, GAP#3, filler, then 8 bytes per
 *   sector (C, H, R, N, ST1, ST2, stored length LE - the length only in the extended format);
 * - sector data follows the header at its 256-byte boundary (0x100 unless more than 29 sectors
 *   push the header past it), sectors back to back in header order;
 * - an extended sector storing a multiple of its nominal size holds that many copies (a weak
 *   sector, read differently each time on the real disk).
 */
export const DSK_STANDARD_SIGNATURE = "MV - CPCEMU Disk-File\r\nDisk-Info\r\n";
export const DSK_EXTENDED_SIGNATURE = "EXTENDED CPC DSK File\r\nDisk-Info\r\n";
export const DSK_TRACK_SIGNATURE = "Track-Info\r\n";
export const DSK_DISK_INFO_SIZE = 0x100;
export const DSK_TRACK_HEADER_SIZE = 0x18;
export const DSK_SECTOR_INFO_SIZE = 8;
export const DSK_MAX_TRACK_ENTRIES = 204;
export const DSK_CREATOR_LENGTH = 14;

// --- The signatures are told apart by their first bytes, as every reader of the format does
const STANDARD_PREFIX = "MV - CPC";
const EXTENDED_PREFIX = "EXTENDED CPC";
const DISK_INFO_SUFFIX = "Disk-Info\r\n";

/**
 * The bytes a sector of size code N holds (N above 7 is taken as 7's 16K, the largest the
 * controller can transfer in one go)
 */
export function nominalSectorLength (n: number): number {
  return 0x80 << Math.min(n & 0xff, 7);
}

/** Where the sector data of a track with `sectorCount` sectors starts, from the track's start */
export function trackDataOffset (sectorCount: number): number {
  const header = DSK_TRACK_HEADER_SIZE + sectorCount * DSK_SECTOR_INFO_SIZE;
  return Math.max(0x100, Math.ceil(header / 0x100) * 0x100);
}

/**
 * Reads disk information from the specified disk contents
 * @param contents Binary disk contents to parse
 * @returns Disk information
 */
export function readDiskData (contents: Uint8Array): DiskInformation {
  if (contents.length < DSK_DISK_INFO_SIZE) {
    if (startsWith(contents, 0, STANDARD_PREFIX) || startsWith(contents, 0, EXTENDED_PREFIX)) {
      throw truncated(DSK_DISK_INFO_SIZE, contents.length);
    }
    throw new DiskImageError("notDsk", "Not a valid DSK format");
  }

  // --- Disk-Info block
  let diskFormat: FloppyDiskFormat;
  if (startsWith(contents, 0, STANDARD_PREFIX)) {
    diskFormat = FloppyDiskFormat.Cpc;
  } else if (startsWith(contents, 0, EXTENDED_PREFIX)) {
    diskFormat = FloppyDiskFormat.CpcExtended;
  } else {
    throw new DiskImageError("notDsk", "Not a valid DSK format");
  }
  if (!startsWith(contents, 0x17, DISK_INFO_SUFFIX)) {
    throw new DiskImageError("badHeader", "Invalid DSK header");
  }
  const extended = diskFormat === FloppyDiskFormat.CpcExtended;

  let creator = "";
  for (let i = 0; i < DSK_CREATOR_LENGTH; i++) {
    const ch = contents[0x22 + i];
    if (ch) creator += String.fromCharCode(ch);
  }
  const numTracks = contents[0x30];
  const numSides = contents[0x31];
  if (numSides < 1 || numSides > 2) {
    throw new DiskImageError(
      "badSides",
      `The disk image has ${numSides} sides; a disk has one or two.`,
      { sides: numSides }
    );
  }
  const entries = numTracks * numSides;
  if (numTracks === 0 || (extended && entries > DSK_MAX_TRACK_ENTRIES)) {
    throw new DiskImageError(
      "badTracks",
      `The disk image declares ${numTracks} tracks per side, which the format cannot hold.`,
      { tracks: numTracks }
    );
  }

  // --- The size of each track block in the file
  const standardTrackSize = contents[0x32] | (contents[0x33] << 8);
  const trackSizes: number[] = [];
  for (let i = 0; i < entries; i++) {
    trackSizes.push(extended ? contents[0x34 + i] << 8 : standardTrackSize);
  }

  const disk: DiskInformation = {
    diskFormat,
    creator,
    numTracks,
    numSides,
    tracks: []
  };
  if (!extended) {
    disk.standardTrackSize = standardTrackSize;
  }

  let trackStart = DSK_DISK_INFO_SIZE;
  for (let trackIndex = 0; trackIndex < entries; trackIndex++) {
    const trackSize = trackSizes[trackIndex];
    const cylinder = Math.floor(trackIndex / numSides);
    const side = trackIndex % numSides;
    if (trackSize === 0) {
      // --- An unformatted track takes no room in the file
      disk.tracks.push(unformattedTrack(cylinder, side));
      continue;
    }
    if (trackStart + DSK_TRACK_HEADER_SIZE > contents.length) {
      throw truncated(trackStart + trackSize, contents.length);
    }
    if (!startsWith(contents, trackStart, DSK_TRACK_SIGNATURE)) {
      throw new DiskImageError(
        "missingTrackInfo",
        `Track ${cylinder} on side ${side} has no Track-Info block (at offset ${trackStart}).`,
        { cylinder, side, offset: trackStart }
      );
    }
    disk.tracks.push(readTrack(contents, trackStart, trackSize, trackIndex, extended));
    trackStart += trackSize;
  }

  // --- Whatever follows the last track (EDSK v5's Offset-Info, or padding) is kept as it is
  if (trackStart < contents.length) {
    disk.trailer = contents.slice(trackStart);
  }
  return disk;
}

// --- Reads one formatted track block
function readTrack (
  contents: Uint8Array,
  trackStart: number,
  trackSize: number,
  trackIndex: number,
  extended: boolean
): TrackInformation {
  const at = (offset: number) => contents[trackStart + offset];
  const track: TrackInformation = {
    unformatted: false,
    trackNumber: at(0x10),
    sideNumber: at(0x11),
    dataRate: at(0x12),
    recordingMode: at(0x13),
    sectorSize: at(0x14),
    sectorCount: at(0x15),
    gap3: at(0x16),
    filler: at(0x17),
    sectors: []
  };

  const dataStart = trackDataOffset(track.sectorCount);
  if (dataStart > trackSize && track.sectorCount > 0) {
    throw new DiskImageError(
      "badTrack",
      `Track ${trackIndex} lists ${track.sectorCount} sectors, more than its block can hold.`,
      { track: trackIndex, sectors: track.sectorCount }
    );
  }

  // --- A standard image stores every sector at the track's size; a sector code that does not fit
  // --- (N = 6 in a 6K track, for example) gets an equal share of the track block
  let standardLength = nominalSectorLength(track.sectorSize);
  if (!extended && track.sectorCount > 0) {
    const room = Math.floor((trackSize - dataStart) / track.sectorCount);
    if (standardLength > room) standardLength = room;
  }

  let dataPosition = trackStart + dataStart;
  for (let i = 0; i < track.sectorCount; i++) {
    const info = trackStart + DSK_TRACK_HEADER_SIZE + i * DSK_SECTOR_INFO_SIZE;
    const n = contents[info + 3];
    const actualLength = extended
      ? contents[info + 6] | (contents[info + 7] << 8)
      : standardLength;
    if (dataPosition + actualLength > contents.length) {
      throw truncated(dataPosition + actualLength, contents.length);
    }

    // --- Weak sectors: the extended format stores several copies back to back
    let copies = 1;
    if (extended && n <= 7) {
      const nominal = nominalSectorLength(n);
      if (actualLength > nominal && actualLength % nominal === 0) {
        copies = actualLength / nominal;
      }
    }

    const sector: SectorInformation = {
      C: contents[info],
      H: contents[info + 1],
      R: contents[info + 2],
      N: n,
      SR1: contents[info + 4],
      SR2: contents[info + 5],
      actualLength,
      sectorData: contents.slice(dataPosition, dataPosition + actualLength),
      multipleWeakSectors: copies > 1,
      copies,
      sectorDataPosition: dataPosition
    };
    track.sectors.push(sector);
    dataPosition += actualLength;
  }

  if (dataPosition > trackStart + trackSize) {
    throw new DiskImageError(
      "badTrack",
      `The sectors of track ${trackIndex} overflow its block.`,
      { track: trackIndex, sectors: track.sectorCount }
    );
  }
  return track;
}

/** The entry of an unformatted track */
export function unformattedTrack (cylinder: number, side: number): TrackInformation {
  return {
    unformatted: true,
    trackNumber: cylinder,
    sideNumber: side,
    dataRate: 0,
    recordingMode: 0,
    sectorSize: 0,
    sectorCount: 0,
    gap3: 0,
    filler: 0,
    sectors: []
  };
}

function truncated (needed: number, length: number): DiskImageError {
  return new DiskImageError(
    "truncated",
    `The disk image is cut short: its contents need ${needed} bytes, the file has ${length}.`,
    { needed, length }
  );
}

// --- Compares the bytes at `offset` with the text
function startsWith (contents: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > contents.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (contents[offset + i] !== text.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}
