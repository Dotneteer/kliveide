import {
  FloppyLogEntry,
  PortOperationType
} from "@abstractions/FloppyLogEntry";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import {
  DISK_A_CHANGES,
  DISK_A_DATA,
  DISK_A_WP,
  DISK_B_CHANGES,
  DISK_B_DATA,
  DISK_B_WP
} from "../machine-props";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import { IFloppyDiskDrive } from "@emu/abstractions/IFloppyDiskDrive";
import { FloppyDiskDrive } from "./FloppyDiskDrive";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { IFloppyControllerDeviceTest } from "./IFloppyContorllerDeviceTest";
import { DiskCrc } from "./DiskCrc";

// --- Implements the NEC UPD 765 chip emulation
export class FloppyControllerDevice
  implements IFloppyControllerDevice, IFloppyControllerDeviceTest
{
  // --- Members for testing
  // --- NOTE: These members are public for testing purposes only

  // --- Disables randomization when seeking for a track or a sector
  disableRandomSeek: boolean;

  // --- Number of frame completions
  frames: number;

  // --- The drive currently selected
  currentDrive?: IFloppyDiskDrive;

  // --- Floppy operation log
  opLog: FloppyLogEntry[] = [];

  // --- Main status register
  msr: number;

  // --- Status register 0
  sr0: number;

  // --- Status register 1
  sr1: number;

  // --- Status register 2
  sr2: number;

  // --- Status register 3
  sr3: number;

  // --- The current operation phase
  operationPhase: OperationPhase;

  // --- Current command
  command: CommandDescriptor;

  // --- #of command bytes received
  commandBytesReceived: number;

  // --- The current command register value
  commandRegister: number;

  // --- Selected unit (0-3)
  us: number;

  // --- Head address (0-1)
  hd: number;

  // --- Read/wrire deleted data
  deletedData: boolean;

  // --- Multitrack operations
  mt: boolean;

  // --- MFM mode
  mf: boolean;

  // --- Skip deleted/not deleted data
  sk: boolean;

  // --- Last INTRQ status
  intReq: IntRequest;

  // --- Is the controller in non-DMA mode?
  nonDmaMode: boolean;

  // --- Stepping rate in milliseconds
  stepRate: number;

  // --- Head unload time in milliseconds
  headUnloadTime: number;

  // --- Head load time in milliseconds
  headLoadTime: number;

  // --- The mumber of bytes to send back
  resultBytesLeft: number;

  // --- The index of the result byte to send back
  resultIndex: number;

  // --- Indicates if the head is loaded
  headLoaded: boolean;

  // --- Result bytes for SENSE INTERRUPT
  senseIntRes: number[] = [];

  // --- Present cylinder values
  presentCylinderNumbers: number[] = [];

  // --- New cylinder values
  newCylinderNumbers: number[] = [];

  // --- Saved cylinder values
  savedCylinderNumbers: number[] = [];

  // --- FDC data registers
  dataRegister: number[] = [];

  // --- Seek status for drives
  seekStatus: SeekStatus[] = [];

  // --- Order of overlapped seeks for 4 drive
  seekAge: number[] = [];

  // --- Indicates that a Read ID operation is in progress
  readIdInProgress: boolean;

  // --- Count of revolutions
  revCounter: number;

  // --- Current track of read/write operation
  idTrack: number;

  // --- Current head of read/write operation
  idHead: number;

  // --- Current sector of read/write operation
  idSector: number;

  // --- Sector length code 0, 1, 2, 3 (128 << length code)
  idLength: number;

  // --- The actual sector length
  sectorLength: number;

  // --- AM ID mark found
  idMarkFound: boolean;

  // --- Expected record length
  expRecordLength: number;

  // --- First sector always read/write even when EOT < R
  firstRw: boolean;

  // --- Read a deleted data mark
  ddam: boolean;

  // --- Offset of data byte during read and write operations
  dataOffset: number;

  // --- The last CRC value
  crc: DiskCrc;

  // --- Type of scan to use
  scan: ScanType;

  // --- Initializes the controller
  constructor (
    public readonly machine: IZxSpectrumMachine,
    private readonly hasDriveB = false
  ) {
    machine.machinePropertyChanged.on(args =>
      this.onMachinePropertiesChanged(args)
    );
    this.reset();
  }

  // --- Drive A
  driveA?: IFloppyDiskDrive = new FloppyDiskDrive(this, 0);

  // --- Drive B
  driveB?: IFloppyDiskDrive = new FloppyDiskDrive(this, 1);

  // --- Resets the device
  reset (): void {
    // --- Allow randomization
    this.disableRandomSeek = false;

    // --- Set up the floppy drives
    this.driveA.reset();
    this.driveB.reset();
    this.currentDrive = this.driveA;

    // --- Reset the controller state
    this.msr = MSR_RQM;
    this.sr0 = this.sr1 = this.sr2 = this.sr3 = 0x00;

    this.intReq = IntRequest.None;
    this.operationPhase = OperationPhase.Command;
    for (let i = 0; i < 4; i++) {
      this.presentCylinderNumbers[i] = 0;
      this.newCylinderNumbers[i] = 0;
      this.savedCylinderNumbers[i] = 0;
      this.seekStatus[i] = SeekStatus.None;
      this.seekAge[i] = 0;
    }
    for (let i = 0; i < 9; i++) {
      this.dataRegister[i] = 0;
    }
    this.stepRate = 16;
    this.headUnloadTime = 240;
    this.headLoadTime = 254;
    this.nonDmaMode = true;
    this.headLoaded = false;
    this.commandBytesReceived = 0;
    this.commandRegister = 0x00;
    this.resultBytesLeft;
    this.resultIndex = 0;
    this.readIdInProgress = false;
    this.revCounter = 0;
    this.idTrack = 0;
    this.idHead = 0;
    this.idSector = 0;
    this.idLength = 0;
    this.idMarkFound = false;
    this.crc = new DiskCrc();

    // --- Reset diagnostic members
    this.frames = 0;
  }

  // --- Respond to floppy file changes
  onMachinePropertiesChanged (args: {
    propertyName: string;
    newValue?: any;
  }): void {
    switch (args.propertyName) {
      case DISK_A_DATA:
        const newDiskA = args.newValue;
        if (!newDiskA) {
          this.driveA.ejectDisk();
        } else {
          if (newDiskA instanceof Uint8Array) {
            this.driveA.loadDisk(newDiskA, !!this.machine.getMachineProperty(DISK_A_WP));
            this.driveA.turnOnMotor();
          }
        }
        break;

      case DISK_A_WP:
        this.driveA.writeProtected = !!args.newValue;
        break;

      case DISK_B_DATA:
        const newDiskB = args.newValue;
        if (!newDiskB) {
          this.driveB.ejectDisk();
        } else {
          if (newDiskB instanceof Uint8Array) {
            this.driveB.loadDisk(newDiskB, !!this.machine.getMachineProperty(DISK_B_WP));
            this.driveB.turnOnMotor();
          }
        }
        break;

      case DISK_B_WP:
        this.driveB.writeProtected = !!args.newValue;
        break;
    }
  }

  // --- Dispose the resources held by the device
  dispose (): void {
    this.driveA = undefined;
    this.driveB = undefined;
    this.currentDrive = undefined;
  }

  // --- Gets the value of the data register (8-bit)
  readDataRegister (): number {
    let result = 0;

    if (!(this.msr & MSR_RQM) || !(this.msr & MSR_DIO)) {
      // -- No data is ready to send, or the FDC is waiting for data
      result = 0xff;
    } else if (this.operationPhase === OperationPhase.Execution) {
      result = this.getReadDataResult();
      this.log({
        opType: PortOperationType.ReadData,
        addr: this.machine.opStartAddress,
        phase: "R",
        data: result,
        comment: this.command.resultLabels[this.resultIndex++]
      });
      return result;
    } else if (this.operationPhase !== OperationPhase.Result) {
      // --- No data is ready to send
      result = 0xff;
    } else if (this.command.id === Command.SenseDrive) {
      // --- Sense Drive Status has a single result byte, SR3
      result = this.sr3;
    } else if (this.command.id === Command.SenseInt) {
      // --- Sense Interrupt Status has two result bytes, ST0 and PCN as stored
      // --- Because of multiple interrupts,we retrieve the stored bytes and not ST0 and PCN direcly
      result =
        this.senseIntRes[this.command.resultLength - this.resultBytesLeft];
    } else if (this.command.resultLength - this.resultBytesLeft < 3) {
      // --- For other commands, the first three result bytes are always ST0, ST1, ST2
      switch (this.command.resultLength - this.resultBytesLeft) {
        case 0:
          result = this.sr0;
          break;
        case 1:
          result = this.sr1;
          break;
        case 2:
          result = this.sr2;
          break;
      }
    } else {
      // --- Send back the other result bytes
      result =
        this.dataRegister[this.command.resultLength - this.resultBytesLeft - 2];
    }
    this.resultBytesLeft--;
    if (!this.resultBytesLeft) {
      // --- We have sent back all result bytes, move to command phase
      this.operationPhase = OperationPhase.Command;
      // --- FDC ready to receive new commands
      this.msr |= MSR_RQM;
      // --- Data goes from CPU to FDC
      this.msr &= ~MSR_DIO;
      // --- No command in progress
      this.msr &= ~MSR_CB;
      if (this.intReq < IntRequest.Ready) {
        // --- Unless there is a pending Seek operation, no interrupt is requested
        this.intReq = IntRequest.None;
      }
    }

    // --- Log the result
    this.log({
      opType: PortOperationType.ReadData,
      addr: this.machine.opStartAddress,
      phase: "R",
      data: result,
      comment: this.command.resultLabels[this.resultIndex++]
    });

    // --- Done.
    return result;
  }

  // --- Gets the value of the Main Status Register
  readMainStatusRegister (): number {
    const flags: string[] = [];
    const data = this.msr;
    if (data & MSR_RQM) {
      flags.push("RQM");
    }
    if (data & MSR_DIO) {
      flags.push("DIO");
    }
    if (data & MSR_EXM) {
      flags.push("EXM");
    }
    if (data & MSR_CB) {
      flags.push("CB");
    }
    const busy = data & 0x0f;
    if (busy) {
      flags.push(`$${toHexa2(data & 0x0f)}`);
    }
    this.log({
      opType: PortOperationType.ReadMsr,
      addr: this.machine.opStartAddress,
      data,
      phase: "S",
      comment: flags.join(" | ")
    });
    return this.msr;
  }

  // --- Writes the value of the data register (8-bit)
  writeDataRegister (value: number): void {
    // --- Split to a byte
    value &= 0xff;
    let terminated = false;

    // --- Done, if the controller does not accept data
    if (!(this.msr & MSR_RQM) || this.msr & MSR_DIO) return;

    if (this.msr & MSR_CB && this.operationPhase === OperationPhase.Execution) {
      // --- The controller executes a command and expects more data from the CPU (Write Data or Scan)
      if (this.command.id === Command.WriteId) {
        this.processDataWhileFormatting(value);
      } else if (this.command.id === Command.WriteData) {
        this.log({
          opType: PortOperationType.WriteData,
          addr: this.machine.opStartAddress,
          phase: "D",
          data: value
        });
        this.processDataWhileWriting(value);
      } else {
        this.processDataWhileScanning(value);
      }
      return;
    }

    // --- Command Phase
    if (this.commandBytesReceived === 0) {
      // --- First byte -> command
      this.identifyCommand(value);

      // --- Log the command
      this.log({
        opType: PortOperationType.WriteData,
        addr: this.machine.opStartAddress,
        phase: "C",
        data: value,
        comment: this.command.name
      });
      this.msr |= MSR_CB;

      // --- A Sense Interrupt Status Command must be sent after a Seek or Recalibrate interrupt;
      // --- otherwise the FDC will consider the next Command to be an invalid Command
      // --- Note: looks uPD765 should NOT, because The New Zealand Story does not work with this stuff
      //
      // --- If a SENSE INTERRUPT STATUS command is issued when no active interrupt condition is present,
      // --- the status register ST0 will return a value of $80 (invalid command) ... (82078 44pin)
      if (
        this.intReq === IntRequest.None &&
        this.command.id == Command.SenseInt
      ) {
        // --- This command will be INVALID
        this.identifyCommand(0x00);
      }
    } else {
      // --- Store the subsequent command parameter
      this.dataRegister[this.commandBytesReceived - 1] = value;
      this.log({
        opType: PortOperationType.WriteData,
        addr: this.machine.opStartAddress,
        phase: "P",
        data: value,
        comment: this.command.paramNames[this.commandBytesReceived - 1]
      });
    }

    // --- Do we need to receive more command parameters?
    if (this.commandBytesReceived >= this.command.length) {
      // --- We already read all neccessery byte, start executing the command
      this.operationPhase = OperationPhase.Execution;
      this.msr &= ~MSR_RQM;
      if (this.nonDmaMode) {
        // --- Only NON-DMA mode emulated
        this.msr |= MSR_EXM;
      }

      // --- Set the command-specific parameters according to the current command ID
      // --- Select current drive and head if needed
      if (
        this.command.id !== Command.SenseInt &&
        this.command.id !== Command.Specify &&
        this.command.id !== Command.Invalid
      ) {
        // --- The US parameter specified the current drive
        this.us = this.dataRegister[0] & 0x03;
        if (this.us & 0x01 && this.hasDriveB) {
          this.currentDrive = this.driveB;
          this.driveA.selectDrive(false);
          this.driveB.selectDrive(true);
        } else {
          this.currentDrive = this.driveA;
          this.driveA.selectDrive(true);
          this.driveB.selectDrive(false);
        }

        // --- Set the current drive's head
        this.hd = (this.dataRegister[0] & 0x04) >> 2 ? 1 : 0;
        this.currentDrive.currentHead = this.currentDrive.hasTwoHeads
          ? this.hd
          : 0;

        // --- Identify READ_DELETED_DATA/WRITE_DELETED_DATA
        if (
          this.command.id === Command.ReadData ||
          this.command.id === Command.WriteData
        ) {
          this.deletedData = !!((this.commandRegister & 0x08) >> 3);
          this.sk = !!((this.dataRegister[0] & 0x20) >> 5);
        }
      }

      // --- During the Command Phase of the SEEK operation the FDC in the FDC BUSY state,
      // --- but during the Execution Phase it is in the NON BUSY state. While the FDC is
      // --- in the NON BUSY state, another Seek Command may be issued, and in this manner
      // --- paralell seek operation may be done on up to 4 Drives at once.
      //
      // --- The ability to overlap RECALIBRATE Commands to Multiple FDDs, and the loss of
      // --- the READY signal, as described in the SEEK Command, also applies to the
      // --- RECALIBRATE Command.
      //
      // --- Note:
      // --- For overlapped seeks, only one step pulse per drive section is issued.
      // --- Non-overlapped seeks will issue all programmed step pulses.
      if (
        this.command.id === Command.Recalibrate ||
        this.command.id === Command.Seek ||
        this.command.id === Command.Specify
      ) {
        // --- Reset the Controller Busy flag
        this.msr &= ~MSR_CB;
      }

      if (this.command.id < Command.SenseInt) {
        if (this.command.id < Command.Recalibrate) {
          // --- Reset status registers
          this.sr0 = this.sr1 = this.sr2 = 0x00;
        }

        // --- Set ST0 device/head
        this.sr0 = this.us | (this.hd ? 0x04 : 0x00);
      }

      switch (this.command.id) {
        case Command.Invalid:
          // --- Sign abnormal termination
          this.sr0 = SR0_IC;
          break;

        case Command.Specify:
          this.processSpecify();
          break;

        case Command.SenseDrive:
          this.processSenseDrive();
          break;

        case Command.SenseInt:
          this.processSenseInterrupt();
          break;

        case Command.Recalibrate:
          this.processRecalibrate();
          break;

        case Command.Seek:
          this.processSeek();
          break;

        case Command.ReadId:
          this.commandWithLoadHead();
          return;

        case Command.ReadData:
          this.processReadData();
          return;

        case Command.WriteData:
          terminated = this.processWriteData();
          if (terminated) {
            break;
          }
          return;

        case Command.WriteId:
          terminated = this.processWriteId();
          if (terminated) {
            break;
          }
          return;

        case Command.Scan:
          this.processScan();
          return;
      }

      // --- Complete the last executed command
      if (this.command.id < Command.ReadId && !terminated) {
        // --- We have execution phase, this command goes on. It may convey data to the CPU or
        // --- expect data to pass to the FDC
        this.msr |= MSR_RQM;
        if (this.command.id < Command.WriteData) {
          // --- Data goes from FDC to CPU
          this.msr |= MSR_DIO;
        }
      } else {
        // --- The command has completed, operation goes to result phase
        this.signCommandResult();
      }
    } else {
      // --- We need to receive more command parameters
      this.commandBytesReceived++;
    }
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
    if (!this.currentDrive.motorOn) {
      this.currentDrive.turnOnMotor();
      this.log({
        addr: this.machine.opStartAddress,
        opType: PortOperationType.MotorEvent,
        data: this.currentDrive.motorSpeed,
        comment: "Motor on"
      });
    }
  }

  // --- Turn off the floppy drive's motor
  turnOffMotor (): void {
    if (this.currentDrive.motorOn) {
      this.currentDrive.turnOffMotor();
      this.log({
        addr: this.machine.opStartAddress,
        opType: PortOperationType.MotorEvent,
        data: this.currentDrive.motorSpeed,
        comment: "Motor off"
      });
    }
  }

  // --- Get the floppy drive's motor speed
  getMotorSpeed (): number {
    return this.currentDrive.motorSpeed;
  }

  // --- Get the floppy drive's save light value
  getFloppySaveLight (): boolean {
    // TODO: Implement this
    return false;
  }

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted (): void {
    this.driveA?.onFrameCompleted();
    const driveAChanges = this.driveA?.getChangedSectors();
    if (driveAChanges && driveAChanges.size > 0) {
      this.machine.setMachineProperty(DISK_A_CHANGES, driveAChanges);
    }
    this.driveB?.onFrameCompleted();
    const driveBChanges = this.driveB?.getChangedSectors();
    if (driveBChanges && driveBChanges.size > 0) {
      this.machine.setMachineProperty(DISK_B_CHANGES, driveBChanges);
    }
  }

  // ==========================================================================
  // Helpers
  // --- Adds a new item to the operation log
  private log (entry: FloppyLogEntry): void {
    if (entry.opType === PortOperationType.ReadMsr) return;
    if (this.opLog.length >= MAX_LOG_ENTRIES) {
      this.opLog.shift();
    }
    this.opLog.push(entry);
  }

  // --- Registers an event
  private registerEvent (
    ms: number,
    eventFn: (data: any) => void,
    data: any
  ): void {
    const machine = this.machine;
    const eventTact =
      machine.tacts +
      ((machine.baseClockFrequency * machine.clockMultiplier) / 1000) * ms;
    machine.queueEvent(eventTact, eventFn, data);
  }

  // --- Unregisters an event
  private removeEvent (eventFn: (data: any) => void): void {
    this.machine.removeEvent(eventFn);
  }

  // --- Identifies the command to execute
  private identifyCommand (value: number): void {
    this.commandRegister = value;

    // --- Invalid by default
    let cmd = commandTable[commandTable.length - 1];
    const tableCmd = commandTable.find(
      c => (this.commandRegister & c.mask) === c.value
    );
    if (tableCmd) {
      cmd = tableCmd;
    }
    this.mt = !!((this.commandRegister >> 7) & 0x01);
    this.mf = !!((this.commandRegister >> 6) & 0x01);
    this.sk = !!((this.commandRegister >> 5) & 0x01);
    this.command = cmd;
  }

  // --- Handle the Specify command
  private processSpecify (): void {
    this.stepRate = 0x10 - (this.dataRegister[0] >> 4);
    this.headUnloadTime = (this.dataRegister[0] & 0x0f) << 4;
    if (this.headUnloadTime === 0) this.headUnloadTime = 128;
    this.headLoadTime = this.dataRegister[1] & 0xfe;
    if (this.headLoadTime === 0) this.headLoadTime = 256;
    this.nonDmaMode = !!(this.dataRegister[1] & 0x01);
    this.operationPhase = OperationPhase.Command;
  }

  // --- Handle the Sense Drive Status command
  private processSenseDrive (): void {
    if (this.us & 0x01) {
      if (this.hasDriveB) {
        this.sr3 = this.driveB.currentHead ? SR3_HD : 0x00;
        this.sr3 |=
          !this.driveB.hasDiskLoaded || this.driveB.writeProtected
            ? SR3_WP
            : 0x00;
        this.sr3 |= this.driveB.track0Mark ? SR3_T0 : 0x00;
        this.sr3 |= this.driveB.hasTwoHeads ? SR3_TS : 0x00;
        this.sr3 |= this.driveB.ready ? SR3_RD : 0x00;
        this.sr3 |= SR3_US0;
      } else {
        this.sr3 = 0x00;
      }
    } else {
      this.sr3 = this.driveA.currentHead ? SR3_HD : 0x00;
      this.sr3 |=
        !this.driveA.hasDiskLoaded || this.driveA.writeProtected
          ? SR3_WP
          : 0x00;
      this.sr3 |= this.driveA.track0Mark ? SR3_T0 : 0x00;
      this.sr3 |= this.driveA.hasTwoHeads ? SR3_TS : 0x00;
      this.sr3 |= this.driveA.ready ? SR3_RD : 0x00;
    }
  }

  // --- Handle the Sense Interrupt Status command
  private processSenseInterrupt (): void {
    // --- Iterate through drives to find the first one with terminated seek
    for (let i = 0; i < 4; i++) {
      if (this.seekStatus[i] >= SeekStatus.NormalTermination) {
        // --- The seek operation has been completed (normally or with error)
        // --- Reset the termination flags to "normal termination of command"
        this.sr0 &= ~0xc0;
        // --- Sign Seek End
        this.sr0 |= SR0_SE;
        if (this.seekStatus[i] === SeekStatus.AbnormalTermination) {
          // --- Sign Abnormal Termination
          this.sr0 |= SR0_AT;
        } else if (this.seekStatus[i] === SeekStatus.DriveNotReady) {
          // --- Sign Abnormal termination due to drive not ready
          this.sr0 |= SR0_IC | SR0_AT | SR0_NR;
        }

        // --- End of seek
        this.seekStatus[i] = SeekStatus.None;
        this.seekAge[i] = 0;

        // --- Return head always 0 (11111011)
        this.senseIntRes[0] = this.sr0 & 0xfb;
        this.senseIntRes[1] = this.presentCylinderNumbers[i];
        break;
      }
    }

    if (
      this.seekStatus[0] < SeekStatus.NormalTermination &&
      this.seekStatus[1] < SeekStatus.NormalTermination &&
      this.seekStatus[2] < SeekStatus.NormalTermination &&
      this.seekStatus[3] < SeekStatus.NormalTermination
    ) {
      // --- No terminated seek operations, reset INTRQ state
      this.intReq = IntRequest.None;
    }
  }

  // --- Handle the Recalibrate command
  private processRecalibrate (): void {
    // --- Previous seek in progress?
    if (this.msr & (1 << this.us)) {
      return;
    }

    // --- Save the current cylinder number
    this.savedCylinderNumbers[this.us] = this.presentCylinderNumbers[this.us];

    // --- The controller should find Track 0 in up to 77 steps
    this.presentCylinderNumbers[this.us] = 77;

    // --- To Track 0
    this.dataRegister[1] = 0x00;

    // --- Save new cylinder number
    this.newCylinderNumbers[this.us] = this.dataRegister[1];

    // --- Recalibrate started
    this.seekStatus[this.us] = SeekStatus.Recalibrate;

    // --- Make a step signing that it is the start of the seek operation
    this.seekStep(true);
  }

  // --- Handle the Seek command
  private processSeek (): void {
    // --- Previous seek in progress?
    if (this.msr & (1 << this.us)) {
      return;
    }
    // --- Save new cylinder number
    this.newCylinderNumbers[this.us] = this.dataRegister[1];
    // --- Seek started
    this.seekStatus[this.us] = SeekStatus.SeekStarted;
    this.seekStep(true);
  }

  // --- Handle the Read Data command
  private processReadData (): void {
    this.expRecordLength =
      0x80 <<
      (this.dataRegister[4] > MAX_SIZE_CODE
        ? MAX_SIZE_CODE
        : this.dataRegister[4]);
    if (this.dataRegister[4] === 0 && this.dataRegister[7] < 128) {
      this.expRecordLength = this.dataRegister[7];
    }
    // --- Always read at least one sector
    this.firstRw = true;
    this.commandWithLoadHead();
  }

  // --- Handle the Write Data command
  private processWriteData (): boolean {
    const drive = this.currentDrive;
    if (drive.writeProtected) {
      this.sr1 |= SR1_NW;
      this.sr0 |= SR0_AT;
      return true;
    }
    this.expRecordLength =
      0x80 <<
      (this.dataRegister[4] > MAX_SIZE_CODE
        ? MAX_SIZE_CODE
        : this.dataRegister[4]);
    if (this.dataRegister[4] === 0 && this.dataRegister[7] < 128) {
      this.expRecordLength = this.dataRegister[7];
    }
    // --- Always write at least one sector */
    this.firstRw = true;
    this.commandWithLoadHead();
    return false;
  }

  // --- Handle the Write ID command
  private processWriteId (): boolean {
    const drive = this.currentDrive;
    if (drive.writeProtected) {
      this.sr1 |= SR1_NW;
      this.sr0 |= SR0_AT;
      return true;
    }
    // --- Max. 8192 byte/sector
    this.expRecordLength =
      0x80 <<
      (this.dataRegister[1] > MAX_SIZE_CODE
        ? MAX_SIZE_CODE
        : this.dataRegister[1]);
    this.commandWithLoadHead();
    return false;
  }

  // --- Handle the Scan command
  private processScan (): void {
    // --- & 0x0c >> 2 == 00 - equal, 10 - low, 11 - high
    this.scan =
      (this.commandRegister & 0x0c) >> 2 === 0
        ? ScanType.Eq
        : (this.commandRegister & 0x0c) >> 2 === 0x03
        ? ScanType.Hi
        : ScanType.Lo;
    this.expRecordLength =
      0x80 <<
      (this.dataRegister[4] > MAX_SIZE_CODE
        ? MAX_SIZE_CODE
        : this.dataRegister[4]);
    this.commandWithLoadHead();
  }

  // --- Processes the data coming from the CPU while a Write Data command is in progress
  private processDataWhileWriting (value: number): void {
    const drive = this.currentDrive;
    // --- Write data
    this.dataOffset++;
    drive.currentData = value;
    drive.writeData();
    this.crcAdd();
    if (this.dataOffset === this.expRecordLength) {
      // --- Read only rlen byte from host
      drive.currentData = 0x00;
      while (this.dataOffset < this.sectorLength) {
        // --- Fill with 0x00
        drive.readData();
        this.crcAdd();
        this.dataOffset++;
      }
    }
    // --- Write the CRC
    if (this.dataOffset === this.sectorLength) {
      // --- Write CRC MSB
      drive.currentData = this.crc.high;
      drive.writeData();
      // --- Write CRC LSB
      drive.currentData = this.crc.low;
      drive.writeData();
      this.msr &= ~MSR_RQM;
      this.startWriteData();
    }
  }

  // --- Processes the data coming from the CPU while a Write ID command is in progress
  private processDataWhileFormatting (value: number): void {
    this.dataRegister[this.dataOffset + 5] = value; // --- Read ID fields
    this.dataOffset++;
    const drive = this.currentDrive;

    if (this.dataOffset === 4) {
      // C, H, R, N done => format track
      this.removeEvent(this.timeoutEventHandler);
      drive.currentData = 0x00;

      // --- Write 6/12 zero
      for (let i = this.mf ? 12 : 6; i > 0; i--) {
        drive.writeData();
      }
      this.crcPreset();

      if (this.mf) {
        // --- MFM
        drive.currentData = 0xffa1;
        for (let i = 3; i > 0; i--) {
          // --- Write 3 0xa1 with clock mark
          drive.writeData();
          this.crcAdd();
        }
      }

      // --- Write ID mark
      drive.currentData = 0x00fe | (this.mf ? 0x0000 : 0xff00);
      drive.writeData();
      this.crcAdd();

      // --- Write ID fields
      for (let i = 0; i < 4; i++) {
        drive.currentData = this.dataRegister[i + 5];
        drive.writeData();
        this.crcAdd();
      }

      // --- Write CRC
      drive.currentData = this.crc.high;
      drive.writeData();
      drive.currentData = this.crc.low;
      drive.writeData();

      // --- Write 11 GAP bytes
      drive.currentData = this.mf ? 0x4e : 0xff;
      for (let i = 11; i > 0; i--) {
        drive.writeData();
      }
      if (this.mf) {
        // --- MFM, write another 11 GAP byte
        for (let i = 11; i > 0; i--) {
          drive.writeData();
        }
      }

      // --- Write 6/12 zero
      drive.currentData = 0x00;
      for (let i = this.mf ? 12 : 6; i > 0; i--) {
        drive.writeData();
      }

      // --- Write clock/data mark
      this.crcPreset();
      if (this.mf) {
        // --- MFM
        drive.currentData = 0xffa1;

        // --- write 3 0xa1 with clock mark */
        for (let i = 3; i > 0; i--) {
          drive.writeData();
          this.crcAdd();
        }
      }

      // --- Write data mark
      drive.currentData = 0x00fb | (this.mf ? 0x0000 : 0xff00);
      drive.writeData();
      this.crcAdd();

      // --- Write filler byte
      drive.currentData = this.dataRegister[4];
      for (let i = this.expRecordLength; i > 0; i--) {
        drive.writeData();
        this.crcAdd();
      }

      // --- Write CRC
      drive.currentData = this.crc.high;
      drive.writeData();
      drive.currentData = this.crc.low;
      drive.writeData();

      // --- Write GAP3
      drive.currentData = this.mf ? 0x4e : 0xff;
      for (let i = this.dataRegister[3]; i > 0; i--) {
        drive.writeData();
      }

      // --- Prepare next sector
      this.dataOffset = 0;
      this.dataRegister[2]--;
    }

    // --- Finished all sectors?
    if (this.dataRegister[2] === 0) {
      // --- GAP3
      drive.currentData = this.mf ? 0x4e : 0xff;
      while (!drive.atIndexWhole) {
        drive.writeData();
      }

      // --- End of execution phase
      this.operationPhase = OperationPhase.Result;
      this.resultBytesLeft = this.command.resultLength;
      this.msr &= ~MSR_RQM;
      this.intReq = IntRequest.Result;
      this.signCommandResult();
      return;
    }

    // --- Event for the next sector
    this.registerEvent(20, this.timeoutEventHandler, this);
  }

  // --- Processes the data coming from the CPU while a Scan command is in progress
  private processDataWhileScanning (value: number): void {
    const d = this.currentDrive;
    this.dataOffset++;
    d.readData();
    this.crcAdd();
    if (this.dataOffset === 0 && d.currentData === value) {
      // --- "Scan hit"
      this.sr2 |= SR2_SH;
    }
    if (d.currentData !== value) {
      // --- "Scan not hit"
      this.sr2 &= ~SR2_SH;
    }
    if (
      (this.scan === ScanType.Eq && d.currentData !== value) ||
      (this.scan === ScanType.Lo && d.currentData > value) ||
      (this.scan === ScanType.Hi && d.currentData < value)
    ) {
      // --- Scan not satisfied
      this.sr2 |= SR2_SN;
    }
    if (this.dataOffset === this.sectorLength) {
      // --- Read the CRC
      d.readData();
      this.crcAdd();
      d.readData();
      this.crcAdd();
      if (this.crc.value !== 0x0000) {
        this.sr2 |= SR2_DD;
        this.sr1 |= SR1_DE;
      }
      this.dataRegister[3] += this.dataRegister[7]; // --- FIXME: what about STP>2 or STP<1
      if (this.ddam != this.deletedData) {
        // --- We read a not 'wanted' sector... so
        if (this.dataRegister[5] >= this.dataRegister[3]) {
          // --- If we want to read more...
          this.sr0 |= SR0_AT;
        }
        this.signCommandResult();
        return;
      }
      if (this.sr2 & SR2_SH || (this.sr2 & SR2_SN) === 0x00) {
        // --- FIXME sure?
        this.signCommandResult();
        return;
      }
      this.revCounter = 2;
      this.msr &= ~MSR_RQM;
      this.startReadData();
    }
  }

  // --- Turn the operation phase to sending back result
  private signCommandResult (): void {
    // --- Set up result phase
    this.commandBytesReceived = 0;
    this.resultBytesLeft = this.command.resultLength;
    this.msr &= ~MSR_EXM;
    this.msr |= MSR_RQM;
    if (this.resultBytesLeft > 0) {
      // --- There are result bytes to send back to the CPU
      this.operationPhase = OperationPhase.Result;
      this.intReq = IntRequest.Result;
      this.msr |= MSR_DIO;
      this.resultIndex = 0;
    } else {
      // --- No result bytes, go on with command phase
      this.operationPhase = OperationPhase.Command;
      this.msr &= ~MSR_DIO;
      this.msr &= ~MSR_CB;
    }

    // --- No need to handle disk timeouts, as we completed an operation successfully
    this.removeEvent(this.timeoutEventHandler);

    // --- If the last command used the head and the head is loaded, let's unload it after timeout
    if (this.headLoaded && this.command.id <= Command.ReadId) {
      this.registerEvent(this.headUnloadTime, this.headEventHandler, this);
    }
  }

  // --- Get the next data byte to sende back in the result phase of Read Data
  private getReadDataResult (): number {
    const drive = this.currentDrive;

    this.dataOffset++; // --- count read bytes
    drive.readData();
    this.crcAdd();

    let r = drive.currentData & 0xff;
    if (this.dataOffset === this.expRecordLength) {
      // --- Send only the expected bytes to host
      while (this.dataOffset < this.sectorLength) {
        drive.readData();
        this.crcAdd();
        this.dataOffset++;
      }
    }
    if (
      this.command.id == Command.ReadData &&
      this.dataOffset === this.sectorLength
    ) {
      // --- Read the CRC
      drive.readData();
      this.crcAdd();
      drive.readData();
      this.crcAdd();
      if (this.crc.value !== 0x000) {
        this.sr2 |= SR2_DD;
        this.sr1 |= SR1_DE;
        this.sr0 |= SR0_AT;
        this.signCommandResult();
        return r;
      }

      if (this.ddam !== this.deletedData) {
        // --- we read a not 'wanted' sector... so
        if (this.dataRegister[5] > this.dataRegister[3]) {
          // --- if we want to read more...
          this.sr0 |= SR0_AT;
        }
        this.signCommandResult();
        return r;
      }
      this.revCounter = 2;
      this.msr &= ~MSR_RQM;
      this.startReadData();
    }
    return r;
  }

  // --- Makes a seek step
  private seekStep (start: boolean): void {
    let driveIndex = 0;
    if (start) {
      // --- We are at the start of the seek operation
      driveIndex = this.us;

      // --- Drive already in seek state?
      if (this.msr & (1 << driveIndex)) {
        // --- Yes, nothing more to do
        return;
      }

      // --- Mark seek mode for the drive. It will be cleared by Sense Interrupt command
      this.msr |= 1 << driveIndex;
    } else {
      // --- Get drive in seek state that has completed the positioning
      driveIndex = 0;
      for (let j = 1; j < 4; j++) {
        if (this.seekAge[j] > this.seekAge[driveIndex]) {
          driveIndex = j;
        }
      }
      // --- Here, driveIndex points to the drive with the oldest seek operation
      if (
        this.seekStatus[driveIndex] === SeekStatus.None ||
        this.seekStatus[driveIndex] >= SeekStatus.NormalTermination
      ) {
        // --- No seek operation, or the current seek has already terminated
        return;
      }
    }

    // --- Select the drive used in the seek operation
    const drive = driveIndex & 0x01 ? this.driveB : this.driveA;

    // --- There is need to seek?
    if (
      this.presentCylinderNumbers[driveIndex] ===
        this.newCylinderNumbers[driveIndex] &&
      this.seekStatus[driveIndex] === SeekStatus.Recalibrate &&
      !drive.track0Mark
    ) {
      // --- Recalibrate fail, abnormal termination
      this.seekStatus[driveIndex] = SeekStatus.AbnormalTermination;
      this.seekAge[driveIndex] = 0;
      this.intReq = IntRequest.Seek;

      // --- Track 0 signal not found after 77 steps
      this.sr0 |= SR0_EC;
      this.msr &= ~(1 << driveIndex);
      return;
    }

    // --- We have not reached the target cylinder yet
    if (
      this.presentCylinderNumbers[driveIndex] ===
        this.newCylinderNumbers[driveIndex] ||
      (this.seekStatus[driveIndex] === SeekStatus.Recalibrate &&
        drive.track0Mark)
    ) {
      // --- Correct position
      if (this.seekStatus[driveIndex] === SeekStatus.Recalibrate) {
        // --- Recalibrate, normal termination
        this.presentCylinderNumbers[driveIndex] = 0;
      }
      this.seekStatus[driveIndex] = SeekStatus.NormalTermination;
      this.seekAge[driveIndex] = 0;

      // --- Sign successful seek
      this.intReq = IntRequest.Seek;
      this.msr &= ~(1 << driveIndex);
      return;
    }

    // --- Drive not ready
    if (!drive.ready) {
      if (this.seekStatus[driveIndex] === SeekStatus.Recalibrate) {
        // --- Recalibrate
        this.presentCylinderNumbers[driveIndex] =
          this.savedCylinderNumbers[driveIndex] -
          (77 - this.presentCylinderNumbers[driveIndex]);
      }

      // --- restore PCN, drive not ready termination
      this.seekStatus[driveIndex] = SeekStatus.DriveNotReady;
      this.seekAge[driveIndex] = 0;
      this.intReq = IntRequest.Ready;

      // --- doesn't matter
      this.msr &= ~(1 << driveIndex);
      return;
    }

    // --- Send a step
    if (
      this.presentCylinderNumbers[driveIndex] !==
      this.newCylinderNumbers[driveIndex]
    ) {
      // --- Calculate the direction of the step
      const directionIn =
        this.presentCylinderNumbers[driveIndex] >
        this.newCylinderNumbers[driveIndex];

      // --- Step into that direction
      drive.step(directionIn);
      this.presentCylinderNumbers[driveIndex] += directionIn ? -1 : 1;

      // --- Update age for active seek operations
      for (let j = 0; j < 4; j++) {
        if (this.seekAge[j] > 0) {
          this.seekAge[j]++;
        }
      }
      this.seekAge[driveIndex] = 1;

      // --- Wait step completion
      this.registerEvent(this.stepRate, this.fdcEventHandler, this);
    }
  }

  // --- Seek to a specified id
  private seekId (): SeekIdResult {
    // --- Reset the Wrong Cylinder and Bad Cylinder flags
    this.sr2 &= ~(SR2_WC | SR2_BC);

    // --- Read the next sector's ID
    let idResult = this.readId();
    // --- Not found any good ID
    if (idResult !== ReadIdResult.Ok) {
      return SeekIdResult.NotFoundAny;
    }

    // --- We found a sector ID, check if it is the one we are looking for
    if (this.idTrack != this.dataRegister[1]) {
      // --- We're looking for another track, sigh Wrong Cylinder
      this.sr2 |= SR2_WC;

      if (this.idTrack === 0xff) {
        // --- We have found a Bad Cylinder
        this.sr2 |= SR2_BC;
      }

      // --- Sign the seek failure
      return SeekIdResult.NotFoundSpecified;
    }

    // --- Ok, we're on the right track, check the sector and the head
    if (
      this.idSector === this.dataRegister[3] &&
      this.idHead === this.dataRegister[2]
    ) {
      // --- The Track, Head, and Sector number match
      if (this.idLength !== this.dataRegister[4]) {
        // --- The Length field does not match, sign No Data
        this.sr1 |= SR1_ND;

        // --- Sign the seek failure
        return SeekIdResult.NotFoundSpecified;
      }

      // --- Yes, we have found the sector
      return SeekIdResult.Found;
    }

    // --- The Head and/or Sector numbers do not match, sign No Data
    this.sr1 |= SR1_ND;
    return SeekIdResult.NotFoundSpecified;
  }

  // --- Reads the DAM (Data Address Mark)
  // --- Return: false = found, true = not found
  private readDataAddressMark (): boolean {
    const drive = this.currentDrive;
    let i = 0;

    if (this.mf) {
      // --- Double density (MFM)
      for (i = 40; i > 0; i--) {
        drive.readData();
        // --- Read next?
        if (drive.currentData === 0x4e) continue;
        // --- Go to PLL sync
        if (drive.currentData === 0x00) break;

        this.sr2 |= SR2_MD;
        // --- Something wrong
        return true;
      }

      for (; i > 0; i--) {
        this.crcPreset();
        drive.readData();
        this.crcAdd();
        if (drive.currentData === 0x00) continue;
        // --- Got to 0xA1 mark
        if (drive.currentData === 0xffa1) break;
        this.sr2 |= SR2_MD;
        return true;
      }

      for (i = drive.currentData === 0xffa1 ? 2 : 3; i > 0; i--) {
        drive.readData();
        this.crcAdd();
        if (drive.currentData !== 0xffa1) {
          this.sr2 |= SR2_MD;
          return true;
        }
      }

      drive.readData();
      this.crcAdd();
      if (drive.currentData < 0x00f8 || drive.currentData > 0x00fb) {
        // !fb deleted mark
        this.sr2 |= SR2_MD;
        return true;
      }

      // --- DAM found
      this.ddam = drive.currentData !== 0x00fb;
      return false;
    } else {
      // --- SD -> FM
      for (i = 30; i > 0; i--) {
        drive.readData();
        // --- Read next?
        if (drive.currentData === 0xff) continue;
        // --- Go to PLL sync?
        if (drive.currentData === 0x00) break;
        this.sr2 |= SR2_MD;
        // --- Something wrond
        return true;
      }

      for (; i > 0; i--) {
        this.crcPreset();
        drive.readData();
        this.crcAdd();
        if (drive.currentData === 0x00) continue;
        // --- !fb deleted mark
        if (drive.currentData >= 0xfff8 && drive.currentData <= 0xfffb) break;

        this.sr2 |= SR2_MD;
        return true;
      }

      if (i === 0) {
        drive.readData();
        this.crcAdd();
        if (drive.currentData < 0xfff8 || drive.currentData > 0xfffb) {
          // --- !fb deleted mark
          this.sr2 |= SR2_MD;
          return true;
        }
      }

      // --- Found
      this.ddam = drive.currentData !== 0x00fb;
      return false;
    }
  }

  // --- Loads the head and then executes the current command
  private commandWithLoadHead (): void {
    // --- The current command will use the head, so it must not be unloaded. Remove the
    // --- event handler that would unolad the head
    this.removeEvent(this.headEventHandler);

    if (this.headLoaded) {
      // --- Head already loaded, start the command usign the head
      if (
        this.command.id === Command.ReadData ||
        this.command.id === Command.Scan
      ) {
        this.startReadData();
      } else if (this.command.id === Command.ReadId) {
        this.startReadId();
      } else if (this.command.id == Command.WriteData) {
        this.startWriteData();
      } else if (this.command.id == Command.WriteId) {
        this.currentDrive.waitIndexHole();
        this.startWriteId();
      }
    } else {
      // --- The head is not loaded, load it
      this.currentDrive.loadHead(true);
      this.headLoaded = true;

      // --- Allow the head to settle down after the head load time and start executing the command
      // --- using the loaded head
      this.registerEvent(this.headLoadTime, this.fdcEventHandler, this);
    }
  }

  // --- Start the Read ID command
  private startReadId (): void {
    // --- Allow up to 2 revolutions to find the ID
    if (!this.readIdInProgress) {
      this.revCounter = 2;
      this.readIdInProgress = true;
    }

    // --- Work with the current drive
    const drive = this.currentDrive;

    // --- Is there any revolutions left to find the ID?
    if (this.revCounter) {
      // --- Yes, continue reading the ID
      let startPosition =
        drive.dataPosInTrack >= (drive.surface?.bytesPerTrack ?? 0)
          ? 0
          : drive.dataPosInTrack;
      if (this.readId() !== ReadIdResult.NotFound) {
        // --- ID found (or CRC error)
        this.revCounter = 0;
      }

      const bytesPerTrack = drive.surface?.bytesPerTrack ?? 0;
      const relativeMove = bytesPerTrack
        ? (drive.dataPosInTrack - startPosition) / bytesPerTrack
        : 1;
      if (relativeMove > 0) {
        // --- We need to move ahead to find the start position. Allow up to two revolutions
        this.registerEvent(relativeMove * 200, this.fdcEventHandler, this);
        return;
      }
    }

    // --- No more revolutions, ID not found
    this.readIdInProgress = false;
    if (this.idMarkFound) {
      this.dataRegister[1] = this.idTrack;
      this.dataRegister[2] = this.idHead;
      this.dataRegister[3] = this.idSector;
      this.dataRegister[4] = this.idLength;
    }
    if (!this.idMarkFound || this.sr1 & SR1_DE) {
      // --- ID mark not found (or CRC error)
      this.sr0 |= SR0_AT;
    }
    this.intReq = IntRequest.Result;
    this.signCommandResult();
  }

  // --- Start the Read Data command
  private startReadData (): void {
    const fdc = this;

    // --- Try reading the data unless the loop is broken
    while (true) {
      if (
        this.firstRw ||
        this.readIdInProgress ||
        this.dataRegister[5] > this.dataRegister[3]
      ) {
        if (!this.readIdInProgress) {
          // --- Read operation has not been started
          if (!this.firstRw) {
            // --- We target the next sector on this track
            this.dataRegister[3]++;
          }

          // --- We do not target the first sector on the track anymore
          this.firstRw = false;

          // --- Allow two revolutions to find the sector
          this.revCounter = 2;
          this.readIdInProgress = true;
        }

        // --- Go on untile there is any revolution left or we find the sector
        while (this.revCounter) {
          // --- Start position
          let startPosition =
            this.currentDrive.dataPosInTrack >=
            this.currentDrive.surface.bytesPerTrack
              ? 0
              : this.currentDrive.dataPosInTrack;

          // --- Try to find the sector according to the current ID
          if (this.seekId() === SeekIdResult.Found) {
            // --- We have just found the sector, so we can exit the loop
            this.revCounter = 0;
            this.currentDrive.currentSectorIndex = this.idSector;
          } else {
            // --- We have not found the sector yet, so the ID mark is not found
            this.idMarkFound = false;
          }

          // --- Calculate the relative move
          const bytesPerTrack = this.currentDrive.surface?.bytesPerTrack ?? 0;
          const relativeMove = bytesPerTrack
            ? (this.currentDrive.dataPosInTrack - startPosition) / bytesPerTrack
            : 1;

          startPosition = this.currentDrive.surface.bytesPerTrack
            ? ((this.currentDrive.dataPosInTrack - startPosition) * 200) /
              this.currentDrive.surface.bytesPerTrack
            : 200;

          if (relativeMove > 0) {
            // --- We need to move ahead to find the start position. Allow up to two revolutions
            this.registerEvent(relativeMove * 200, this.fdcEventHandler, this);
            return;
          }
        }

        // --- We exited the loop above because we have found the sector or there
        // --- is no more revolutions left
        this.readIdInProgress = false;
        if (!this.idMarkFound) {
          // --- Not found/crc error
          this.sr0 |= SR0_AT;
          abortReadData();
          return;
        }

        // --- We have found the sector. Now, find the data address mark to commence reading the sector data
        if (this.readDataAddressMark()) {
          // --- Not found
          this.sr0 |= SR0_AT;
          abortReadData();
          return;
        }

        // --- Ok, we are just about to read the data
        if (this.ddam !== this.deletedData) {
          // --- We found not deleted data
          this.sr2 |= SR2_CM;
          if (this.sk) {
            // --- Skip deleted data as we do not want to read it
            this.dataRegister[3]++;
            continue;
          }
        }
      } else {
        // --- We have not found the specified sector in the current track
        if (this.mt) {
          // --- As this operation is a multritrack, let's find the first available sector on the next track
          this.dataRegister[1]++; // --- Next track
          this.dataRegister[3] = 1; // --- First sector
          continue;
        }

        // --- This is not a multitrack operation, so we abort
        abortReadData();
        return;
      }

      // --- Now, we are ready to send back data
      this.msr |= MSR_RQM;
      if (this.command.id !== Command.Scan) {
        // --- We are not in scan mode, so we can send back data from the FDC to the CPU
        this.msr |= MSR_DIO;
      }

      // --- This is the first data byte to send back
      this.dataOffset = 0;
      this.removeEvent(this.timeoutEventHandler);

      // --- 2 revolutions
      this.registerEvent(400, this.timeoutEventHandler, this);
      return;
    }

    // --- Helper for aborting the Read Data command
    function abortReadData (): void {
      // --- End of execution phase
      fdc.operationPhase = OperationPhase.Result;
      fdc.resultBytesLeft = fdc.command.resultLength;

      // --- End of cylinder is set if:
      // --- 1: sector data is read completely (i.e. no other errors occur like no data.)
      // --- 2: sector being read is same specified by EOT
      // --- 3: terminal count is not received
      // --- Note: in +3 uPD765 never got TC
      if (!(fdc.sr0 & 0xfc) && !fdc.sr1) {
        fdc.sr0 |= SR0_AT;
        fdc.sr1 |= SR1_EN;
      }

      if (!(fdc.sr0 & (SR0_AT | SR0_IC))) {
        // --- Next track
        fdc.dataRegister[1]++;
        // --- First sector
        fdc.dataRegister[3] = 1;
      }

      fdc.msr &= ~MSR_EXM;
      fdc.intReq = IntRequest.Result;
      fdc.signCommandResult();
    }
  }

  // --- Reads the current position ID
  private readId (): ReadIdResult {
    const fdc = this;
    const drive = this.currentDrive;

    this.sr1 &= ~(SR1_DE | SR1_MA | SR1_ND);
    this.idMarkFound = false;
    let i = this.revCounter;
    while (i === this.revCounter && drive.ready) {
      readNextDataByte(false);
      this.crcPreset();
      if (this.mf) {
        // --- Double density (MFM)
        if (drive.currentData === 0xffa1) {
          this.crcAdd();
          readNextDataByte();
          if (drive.currentData != 0xffa1) continue;
          readNextDataByte();
          if (drive.currentData !== 0xffa1) continue;
        } else {
          // --- No 0xa1 with missing clock...
          continue;
        }
      }
      drive.readData();
      if (drive.atIndexWhole) {
        this.revCounter--;
      }

      // --- Read the address end mark
      if (
        (this.mf && drive.currentData !== 0x00fe) ||
        (!this.mf && drive.currentData !== 0xfffe)
      ) {
        continue;
      }
      this.crcAdd();

      // --- Read track, head, and sector IDs
      readNextDataByte();
      this.idTrack = drive.currentData;
      readNextDataByte();
      this.idHead = drive.currentData;
      readNextDataByte();
      this.idSector = drive.currentData;
      readNextDataByte();
      this.idLength =
        drive.currentData > MAX_SIZE_CODE ? MAX_SIZE_CODE : drive.currentData;
      this.sectorLength = 0x80 << this.idLength;

      // --- Read CRC bytes
      readNextDataByte();
      readNextDataByte();

      if (this.crc.value !== 0x0000) {
        this.sr1 |= SR1_DE | SR1_ND;
        this.idMarkFound = true;
        // --- Found CRC error
        return ReadIdResult.CrcError;
      } else {
        this.idMarkFound = true;
        // --- Found and OK
        return ReadIdResult.Ok;
      }
    }
    if (!drive.ready) {
      this.revCounter = 0;
    }

    // --- FIXME NO_DATA?
    this.sr1 |= SR1_MA | SR1_ND;
    // --- Not found
    return ReadIdResult.NotFound;

    // --- Helper for reading a byte (and calculating CRC)
    function readNextDataByte (addCrc = true): void {
      drive.readData();
      if (addCrc) {
        fdc.crcAdd();
      }
      if (drive.atIndexWhole) {
        fdc.revCounter--;
      }
    }
  }

  // --- Start the Write Data command
  private startWriteData (): void {
    const drive = this.currentDrive;
    const fdc = this;

    // --- Try reading the data unless the loop is broken
    while (true) {
      if (
        this.firstRw ||
        this.readIdInProgress ||
        this.dataRegister[5] > this.dataRegister[3]
      ) {
        if (!this.readIdInProgress) {
          // --- Read operation has not been started
          if (!this.firstRw) {
            // --- We target the next sector on this track
            this.dataRegister[3]++;
          }

          // --- We do not target the first sector on the track anymore
          this.firstRw = false;

          // --- Allow two revolutions to find the sector
          this.revCounter = 2;
          this.readIdInProgress = true;
        }

        // --- Go on untile there is any revolution left or we find the sector
        while (this.revCounter) {
          // --- Start position
          let startPosition =
            this.currentDrive.dataPosInTrack >=
            this.currentDrive.surface.bytesPerTrack
              ? 0
              : this.currentDrive.dataPosInTrack;
          if (this.seekId() === SeekIdResult.Found) {
            // --- We have just found the sector, so we can exit the loop
            this.revCounter = 0;
            this.currentDrive.currentSectorIndex = this.idSector;
          } else {
            // --- We have not found the sector yet, so the ID mark is not found
            this.idMarkFound = false;
          }

          // --- Calculate the relative move
          const bytesPerTrack = this.currentDrive.surface?.bytesPerTrack ?? 0;
          const relativeMove = bytesPerTrack
            ? (this.currentDrive.dataPosInTrack - startPosition) / bytesPerTrack
            : 1;

          startPosition = this.currentDrive.surface.bytesPerTrack
            ? ((this.currentDrive.dataPosInTrack - startPosition) * 200) /
              this.currentDrive.surface.bytesPerTrack
            : 200;

          if (relativeMove > 0) {
            // --- We need to move ahead to find the start position. Allow up to two revolutions
            this.registerEvent(relativeMove * 200, this.fdcEventHandler, this);
            return;
          }
        }

        // --- We exited the loop above because we have found the sector or there
        // --- is no more revolutions left
        this.readIdInProgress = false;
        if (!this.idMarkFound) {
          // --- Not found/crc error
          this.sr0 |= SR0_AT;
          abortWriteData();
          return;
        }

        // --- "Delay" 11 GAP bytes
        for (let i = 11; i > 0; i--) {
          drive.readData();
        }
        if (this.mf) {
          // --- MFM, "delay" another 11 GAP byte
          for (let i = 11; i > 0; i--) {
            drive.readData();
          }
        }

        drive.currentData = 0x00;
        // -- Write 6/12 zero
        for (let i = this.mf ? 12 : 6; i > 0; i--) {
          drive.writeData();
        }
        this.crcPreset();
        if (this.mf) {
          // --- MFM
          drive.currentData = 0xffa1;
          // --- Write 3 0xa1 with clock mark */
          for (let i = 3; i > 0; i--) {
            drive.writeData();
            this.crcAdd();
          }
        }
        drive.currentData =
          (this.deletedData ? 0x00f8 : 0x00fb) | (this.mf ? 0x0000 : 0xff00);
        // --- Write data mark
        drive.writeData();
        this.crcAdd();
      } else {
        // --- Next track
        this.dataRegister[1]++;
        // --- First sector
        this.dataRegister[3] = 1;
        if (this.mt) continue;
        abortWriteData();
        return;
      }

      this.msr |= MSR_RQM;
      this.dataOffset = 0;
      this.removeEvent(this.timeoutEventHandler);
      this.registerEvent(400, this.timeoutEventHandler, this);
      return;
    }

    function abortWriteData (): void {
      fdc.operationPhase = OperationPhase.Result;
      fdc.resultBytesLeft = fdc.command.resultLength;
      // --- End of cylinder is set if:
      // --- 1: sector data is read completely (i.e. no other errors occur like no data).
      // --- 2: sector being read is same specified by EOT
      // --- 3: terminal count is not received
      // --- Note: in +3 uPD765 never got TC
      fdc.sr0 |= SR0_AT;
      fdc.sr1 |= SR1_EN;
      fdc.msr &= ~MSR_RQM;
      fdc.intReq = IntRequest.Result;
      fdc.signCommandResult();
    }
  }

  // --- Start the Write ID command
  private startWriteId (): void {
    const drive = this.currentDrive;

    // --- Write 40 GAP bytes
    drive.currentData = this.mf ? 0x4e : 0xff;
    for (let i = 40; i > 0; i--) {
      drive.writeData();
    }

    if (this.mf) {
      // --- MFM, write another 40 GAP byte
      for (let i = 40; i > 0; i--) {
        drive.writeData();
      }
    }

    // --- Write 6/12 zero
    drive.currentData = 0x00;
    for (let i = this.mf ? 12 : 6; i > 0; i--) {
      drive.writeData();
    }

    // --- Write clock
    this.crcPreset();
    if (this.mf) {
      // --- MFM
      drive.currentData = 0xffc2;
      for (let i = 3; i > 0; i--) {
        drive.writeData();
      }
    }

    // --- Write index mark
    drive.currentData = 0x00fc | (this.mf ? 0x0000 : 0xff00);
    drive.writeData();

    // --- Postindex GAP
    drive.currentData = this.mf ? 0x4e : 0xff;
    for (let i = 26; i > 0; i--) {
      drive.writeData();
    }
    if (this.mf) {
      // --- MFM
      for (let i = 24; i > 0; i--) {
        drive.writeData();
      }
    }

    this.msr |= MSR_RQM;
    this.dataOffset = 0;
    this.registerEvent(20, this.timeoutEventHandler, this);
  }

  // --- Handles the timeout event
  private timeoutEventHandler (data: any): void {
    const fdc = data as FloppyControllerDevice;
    fdc.sr0 |= SR0_AT;
    fdc.sr1 |= SR1_OR;
    fdc.signCommandResult();
  }

  // --- This event unloads the head if no head-using operation is in progress after
  // --- the head unload time
  private headEventHandler (data: any): void {
    const fdc = data as FloppyControllerDevice;
    fdc.currentDrive.loadHead(false);
    fdc.headLoaded = false;
  }

  private fdcEventHandler (data: any): void {
    const fdc = data as FloppyControllerDevice;
    const cmdId = data.command.id;
    if (fdc.readIdInProgress) {
      if (cmdId === Command.ReadData) {
        fdc.startReadData();
      } else if (cmdId === Command.ReadId) {
        fdc.startReadId();
      } else if (cmdId === Command.WriteData) {
        fdc.startWriteData();
      }
    } else if (fdc.msr & 0x03) {
      // --- Seek/Recalibrate active, make a new seek step (continue previous seek)
      fdc.seekStep(false);
    } else if (cmdId === Command.ReadData || cmdId === Command.Scan) {
      fdc.startReadData();
    } else if (cmdId === Command.ReadId) {
      fdc.startReadId();
    } else if (cmdId === Command.WriteData) {
      fdc.startWriteData();
    } else if (cmdId === Command.WriteId) {
      fdc.currentDrive.waitIndexHole();
      fdc.startWriteId();
    }
  }

  // --- Preset the CRC value to its default
  private crcPreset () {
    this.crc.value = 0xffff;
  }

  // --- Add the drive's data byte to the CRC
  private crcAdd (): void {
    this.crc.add(this.currentDrive.currentData);
  }
}

// --- FDC Busy. A Read or Write command is in process.FDC will not accept any other command.
export const MSR_CB = 0x10;

// --- Execution Mode. This bit is set only during execution phase in non-DMA
// --- mode When DB5 goes low, execution phase has ended and result phase has started.
// --- It operates only during non-DMA mode of operation.
export const MSR_EXM = 0x20;

// --- Data Input/Output
// --- Indicates direction of data transfer between FDC and data register If DIO = 1, then transfer is from data register to
// --- the processor. If DIO = 0, then transfer is from the processor to data register
export const MSR_DIO = 0x40;

// --- Request For Master
// --- Indicates data register IS ready to send or receive data to or from the processor.
// --- Both bits DIO and RQM should be used to perform the hand-shaking functions of "ready" and "directron" to the processor
export const MSR_RQM = 0x80;

// --- Not Ready
// --- When the FDD is in the not-ready state and a Read or Write command is issued, this flag is set If a Read
// --- or Write command is issued to side 1 of a single-sided drive, then this flag is set.
export const SR0_NR = 0x08;

// --- Equipment Check. If a fault signal received from the FDD, or if the track 0 signal fails to occur after 77
// --- step pulses, this flag is set.
export const SR0_EC = 0x10;

// --- Seek End. When the FDC completes the Seek command, this flag is set to high.
export const SR0_SE = 0x20;

// --- Abnormal termination of command, (AT) Execution of command was started but was not successfully completed.
export const SR0_AT = 0x40;

// --- Abnormal termination of command, (IC)
export const SR0_IC = 0x80;

// --- Missing Address Mark
// --- This bit is set if the FDC does not detect the IDAM before 2 index pulses It is also set if
// --- the FDC cannot find the DAM or DDAM after the IDAM is found. MD bit of ST2 is also ser at this time.
export const SR1_MA = 0x01;

// --- Not Writeable
// --- During execution of Write Data, Write Deleted Data or Write ID command. if the FDC.
// ---  detect: a write protect srgnal from the FDD. then this flag is Set.
export const SR1_NW = 0x02;

// --- No Data
// --- During execution of Read Data. Read Deleted Data Write Data. Write Deleted Data or Scan command,
// --- if the FDC cannot find the sector specified in the IDR(2) Register, this flag is set.
export const SR1_ND = 0x04;

// --- Over Run
// --- If the FDC is not serviced by the host system during data transfers within a certain time interval, this flag is set.
export const SR1_OR = 0x10;

// --- Data Error
// --- If the FDC is not serviced by the host system during data transfers within a certain time interval, this flag is set.
export const SR1_DE = 0x20;

// --- End of Track
// --- When the FDC tries to access a sector beyond the final sector of a cylinder, this flag is set.
export const SR1_EN = 0x80;

// --- Missing Address Mark in Data Field
// --- When data IS read from the medium, if the FDC cannot find a data address mark or
// --- deleted data address mark, then this flag is set.
export const SR2_MD = 0x01;

// --- Bad Cylinder
// --- This bit is related to the ND bit. and when the contents of C on the medium is different from
// --- that stored in the IDR and the contents of C is FFH. then this flag is set.
export const SR2_BC = 0x02;

// --- Scan Not Satisfied
// --- During execution of the Scan command, if the FD cannot find a sector on the cylinder which meets the condition.
// --- then this flag is set.
export const SR2_SN = 0x04;

// --- Scan Equal Hit
// --- During execution of the Scan command. if the condition of "equal" is satisfied, this flag is set.
export const SR2_SH = 0x08;

// --- Wrong Cylinder
// --- This bit is related to the ND bit, and when the contents of C(3) on the medium is different from that stored i n the IDR.
// --- this flag is set.
export const SR2_WC = 0x10;

// --- Data Error in Data Field
// --- If the FDC detects a CRC error in the data field then this flag is set.
export const SR2_DD = 0x20;

// --- Control Mark
// --- During execution of the Read Data or Scan command, if the FDC encounters a sector
// --- which contains a deleted data address mark, this flag is set Also set if DAM is found during Read Deleted Data.
export const SR2_CM = 0x40;

// --- US 0: Indicates the status of the Unit Select 0 signal
export const SR3_US0 = 0x01;

// --- HD 0: Indicates the status of the Side Select signal
export const SR3_HD = 0x04;

// --- Two Side
// --- This bit is used to indicate the status of the two side signal from the FDD.
export const SR3_TS = 0x08;

// --- Track 0
// --- This bit is used to indicate the status of the track 0 signal from the FDD.
export const SR3_T0 = 0x10;

// --- Ready
// --- This bit is used to Indicate the status of the ready signal from the FDD.
export const SR3_RD = 0x20;

// --- Write Protected
// --- This bit is used to indicate the status of the write protected signal from the FDD.
export const SR3_WP = 0x40;

// --- Percentage of motor speed increment in a single complete frame
const MOTOR_SPEED_INCREMENT = 2;
const MOTOR_SPEED_DECREMENT = 2;

// --- Maximum log entries preserved
const MAX_LOG_ENTRIES = 10240;

// ???
const MAX_SIZE_CODE = 8;

// --- Available scan types
export enum ScanType {
  Eq,
  Lo,
  Hi
}

// --- UPD Commands
export enum Command {
  // --- | Computer READ at execution phase
  //     V
  ReadData = 0,

  // --- | Computer WRITE at execution phase
  //     V
  WriteData,
  WriteId,
  Scan,

  // --- | No data transfer at execution phase
  //     V
  ReadId,

  // --- | No read/write head contact
  //     V
  Recalibrate,
  SenseInt,
  Specify,
  SenseDrive,
  Seek,
  Invalid
}

// --- Interrupt request type
export enum IntRequest {
  None = 0,
  Result,
  Exec,
  Ready,
  Seek
}

// --- Avaliable Seek Statuses
export enum SeekStatus {
  None = 0,
  SeekStarted = 1,
  Recalibrate = 2,
  NormalTermination = 4,
  AbnormalTermination = 5,
  DriveNotReady = 6
}

// --- Avaliable Statuses of the Read ID operation
export enum ReadIdResult {
  Ok = 0,
  CrcError = 1,
  NotFound = 2
}

// --- Avaliable results of the Seek ID operation
export enum SeekIdResult {
  Found = 0,
  CrcError = 1,
  NotFoundAny = 2,
  NotFoundSpecified = 3
}

// --- Describes a command
export type CommandDescriptor = {
  // --- Command ID
  id: Command;
  // --- Display name
  name: string;
  // --- Mask to use
  mask: number;
  // --- Value to test with mask
  value: number;
  // --- Command length
  length: number;
  // --- Result length
  resultLength: number;
  // --- Parameter names
  paramNames: string[];
  // --- Result names
  resultLabels: string[];
};

// --- Represents the execution phases of the controller
export enum OperationPhase {
  // --- The FDC receives all information required to perform a particular operation from the processor.
  Command,
  // --- The FDC performs the operation it was instructed to do.
  Execution,
  // --- After completion of the operation, status and other housekeeping information are made
  // --- available to the processor.
  Result
}

// --- Common parameter and result sets
const readDataPars = ["HD/US", "C", "H", "N", "R", "EOT", "GPL", "DTL"];
const readDataResults = ["ST0", "ST1", "ST2", "C", "H", "R", "N"];

// --- Description of available commmands
const commandTable: CommandDescriptor[] = [
  {
    id: Command.ReadData,
    name: "Read Data",
    mask: 0x1f,
    value: 0x06,
    length: 0x08,
    resultLength: 0x07,
    paramNames: readDataPars,
    resultLabels: readDataResults
  },
  // --- Deleted data
  {
    id: Command.ReadData,
    name: "Read Deleted Data",
    mask: 0x1f,
    value: 0x0c,
    length: 0x08,
    resultLength: 0x07,
    paramNames: readDataPars,
    resultLabels: readDataResults
  },
  {
    id: Command.Recalibrate,
    name: "Recalibrate",
    mask: 0xff,
    value: 0x07,
    length: 0x01,
    resultLength: 0x00,
    paramNames: ["US"],
    resultLabels: []
  },
  {
    id: Command.Seek,
    name: "Seek",
    mask: 0xff,
    value: 0x0f,
    length: 0x02,
    resultLength: 0x00,
    paramNames: ["HD/US", "NCN"],
    resultLabels: []
  },
  {
    id: Command.WriteData,
    name: "Write Data",
    mask: 0x3f,
    value: 0x05,
    length: 0x08,
    resultLength: 0x07,
    paramNames: readDataPars,
    resultLabels: readDataResults
  },
  // --- Deleted data
  {
    id: Command.WriteData,
    name: "Write Deleted Data",
    mask: 0x3f,
    value: 0x09,
    length: 0x08,
    resultLength: 0x07,
    paramNames: readDataPars,
    resultLabels: readDataResults
  },
  // --- Equal
  {
    id: Command.Scan,
    name: "Scan Equal",
    mask: 0x1f,
    value: 0x11,
    length: 0x08,
    resultLength: 0x07,
    paramNames: readDataPars,
    resultLabels: readDataResults
  },
  // --- Low or Equal
  {
    id: Command.Scan,
    name: "Scan Low or Equal",
    mask: 0x1f,
    value: 0x19,
    length: 0x08,
    resultLength: 0x07,
    paramNames: readDataPars,
    resultLabels: readDataResults
  },
  // --- High or Equal
  {
    id: Command.Scan,
    name: "Scan High or Equal",
    mask: 0x1f,
    value: 0x1d,
    length: 0x08,
    resultLength: 0x07,
    paramNames: readDataPars,
    resultLabels: readDataResults
  },
  {
    id: Command.ReadId,
    name: "Read Id",
    mask: 0xbf,
    value: 0x0a,
    length: 0x01,
    resultLength: 0x07,
    paramNames: ["HD/US"],
    resultLabels: readDataResults
  },
  {
    id: Command.WriteId,
    name: "Format",
    mask: 0xbf,
    value: 0x0d,
    length: 0x05,
    resultLength: 0x07,
    paramNames: ["HD/US"],
    resultLabels: readDataResults
  },
  {
    id: Command.SenseInt,
    name: "Sense Interrupt",
    mask: 0xff,
    value: 0x08,
    length: 0x00,
    resultLength: 0x02,
    paramNames: [],
    resultLabels: ["ST0", "PCN"]
  },
  {
    id: Command.Specify,
    name: "Specify",
    mask: 0xff,
    value: 0x03,
    length: 0x02,
    resultLength: 0x00,
    paramNames: ["SRT/HUT", "HLT/ND"],
    resultLabels: []
  },
  {
    id: Command.SenseDrive,
    name: "Sense Drive",
    mask: 0xff,
    value: 0x04,
    length: 0x01,
    resultLength: 0x01,
    paramNames: ["HD/US"],
    resultLabels: ["ST3"]
  },
  {
    id: Command.Invalid,
    name: "Invalid",
    mask: 0x00,
    value: 0x00,
    length: 0x00,
    resultLength: 0x01,
    paramNames: [],
    resultLabels: ["ST0"]
  }
];
