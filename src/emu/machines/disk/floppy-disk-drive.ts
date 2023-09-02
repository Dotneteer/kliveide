import { FloppyDisk } from "./FloppyDisk";
import { NecUpd765 } from "./NecUpd765";

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDriveDevice {
  /**
   * Initializes the floppy drive instance
   * @param id Floppy disk ID
   * @param floppyDiskController Floppy disk controller
   */
  constructor (
    public readonly id: number,
    private readonly floppyDiskController: NecUpd765
  ) {}

  // --- Signs whether the motor is running
  get isMotorRunning (): boolean {
    return this.floppyDiskController.isMotorOn;
  }

  // --- Signs whether the drive is ready
  get isReady (): boolean {
    return (
      this.isDiskLoaded &&
      this.disk?.tracks &&
      this.disk.tracks.length > 0 &&
      this.floppyDiskController.isMotorOn
    );
  }

  // --- Signs wether the currently loaded disk is write protected
  isWriteProtected: boolean;

  // --- The contents of the loaded floppy disk
    disk: FloppyDisk | undefined;

  // --- Indicates if a disk is loaded into the device
  get isDiskLoaded (): boolean {
    return !!this.disk;
  }

  // --- Seek status
  seekStatus: number;

  // --- Track to seek (used in seek operations)
  seekingTrack: number;

  // --- Current track index in DiskTracks array
  trackIndex: number;

  // --- Sector index in the Sectors array
  sectorIndex: number;

  // --- Current cylinder track ID
  get currentTrackId (): number {
    // default invalid track
    if (!this.disk?.tracks || !this.disk.tracks.length) {
      return 0xff;
    } else if (
      this.trackIndex >= this.disk.tracks.length ||
      this.trackIndex < 0
    ) {
      this.trackIndex = 0;
    }

    return this.disk.tracks[this.trackIndex].trackNo;
  }
  set currentTrackId (value: number) {
    const track = this.disk?.tracks?.find(item => item.trackNo === value);
    if (track) {
      this.trackIndex = this.disk.tracks.indexOf(track) & 0xff;
    }
  }

  // --- Ejects floppy disk
  ejectDisk (): void {
    this.disk = null;
  }
}
