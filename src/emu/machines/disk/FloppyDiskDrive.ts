import { FloppyDisk } from "./FloppyDisk";

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDrive {
  // --- Signs wether the currently loaded disk is write protected
  isWriteProtected: boolean;

  // --- The contents of the loaded floppy disk
  disk: FloppyDisk | undefined;

  // --- Resets the drive
  reset(): void {
    this.isWriteProtected = false;
    this.disk = undefined;
  }
  // --- Indicates if a disk is loaded into the device
  get isDiskLoaded (): boolean {
    return !!this.disk;
  }

  // --- Read/write to data byte 0x00nn or 0xffnn
  data: number;

  // --- Track to seek (used in seek operations)
  seekingTrack: number = 0;

  // --- Current head index
  headIndex: number = 0;

  // --- Current track index in DiskTracks array
  trackIndex: number = 0;

  // --- Sector index in the Sectors array
  sectorIndex: number = 0;

  // --- Ejects floppy disk
  ejectDisk (): void {
    this.disk = null;
  }
}
