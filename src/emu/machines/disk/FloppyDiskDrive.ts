import type { DiskSurface } from "./DiskSurface";
import type { DiskInformation } from "./DiskInformation";
import type {
  IFloppyDiskDrive,
  ChangedSectors,
  SectorChanges
} from "@emu/abstractions/IFloppyDiskDrive";

import { createDiskSurface } from "./DiskSurface";
import { readDiskData } from "./disk-readers";
import { FloppyControllerDevice } from "./FloppyControllerDevice";

// --- Percentage of motor speed increment in a single complete frame
const MOTOR_SPEED_INCREMENT = 2;
const MOTOR_SPEED_DECREMENT = 2;

// --- Random factors when positioning the drive's head
const LOAD_RND_FACTOR = 2;
const STEP_RND_FACTOR = 34;

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDrive implements IFloppyDiskDrive {
  constructor(
    public readonly controller: FloppyControllerDevice,
    public readonly unitNumber: number
  ) {
    this.reset();
  }

  // --- Resets the drive
  reset(): void {
    delete this.contents;
    delete this.disk;
    delete this.surface;
    delete this.motorAccelerating;

    this.writeProtected = false;
    this.track0Mark = true;
    this.hasTwoHeads = true;
    this.currentHead = 0;
    this.maxCylinders = 42;
    this.currentCylinder = 0;
    this.atIndexWhole = true;
    this.ready = false;
    this.motorSpeed = 0;
    this.motorOn = false;
    this.headLoaded = false;
    this.dataPosInTrack = 0;
    this.currentData = 0;
    this.currentTrackIndex = -1;
    this.currentSectorIndex = -1;
    this.marks = MarkFlags.None;
    this.dirtySectors = new Set<number>();
  }

  // --- Indicates if the drive is selected for active operation
  selected: boolean;

  // --- Indicates if the drive has a disk loaded
  get hasDiskLoaded(): boolean {
    return !!this.contents;
  }

  // --- Selects the drive for active/inactive operation
  selectDrive(selected: boolean): void {
    this.selected = selected;
    this.loadHead(selected);
  }

  // --- Loads the disk with the specified contents into the drive
  loadDisk(contents: Uint8Array, writeProtected: boolean): void {
    // --- Load the disk data
    this.contents = contents;
    this.disk = readDiskData(contents);
    this.surface = createDiskSurface(this.disk);

    this.writeProtected = writeProtected;
    if (this.selected) {
      this.loadHead(true);
    }

    this.setDataToCurrentCylinder(LOAD_RND_FACTOR);
    this.ready = this.motorOn && this.motorSpeed === 100 && this.hasDiskLoaded;
  }

  // --- Ejects the disk from the drive
  ejectDisk(): void {
    delete this.contents;
    delete this.disk;
    delete this.surface;
    this.atIndexWhole = true;
    this.writeProtected = false;
    if (this.selected) {
      this.loadHead(false);
    }
    this.ready = false;
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

  // --- Signs if the drive's head is loaded
  headLoaded: boolean;

  // --- The current data position within the current track
  dataPosInTrack: number;

  // --- The data last read from the disk
  currentData: number;

  // --- The current track index within the surface data
  currentTrackIndex: number;

  // --- The current sector index within the track
  currentSectorIndex: number;

  // --- The type of marks found when reading data
  marks: number;

  // --- Signs that drive data has been changed
  dirtySectors: ChangedSectors;

  // --- Turn on the floppy drive's motor
  turnOnMotor(): void {
    if (this.motorOn) return;
    this.motorOn = true;
    this.motorAccelerating = true;
  }

  // --- Turn off the floppy drive's motor
  turnOffMotor(): void {
    if (!this.motorOn) return;
    this.motorOn = false;
    this.motorAccelerating = false;
  }

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted(): void {
    this.ready = this.motorSpeed === 100 && this.hasDiskLoaded;
    if (this.motorAccelerating === undefined) return;
    if (this.motorAccelerating) {
      // --- Handle acceleration
      if (this.motorSpeed < 100) {
        this.motorSpeed = Math.min(100, this.motorSpeed + MOTOR_SPEED_INCREMENT);
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
    this.ready = this.motorSpeed === 100 && this.hasDiskLoaded;
  }

  // --- Step one cylinder into the specified direction
  step(directionIn: boolean): void {
    if (directionIn) {
      // --- Direction out
      if (this.currentCylinder > 0) {
        this.currentCylinder--;
      }
    } else {
      // --- Direction in
      if (this.currentCylinder < this.maxCylinders - 1) {
        this.currentCylinder++;
      }
    }
    this.track0Mark = this.currentCylinder === 0;
    this.setDataToCurrentCylinder(STEP_RND_FACTOR);
  }

  // --- Loads or unloads the drive's head
  loadHead(load: boolean): void {
    if (!this.hasDiskLoaded || this.headLoaded === load) {
      return;
    }
    this.headLoaded = load;
    this.setDataToCurrentCylinder(LOAD_RND_FACTOR);
  }

  // --- Sets the data position to the current cylinder's surface data using the specified random factor
  setDataToCurrentCylinder(randomFactor: number): void {
    if (!this.hasDiskLoaded) return;

    const head = this.currentHead;
    if ((this.disk.numSides === 1 && head === 1) || this.currentCylinder >= this.disk.numTracks) {
      // --- No data available for the disk
      this.currentTrackIndex = -1;
      return;
    }

    // --- Set the index to the specified track
    this.currentTrackIndex = this.disk.numSides * this.currentCylinder + head;
    this.dataPosInTrack = 0;
    if (randomFactor > 0) {
      // --- Generate a bpt/fact +-10% triangular distribution skip in bytes
      const trackLength = this.surface.tracks[this.currentTrackIndex].trackLength;

      // --- Random number between -9 and 9
      const rand = this.controller.disableRandomSeek
        ? 2
        : (Math.floor(Math.random() * 10) % 10) + (Math.floor(Math.random() * 10) % 10) - 9;
      this.dataPosInTrack +=
        Math.floor(trackLength / randomFactor) +
        Math.floor((trackLength * rand) / randomFactor / 100);
      while (this.dataPosInTrack >= trackLength) this.dataPosInTrack -= trackLength;
    }
    this.atIndexWhole = !this.dataPosInTrack;
  }

  // --- Read the next data from the disk
  readData(): void {
    if (!this.positionData(false)) {
      // --- Positioning the data is not done yet.
      return;
    }
    this.readDataValue();
  }

  // --- Write the current data to the disk
  writeData(): void {
    if (!this.positionData(true)) {
      // --- Positioning the data is not done yet.
      return;
    }
    this.writeDataValue();
  }

  // --- Wait while the revolution reaches the index hole
  waitIndexHole(): void {
    if (!this.selected || !this.ready) {
      return;
    }

    this.dataPosInTrack = 0;
    this.atIndexWhole = true;
  }

  // --- Reads the data of changed sectors from the disk surface and immediately clears
  // --- the change sector information
  getChangedSectors(): SectorChanges {
    const changes = new Map<number, Uint8Array>();
    for (const sectorKey of this.dirtySectors) {
      const trackIndex = Math.floor(sectorKey / 100);
      const sectorIndex = sectorKey % 100;
      const track = this.surface.tracks[trackIndex];
      const sector = track.sectors[sectorIndex - 1];
      changes.set(sectorKey, sector.sectordata.view());
    }
    this.dirtySectors.clear();
    return changes;
  }

  // --- Helpers

  // --- Positions the data to the specified operation
  private positionData(write: boolean): boolean {
    if (!this.selected || !this.ready || !this.headLoaded || this.currentTrackIndex < 0) {
      if (this.hasDiskLoaded && this.motorOn && this.motorSpeed === 100) {
        // --- The disk is spinnng
        if (this.dataPosInTrack >= this.surface.bytesPerTrack) {
          this.dataPosInTrack = 0;
        }
        if (!write) {
          // --- No data
          this.currentData = 0x100;
        }
        this.dataPosInTrack++;
        if (this.dataPosInTrack >= this.surface.bytesPerTrack) {
          this.dataPosInTrack = 0;
        }
        this.atIndexWhole = !this.dataPosInTrack;
      }
      // --- Positioning is pending
      return false;
    }

    // --- Positioning done
    return true;
  }

  // --- Reads the next data from the disk (after positioning)
  private readDataValue(): void {
    const trackSurface = this.surface.tracks[this.currentTrackIndex];
    this.currentData = trackSurface.trackData[this.dataPosInTrack];
    if (trackSurface.clockData.testBit(this.dataPosInTrack)) {
      this.currentData |= 0xff00;
    }
    this.marks = MarkFlags.None;
    if (trackSurface.fmData.testBit(this.dataPosInTrack)) {
      this.marks |= MarkFlags.FM;
    }
    if (trackSurface.weakSectorData.testBit(this.dataPosInTrack)) {
      this.marks |= MarkFlags.Weak;
      // --- Mess up weak data
      this.currentData &= Math.floor(256 * Math.random());
      this.currentData |= Math.floor(256 * Math.random());
    }

    this.dataPosInTrack++;
    if (this.dataPosInTrack >= this.surface.bytesPerTrack) {
      this.dataPosInTrack = 0;
    }
    this.atIndexWhole = !this.dataPosInTrack;
  }

  // --- Writes the current data to the disk (after positioning)
  private writeDataValue(): void {
    const trackSurface = this.surface.tracks[this.currentTrackIndex];
    if (this.writeProtected) {
      this.dataPosInTrack++;
      this.atIndexWhole = this.dataPosInTrack >= trackSurface.trackLength;
      return;
    }
    trackSurface.trackData[this.dataPosInTrack] = this.currentData & 0x00ff;
    trackSurface.clockData.setBit(this.dataPosInTrack, !!(this.currentData & 0xff00));
    trackSurface.fmData.setBit(this.dataPosInTrack, !!(this.marks & 0x01));
    trackSurface.fmData.setBit(this.dataPosInTrack, false);
    this.dirtySectors.add(this.sectorKey());

    this.dataPosInTrack++;
    if (this.dataPosInTrack >= this.surface.bytesPerTrack) {
      this.dataPosInTrack = 0;
    }
    this.atIndexWhole = !this.dataPosInTrack;
  }

  private sectorKey(): number {
    return this.currentTrackIndex * 100 + this.currentSectorIndex;
  }
}

enum MarkFlags {
  None = 0,
  FM = 0x01,
  Weak = 0x02
}
