// --- If any of the Dn bits Iis set FDC will not accept read or write command.

import {
  FloppyLogEntry,
  PortOperationType
} from "@abstractions/FloppyLogEntry";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { FloppyDiskDrive } from "./FloppyDiskDrive";

// --- FDD0 Busy
const MSR_D0 = 0x01;

// --- FDD1 Busy
const MSR_D1 = 0x02;

// --- FDD2 Busy
const MSR_D2 = 0x04;

// --- FDD3 Busy
const MSR_D3 = 0x08;

// --- FDC Busy. A Read or Write command is in process.
// --- FDC will not accept any other command.
const MSR_CB = 0x10;

// --- Execution Mode. This bit is set only during execution phase in non-DMA
// --- mode When DB5 goes low, execution phase has ended and result phase has started.
// --- It operates only during non-DMA mode of operation.
const MSR_EXM = 0x20;

// --- Data Input/Output
// --- Indicates direction of data transfer between FDC and data register If DIO = 1, then transfer is from data register to
// --- the processor. If DIO = 0, then transfer is from the processor to data register
const MSR_DIO = 0x40;

// --- Request For Master
// --- Indicates data register IS ready to send or receive data to or from the processor.
// --- Both bits DIO and RQM should be used to perform the hand-shaking functions of "ready" and "directron" to the processor
const MSR_RQM = 0x80;

// --- Head Address. This flag is used to indicate the state of the head at interrupt
const SR0_HD = 0x04;

// --- Not Ready
// --- When the FDD is in the not-ready state and a Read or Write command is issued, this flag is set If a Read
// --- or Write command is issued to side 1 of a single-sided drive, then this flag is set.
const SR0_NR = 0x08;

// --- Equipment Check. If a fault signal received from the FDD, or if the track 0 signal fails to occur after 77
// --- step pulses, this flag is set.
const SR0_EC = 0x10;

// --- Seek End. When the FDC completes the Seek command, this flag is set to high.
const SR0_SE = 0x20;

// --- Abnormal termination of command, (AT) Execution of command was started but was not successfully completed.
const SR0_AT = 0x40;

// --- Abnormal termination of command, (IC)
const SR0_IC = 0x80;

// --- Missing Address Mark
// --- This bit is set if the FDC does not detect the IDAM before 2 index pulses It is also set if
// --- the FDC cannot find the DAM or DDAM after the IDAM is found. MD bit of ST2 is also ser at this time.
const SR1_MA = 0x01;

// --- Not Writeable
// --- During execution of Write Data, Write Deleted Data or Write ID command. if the FDC.
// ---  detect: a write protect srgnal from the FDD. then this flag is Set.
const SR1_NW = 0x02;

// --- No Data
// --- During execution of Read Data. Read Deleted Data Write Data. Write Deleted Data or Scan command,
// --- if the FDC cannot find the sector specified in the IDR(2) Register, this flag is set.
const SR1_ND = 0x04;

// --- No Data
// --- During execution of Read Data. Read Deleted Data Write Data. Write Deleted Data or Scan command,
// --- if the FDC cannot find the sector specified in the IDR(2) Register, this flag is set.
const SR1_NR = 0x08;

// --- Over Run
// --- If the FDC i s not serviced by the host system during data transfers within a certain time interval. this flaa i s set.
const SR1_OR = 0x10;

// --- Data Error
// --- If the FDC i s not serviced by the host system during data transfers within a certain time interval. this flaa i s set.
const SR1_DE = 0x20;

// --- End of Track
// --- When the FDC tries to access a sector beyond the final sector of a cylinder, this flag is set.
const SR1_EN = 0x80;

// --- Missing Address Mark in Data Field
// --- When data IS read from the medium, if the FDC cannot find a data address mark or
// --- deleted data address mark, then this flag is set.
const SR2_MD = 0x01;

// --- Bad Cylinder
// --- This bit is related to the ND bit. and when the contents of C on the medium is different from
// --- that stored in the IDR and the contents of C is FFH. then this flag is set.
const SR2_BC = 0x02;

// --- Scan Not Satisfied
// --- During execution of the Scan command, if the FD cannot find a sector on the cylinder which meets the condition.
// --- then this flag is set.
const SR2_SN = 0x04;

// --- Scan Equal Hit
// --- During execution of the Scan command. if the condition of "equal" is satisfied, this flag is set.
const SR2_SH = 0x08;

// --- Wrong Cylinder
// --- This bit is related to the ND bit, and when the contents of C(3) on the medium is different from that stored i n the IDR.
// --- this flag is set.
const SR2_WC = 0x10;

// --- Data Error in Data Field
// --- If the FDC detects a CRC error in the data field then this flag is set.
const SR2_DD = 0x20;

// --- Control Mark
// --- During execution of the Read Data or Scan command, if the FDC encounters a sector
// --- which contains a deleted data address mark, this flag is set Also set if DAM is found during Read Deleted Data.
const SR2_CM = 0x40;

// --- US0
// --- This bit is used to indicate the status of the unit select signal 0 to the FDD.
const SR3_US0 = 0x01;

// --- Head address
// --- This bit is used to indicate the status of the ide select signal to the FDD.
const SR3_HD = 0x04;

// --- Two Side (0 = yes, 1 = no)
// --- This bit is used to indicate the status of the two-side signal from the FDD.
const SR3_TS = 0x08;

// --- Track 0
// --- This bit is used to indicate the status of the track 0 signal from the FDD.
const SR3_T0 = 0x10;

// --- Ready
// --- This bit is used to Indicate the status of the ready signal from the FDD.
const SR3_RD = 0x20;

// --- Write Protected
// --- This bit is used to indicate the status of the write protected signal from the FDD.
const SR3_WP = 0x40;

// --- Fault
// --- This bit is used to indicate the status of the fault signal from the FDD.
const SR3_FT = 0x80;

// --- Various commands
const CMD_INVALID = 0x00;
const CMD_READ_TRACK = 0x02;

// --- Sets initial values for each of the three internal timers (HUT - Head Unload Time, HLT - Head Load Time,
// --- SRT - Step Rate Time) ans sets the DMA mode (DMA/no-DMA)
const CMD_SPECIFY = 0x03;

const CMD_SENSE_DRIVE_STATUS = 0x04;
const CMD_WRITE_DATA = 0x05;
const CMD_READ_DATA = 0x06;
const CMD_RECALIBRATE = 0x07;
const CMD_SENSE_INTERRUPT_STATE = 0x08;
const CMD_READ_ID = 0x0a;
const CMD_READ_DELETED_DATA = 0x0c;
const CMD_FORMAT_TRACK = 0x0d;
const CMD_SEEK = 0x0f;

// --- Percentage of motor speed increment in a single complete frame
const MOTOR_SPEED_INCREMENT = 2;
const MOTOR_SPEED_DECREMENT = 2;

// --- Maximum log entries preserved
const MAX_LOG_ENTRIES = 1024;

// --- Implements the NEC UPD 765 chip emulation
export class FloppyControllerDevice implements IFloppyControllerDevice {
  // --- Initializes the specified floppy
  constructor (public readonly machine: IZxSpectrumMachine) {}

  // --- The available floppy devices
  private floppyDrives: FloppyDiskDrive[] = [];

  // --- The currently selected drive index
  private driveIndex = 0;

  // --- Main Status Register
  private msr = 0;

  // --- Status register 0
  private sr0 = 0;

  // --- Status register 1
  private sr1 = 0;

  // --- Status register 2
  private sr2 = 0;

  // --- Status register 3
  private sr3 = 0;

  // --- Current operation phase
  private operationPhase = OperationPhase.Idle;

  // --- Last command received
  private commandReceived = 0;

  // === Command parameters
  // --- Cylinder number
  private parC = 0;

  // --- Head address (0 or 1)
  private parH = false;

  // --- Record (Sector) number to read or write
  private parR = 0;

  // --- Number of data byte written in a sector
  private parN = 0;

  // --- (End of Track) Final sector number on a cylinder
  private parEot = 0;

  // --- Lenght of Gap 3
  private parGpl = 0;

  // --- Data length
  private parDtl = 0;

  // --- Step Rate Time (Stepping rate for the FDD)
  private parSrt = 0;

  // --- Head Unload Time
  private parHut = 0;

  // --- Head Load Time
  private parHlt = 0;

  // --- Non-DMA mode
  private parNd = 0;

  // --- New cylinder number
  private newCylinder = 0;

  // --- Number of sectors per cylinder
  private parSc = 0;

  // --- Data pattern to be written into a sector
  private parD = 0;

  // --- Multitrack command flag
  private parMt = false;

  // --- Multi-format command flag
  private parMf = false;

  // --- Skip command flag
  private parSk = false;

  // --- Command input
  private paramIndex = 0;

  // --- The index of the currently returned result
  private resultBuffer: number[] = [];
  private resultReadIndex = 0;

  // --- Indicates pending interupt
  private interruptPending = false;

  // --- Current cylinder value
  private currentCylinder = 0;

  // --- Last physical sector read by READ_DATE and READ_ID commands
  private lastPhysicalSectorRead = -1;

  // --- Last physical sector affected by write data commands
  private lastPhysicalSectorWrite = -1;

  // --- The seek that was being executed was a recalibrate
  private seekWasRecalibrating = false;

  // --- Is the floppy motor turned on?
  private motorOn = false;

  // --- Is the motor accelerating or slowing down?
  private motorAccelerating = false;

  // --- Relative motor speed: 0%: fully stopped, 100%: fully started
  private motorSpeed = 0;

  // --- State of the floppy saving ligth
  private floppySavingLight = false;

  // --- The CPU tact when the last event happened
  private lastEventTact = -1;

  // --- Floppy operation log
  private opLog: FloppyLogEntry[] = [];

  // --- Retrieves the currently selected drive
  private get selectedDrive (): FloppyDiskDrive {
    return this.floppyDrives[this.driveIndex];
  }

  // --- Tests if the drive is ready for operations
  private isDriveReady (): boolean {
    return this.selectedDrive.disk && this.motorSpeed === 100;
  }

  // --- Indicates if Drive #1 is present
  isDriveAPresent: boolean;

  // --- Indicates if Drive #2 is present
  isDriveBPresent: boolean;

  // --- Indicates if disk in Drive #1 is write protected
  isDiskAWriteProtected: boolean;

  // --- Indicates if disk in Drive #2 is write protected
  isDiskBWriteProtected: boolean;

  // --- Resets the device
  reset (): void {
    this.msr = MSR_RQM;
    this.operationPhase = OperationPhase.Command;
    this.paramIndex = 0;
    this.resultReadIndex = 0;
    this.sr0 = 0x00;
    this.sr1 = 0x00;
    this.sr2 = 0x00;
    this.sr2 = 0x00;
    this.interruptPending = false;
    this.motorOn = false;

    this.floppyDrives = [];
    for (let i = 0; i < 4; i++) {
      this.floppyDrives[i] = new FloppyDiskDrive();
    }

    this.setResultBuffer();
    this.clearLogEntries();
  }

  // Dispose the resources held by the device
  dispose (): void {
    // TODO: Implement this method
  }

  // --- Gets the value of the data register (8-bit)
  readDataRegister (): number {
    if (this.operationPhase === OperationPhase.Result) {
      const value = this.resultBuffer[this.resultReadIndex++];
      const result = value ?? 0xff;
      if (this.resultReadIndex > this.resultBuffer.length - 1) {
        this.setResultBuffer();
        this.msr &= ~MSR_DIO;
        this.operationPhase = OperationPhase.Command;
        this.paramIndex = 0;

        // --- After-result settings
        switch (this.commandReceived) {
          case CMD_SENSE_INTERRUPT_STATE:
            this.msr &= ~MSR_CB;
            break;
        }
      }

      // --- The other commands do not support result value
      this.log({
        addr: this.machine.opStartAddress,
        opType: PortOperationType.ReadData,
        data: result
      });
      return result;
    }

    // --- No valid data register value
    return 0xff;
  }

  // --- Gets the value of the Main Status Register
  readMainStatusRegister (): number {
    this.log({
      addr: this.machine.opStartAddress,
      opType: PortOperationType.ReadMsr,
      data: this.msr
    });
    return this.msr;
  }

  // --- Writes the value of the data register (8-bit)
  writeDataRegister (value: number): void {
    const logEntry: FloppyLogEntry = {
      addr: this.machine.opStartAddress,
      opType: PortOperationType.WriteData,
      data: value,
      phase:
        this.operationPhase === OperationPhase.Command
          ? "C"
          : this.operationPhase === OperationPhase.Execution
          ? "E"
          : "R"
    };
    if (this.operationPhase !== OperationPhase.Command) {
      // --- Writes allowed only in command mode; otherwise, they are ignored.
      logEntry.comment = "Ignored";
    } else {
      if (!this.paramIndex) {
        // --- This write specifies the command
        this.commandReceived = value & 0x1f;
        switch (this.commandReceived) {
          case CMD_SENSE_INTERRUPT_STATE:
            if (this.interruptPending) {
              this.interruptPending = false;
              logEntry.comment = `Sense Interrupt`;
              this.msr |= MSR_DIO | MSR_CB;

              if (this.isDriveReady) {
                this.sr0 =
                  (this.selectedDrive.headIndex === 0 ? 0x00 : SR0_HD) |
                  (this.driveIndex & 0x03);
                this.newCylinder = this.selectedDrive.trackIndex;
              } else {
                this.sr0 = this.driveIndex & 0x03;
                this.newCylinder = 0;
              }
              this.setResultBuffer([this.sr0, this.newCylinder]);
            } else {
              this.commandReceived = CMD_INVALID;
              logEntry.comment = "Sense Interrupt (invalid)";
            }
            break;

          case CMD_SPECIFY:
            logEntry.comment = "Specify";
            this.paramIndex++;
            break;

          case CMD_SENSE_DRIVE_STATUS:
            logEntry.comment = "Sense Drive State";
            this.paramIndex++;
            break;

          case CMD_RECALIBRATE:
            logEntry.comment = "Recalibrate";
            this.paramIndex++;
            break;

          case CMD_SEEK:
            logEntry.comment = "Seek";
            this.paramIndex++;
            break;

          case CMD_READ_ID:
            logEntry.comment = "Read ID";
            if ((value & 0xbf) === CMD_READ_ID) {
              this.paramIndex++;
            } else {
              this.commandReceived = CMD_INVALID;
            }
            break;

          case CMD_READ_DATA:
          case CMD_READ_DELETED_DATA:
            const readOp = value & 0x1f;
            logEntry.comment =
              readOp === CMD_READ_DATA ? "Read Data" : "Read Deleted Data";
            if (readOp === CMD_READ_DATA || readOp === CMD_READ_DELETED_DATA) {
              this.parMt = !!((value >> 7) & 1);
              this.parMf = !!((value >> 6) & 1);
              this.parSk = !!((value >> 5) & 1);
              this.paramIndex++;
              logEntry.comment =
                readOp === CMD_READ_DATA ? "Read Data" : "Read Deleted Data";
              logEntry.comment += ` - MT: ${this.parMt ? "1" : "0"}, MF: ${
                this.parMf ? "1" : "0"
              }, SK: ${this.parMt ? "1" : "0"}, `;
            } else {
              this.commandReceived = CMD_INVALID;
              logEntry.comment += "(invalid)";
            }
            break;

          case CMD_READ_TRACK:
            if ((value & 0x9f) == CMD_READ_TRACK) {
              this.parMt = false;
              this.parMf = !!((value >> 6) & 1);
              this.parSk = !!((value >> 5) & 1);
              this.paramIndex++;
              logEntry.comment = `Read Track - MT: ${
                this.parMt ? "1" : "0"
              }, MF ${this.parMf ? "1" : "0"}, SK: ${this.parMt ? "1" : "0"}, `;
            } else {
              this.commandReceived = CMD_INVALID;
              logEntry.comment = "Read track (invalid)";
            }
            break;

          case CMD_WRITE_DATA:
            if ((value & 0x3f) === CMD_WRITE_DATA) {
              this.parMf = !!((value >> 6) & 1);
              this.parSk = !!((value >> 5) & 1);
              this.paramIndex++;
              this.floppySavingLight = true;
              logEntry.comment = `Write Data - MF: ${
                this.parMf ? "1" : "0"
              }, SK: ${this.parMt ? "1" : "0"}`;
            } else {
              this.commandReceived = CMD_INVALID;
              logEntry.comment = "Write Data (invalid)";
            }
            break;

          case CMD_FORMAT_TRACK:
            if ((value & 0xbf) === CMD_FORMAT_TRACK) {
              this.parMf = !!((value >> 6) & 1);
              this.paramIndex++;
              this.floppySavingLight = true;
              logEntry.comment = `Format Track - MF: ${this.parMf ? "1" : "0"}`;
            } else {
              this.commandReceived = CMD_INVALID;
              logEntry.comment = "Format Track (invalid)";
            }
            break;

          default:
            this.commandReceived = CMD_INVALID;
            logEntry.comment = "(invalid)";
            break;
        }

        // --- If the command is invalid, handle it
        if (this.commandReceived === CMD_INVALID) {
          this.setResultBuffer([0x80]);
        }
      } else {
        // --- This write specifies the subsequent command parameter
        switch (this.commandReceived) {
          case CMD_SPECIFY:
            if (this.paramIndex === 1) {
              this.parSrt = (value >> 4) & 0x0f;
              this.parHut = value & 0x0f;
              this.paramIndex++;
              logEntry.comment = `SRT: ${this.parSrt}, HUT: ${this.parHut}`;
            } else if (this.paramIndex === 2) {
              this.parHlt = (value >> 4) & 0x0f;
              this.parNd = value & 0x0f;
              this.paramIndex = 0;
              logEntry.comment = `HLT: ${this.parHlt}, ND: ${this.parNd}`;
            }
            break;

          case CMD_SENSE_DRIVE_STATUS:
            if (this.paramIndex === 1) {
              // --- Select the specified drive
              this.driveIndex = value & 0x03;
              const hd = (value >> 2) & 0x01;
              this.selectedDrive.headIndex = hd;
              logEntry.comment = `HD: ${hd}, US1: ${
                (this.driveIndex >> 1) & 0x01
              }, US0: ${this.driveIndex & 0x01}`;

              // --- Sense the status according to the current drive settings
              // --- Ready, Track 0, and Two Sides flags set. Use the drives head index
              if (this.driveIndex === 0 && this.isDriveAPresent) {
                // --- Drive #1 (A) selected
                this.sr3 =
                  SR3_RD |
                  SR3_TS |
                  SR3_T0 |
                  (this.floppyDrives[0].headIndex === 0 ? 0x00 : SR3_HD);
              } else if (this.driveIndex === 1 && this.isDriveBPresent) {
                // --- Drive #2 (B) selected
                this.sr3 =
                  SR3_RD |
                  SR3_TS |
                  SR3_T0 |
                  (this.floppyDrives[0].headIndex === 0 ? 0x00 : SR3_HD) |
                  SR3_US0;
              } else {
                // --- No drive present
                this.sr3 = 0x00;
              }
              if (
                this.selectedDrive.isDiskLoaded &&
                this.selectedDrive.isWriteProtected
              ) {
                this.sr3 |= SR3_WP;
              }

              // --- Done
              this.setResultBuffer([this.sr3]);
            }
            break;

          case CMD_RECALIBRATE:
            if (this.paramIndex === 1) {
              // --- Select the specified drive
              this.driveIndex = value & 0x03;
              logEntry.comment = `US1: ${(this.driveIndex >> 1) & 0x01}, US0: ${
                this.driveIndex & 0x01
              }`;
              this.paramIndex = 0;
              console.log("RECALIBRATE");
              this.interruptPending = true;

              // --- Execute the command
              this.msr |= MSR_EXM;
              this.selectedDrive.trackIndex = 0;
              if (this.isDriveReady) {
                // --- We reached Track 0, seek ended
                this.sr0 |= SR0_SE;
                this.msr &= ~MSR_EXM;
              } else {
                // --- The drive is not ready yet, sign abnormal termination
                this.sr0 |= SR0_IC | SR0_AT | SR0_NR;
              }
            }
            break;

          case CMD_READ_ID:
            if (this.paramIndex === 1) {
              // --- Select the specified drive
              this.driveIndex = value & 0x03;
              const hd = (value >> 2) & 0x01;
              this.selectedDrive.headIndex = hd;
              logEntry.comment = `HD: ${hd}, US1: ${
                (this.driveIndex >> 1) & 0x01
              }, US0: ${this.driveIndex & 0x01}`;
              this.paramIndex = 0;

              console.log("READ ID");
              // --- Execute the command
              if (this.isDriveReady) {
                this.sr0 =
                  (this.selectedDrive.headIndex === 0 ? 0x00 : SR0_HD) |
                  (this.driveIndex & 0x03);
                this.sr1 = this.selectedDrive.sectorIndex > 9 ? 0x80 : 0x00;
              } else {
                this.msr &= ~MSR_EXM;
                this.sr0 |= SR0_NR;
                this.sr1 |= SR1_ND;
              }
              this.msr |= MSR_DIO;
              this.interruptPending = true;
              this.sr2 = 0;

              // --- Done
              this.setResultBuffer([
                this.sr0,
                this.sr1,
                this.sr2,
                this.selectedDrive.trackIndex,
                this.selectedDrive.headIndex,
                this.selectedDrive.sectorIndex,
                0x02
              ]);
            }
            break;

          case CMD_READ_DATA:
          case CMD_READ_DELETED_DATA:
          case CMD_READ_TRACK:
            // TODO: Implement command parameter reader
            break;
          case CMD_WRITE_DATA:
            // TODO: Implement command parameter reader
            break;
          case CMD_FORMAT_TRACK:
            // TODO: Implement command parameter reader
            break;
          case CMD_SEEK:
            // TODO: Implement command parameter reader
            break;
        }
      }
    }
    this.log(logEntry);
  }

  // --- Gets the log entries
  getLogEntries (): FloppyLogEntry[] {
    return this.opLog.slice(0);
  }

  // --- Clears all log entries
  clearLogEntries (): void {
    this.opLog.length = 0;
  }

  // --- Adjust the current motor speed
  handleMotorSpeed (): void {
    throw new Error("Not implemented yet");
  }

  // --- Executes the floppy event handler
  onFloppyEvent (): void {
    throw new Error("Not implemented yet");
  }

  // --- Turn on the floppy drive's motor
  turnOnMotor (): void {
    if (this.motorOn) return;
    this.motorOn = true;
    this.motorAccelerating = true;
    this.log({
      addr: this.machine.opStartAddress,
      opType: PortOperationType.MotorEvent,
      data: this.motorSpeed,
      comment: "Motor on"
    });
  }

  // --- Turn off the floppy drive's motor
  turnOffMotor (): void {
    if (!this.motorOn) return;
    this.motorOn = false;
    this.motorAccelerating = false;
    this.log({
      addr: this.machine.opStartAddress,
      opType: PortOperationType.MotorEvent,
      data: this.motorSpeed,
      comment: "Motor off"
    });
  }

  // --- Get the floppy drive's motor speed
  getMotorSpeed (): number {
    return this.motorSpeed;
  }

  // --- Get the floppy drive's save light value
  getFloppySaveLight (): boolean {
    return this.floppySavingLight;
  }

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted (): void {
    if (this.motorAccelerating) {
      // --- Handle acceleration
      if (this.motorSpeed < 100) {
        this.motorSpeed = Math.min(
          100,
          this.motorSpeed + MOTOR_SPEED_INCREMENT
        );
      }
    } else {
      // --- Handle slowing down
      if (this.motorSpeed > 0) {
        this.motorSpeed = Math.max(0, this.motorSpeed - MOTOR_SPEED_DECREMENT);
      }
    }
  }

  // --- Resets the result buffer
  private setResultBuffer (result?: number[]): void {
    this.resultBuffer = result ?? [];
    this.resultReadIndex = 0;
    if (result) {
      // --- Move to result phase
      this.operationPhase = OperationPhase.Result;
      this.msr |= MSR_DIO;
      this.interruptPending = true;
    }
  }

  // --- Adds a new item to the operation log
  private log (entry: FloppyLogEntry): void {
    if (this.opLog.length >= MAX_LOG_ENTRIES) {
      this.opLog.shift();
    }
    this.opLog.push(entry);
  }
}

// --- Represents the execution phases of the controller
enum OperationPhase {
  // --- FDC is in an idle state, awaiting the next initial command byte.
  Idle,
  // --- The FDC receives all information required to perform a particular operation from the processor.
  Command,
  // --- The FDC performs the operation it was instructed to do.
  Execution,
  // --- After completion of the operation, status and other housekeeping information are made
  // --- available to the processor.
  Result
}
