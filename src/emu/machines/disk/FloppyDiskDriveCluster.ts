import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { NecUpd765 } from "./NecUpd765";
import { FloppyDiskDriveDevice } from "./floppy-disk-drive";
import { FloppyDisk } from "./FloppyDisk";

// --- Represents a cluster of floppy disk drives
export class FloppyDiskDriveCluster {
  private readonly _floppyDiskDrivesUsed = 2;
  private _floppyDiskController: NecUpd765;
  private readonly _floppyDiskDrives: FloppyDiskDriveDevice[] = [];

  private _floppyDiskDriveSlot = 0;

  // --- Initializes the floppy disk cluster attached to the specified machine
  public constructor (private readonly machine: IZxSpectrumMachine) {
    this._floppyDiskController = new NecUpd765(this);
    this.reset();
  }

  // --- Signs whether the motor is running
  get isMotorOn () {
    return this._floppyDiskController.isMotorOn;
  }

  // --- Signs whether a disk is inserted in active drive slot
  get isFloppyDiskLoaded () {
    return (
      this.activeDrive && this.activeDrive.isDiskLoaded
    );
  }

  // --- The contents of the active floppy disk Active floppy disk
  get floppyDisk () {
    return this.activeDrive?.disk;
  }

  // --- Read the data register of the FDC
  readDataRegister () {
    return this._floppyDiskController.readDataRegister();
  }

  // --- Read the main status register of the FDC
  readMainStatusRegister () {
    return this._floppyDiskController.readMainStatusRegister();
  }

  // --- Write the data register of the FDC
  writeDataRegister (value: number): void {
    this._floppyDiskController.writeDataRegister(value);
  }

  // --- The currently active floppy drive device
  activeDrive?: FloppyDiskDriveDevice;

  // --- the active floppy disk drive slot
  get floppyDiskDriveSlot (): number {
    return this._floppyDiskDriveSlot;
  }
  set floppyDiskDriveSlot (value: number) {
    this._floppyDiskDriveSlot = value;
    this.activeDrive =
      this._floppyDiskDrives[this._floppyDiskDriveSlot];
  }

  // --- Load floppy disk data in active slot
  loadDisk (contents: FloppyDisk) {
    if (this.activeDrive) {
      this.activeDrive.disk = contents;
    }
  }

  // --- Ejects floppy disk from active slot
  ejectDisk (): void {
    this.activeDrive.ejectDisk();
  }

  // --- Initializes the floppy subsystem
  private reset () {
    for (let i = 0; i < this._floppyDiskDrivesUsed; i++) {
      this._floppyDiskDrives[i] = new FloppyDiskDriveDevice(
        i,
        this._floppyDiskController
      );
    }
    this.floppyDiskDriveSlot = 0;
  }
}
