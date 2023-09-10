import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { IGenericDevice } from "./IGenericDevice";
import { FloppyLogEntry } from "@abstractions/FloppyLogEntry";

export interface IFloppyControllerDevice
  extends IGenericDevice<IZxSpectrumMachine> {
  // --- Indicates if Drive #1 is present
  isDriveAPresent: boolean;

  // --- Indicates if Drive #2 is present
  isDriveBPresent: boolean;

  // --- Indicates if disk in Drive #1 is write protected
  isDiskAWriteProtected: boolean;

  // --- Indicates if disk in Drive #2 is write protected
  isDiskBWriteProtected: boolean;

  // --- Gets the value of the data register (8-bit)
  readDataRegister(): number;

  // --- Gets the value of the Main Status Register
  readMainStatusRegister(): number;

  // --- Writes the value of the data register (8-bit)
  writeDataRegister(value: number): void;

  // --- Resets the device
  reset(): void;

  // --- Adjust the current motor speed
  handleMotorSpeed(): void;

  // --- Executes the floppy event handler
  onFloppyEvent(): void;

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
