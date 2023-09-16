import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { IGenericDevice } from "./IGenericDevice";
import { FloppyLogEntry } from "@abstractions/FloppyLogEntry";
import { FloppyDisk } from "@emu/machines/disk/FloppyDisk";

export interface IFloppyControllerDevice
  extends IGenericDevice<IZxSpectrumMachine> {
  // --- Indicates if Drive #1 is present
  isDriveAPresent: boolean;

  // --- Indicates if Drive #2 is present
  isDriveBPresent: boolean;

  // --- Indicates if disk in Drive #1 is write protected
  readonly isDiskAWriteProtected: boolean;

  // --- Indicates if disk in Drive #2 is write protected
  readonly isDiskBWriteProtected: boolean;

  // --- Loads the specified floppy disk into drive A
  loadDiskA(disk: FloppyDisk): void;

  // --- Ejects disk from drive A
  ejectDiskA(): void;

  // --- Loads the specified floppy disk into drive B
  loadDiskB(disk: FloppyDisk): void;

  // --- Ejects disk from drive B
  ejectDiskB(): void;

  // --- Gets the value of the data register (8-bit)
  readDataRegister(): number;

  // --- Gets the value of the Main Status Register
  readMainStatusRegister(): number;

  // --- Writes the value of the data register (8-bit)
  writeDataRegister(value: number): void;

  // --- Resets the device
  reset(): void;

  // --- Turn on the floppy drive's motor
  turnOnMotor(): void;

  // --- Turn off the floppy drive's motor
  turnOffMotor(): void;

  // --- Get the floppy drive's motor speed
  getMotorSpeed(): number;

  // --- Get the floppy drive's save light value
  getFloppySaveLight(): boolean;

  // --- Gets the log entries
  getLogEntries(): FloppyLogEntry[];

  // --- Clears all log entries
  clearLogEntries(): void;

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted(): void;
}
