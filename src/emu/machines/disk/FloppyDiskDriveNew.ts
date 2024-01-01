import { DiskSurface, createDiskSurface } from "./DiskSurface";
import { DiskInformation } from "./DiskInformation";
import { readDiskData } from "./disk-readers";
import { FloppyControllerDevice } from "./FloppyControllerDeviceNew";
import { IFloppyDiskDrive } from "@emu/abstractions/IFloppyDiskDrive";

// --- Percentage of motor speed increment in a single complete frame
const MOTOR_SPEED_INCREMENT = 2;
const MOTOR_SPEED_DECREMENT = 2;

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDrive implements IFloppyDiskDrive {
  constructor (public readonly controller: FloppyControllerDevice) {
    delete this.contents;
    delete this.disk;
    delete this.surface;
    delete this.motorAccelerating;

    this.writeProtected = true;
    this.track0Mark = true;
    this.hasTwoHeads = false;
    this.ready = false;
    this.motorSpeed = 0;
    this.motorOn = false;
  }

  // --- Indicates if the drive is selected for active operation
  selected: boolean;

  // --- Indicates if the drive has a disk loaded
  get hasDiskLoaded (): boolean {
    return !!this.contents;
  }

  // --- Loads the disk with the specified contents into the drive
  loadDisk (contents: Uint8Array): void {
    if (this.contents) {
      // --- Eject the disk first
      this.ejectDisk();
    }

    // --- Load the disk data
    this.contents = contents;
    this.disk = readDiskData(contents);
    this.surface = createDiskSurface(this.disk);

    // TODO: Set up the drive with the loaded disk
  }

  // --- Ejects the disk from the drive
  ejectDisk (): void {
    // TODO: Set drive info to empty
    delete this.contents;
    delete this.disk;
    delete this.surface;
  }

  // --- The "write protection" state of the disk
  writeProtected: boolean;

  // --- The contents data of the disk
  contents?: Uint8Array;

  // --- Disk information
  disk: DiskInformation;

  // --- The surface data of the disk
  surface?: DiskSurface;

  // --- Does this drive has two heads?
  hasTwoHeads: boolean;

  // --- The current drive head
  currentHead: number;

  // --- Is at the index hole?
  atIndexWhole: boolean;

  // --- Track 0 mark
  track0Mark: boolean;

  // --- Indicates if the drive is ready
  ready: boolean;

  // --- Is the floppy motor turned on?
  motorOn: boolean;

  // --- Is the motor accelerating or slowing down?
  motorAccelerating: boolean;

  // --- Relative motor speed: 0%: fully stopped, 100%: fully started
  motorSpeed: number;

  // --- The current cylinder number
  currentCylinder: number;

  // --- The maximum cylinder number of the drive
  maxCylinders: number;

  // --- Turn on the floppy drive's motor
  turnOnMotor (): void {
    if (this.motorOn) return;
    this.motorOn = true;
    this.motorAccelerating = true;
  }

  // --- Turn off the floppy drive's motor
  turnOffMotor (): void {
    if (!this.motorOn) return;
    this.motorOn = false;
    this.motorAccelerating = false;
  }

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted (): void {
    if (this.motorAccelerating === undefined) return;
    if (this.motorAccelerating) {
      // --- Handle acceleration
      if (this.motorSpeed < 100) {
        this.motorSpeed = Math.min(
          100,
          this.motorSpeed + MOTOR_SPEED_INCREMENT
        );
      } else {
        delete this.motorAccelerating;
      }
    } else {
      // --- Handle slowing down
      if (this.motorSpeed > 0) {
        this.motorSpeed = Math.max(0, this.motorSpeed - MOTOR_SPEED_DECREMENT);
      } else {
        delete this.motorAccelerating;
      }
    }
  }

  // --- Step one cylinder into the specified direction
  step (directionIn: boolean): void {
    // TODO: Implement this
  }
}
