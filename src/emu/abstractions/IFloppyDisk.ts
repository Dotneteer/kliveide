import { BufferSpan } from "@emu/machines/disk/BufferSpan";
import { DiskDensity } from "./DiskDensity";
import { DiskError } from "./DiskError";
import { FloppyDiskFormat } from "./FloppyDiskFormat";
import { DiskTrackInfo } from "./DiskTrackInfo";

/**
 * Represents a floppy disk with its surface data and current state
 */
export interface IFloppyDisk {
  // --- Disk format
  diskFormat: FloppyDiskFormat;

  // --- The disk's representation in a .DSK file
  readonly diskFileData: Uint8Array;

  // --- Binary disk data (physical surface)
  readonly data: Uint8Array;

  // --- The number of physical sides
  readonly sides: number;

  // --- Number of tracks per side
  readonly tracksPerSide: number;

  // --- Number of bytes per track
  readonly bytesPerTrack: number;

  // --- Signs whether is write-protect tab on the disk
  readonly isWriteProtected: boolean;

  // --- Has the disk data changed?
  readonly dirty: boolean;

  // --- Disk status
  readonly status: DiskError;

  // --- Disk density
  readonly density: DiskDensity;

  // --- The disk contains week sectors
  readonly hasWeakSectors: boolean;

  // --- Track length
  readonly trackLength: number;

  // --- Buffer to track data
  readonly trackData: BufferSpan;

  // --- Buffer to clock data
  readonly clockData: BufferSpan;

  // --- Buffer to MF/MFM mark bits
  readonly fmData: BufferSpan;

  // --- Buffer to weak mark bits/weak data
  readonly weakData: BufferSpan;

  // --- Interim index position while processing disk data
  readonly indexPos: number;

  // --- Extra physical info about a track
  readonly trackInfo: DiskTrackInfo[];

  // --- Sets the index structures to the specified track index
  setTrackIndex(trackNo: number): void;
}
