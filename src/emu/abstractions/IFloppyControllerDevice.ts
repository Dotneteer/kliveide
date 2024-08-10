import type { FloppyLogEntry } from "@abstractions/FloppyLogEntry";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { IGenericDevice } from "./IGenericDevice";
import type { IFloppyDiskDrive } from "./IFloppyDiskDrive";

/**
 * This interface represents an abstract floppy controller device
 */
export interface IFloppyControllerDevice extends IGenericDevice<IZxSpectrumMachine> {
  // --- Drive A (if present)
  driveA?: IFloppyDiskDrive;

  // --- Drive B (if present)
  driveB?: IFloppyDiskDrive;

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
