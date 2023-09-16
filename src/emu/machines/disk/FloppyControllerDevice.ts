// --- If any of the Dn bits Iis set FDC will not accept read or write command.

import {
  FloppyLogEntry,
  PortOperationType
} from "@abstractions/FloppyLogEntry";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { FloppyDiskDrive } from "./FloppyDiskDrive";
import { FloppyDisk } from "./FloppyDisk";

// --- Implements the NEC UPD 765 chip emulation
export class FloppyControllerDevice implements IFloppyControllerDevice {
  // --- Initializes the specified floppy
  constructor (public readonly machine: IZxSpectrumMachine) {}

  // --- The available floppy devices
  private driveA?: FloppyDiskDrive;
  private driveB?: FloppyDiskDrive;
  private currentDrive?: FloppyDiskDrive;

  // --- Stepping rate in milliseconds
  private stepRate: number;

  // --- Head unload time in milliseconds
  private hut: number;

  // --- Head load time in milliseconds
  private hld: number;

  // --- Operating mode;
  private nonDma: boolean;

  // --- First sector always read/write even when EOT < R
  private firstRw: boolean;

  // --- Last INTRQ status
  private intReq: IntRequest;

  // --- The current operation phase
  private phase: OperationPhase;

  private idTrack: number;
  private idHead: number;
  private idSector: number;

  // --- Sector length code 0, 1, 2, 3
  private idLength: number;

  // --- Sector length from length code
  private sector_length: number;

  // --- Read a deleted data mark
  private ddam: boolean;

  // --- Revolution counter
  private rev: number;

  // --- Head state
  private headLoad: boolean;

  // --- Searching an IDAM
  private readId: boolean;

  // --- AM ID mark
  private idMark: boolean;

  // --- For Speedlock 'random' sector hack
  private lastSectorRead: number;

  // --- For Speedlock 'random' sector hack, -1 -> disable
  private speedlock: number;

  // --- State during transfer
  private dataOffset: number;

  // --- Read/write cycle num
  private cycle: number;

  // --- Read/wrire deleted data
  private delData: boolean;

  // --- multitrack operations
  private mt: boolean;

  // --- MFM mode
  private mf: boolean;

  // --- Skip deleted/not deleted data
  private sk: boolean;

  // --- Physical head address
  private hd: boolean;

  // --- Selected unit (0-3)
  private us: number;

  // --- Present cylinder numbers
  private pcn: number[];

  // --- New cylinder numbers
  private ncn: number[];

  // --- Recalibrate stored PCN values
  private rec: number[];

  // --- Seek status for the drives
  private seek: number[];

  // --- order of overlapped seeks for 4 drive
  private seekAge: number[];

  // --- Expected record length
  private rlen: number;

  // --- Current SCAN type
  private scan: ScanType;

  // --- Current command
  private cmd: CommandDescriptor;

  // --- Data registers
  private dataRegister: number[];

  // --- Main status register
  private msr: number;

  // --- Status register 0
  private sr0: number;

  // --- Status register 1
  private sr1: number;

  // --- Status register 2
  private sr2: number;

  // --- Status register 3
  private sr3: number;

  // --- Result bytes for SENSE INTERRUPT
  private senseIntRes: number[];

  // --- Hold CRC
  private crc: number;

  // --- Is the floppy motor turned on?
  private motorOn = false;

  // --- Is the motor accelerating or slowing down?
  private motorAccelerating = false;

  // --- Relative motor speed: 0%: fully stopped, 100%: fully started
  private motorSpeed = 0;

  // --- State of the floppy saving ligth
  private floppySavingLight = false;

  // --- Floppy operation log
  private opLog: FloppyLogEntry[] = [];

  // --- Indicates if Drive #1 is present
  isDriveAPresent: boolean;

  // --- Indicates if Drive #2 is present
  isDriveBPresent: boolean;

  // --- Indicates if disk in Drive #1 is write protected
  get isDiskAWriteProtected (): boolean {
    return this.isDriveAPresent && this.driveA.isWriteProtected;
  }

  // --- Indicates if disk in Drive #2 is write protected
  get isDiskBWriteProtected (): boolean {
    return this.isDriveAPresent && this.driveA.isWriteProtected;
  }

  // --- Loads the specified floppy disk into drive A
  loadDiskA (disk: FloppyDisk): void {
    if (this.isDriveAPresent) {
      this.driveA.disk = disk;
    }
  }

  // --- Ejects disk from drive A
  ejectDiskA (): void {
    if (this.isDriveAPresent) {
      this.driveA.ejectDisk();
    }
  }

  // --- Loads the specified floppy disk into drive B
  loadDiskB (disk: FloppyDisk): void {
    if (this.isDriveBPresent) {
      this.driveB.disk = disk;
    }
  }

  // --- Ejects disk from drive B
  ejectDiskB (): void {
    if (this.isDriveAPresent) {
      this.driveA.ejectDisk();
    }
  }

  // --- Resets the device
  reset (): void {
    console.log("Event registered");
    this.registerEvent(10_000, () => console.log("Floppy Event happened"), null);
  }

  // Dispose the resources held by the device
  dispose (): void {
    // TODO: Implement this method
  }

  // --- Gets the value of the data register (8-bit)
  readDataRegister (): number {
    // TODO: Implement this method
    return 0xff;
  }

  // --- Gets the value of the Main Status Register
  readMainStatusRegister (): number {
    // TODO: Implement this method
    return 0xff;
  }

  // --- Writes the value of the data register (8-bit)
  writeDataRegister (value: number): void {
    // TODO: Implement this method
  }

  // --- Gets the log entries
  getLogEntries (): FloppyLogEntry[] {
    return this.opLog.slice(0);
  }

  // --- Clears all log entries
  clearLogEntries (): void {
    this.opLog.length = 0;
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

  // --- Adds a new item to the operation log
  private log (entry: FloppyLogEntry): void {
    if (this.opLog.length >= MAX_LOG_ENTRIES) {
      this.opLog.shift();
    }
    this.opLog.push(entry);
  }

  private registerEvent(ms: number, eventFn: (data: any) => void, data: any): void {
    const machine = this.machine;
    const eventTact = machine.tacts + machine.baseClockFrequency * machine.clockMultiplier / 1000 * ms;
    machine.queueEvent(eventTact, eventFn, data);
  }
}

// --- FDC Busy. A Read or Write command is in process.FDC will not accept any other command.
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

// --- Track 0
// --- This bit is used to indicate the status of the track 0 signal from the FDD.
const SR3_T0 = 0x10;

// --- Ready
// --- This bit is used to Indicate the status of the ready signal from the FDD.
const SR3_RD = 0x20;

// --- Write Protected
// --- This bit is used to indicate the status of the write protected signal from the FDD.
const SR3_WP = 0x40;

// --- Percentage of motor speed increment in a single complete frame
const MOTOR_SPEED_INCREMENT = 2;
const MOTOR_SPEED_DECREMENT = 2;

// --- Maximum log entries preserved
const MAX_LOG_ENTRIES = 1024;

// --- Available scan types
enum ScanType {
  Eq,
  Lo,
  Hi
}

// --- UPD Commands
enum Command {
  ReadData = 0,
  ReadDiag,
  WriteData,
  WriteId,
  Scan,
  ReadId,
  Recalibrate,
  SenseInt,
  Specify,
  SenseDrive,
  Seek,
  Invalid
}

// --- Interrupt request type
enum IntRequest {
  None = 0,
  Result,
  Exec,
  Ready,
  Seek
}

// --- Describes a command
type CommandDescriptor = {
  // --- Command ID
  id: Command;
  // --- Mask to use
  mask: number;
  // --- Value to test with mask
  value: number;
  // --- Command paremeter length
  cmdLength: number;
  // --- Result length
  reslength: number;
};

// --- Represents the execution phases of the controller
enum OperationPhase {
  // --- The FDC receives all information required to perform a particular operation from the processor.
  Command,
  // --- The FDC performs the operation it was instructed to do.
  Execution,
  // --- After completion of the operation, status and other housekeeping information are made
  // --- available to the processor.
  Result
}

// --- Description of available commmands
const commandTable: CommandDescriptor[] = [
  {
    id: Command.ReadData,
    mask: 0x1f,
    value: 0x06,
    cmdLength: 0x08,
    reslength: 0x07
  },
  // --- Deleted data
  {
    id: Command.ReadData,
    mask: 0x1f,
    value: 0x0c,
    cmdLength: 0x08,
    reslength: 0x07
  },
  {
    id: Command.ReadDiag,
    mask: 0x9f,
    value: 0x02,
    cmdLength: 0x08,
    reslength: 0x07
  },
  {
    id: Command.Recalibrate,
    mask: 0xff,
    value: 0x07,
    cmdLength: 0x01,
    reslength: 0x00
  },
  {
    id: Command.Seek,
    mask: 0xff,
    value: 0x0f,
    cmdLength: 0x02,
    reslength: 0x00
  },
  {
    id: Command.WriteData,
    mask: 0x3f,
    value: 0x05,
    cmdLength: 0x08,
    reslength: 0x07
  },
  // --- Deleted data
  {
    id: Command.WriteData,
    mask: 0x3f,
    value: 0x09,
    cmdLength: 0x08,
    reslength: 0x07
  },
  {
    id: Command.WriteId,
    mask: 0xbf,
    value: 0x0d,
    cmdLength: 0x05,
    reslength: 0x07
  },
  // --- Equal
  {
    id: Command.Scan,
    mask: 0x1f,
    value: 0x11,
    cmdLength: 0x08,
    reslength: 0x07
  },
  // --- Low or Equal
  {
    id: Command.Scan,
    mask: 0x1f,
    value: 0x19,
    cmdLength: 0x08,
    reslength: 0x07
  },
  // --- High or Equal
  {
    id: Command.Scan,
    mask: 0x1f,
    value: 0x1d,
    cmdLength: 0x08,
    reslength: 0x07
  },
  {
    id: Command.ReadId,
    mask: 0xbf,
    value: 0x0a,
    cmdLength: 0x01,
    reslength: 0x07
  },
  {
    id: Command.SenseInt,
    mask: 0xff,
    value: 0x08,
    cmdLength: 0x00,
    reslength: 0x02
  },
  {
    id: Command.Specify,
    mask: 0xff,
    value: 0x03,
    cmdLength: 0x02,
    reslength: 0x00
  },
  {
    id: Command.SenseDrive,
    mask: 0xff,
    value: 0x04,
    cmdLength: 0x01,
    reslength: 0x01
  },
  {
    id: Command.Invalid,
    mask: 0x00,
    value: 0x00,
    cmdLength: 0x00,
    reslength: 0x01
  }
];
