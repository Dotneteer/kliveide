import { DiskSurface } from "@emu/machines/disk/DiskSurface";
import { DiskInformation } from "@emu/machines/disk/DiskInformation";
import { IFloppyControllerDevice } from "./IFloppyControllerDeviceNew";

/**
 * This interface represents a floppy disk drive
 */
export interface IFloppyDiskDrive {
  // --- The controller managing this drive
  controller: IFloppyControllerDevice;

  // --- Indicates if the drive has a disk loaded
  readonly hasDiskLoaded: boolean;

  // --- Loads the disk with the specified contents into the drive
  loadDisk(contents: Uint8Array): void;

  // --- Ejects the disk from the drive
  ejectDisk(): void;

  // --- Indicates if the drive is selected for active operation
  readonly selected: boolean;

  // --- Selects the drive for active/inactive operation
  selectDrive(selected: boolean): void;

  // --- The "write protection" state of the disk
  writeProtected: boolean;

  // --- The contents data of the disk
  readonly contents?: Uint8Array;

  // --- Disk information
  readonly disk: DiskInformation;

  // --- The surface data of the disk
  readonly surface?: DiskSurface;

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

  // --- The current cylinder number
  currentCylinder: number;

  // --- The maximum cylinder number of the drive
  maxCylinders: number;

  // --- Signs if the drive's head is loaded
  headLoaded: boolean;

  // --- Is the floppy motor turned on?
  readonly motorOn: boolean;

  // --- Is the motor accelerating or slowing down?
  readonly motorAccelerating?: boolean;
  
  // --- Relative motor speed: 0%: fully stopped, 100%: fully started
  readonly motorSpeed: number;

  // --- The current data position within the current track
  dataPosInTrack: number;

  // --- The data last read from the disk
  currentData: number;

  // --- The current track index within the surface data
  currentTrackIndex: number;

  // --- The type of marks found when reading data
  marks: number;

  // --- Turn on the floppy drive's motor
  turnOnMotor (): void;

  // --- Turn off the floppy drive's motor
  turnOffMotor (): void;

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted(): void;

  // --- Step one cylinder into the specified direction
  step (directionIn: boolean): void;

  // --- Loads or unloads the drive's head
  loadHead(load: boolean): void;

  // --- Sets the data position to the current cylinder's surface data using the specified random factor
  setDataToCurrentCylinder(randomFactor: number): void;

  // --- Read the next data from the disk into currentData
  readData(): void;
}
