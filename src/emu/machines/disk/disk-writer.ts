import type { DiskInformation, TrackInformation } from "./DiskInformation";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { DiskImageError } from "./DiskImageError";
import {
  DSK_CREATOR_LENGTH,
  DSK_DISK_INFO_SIZE,
  DSK_EXTENDED_SIGNATURE,
  DSK_MAX_TRACK_ENTRIES,
  DSK_SECTOR_INFO_SIZE,
  DSK_STANDARD_SIGNATURE,
  DSK_TRACK_HEADER_SIZE,
  DSK_TRACK_SIGNATURE,
  nominalSectorLength,
  trackDataOffset
} from "./disk-readers";

/**
 * Writes a disk model as a DSK file: the inverse of `readDiskData`.
 *
 * The model's `diskFormat` picks the container. A standard image can only hold tracks whose
 * sectors all have the track's size and no unformatted tracks; `canWriteStandard` says whether the
 * model fits, and writing one that does not throws. The extended format holds anything the model
 * can.
 *
 * Every `sectorDataPosition` in the model is updated to where the sector landed in the new file,
 * so the model can patch the file afterwards.
 */
export function writeDiskData (disk: DiskInformation): Uint8Array {
  const extended = disk.diskFormat === FloppyDiskFormat.CpcExtended;
  const entries = disk.numTracks * disk.numSides;
  if (disk.numSides < 1 || disk.numSides > 2) {
    throw new DiskImageError("badSides", `A disk has one or two sides, not ${disk.numSides}.`, {
      sides: disk.numSides
    });
  }
  if (disk.tracks.length !== entries || disk.numTracks === 0 || disk.numTracks > 0xff) {
    throw new DiskImageError(
      "badTracks",
      `The disk model has ${disk.tracks.length} track entries for ${disk.numTracks} tracks on ${disk.numSides} sides.`,
      { tracks: disk.numTracks }
    );
  }
  if (extended && entries > DSK_MAX_TRACK_ENTRIES) {
    throw new DiskImageError(
      "badTracks",
      `An extended DSK holds at most ${DSK_MAX_TRACK_ENTRIES} tracks.`,
      { tracks: disk.numTracks }
    );
  }

  // --- The size of each track block
  let standardTrackSize = 0;
  if (!extended) {
    const problem = standardProblem(disk);
    if (problem) {
      throw new DiskImageError("badTrack", `The disk cannot be written as a standard DSK: ${problem}`, {
        track: -1,
        sectors: 0
      });
    }
    standardTrackSize = Math.max(
      disk.standardTrackSize ?? 0,
      ...disk.tracks.map((t) => trackBlockLength(t, false))
    );
    // --- The uniform track size is a 16-bit field
    if (standardTrackSize > 0xffff) {
      throw new DiskImageError("tooLarge", "A standard DSK track cannot exceed 65,535 bytes.", {
        size: standardTrackSize
      });
    }
  }
  const sizes = disk.tracks.map((t) => (extended ? trackBlockLength(t, true) : standardTrackSize));
  for (const size of sizes) {
    if (extended && size > 0xff00) {
      throw new DiskImageError("tooLarge", "An extended DSK track cannot exceed 65,280 bytes.", {
        size
      });
    }
  }

  const trailer = disk.trailer ?? new Uint8Array(0);
  const total = DSK_DISK_INFO_SIZE + sizes.reduce((a, b) => a + b, 0) + trailer.length;
  const out = new Uint8Array(total);

  // --- Disk-Info block
  writeText(out, 0, extended ? DSK_EXTENDED_SIGNATURE : DSK_STANDARD_SIGNATURE);
  const creator = disk.creator ?? "";
  for (let i = 0; i < DSK_CREATOR_LENGTH && i < creator.length; i++) {
    out[0x22 + i] = creator.charCodeAt(i) & 0xff;
  }
  out[0x30] = disk.numTracks;
  out[0x31] = disk.numSides;
  if (extended) {
    sizes.forEach((size, i) => (out[0x34 + i] = size >> 8));
  } else {
    out[0x32] = standardTrackSize & 0xff;
    out[0x33] = standardTrackSize >> 8;
  }

  // --- Track blocks
  let trackStart = DSK_DISK_INFO_SIZE;
  disk.tracks.forEach((track, index) => {
    if (!track.unformatted) {
      writeTrack(out, trackStart, track, extended);
    }
    trackStart += sizes[index];
  });
  out.set(trailer, trackStart);
  return out;
}

/** Can the model be written as a standard (not extended) DSK? */
export function canWriteStandard (disk: DiskInformation): boolean {
  return standardProblem(disk) === undefined;
}

// --- Why a model does not fit the standard format, or undefined when it does
function standardProblem (disk: DiskInformation): string | undefined {
  for (let i = 0; i < disk.tracks.length; i++) {
    const track = disk.tracks[i];
    if (track.unformatted) {
      return `track ${i} is unformatted.`;
    }
    const length = standardSectorLength(track);
    for (const sector of track.sectors) {
      if (sector.actualLength !== length) {
        return `track ${i} has a sector of ${sector.actualLength} bytes instead of ${length}.`;
      }
    }
  }
  return undefined;
}

// --- The size every sector of a track has in a standard image
function standardSectorLength (track: TrackInformation): number {
  return track.sectors.length > 0 ? track.sectors[0].actualLength : nominalSectorLength(track.sectorSize);
}

/** The bytes a track's block takes in the file */
export function trackBlockLength (track: TrackInformation, extended: boolean): number {
  if (track.unformatted) return 0;
  const data = track.sectors.reduce((sum, s) => sum + s.actualLength, 0);
  const length = trackDataOffset(track.sectors.length) + data;
  // --- Extended track sizes are stored as a high byte: round up to a 256-byte boundary
  return extended ? Math.ceil(length / 0x100) * 0x100 : length;
}

function writeTrack (out: Uint8Array, trackStart: number, track: TrackInformation, extended: boolean): void {
  writeText(out, trackStart, DSK_TRACK_SIGNATURE);
  out[trackStart + 0x10] = track.trackNumber;
  out[trackStart + 0x11] = track.sideNumber;
  out[trackStart + 0x12] = track.dataRate ?? 0;
  out[trackStart + 0x13] = track.recordingMode ?? 0;
  out[trackStart + 0x14] = track.sectorSize;
  out[trackStart + 0x15] = track.sectors.length;
  out[trackStart + 0x16] = track.gap3;
  out[trackStart + 0x17] = track.filler;
  track.sectorCount = track.sectors.length;

  let dataPosition = trackStart + trackDataOffset(track.sectors.length);
  track.sectors.forEach((sector, i) => {
    const info = trackStart + DSK_TRACK_HEADER_SIZE + i * DSK_SECTOR_INFO_SIZE;
    out[info] = sector.C;
    out[info + 1] = sector.H;
    out[info + 2] = sector.R;
    out[info + 3] = sector.N;
    out[info + 4] = sector.SR1;
    out[info + 5] = sector.SR2;
    if (extended) {
      out[info + 6] = sector.actualLength & 0xff;
      out[info + 7] = sector.actualLength >> 8;
    }
    out.set(sector.sectorData.subarray(0, sector.actualLength), dataPosition);
    sector.sectorDataPosition = dataPosition;
    dataPosition += sector.actualLength;
  });
}

function writeText (out: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    out[offset + i] = text.charCodeAt(i);
  }
}
