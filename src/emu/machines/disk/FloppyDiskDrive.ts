import { FloppyDisk } from "./FloppyDisk";

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDrive {
  // --- Signs wether the currently loaded disk is write protected
  isWriteProtected: boolean;

  // --- The contents of the loaded floppy disk
  disk: FloppyDisk | undefined;

  // --- Indicates if a disk is loaded into the device
  get isDiskLoaded (): boolean {
    return !!this.disk;
  }

  // --- Track to seek (used in seek operations)
  seekingTrack: number = -1;

  // --- Current head index
  headIndex: number = -1;

  // --- Current track index in DiskTracks array
  trackIndex: number = -1;

  // --- Sector index in the Sectors array
  sectorIndex: number = -1;

  // --- Ejects floppy disk
  ejectDisk (): void {
    this.disk = null;
  }
}