// --- If any of the Dn bits Iis set FDC will not accept read or write command.

import {
  FloppyLogEntry,
  PortOperationType
} from "@abstractions/FloppyLogEntry";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";

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

// --- Not Ready
// --- When the FDD is in the not-ready state and a Read or Write command is issued, this flag is set If a Read or Write
// --- command is issued to side 1 of a single-sided drive, then this flag is set.
const SR0_NR = 0x08;

// --- Abnormal termination of command, (AT) Execution of command was started but was not successfully completed.
const SR0_AT = 0x40;

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

// --- Unit select 0
// --- This bit is used to indicate the status of the unit select 0 signal to the FDD.
const SR3_D0 = 0x01;

// --- Unit select 1
// --- This bit is used to Indicate the status of the unit select 1 signal to the FDD.
const SR3_D1 = 0x02;

// --- Head address
// --- This bit is used to indicate the status of the ide select signal to the FDD.
const SR3_D2 = 0x04;

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

// --- Maximum log entries preserved
const MAX_LOG_ENTRIES = 1024;

// --- Implements the NEC UPD 765 chip emulation
export class FloppyControllerDevice implements IFloppyControllerDevice {
  // --- Main Status Register
  private msr = 0;

  // --- Status register 0
  private sr0 = 0;

  // --- Status register 1
  private sr1 = 0;

  // --- Status register 2
  private sr2 = 0;

  // === Status register 3 flags

  // --- Write protected signal from the FDD
  // TODO: Use it later
  private sr3Wp = false;

  // --- Ready signal from the FDD
  private sr3Ry = true;

  // --- Status of Track 0 signal from FDD
  private sr3T0 = true;

  // --- Status of Two Side signal from FDD
  private sr3Ts = false;

  // --- Current operation phase
  private operationPhase = OperationPhase.Idle;

  // --- Last command received
  private commandReceived = 0;

  // === Command parameters
  // --- Selected head number (0 or 1)
  private parHd = false;

  // --- Unit select 0
  private parUs0 = false;

  // --- Unit select 1
  private parUs1 = false;

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
  private parNcn = 0;

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
  private readonly resultBuffer: number[] = [];
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

  // --- Relative motor speed: 0%: fully stopped, 100%: fully started
  private motorSpeed = 0;

  // --- Signal counter information
  private readonly signalCounter: SignalWithCounter = {
    counter: 0,
    value: 0,
    isRunning: false,
    max: 80,
    triggered: this.signalTriggered
  };

  // --- State of the floppy saving ligth
  private floppySavingLight = false;

  // --- The CPU tact when the last event happened
  private lastEventTact = -1;

  // --- Floppy operation log
  private opLog: FloppyLogEntry[] = [];

  constructor (public readonly machine: IZxSpectrumMachine) {}

  // --- Resets the device
  reset (): void {
    this.msr = MSR_RQM;
    this.operationPhase = OperationPhase.Command;
    this.paramIndex = 0;
    this.resultReadIndex = 0;
    this.sr3Ry = true;
    this.sr3T0 = false;
    this.currentCylinder = 0;
    this.interruptPending = false;
    this.motorOn = false;
    this.lastPhysicalSectorRead = -1;
    this.lastPhysicalSectorWrite = -1;
    this.resetSignalCounter();
    this.seekWasRecalibrating = false;
    this.resetresultBuffer();

    this.clearLogEntries();
  }

  // Dispose the resources held by the device
  dispose (): void {
    // TODO: Implement this method
  }

  // --- Gets the value of the data register (8-bit)
  readDataRegister (): number {
    let result = 0xff;
    if (this.operationPhase === OperationPhase.Result) {
      // --- Return the result of the last executed command
      switch (this.commandReceived) {
        case CMD_SENSE_DRIVE_STATUS:
          if (this.resultReadIndex === 0) {
            result = this.sr3;
            this.msr &= ~ MSR_DIO;
            this.operationPhase = OperationPhase.Command;
          } else {
            result = 0xff;
          }
          break;
        case CMD_SENSE_INTERRUPT_STATE:
          // TODO
          result = 0xff;
          break;
        case CMD_READ_ID:
          // TODO
          result = 0xff;
          break;
        case CMD_READ_DATA:
        case CMD_READ_DELETED_DATA:
        case CMD_READ_TRACK:
          // TODO
          result = 0xff;
          break;
        case CMD_WRITE_DATA:
          // TODO
          return 0xff;
        case CMD_FORMAT_TRACK:
          // TODO
          return 0xff;
        case CMD_INVALID:
          if (this.resultReadIndex) {
            result = 0xff;
            break;
          } else {
            // --- No need to return more data
            this.msr &= ~MSR_DIO;
            this.operationPhase = OperationPhase.Command;

            // --- If an invalid command is sent to the FDC (a commend not defined above), then the FDC will terminate the
            // --- command after bits 7 and 6 of Status Register 0 are set to 1 and 0 respectively.
            result = 0x80;
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
              this.operationPhase = OperationPhase.Result;
              // --- Indicate data must be read
              // --- While it lasts, indicate that FDC is busy
              this.msr |= MSR_DIO | MSR_CB;
              logEntry.comment = `Sense Interrupt`;

              // --- No result to retrieve
              this.resultReadIndex = 0;
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
          this.operationPhase = OperationPhase.Result;
          this.msr |= MSR_DIO;
          this.resultReadIndex = 0;
          this.interruptPending = true;
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
              console.log("SPECIFY HLT/ND");
              this.parHlt = (value >> 4) & 0x0f;
              this.parNd = value & 0x0f;
              this.paramIndex = 0;
              logEntry.comment = `HLT: ${this.parHlt}, ND: ${this.parNd}`;
            }
            break;
          case CMD_SENSE_DRIVE_STATUS:
            if (this.paramIndex === 1) {
              this.parHd = !!((value >> 2) & 0x01);
              this.parUs1 = !!((value >> 1) & 0x01);
              this.parUs0 = !!(value & 0x01);
              this.paramIndex = 0;
              logEntry.comment = `HD: ${this.parHd ? 1 : 0}, US1: ${
                this.parUs1 ? 1 : 0
              }, US0: ${this.parUs0 ? 1 : 0}`;

              // --- Execute the command
              this.operationPhase = OperationPhase.Result;
              this.msr |= MSR_DIO;
              this.resultReadIndex = 0;
              this.interruptPending = true;
            }
            break;
          case CMD_RECALIBRATE:
            // TODO: Implement command parameter reader
            break;
          case CMD_SENSE_INTERRUPT_STATE:
            // TODO: Implement command parameter reader
            break;
          case CMD_READ_ID:
            // TODO: Implement command parameter reader
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

  turnOnMotor (): void {
    throw new Error("Not implemented yet");
  }

  turnOffMotor (): void {
    throw new Error("Not implemented yet");
  }

  getMotorSpeed (): number {
    throw new Error("Not implemented yet");
  }

  getFloppySaveLight (): boolean {
    throw new Error("Not implemented yet");
  }

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted (): void {
    console.log("Frame");
  }

  // --- Resets the result buffer
  private resetresultBuffer (): void {
    this.resultBuffer.length = 0;
    this.resultReadIndex = 0;
  }

  // --- Resets the current signal counter;
  private resetSignalCounter (): void {
    this.signalCounter.counter = 0;
    this.signalCounter.value = 0;
    this.signalCounter.isRunning = false;
  }

  // --- Sets the current signal counter;
  private setSignalCounter (): void {
    this.signalCounter.counter = 0;
    this.signalCounter.value = 1;
    this.signalCounter.isRunning = false;
  }

  // --- Execute when a timed signal is triggered
  private signalTriggered (): void {
    // TODO: Implment this method
  }

  // --- Status Register 3 value
  private get sr3 (): number {
    return (
      (this.sr3Ry ? 1 : 0) << 5 |
      (this.sr3T0 ? 1 : 0) << 4 |
      (this.sr3Ts ? 1 : 0) << 3 |
      (this.parHd ? 1 : 0) << 2 |
      (this.parUs1 ? 1 : 0) << 1 |
      (this.parUs0 ? 1 : 0)
    );
  }

  // --- Adds a new item to the operation log
  private log (entry: FloppyLogEntry): void {
    //if (entry.opType !== PortOperationType.WriteData) return;
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

// --- Represents a signal with counter
type SignalWithCounter = {
  // ---
  counter: number;
  value: number;
  isRunning: boolean;
  max: number;
  triggered: () => void;
};
