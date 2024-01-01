import {
  FloppyLogEntry,
  PortOperationType
} from "@abstractions/FloppyLogEntry";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { DISK_A_DATA, DISK_B_DATA } from "../machine-props";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDeviceNew";
import { IFloppyDiskDrive } from "@emu/abstractions/IFloppyDiskDrive";
import { FloppyDiskDrive } from "./FloppyDiskDriveNew";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { IFloppyControllerDeviceTest } from "./IFloppyContorllerDeviceTest";

// --- Implements the NEC UPD 765 chip emulation
export class FloppyControllerDevice
  implements IFloppyControllerDevice, IFloppyControllerDeviceTest
{
  // --- Members for testing
  // --- NOTE: These members are public for testing purposes only

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

  // --- Command parameter received
  commandParameters: number[];

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

  // --- The result to send back
  resultData: number[];

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
  driveA?: IFloppyDiskDrive;

  // --- Drive B
  driveB?: IFloppyDiskDrive;

  // --- Resets the device
  reset (): void {
    // --- Set up the floppy drives
    this.currentDrive = this.driveA = new FloppyDiskDrive(this);
    this.driveB = new FloppyDiskDrive(this);

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
    this.commandParameters = [];
    this.resultData = [];
    this.resultBytesLeft;
    this.resultIndex = 0;
    this.readIdInProgress = false;
    //this.lastSectorRead = 0;

    // --- Reset diagnostic members
    this.frames = 0;
  }

  // --- Respond to floppy file changes
  onMachinePropertiesChanged (args: {
    propertyName: string;
    newValue?: any;
  }): void {
    if (args.propertyName === DISK_A_DATA) {
      if (!(args.newValue instanceof Uint8Array)) return;

      const newDiskA = args.newValue;
      if (newDiskA === undefined) {
        this.driveA?.ejectDisk();
      } else {
        this.driveA.loadDisk(newDiskA);
      }
    } else if (args.propertyName === DISK_B_DATA) {
      if (!(args.newValue instanceof Uint8Array)) return;

      const newDiskB = args.newValue;
      if (newDiskB === undefined) {
        this.driveB?.ejectDisk();
      } else {
        this.driveB.loadDisk(newDiskB);
      }
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
        this.resultData[this.command.resultLength - this.resultBytesLeft - 2];
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
      if (this.command.id === Command.WriteData) {
        this.processDataWhileWriting();
      } else {
        this.processDataWhileScanning();
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
      this.commandParameters[this.commandBytesReceived - 1] = value;
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
        this.us = this.commandParameters[0] & 0x03;
        if (this.us & 0x01 && this.hasDriveB) {
          this.currentDrive = this.driveB;
          this.driveA.selected = false;
          this.driveB.selected = true;
        } else {
          this.currentDrive = this.driveA;
          this.driveA.selected = true;
          this.driveB.selected = false;
        }

        // --- Set the current drive's head
        this.hd = (this.commandParameters[0] & 0x04) >> 2 ? 1 : 0;
        this.currentDrive.currentHead = this.currentDrive.hasTwoHeads
          ? this.hd
          : 0;

        // --- Identify READ_DELETED_DATA/WRITE_DELETED_DATA
        if (
          this.command.id === Command.ReadData ||
          this.command.id === Command.WriteData
        ) {
          this.deletedData = !!((this.commandRegister & 0x08) >> 3);
          this.sk = !!((this.commandParameters[0] & 0x20) >> 5);
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
          // --- Immediate execution: store the parameters
          this.stepRate = 0x10 - (this.commandParameters[0] >> 4);
          this.headUnloadTime = (this.commandParameters[0] & 0x0f) << 4;
          if (this.headUnloadTime === 0) this.headUnloadTime = 128;
          this.headLoadTime = this.commandParameters[1] & 0xfe;
          if (this.headLoadTime === 0) this.headLoadTime = 256;
          this.nonDmaMode = !!(this.commandParameters[1] & 0x01);
          this.operationPhase = OperationPhase.Command;
          break;

        case Command.SenseDrive:
          let driveBEnabled = (this.us & 0x01) === 0x01 && this.hasDriveB;
          this.sr3 = (driveBEnabled ? SR3_US0 : 0x00) | (this.hd ? 0x04 : 0x00);
          // --- The plus3 wiring cause that the double side signal is the same as
          // --- the write protect signal
          this.sr3 |= this.currentDrive.writeProtected ? SR3_WP : 0x00;
          this.sr3 |= this.currentDrive.track0Mark ? SR3_T0 : 0x00;
          this.sr3 |= this.currentDrive.hasTwoHeads ? SR3_TS : 0x00;
          this.sr3 |= this.currentDrive.ready ? SR3_RD : 0x00;
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
          this.processReadId();
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

        case Command.Scan:
          this.processScan();
          return;
      }

      if (this.command.id < Command.ReadId && !terminated) {
        // --- We have execution phase
        this.msr |= MSR_RQM;
        if (this.command.id < Command.WriteData) {
          // --- Data goes from FDC to CPU
          this.msr |= MSR_DIO;
        }
      } else {
        // --- We have result phase
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
    this.currentDrive.turnOnMotor();
  }

  // --- Turn off the floppy drive's motor
  turnOffMotor (): void {
    this.currentDrive.turnOffMotor();
  }

  // --- Get the floppy drive's motor speed
  getMotorSpeed (): number {
    // TODO: Implement this
    return 0;
  }

  // --- Get the floppy drive's save light value
  getFloppySaveLight (): boolean {
    // TODO: Implement this
    return false;
  }

  // --- Carry out chores when a machine frame has been completed
  onFrameCompleted (): void {
    this.driveA?.onFrameCompleted();
    this.driveB?.onFrameCompleted();
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

  // --- Handle the Sense Interrupt Status command
  private processSenseInterrupt (): void {
    // for (let i = 0; i < 4; i++) {
    //   if (this.seek[i] >= 4) {
    //     // --- Seek interrupt, normal termination
    //     this.sr0 &= ~0xc0;
    //     this.sr0 |= SR0_SE;
    //     if (this.seek[i] === 5) {
    //       this.sr0 |= SR0_AT;
    //     } else if (this.seek[i] === 6) {
    //       this.sr0 |= SR0_IC | SR0_AT | SR0_NR;
    //     }
    //     // --- End of seek
    //     this.seek[i] = this.seekAge[i] = 0;
    //     // --- Return head always 0 (11111011)
    //     this.senseIntRes[0] = this.sr0 & 0xfb;
    //     this.senseIntRes[1] = this.pcn[i];
    //     i = 4;
    //   }
    // }
    // if (
    //   this.seek[0] < 4 &&
    //   this.seek[1] < 4 &&
    //   this.seek[2] < 4 &&
    //   this.seek[3] < 4
    // ) {
    //   // --- Delete INTRQ state
    //   this.intReq = IntRequest.None;
    // }
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
    // // --- Previous seek in progress?
    // if (this.msr & (1 << this.us)) {
    //   break;
    // }
    // // --- Save new cylinder number
    // this.ncn[this.us] = this.dataRegister[1];
    // // --- Seek started
    // this.seek[this.us] = 1;
    // this.seekStep(true);
  }

  // --- Handle the Read ID command
  private processReadId (): void {
    // this.loadHead();
  }

  // --- Handle the Read Data command
  private processReadData (): void {
    // // --- Speedlock
    // if (this.speedlock !== -1 && !d.doReadWeak) {
    //   let u =
    //     (this.dataRegister[2] & 0x01) +
    //     (this.dataRegister[1] << 1) +
    //     (this.dataRegister[3] << 8);
    //   if (this.dataRegister[3] === this.dataRegister[5] && u == 0x200) {
    //     if (u === this.lastSectorRead) {
    //       this.speedlock++;
    //     } else {
    //       this.speedlock = 0;
    //       this.lastSectorRead = u;
    //     }
    //   } else {
    //     this.lastSectorRead = this.speedlock = 0;
    //   }
    // }
    // // --- End of speedlock hack
    // this.rlen =
    //   0x80 <<
    //   (this.dataRegister[4] > MAX_SIZE_CODE
    //     ? MAX_SIZE_CODE
    //     : this.dataRegister[4]);
    // if (this.dataRegister[4] === 0 && this.dataRegister[7] < 128) {
    //   this.rlen = this.dataRegister[7];
    // }
    // // --- Always read at least one sector
    // this.firstRw = true;
    // this.loadHead();
  }

  // --- Handle the Write Data command
  private processWriteData (): boolean {
    // if (d.isWriteProtected) {
    //   this.sr1 |= SR1_NW;
    //   this.sr0 |= SR0_AT;
    //   terminated = 1;
    //   break;
    // }
    // this.rlen =
    //   0x80 <<
    //   (this.dataRegister[4] > MAX_SIZE_CODE
    //     ? MAX_SIZE_CODE
    //     : this.dataRegister[4]);
    // if (this.dataRegister[4] === 0 && this.dataRegister[7] < 128) {
    //   this.rlen = this.dataRegister[7];
    // }
    // // --- Always write at least one sector */
    // this.firstRw = true;
    // this.loadHead();
    return false;
  }

  // --- Handle the Scan command
  private processScan (): void {
    // // --- & 0x0c >> 2 == 00 - equal, 10 - low, 11 - high
    // this.scan =
    //   (this.commandRegister & 0x0c) >> 2 === 0
    //     ? ScanType.Eq
    //     : (this.commandRegister & 0x0c) >> 2 === 0x03
    //     ? ScanType.Hi
    //     : ScanType.Lo;
    // this.rlen =
    //   0x80 <<
    //   (this.dataRegister[4] > MAX_SIZE_CODE
    //     ? MAX_SIZE_CODE
    //     : this.dataRegister[4]);
    // this.loadHead();
  }

  private processDataWhileWriting (): void {
    // // --- Write data
    // this.dataOffset++;
    // d.data = value;
    // d.writeData();
    // this.crcAdd();
    // if (this.dataOffset === this.rlen) {
    //   // --- Read only rlen byte from host
    //   d.data = 0x00;
    //   while (this.dataOffset < this.sectorLength) {
    //     // --- Fill with 0x00
    //     d.readData();
    //     this.crcAdd();
    //     this.dataOffset++;
    //   }
    // }
    // // --- Write the CRC
    // if (this.dataOffset === this.sectorLength) {
    //   // --- Write CRC MSB
    //   d.data = this.crc >> 8;
    //   d.writeData();
    //   // --- Write CRC LSB
    //   d.data = this.crc & 0xff;
    //   d.writeData();
    //   this.msr &= ~MSR_RQM;
    //   this.startWriteData();
    // }
  }

  private processDataWhileScanning (): void {
    // // --- SCAN
    // this.dataOffset++;
    // d.readData();
    // this.crcAdd();
    // if (this.dataOffset === 0 && d.data === value) {
    //   // --- "Scan hit"
    //   this.sr2 |= SR2_SH;
    // }
    // if (d.data !== value) {
    //   // --- "Scan not hit"
    //   this.sr2 &= ~SR2_SH;
    // }
    // if (
    //   (this.scan === ScanType.Eq && d.data !== value) ||
    //   (this.scan === ScanType.Lo && d.data > value) ||
    //   (this.scan === ScanType.Hi && d.data < value)
    // ) {
    //   // --- Scan not satisfied
    //   this.sr2 |= SR2_SN;
    // }
    // if (this.dataOffset === this.sectorLength) {
    //   // --- Read the CRC
    //   d.readData();
    //   this.crcAdd();
    //   d.readData();
    //   this.crcAdd();
    //   if (this.crc !== 0x0000) {
    //     this.sr2 |= SR2_DD;
    //     this.sr1 |= SR1_DE;
    //   }
    //   this.dataRegister[3] += this.dataRegister[7]; // --- FIXME: what about STP>2 or STP<1
    //   if (this.ddam != this.deletedData) {
    //     // --- We read a not 'wanted' sector... so
    //     if (this.dataRegister[5] >= this.dataRegister[3]) {
    //       // --- If we want to read more...
    //       this.sr0 |= SR0_AT;
    //     }
    //     this.cmdResult();
    //     return;
    //   }
    //   if (this.sr2 & SR2_SH || (this.sr2 & SR2_SN) === 0x00) {
    //     // --- FIXME sure?
    //     this.cmdResult();
    //     return;
    //   }
    //   this.revCounter = 2;
    //   this.msr &= ~MSR_RQM;
    //   this.startReadData();
    // }
  }

  // --- Turn the operation phase to sending back result
  private signCommandResult (): void {
    // --- Set up result phase
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
    this.removeEvent(this.timeoutEventHandler);
    if (this.headLoaded && this.command.id <= Command.ReadId) {
      this.registerEvent(this.headUnloadTime, this.headEventHandler, this);
    }
  }

  // --- Get the next data byte to sende back in the result phase of Read Data
  private getReadDataResult (): number {
    // TODO: Implement this
    // // --- READ_DATA
    // this.dataOffset++; // --- count read bytes
    // d.readData();
    // this.crcAdd();

    // // --- Speedlock hack
    // if (this.speedlock > 0 && !d.doReadWeak) {
    //   if (this.dataOffset < 64 && d.data !== 0xe5) {
    //     // --- W.E.C Le Mans type
    //     this.speedlock = 2;
    //   } else if (
    //     (this.speedlock > 1 || this.dataOffset < 64) &&
    //     !(this.dataOffset % 29)
    //   ) {
    //     // --- Mess up data
    //     d.data ^= this.dataOffset;
    //     // --- Mess up CRC
    //     this.crcAdd();
    //   }
    // }
    // // --- End of Speedlock hack

    // r = d.data & 0xff;
    // if (this.dataOffset === this.rlen) {
    //   // --- Send only rlen byte to host
    //   while (this.dataOffset < this.sectorLength) {
    //     d.readData();
    //     this.crcAdd();
    //     this.dataOffset++;
    //   }
    // }
    // if (
    //   this.cmd.id == Command.ReadData &&
    //   this.dataOffset === this.sectorLength
    // ) {
    //   // --- Read the CRC
    //   d.readData();
    //   this.crcAdd();
    //   d.readData();
    //   this.crcAdd();
    //   if (this.crc !== 0x000) {
    //     this.sr2 |= SR2_DD;
    //     this.sr1 |= SR1_DE;
    //     this.sr0 |= SR0_AT;
    //     this.cmdResult(); /* set up result phase */
    //     return r;
    //   }

    //   if (this.ddam !== this.delData) {
    //     // --- we read a not 'wanted' sector... so
    //     if (this.dataRegister[5] > this.dataRegister[3]) {
    //       // --- if we want to read more...
    //       this.sr0 |= SR0_AT;
    //     }
    //     this.cmdResult();
    //     return r;
    //   }
    //   this.revCounter = 2;
    //   this.msr &= ~MSR_RQM;
    //   this.startReadData();
    // }
    // return r;
    return 0xff;
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
    const d = driveIndex % 1 ? this.driveB : this.driveA;

    // --- There is need to seek?
    if (
      this.presentCylinderNumbers[driveIndex] ===
        this.newCylinderNumbers[driveIndex] &&
      this.seekStatus[driveIndex] === SeekStatus.Recalibrate &&
      !d.track0Mark
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
      (this.seekStatus[driveIndex] === SeekStatus.Recalibrate && d.track0Mark)
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
    if (!d.ready) {
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
      const directionIn =
        this.presentCylinderNumbers[driveIndex] >
        this.newCylinderNumbers[driveIndex];
      d.step(directionIn);
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

  // --- Handles the timeout event
  private timeoutEventHandler (data: any): void {
    const fdc = data as FloppyControllerDevice;
    fdc.sr0 |= SR0_AT;
    fdc.sr1 |= SR1_OR;
    fdc.signCommandResult();
  }

  // --- Handles the head event
  private headEventHandler (data: any): void {
    // TODO: Implement this
    // const fdc = data as FloppyControllerDevice;
    // fdc.currentDrive.loadHead(false);
    // fdc.headLoad = false;
  }

  private fdcEventHandler (data: any): void {
    // TODO: Implement this
    const fdc = data as FloppyControllerDevice;
    const cmdId = this.command.id;
    if (fdc.readIdInProgress) {
      if (cmdId === Command.ReadData) {
        // TODO: Implement this
        // fdc.startReadData();
      } else if (cmdId === Command.ReadId) {
        // TODO: Implement this
        // fdc.startReadId();
      } else if (cmdId === Command.WriteData) {
        // TODO: Implement this
        // fdc.startWriteData();
      }
    } else if (fdc.msr & 0x03) {
      // --- Seek/Recalibrate active, make a new seek step (continue previous seek)
      fdc.seekStep(false);
    } else if (cmdId === Command.ReadData || cmdId === Command.Scan) {
      // TODO: Implement this
      // fdc.startReadData();
    } else if (cmdId === Command.ReadId) {
      // TODO: Implement this
      // fdc.startReadId();
    } else if (cmdId === Command.WriteData) {
      // TODO: Implement this
      // fdc.startWriteData();
    }
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
// --- If the FDC i s not serviced by the host system during data transfers within a certain time interval. this flaa i s set.
export const SR1_OR = 0x10;

// --- Data Error
// --- If the FDC i s not serviced by the host system during data transfers within a certain time interval. this flaa i s set.
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
const MAX_LOG_ENTRIES = 1024;

// ???
const MAX_SIZE_CODE = 8;

// --- Available scan types
enum ScanType {
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

export enum SeekStatus {
  None = 0,
  SeekStarted = 1,
  Recalibrate = 2,
  NormalTermination = 4,
  AbnormalTermination = 5,
  DriveNotReady = 6
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
  // --- Command paremeter length
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
