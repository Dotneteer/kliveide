import {
  FloppyLogEntry,
  PortOperationType
} from "@abstractions/FloppyLogEntry";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { FloppyDiskDrive } from "./FloppyDiskDrive";
import { FloppyDisk, crcFdcTable } from "./FloppyDisk";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { DISK_A_DATA, DISK_B_DATA } from "../machine-props";

// --- Implements the NEC UPD 765 chip emulation
export class FloppyControllerDevice implements IFloppyControllerDevice {
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

  // --- Current command
  private command: CommandDescriptor;

  // --- The current operation phase
  private phase: OperationPhase;

  // --- Current track of read/write operation
  private idTrack: number;

  // --- Current head of read/write operation
  private idHead: number;

  // --- Current sector of read/write operation
  private idSector: number;

  // --- Sector length code 0, 1, 2, 3 (128 << length code)
  private idLength: number;

  // --- Sector length from length code
  private sectorLength: number;

  // --- Read a deleted data mark
  private ddam: boolean;

  // --- Revolution counter
  private revCounter: number;

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

  // --- Result byte index
  private resultIndex: number;

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
  private pcn: number[] = [];

  // --- New cylinder numbers
  private ncn: number[] = [];

  // --- Recalibrate stored PCN values
  private rec: number[] = [];

  // --- Seek status for the drives
  private seek: number[] = [];

  // --- order of overlapped seeks for 4 drive
  private seekAge: number[] = [];

  // --- Expected record length
  private rlen: number;

  // --- Current SCAN type
  private scan: ScanType;

  // --- Current command
  private cmd: CommandDescriptor;

  // --- Command register
  private commandRegister: number;

  // --- Data registers
  private dataRegister: number[] = [];

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
  private senseIntRes: number[] = [];

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

  // --- Initializes the specified floppy
  constructor (public readonly machine: IZxSpectrumMachine) {
    this.driveA = new FloppyDiskDrive(this);
    this.driveA.reset(false);
    this.driveB = new FloppyDiskDrive(this);
    this.driveB.reset(false);
    const device = this;
    machine.machinePropertyChanged.on(args =>
      this.onMachinePropertiesChanged(device, args)
    );
    this.reset();
  }

  // --- Resets the device
  reset (): void {
    this.driveA.reset(true);
    this.driveB.reset(true);
    this.currentDrive = this.driveA;
    this.speedlock = 0;

    this.msr = MSR_RQM;
    this.sr0 = this.sr1 = this.sr2 = this.sr3 = 0x00;

    for (let i = 0; i < 4; i++) {
      this.pcn[i] = this.seek[i] = this.seekAge[i] = 0;
    }
    this.stepRate = 16;
    this.hut = 240;
    this.hld = 254;
    this.nonDma = true;
    this.headLoad = false;
    this.intReq = IntRequest.None;
    this.phase = OperationPhase.Command;
    this.cycle = 0;
    this.lastSectorRead = 0;
    this.readId = false;
  }

  // --- Respond to floppy file changes
  onMachinePropertiesChanged (
    device: any,
    args: { propertyName: string; newValue?: any }
  ): void {
    if (args.propertyName === DISK_A_DATA) {
      if (!(args.newValue instanceof FloppyDisk)) return;

      const newDiskA = args.newValue;
      if (newDiskA === undefined) {
        this.driveA?.ejectDisk();
      } else {
        this.driveA.insertDisk(newDiskA);
      }
    } else if (args.propertyName === DISK_B_DATA) {
      if (!(args.newValue instanceof FloppyDisk)) return;

      const newDiskB = args.newValue;
      if (newDiskB === undefined) {
        this.driveB?.ejectDisk();
      } else {
        this.driveB.insertDisk(newDiskB);
      }
    }
  }

  // --- Indicates if Drive #1 is present
  private _driveAPresent = false;
  get isDriveAPresent (): boolean {
    return this._driveAPresent;
  }
  set isDriveAPresent (value: boolean) {
    this._driveAPresent = value;
    if (this.driveA) {
      this.driveA.enabled = value;
    }
  }

  // --- Indicates if Drive #2 is present
  private _driveBPresent = false;
  get isDriveBPresent (): boolean {
    return this._driveBPresent;
  }
  set isDriveBPresent (value: boolean) {
    this._driveBPresent = value;
    if (this.driveB) {
      this.driveB.enabled = value;
    }
  }

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
      this.driveA.insertDisk(disk);
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
      this.driveB.insertDisk(disk);
    }
  }

  // --- Ejects disk from drive B
  ejectDiskB (): void {
    if (this.isDriveAPresent) {
      this.driveA.ejectDisk();
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
    let r = 0;
    const d = this.currentDrive;

    if (!(this.msr & MSR_RQM) || !(this.msr & MSR_DIO)) {
      return 0xff;
    }

    if (this.phase == OperationPhase.Execution) {
      // --- READ_DATA
      this.dataOffset++; // --- count read bytes
      d.readData();
      this.crcAdd();

      // --- Speedlock hack
      if (this.speedlock > 0 && !d.doReadWeak) {
        if (this.dataOffset < 64 && d.data !== 0xe5) {
          // --- W.E.C Le Mans type
          this.speedlock = 2;
        } else if (
          (this.speedlock > 1 || this.dataOffset < 64) &&
          !(this.dataOffset % 29)
        ) {
          // --- Mess up data
          d.data ^= this.dataOffset;
          // --- Mess up CRC
          this.crcAdd();
        }
      }
      // --- End of Speedlock hack

      r = d.data & 0xff;
      if (this.dataOffset === this.rlen) {
        // --- Send only rlen byte to host
        while (this.dataOffset < this.sectorLength) {
          d.readData();
          this.crcAdd();
          this.dataOffset++;
        }
      }
      if (
        this.cmd.id == Command.ReadData &&
        this.dataOffset === this.sectorLength
      ) {
        // --- Read the CRC
        d.readData();
        this.crcAdd();
        d.readData();
        this.crcAdd();
        if (this.crc !== 0x000) {
          this.sr2 |= SR2_DD;
          this.sr1 |= SR1_DE;
          this.sr0 |= SR0_AT;
          this.cmdResult(); /* set up result phase */
          return r;
        }

        if (this.ddam !== this.delData) {
          // --- we read a not 'wanted' sector... so
          if (this.dataRegister[5] > this.dataRegister[3]) {
            // --- if we want to read more...
            this.sr0 |= SR0_AT;
          }
          this.cmdResult();
          return r;
        }
        this.revCounter = 2;
        this.msr &= ~MSR_RQM;
        this.startReadData();
      }
      return r;
    }

    if (this.phase != OperationPhase.Result) {
      return 0xff;
    }

    if (this.cmd.id === Command.SenseDrive) {
      // --- Result byte 1
      r = this.sr3;
    } else if (this.cmd.id === Command.SenseInt) {
      // --- Result byte 2
      r = this.senseIntRes[this.cmd.reslength - this.cycle];
    } else if (this.cmd.reslength - this.cycle < 3) {
      switch (this.cmd.reslength - this.cycle) {
        case 0:
          r = this.sr0;
          break;
        case 1:
          r = this.sr1;
          break;
        case 2:
          r = this.sr2;
          break;
        default:
          r = this.sr3;
          break;
      }
    } else {
      r = this.dataRegister[this.cmd.reslength - this.cycle - 2];
    }
    this.cycle--;
    if (this.cycle === 0) {
      this.phase = OperationPhase.Command;
      this.msr |= MSR_RQM;
      this.msr &= ~MSR_DIO;
      this.msr &= ~MSR_CB;
      if (this.intReq < IntRequest.Ready) {
        this.intReq = IntRequest.None;
      }
    }

    this.log({
      opType: PortOperationType.ReadData,
      addr: this.machine.opStartAddress,
      phase: "R",
      data: r,
      comment: this.cmd.reslbls[this.resultIndex++]
    });
    return r;
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
    let terminated = 0;

    // --- Done, if the controller does not accept data
    if (!(this.msr & MSR_RQM) || this.msr & MSR_DIO) return;

    if (this.msr & MSR_CB && this.phase === OperationPhase.Execution) {
      // --- Execution phase Write/Format
      const d = this.currentDrive;
      if (this.cmd.id === Command.WriteData) {
        // --- Write data
        this.dataOffset++;
        d.data = value;
        d.writeData();
        this.crcAdd();

        if (this.dataOffset === this.rlen) {
          // --- Read only rlen byte from host
          d.data = 0x00;
          while (this.dataOffset < this.sectorLength) {
            // --- Fill with 0x00
            d.readData();
            this.crcAdd();
            this.dataOffset++;
          }
        }

        // --- Write the CRC
        if (this.dataOffset === this.sectorLength) {
          // --- Write CRC MSB
          d.data = this.crc >> 8;
          d.writeData();

          // --- Write CRC LSB
          d.data = this.crc & 0xff;
          d.writeData();

          this.msr &= ~MSR_RQM;
          this.startWriteData();
        }
        return;
      } else {
        // --- SCAN
        this.dataOffset++;
        d.readData();
        this.crcAdd();
        if (this.dataOffset === 0 && d.data === value) {
          // --- "Scan hit"
          this.sr2 |= SR2_SH;
        }
        if (d.data !== value) {
          // --- "Scan not hit"
          this.sr2 &= ~SR2_SH;
        }

        if (
          (this.scan === ScanType.Eq && d.data !== value) ||
          (this.scan === ScanType.Lo && d.data > value) ||
          (this.scan === ScanType.Hi && d.data < value)
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
          if (this.crc !== 0x0000) {
            this.sr2 |= SR2_DD;
            this.sr1 |= SR1_DE;
          }

          this.dataRegister[3] += this.dataRegister[7]; // --- FIXME: what about STP>2 or STP<1
          if (this.ddam != this.delData) {
            // --- We read a not 'wanted' sector... so
            if (this.dataRegister[5] >= this.dataRegister[3]) {
              // --- If we want to read more...
              this.sr0 |= SR0_AT;
            }
            this.cmdResult();
            return;
          }

          if (this.sr2 & SR2_SH || (this.sr2 & SR2_SN) === 0x00) {
            // --- FIXME sure?
            this.cmdResult();
            return;
          }
          this.revCounter = 2;
          this.msr &= ~MSR_RQM;
          this.startReadData();
        }
        return;
      }
    }

    // === Command Phase
    if (this.cycle === 0) {
      // --- First byte -> command
      this.commandRegister = value;
      this.cmdIdentify();

      // --- Log the command
      this.log({
        opType: PortOperationType.WriteData,
        addr: this.machine.opStartAddress,
        phase: "C",
        data: value,
        comment: this.cmd.name
      });
      this.msr |= MSR_CB;

      // --- A Sense Interrupt Status Command must be sent after a Seek or Recalibrate interrupt;
      // --- otherwise the FDC will consider the next Command to be an invalid Command
      // --- Note: looks uPD765 should NOT, because The New Zealand Story does not work with this stuff
      //
      // --- If a SENSE INTERRUPT STATUS command is issued when no active interrupt condition is present,
      // --- the status register ST0 will return a value of $80 (invalid command) ... (82078 44pin)
      if (this.intReq === IntRequest.None && this.cmd.id == Command.SenseInt) {
        // --- This command will be INVALID
        this.commandRegister = 0x00;
        this.cmdIdentify();
      }
    } else {
      // --- Store data register bytes
      this.dataRegister[this.cycle - 1] = value;
      this.log({
        opType: PortOperationType.WriteData,
        addr: this.machine.opStartAddress,
        phase: "P",
        data: value,
        comment: this.cmd.pars[this.cycle - 1]
      });
    }

    if (this.cycle >= this.cmd.cmdLength) {
      // --- We already read all neccessery byte, start executing the command
      this.phase = OperationPhase.Execution;
      this.msr &= ~MSR_RQM;
      if (this.nonDma) {
        // --- Only NON-DMA mode emulated
        this.msr |= MSR_EXM;
      }

      // --- Select current drive and head if needed
      if (
        this.cmd.id !== Command.SenseInt &&
        this.cmd.id !== Command.Specify &&
        this.cmd.id !== Command.Invalid
      ) {
        this.us = this.dataRegister[0] & 0x03;
        if (this.us & 0x01) {
          this.currentDrive = this.driveB;
          this.driveA.selected = false;
          this.driveB.selected = true;
        } else {
          this.currentDrive = this.driveA;
          this.driveA.selected = true;
          this.driveB.selected = false;
        }
        const d = this.currentDrive;

        // --- Set the current drive's head
        this.hd = !!((this.dataRegister[0] & 0x04) >> 2);
        if (!d.twoHeads) {
          d.headIndex = 0;
        } else {
          d.headIndex = this.hd ? 1 : 0;
        }

        // --- Identify READ_DELETED_DATA/WRITE_DELETED_DATA
        if (
          this.cmd.id === Command.ReadData ||
          this.cmd.id === Command.WriteData
        ) {
          this.delData = !!((this.commandRegister & 0x08) >> 3);
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
        this.cmd.id === Command.Recalibrate ||
        this.cmd.id === Command.Seek ||
        this.cmd.id === Command.Specify
      ) {
        this.msr &= ~MSR_CB;
      }

      if (this.cmd.id < Command.SenseInt) {
        if (this.cmd.id < Command.Recalibrate) {
          // --- Reset status registers
          this.sr0 = this.sr1 = this.sr2 = 0x00;
        }

        // --- Set ST0 device/head
        this.sr0 = this.us | (this.hd ? 0x04 : 0x00);
      }

      const d = this.currentDrive;
      switch (this.cmd.id) {
        case Command.Invalid:
          this.sr0 = 0x80;
          break;
        case Command.Specify:
          this.stepRate = 0x10 - (this.dataRegister[0] >> 4);
          this.hut = (this.dataRegister[0] & 0x0f) << 4;
          if (this.hut === 0) this.hut = 128;
          this.hld = this.dataRegister[1] & 0xfe;
          if (this.hld === 0) this.hld = 256;
          this.nonDma = !!(this.dataRegister[1] & 0x01);
          this.phase = OperationPhase.Command;
          break;
        case Command.SenseDrive:
          let driveBEnabled = (this.us & 0x01) === 0x01 && this.isDriveBPresent;
          this.sr3 = (driveBEnabled ? SR3_US0 : 0x00) | (this.hd ? 0x04 : 0x00);
          // --- The plus3 wiring cause that the double side signal is the same as
          // --- the write protect signal
          this.sr3 |= d.isWriteProtected ? SR3_WP : 0x00;
          this.sr3 |= d.tr00 ? SR3_T0 : 0x00;
          this.sr3 |= d.twoHeads ? SR3_TS : 0x00;
          this.sr3 |= driveBEnabled ? SR3_RD : 0x00;
          break;
        case Command.SenseInt:
          for (let i = 0; i < 4; i++) {
            if (this.seek[i] >= 4) {
              // --- Seek interrupt, normal termination
              this.sr0 &= ~0xc0;
              this.sr0 |= SR0_SE;
              if (this.seek[i] === 5) {
                this.sr0 |= SR0_AT;
              } else if (this.seek[i] === 6) {
                this.sr0 |= SR0_IC | SR0_AT | SR0_NR;
              }
              // --- End of seek
              this.seek[i] = this.seekAge[i] = 0;
              // --- Return head always 0 (11111011)
              this.senseIntRes[0] = this.sr0 & 0xfb;
              this.senseIntRes[1] = this.pcn[i];
              i = 4;
            }
          }
          if (
            this.seek[0] < 4 &&
            this.seek[1] < 4 &&
            this.seek[2] < 4 &&
            this.seek[3] < 4
          ) {
            // --- Delete INTRQ state
            this.intReq = IntRequest.None;
          }
          break;
        case Command.Recalibrate:
          // --- Previous seek in progress?
          if (this.msr & (1 << this.us)) {
            break;
          }
          // --- Save PCN
          this.rec[this.us] = this.pcn[this.us];
          this.pcn[this.us] = 77;
          // --- To Track 0
          this.dataRegister[1] = 0x00;
          // --- save new cylinder number
          this.ncn[this.us] = this.dataRegister[1];
          // --- Recalibrate started
          this.seek[this.us] = 2;
          this.seekStep(true);
          break;
        case Command.Seek:
          // --- Previous seek in progress?
          if (this.msr & (1 << this.us)) {
            break;
          }
          // --- Save new cylinder number
          this.ncn[this.us] = this.dataRegister[1];
          // --- Seek started
          this.seek[this.us] = 1;
          this.seekStep(true);
          break;
        case Command.ReadId:
          this.loadHead();
          return;
        case Command.ReadData:
          // --- Speedlock
          if (this.speedlock !== -1 && !d.doReadWeak) {
            let u =
              (this.dataRegister[2] & 0x01) +
              (this.dataRegister[1] << 1) +
              (this.dataRegister[3] << 8);
            if (this.dataRegister[3] === this.dataRegister[5] && u == 0x200) {
              if (u === this.lastSectorRead) {
                this.speedlock++;
              } else {
                this.speedlock = 0;
                this.lastSectorRead = u;
              }
            } else {
              this.lastSectorRead = this.speedlock = 0;
            }
          }
          // --- End of speedlock hack

          this.rlen =
            0x80 <<
            (this.dataRegister[4] > MAX_SIZE_CODE
              ? MAX_SIZE_CODE
              : this.dataRegister[4]);
          if (this.dataRegister[4] === 0 && this.dataRegister[7] < 128) {
            this.rlen = this.dataRegister[7];
          }
          // --- Always read at least one sector
          this.firstRw = true;
          this.loadHead();
          return;

        case Command.WriteData:
          if (d.isWriteProtected) {
            this.sr1 |= SR1_NW;
            this.sr0 |= SR0_AT;
            terminated = 1;
            break;
          }
          this.rlen =
            0x80 <<
            (this.dataRegister[4] > MAX_SIZE_CODE
              ? MAX_SIZE_CODE
              : this.dataRegister[4]);
          if (this.dataRegister[4] === 0 && this.dataRegister[7] < 128) {
            this.rlen = this.dataRegister[7];
          }
          // --- Always write at least one sector */
          this.firstRw = true;
          this.loadHead();
          return;

        case Command.Scan:
          // --- & 0x0c >> 2 == 00 - equal, 10 - low, 11 - high
          this.scan =
            (this.commandRegister & 0x0c) >> 2 === 0
              ? ScanType.Eq
              : (this.commandRegister & 0x0c) >> 2 === 0x03
              ? ScanType.Hi
              : ScanType.Lo;

          this.rlen =
            0x80 <<
            (this.dataRegister[4] > MAX_SIZE_CODE
              ? MAX_SIZE_CODE
              : this.dataRegister[4]);
          this.loadHead();
          return;
      }

      if (this.cmd.id < Command.ReadId && !terminated) {
        // --- We have execution phase
        this.msr |= MSR_RQM;
        if (this.cmd.id < Command.WriteData) {
          this.msr |= MSR_DIO;
        }
      } else {
        this.cmdResult(); /* set up result phase */
      }
    } else {
      this.cycle++;
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
  private cmdIdentify (): void {
    // --- invalid by default
    let cmd = commandTable[commandTable.length - 1];
    const tableCmd = commandTable.find(
      c => (this.commandRegister & c.mask) === c.value
    );
    if (tableCmd) {
      cmd = tableCmd;
    }
    console.log("Identify", cmd);
    this.mt = !!((this.commandRegister >> 7) & 0x01);
    this.mf = !!((this.commandRegister >> 6) & 0x01);
    this.sk = !!((this.commandRegister >> 5) & 0x01);
    this.cmd = cmd;
  }

  // --- Preset the CRC value to its default
  private crcPreset () {
    this.crc = 0xffff;
  }

  // --- Add the drive's data byte to the CRC
  private crcAdd (): void {
    this.crc =
      ((this.crc << 8) ^
        crcFdcTable[(this.crc >> 8) ^ (this.currentDrive.data & 0xff)]) &
      0xffff;
  }

  // --- Prepares for returning result bytes
  private cmdResult (): void {
    this.cycle = this.cmd.reslength;
    this.msr &= ~MSR_EXM;
    this.msr |= MSR_RQM;
    if (this.cycle > 0) {
      // --- result state
      this.phase = OperationPhase.Result;
      this.intReq = IntRequest.Result;
      this.msr |= MSR_DIO;
      this.resultIndex = 0;
    } else {
      // --- No result state
      this.phase = OperationPhase.Command;
      this.msr &= ~MSR_DIO;
      this.msr &= ~MSR_CB;
    }
    this.removeEvent(this.timeoutEventHandler);
    if (this.headLoad && this.cmd.id <= Command.ReadId) {
      this.registerEvent(this.hut, this.headEventHandler, this);
    }
  }

  // --- Reads the next ID structure
  // --- Return: 0 = ID found, 1 = ID found with CRC error, 2 = not found
  private readNextId (): number {
    const fdc = this;
    const d = this.currentDrive;

    this.sr1 &= ~(SR1_DE | SR1_MA | SR1_ND);
    this.idMark = false;
    let i = this.revCounter;
    while (i === this.revCounter && d.ready) {
      readNextDataByte(false);
      this.crcPreset();
      if (this.mf) {
        // --- Double density (MFM)
        if (d.data === 0xffa1) {
          this.crcAdd();
          readNextDataByte();
          if (d.data != 0xffa1) continue;
          readNextDataByte();
          if (d.data !== 0xffa1) continue;
        } else {
          // --- No 0xa1 with missing clock...
          continue;
        }
      }
      d.readData();
      if (d.atIndexWhole) {
        this.revCounter--;
      }

      // --- Read the address end mark
      if ((this.mf && d.data !== 0x00fe) || !this.mf && d.data !== 0xfffe) {
        continue;
      }
      this.crcAdd();

      // --- Read track, head, and sector IDs
      readNextDataByte();
      this.idTrack = d.data;
      readNextDataByte();
      this.idHead = d.data;
      readNextDataByte();
      this.idSector = d.data;
      readNextDataByte();
      this.idLength = d.data > MAX_SIZE_CODE ? MAX_SIZE_CODE : d.data;
      this.sectorLength = 0x80 << this.idLength;

      // --- Read CRC bytes
      readNextDataByte();
      readNextDataByte();

      if (this.crc !== 0x0000) {
        this.sr1 |= SR1_DE | SR1_ND;
        this.idMark = true;
        // --- Found CRC error
        return 1;
      } else {
        this.idMark = true;
        // --- Found and OK
        return 0;
      }
    }
    if (!d.ready) {
      this.revCounter = 0;
    }

    // --- FIXME NO_DATA?
    this.sr1 |= SR1_MA | SR1_ND;
    // --- Not found
    return 2;

    // --- Helper for reading a byte (and calculating CRC)
    function readNextDataByte (addCrc = true): void {
      d.readData();
      if (addCrc) {
        fdc.crcAdd();
      }
      if (d.atIndexWhole) {
        fdc.revCounter--;
      }
    }
  }

  // --- Reads the DAM (Data Address Mark)
  // --- Return: false = found, true = not found
  private readDataAddressMark (): boolean {
    const d = this.currentDrive;
    let i = 0;

    if (this.mf) {
      // --- Double density (MFM)
      for (i = 40; i > 0; i--) {
        d.readData();
        // --- Read next?
        if (d.data === 0x4e) continue;
        // --- Go to PLL sync
        if (d.data == 0x00) break;

        this.sr2 |= SR2_MD;
        // --- Something wrong
        return true;
      }

      for (; i > 0; i--) {
        this.crcPreset();
        d.readData();
        this.crcAdd();
        if (d.data === 0x00) continue;
        // --- Got to 0xA1 mark
        if (d.data === 0xffa1) break;
        this.sr2 |= SR2_MD;
        return true;
      }

      for (i = d.data === 0xffa1 ? 2 : 3; i > 0; i--) {
        d.readData();
        this.crcAdd();
        if (d.data !== 0xffa1) {
          this.sr2 |= SR2_MD;
          return true;
        }
      }

      d.readData();
      this.crcAdd();
      if (d.data < 0x00f8 || d.data > 0x00fb) {
        // !fb deleted mark
        this.sr2 |= SR2_MD;
        return true;
      }

      // --- DAM found
      this.ddam = d.data !== 0x00fb;
      return false;
    } else {
      // --- SD -> FM
      for (i = 30; i > 0; i--) {
        d.readData();
        // --- Read next?
        if (d.data === 0xff) continue;
        // --- Go to PLL sync?
        if (d.data === 0x00) break;
        this.sr2 |= SR2_MD;
        // --- Something wrond
        return true;
      }

      for (; i > 0; i--) {
        this.crcPreset();
        d.readData();
        this.crcAdd();
        if (d.data === 0x00) continue;
        // --- !fb deleted mark
        if (d.data >= 0xfff8 && d.data <= 0xfffb) break;

        this.sr2 |= SR2_MD;
        return true;
      }

      if (i === 0) {
        d.readData();
        this.crcAdd();
        if (d.data < 0xfff8 || d.data > 0xfffb) {
          // --- !fb deleted mark
          this.sr2 |= SR2_MD;
          return true;
        }
      }

      // --- Found
      this.ddam = d.data !== 0x00fb;
      return false;
    }
  }

  // --- Seek to a specified id
  // --- Return: 0 = found, 1 = id with CRC error, 2 = not found any id, 3 = not found the specified id
  private seekId (): number {
    let r = 0;

    this.sr2 &= ~(SR2_WC | SR2_BC);
    r = this.readNextId();
    // --- Not found any good ID
    if (r !== 0) return r;

    if (this.idTrack != this.dataRegister[1]) {
      this.sr2 |= SR2_WC;
      if (this.idTrack === 0xff) this.sr2 |= SR2_BC;
      return 3;
    }

    if (
      this.idSector === this.dataRegister[3] &&
      this.idHead === this.dataRegister[2]
    ) {
      if (this.idLength !== this.dataRegister[4]) {
        this.sr1 |= SR1_ND;
        return 3;
      }

      return 0;
    }
    this.sr1 |= SR1_ND;
    return 3;
  }

  // --- Makes a seek step
  private seekStep (isStart: boolean): void {
    let i = 0;
    if (isStart) {
      i = this.us;

      // --- Drive already in seek state?
      if (this.msr & (1 << i)) {
        return;
      }

      // --- Mark seek mode for fdd. It will be cleared by Sense Interrupt command
      this.msr |= 1 << i;
    } else {
      // --- Get drive in seek state that has completed the positioning
      i = 0;
      for (let j = 1; j < 4; j++) {
        if (this.seekAge[j] > this.seekAge[i]) i = j;
      }

      if (this.seek[i] === 0 || this.seek[i] >= 4) {
        return;
      }
    }

    // --- Select the drive used in the seek operation
    const d = i % 1 ? this.driveB : this.driveA;

    // --- There is need to seek?
    if (this.pcn[i] === this.ncn[i] && this.seek[i] === 2 && !d.tr00) {
      // --- Recalibrate fail, abnormal termination
      this.seek[i] = 5;
      this.seekAge[i] = 0;
      this.intReq = IntRequest.Seek;
      this.sr0 |= SR0_EC;
      this.msr &= ~(1 << i);
      return;
    }

    // --- There is need to seek?
    if (this.pcn[i] === this.ncn[i] || (this.seek[i] === 2 && d.tr00)) {
      // --- Correct position
      if (this.seek[i] === 2) {
        // --- Recalibrate, normal termination
        this.pcn[i] = 0;
      }
      this.seek[i] = 4;
      this.seekAge[i] = 0;
      this.intReq = IntRequest.Seek;
      this.msr &= ~(1 << i);
      return;
    }

    // --- Drive not ready
    if (!d.ready) {
      if (this.seek[i] === 2) {
        // --- recalibrate
        this.pcn[i] = this.rec[i] - (77 - this.pcn[i]);
      }

      // --- restore PCN, drive not ready termination
      this.seek[i] = 6;
      this.seekAge[i] = 0;
      this.intReq = IntRequest.Ready;
      // --- doesn't matter
      this.msr &= ~(1 << i);
      return;
    }

    // --- Send step
    if (this.pcn[i] !== this.ncn[i]) {
      // --- FIXME if d->tr00 == 1 ???
      d.step(this.pcn[i] > this.ncn[i]);
      this.pcn[i] += this.pcn[i] > this.ncn[i] ? -1 : 1;

      // --- Update age for active seek operations
      for (let j = 0; j < 4; j++) {
        if (this.seekAge[j] > 0) {
          this.seekAge[j]++;
        }
      }
      this.seekAge[i] = 1;

      // --- Wait step completion
      this.registerEvent(this.stepRate, this.fdcEventHandler, this);
    }

    return;
  }

  // --- Starts reading the ID
  private startReadId (): void {
    let i = 0;
    if (!this.readId) {
      this.revCounter = 2;
      this.readId = true;
    }
    const indexPos = this.currentDrive.disk?.indexPos ?? 0;
    const bytesPerTrack = this.currentDrive.disk?.bytesPerTrack ?? 0;
    if (this.revCounter) {
      // --- Start position
      i = indexPos >= bytesPerTrack ? 0 : indexPos;
      if (this.readNextId() !== 2) {
        this.revCounter = 0;
      }
      i = bytesPerTrack ? ((indexPos - i) * 200) / bytesPerTrack : 200;
      if (i > 0) {
        // --- i * 1/20 revolution
        this.registerEvent(i, this.fdcEventHandler, this);
        return;
      }
    }
    this.readId = false;
    if (this.idMark) {
      // --- ID mark found
      this.dataRegister[1] = this.idTrack;
      this.dataRegister[2] = this.idHead;
      this.dataRegister[3] = this.idSector;
      this.dataRegister[4] = this.idLength;
    }
    if (!this.idMark || this.sr1 & SR1_DE) {
      // --- Not found/crc error id mark */
      this.sr0 |= SR0_AT;
    }
    this.intReq = IntRequest.Result;
    this.cmdResult();
  }

  // --- Starts reading data
  private startReadData (): void {
    let i = 0;
    const fdc = this;

    while (true) {
      if (
        this.firstRw ||
        this.readId ||
        this.dataRegister[5] > this.dataRegister[3]
      ) {
        if (!this.readId) {
          if (!this.firstRw) {
            this.dataRegister[3]++;
          }
          this.firstRw = false;

          this.revCounter = 2;
          this.readId = true;
        }
        while (this.revCounter) {
          // --- Start position
          i =
            this.currentDrive.disk.indexPos >=
            this.currentDrive.disk.bytesPerTrack
              ? 0
              : this.currentDrive.disk.indexPos;
          if (this.seekId() === 0) {
            this.revCounter = 0;
          } else {
            this.idMark = false;
          }
          i = this.currentDrive.disk.bytesPerTrack
            ? ((this.currentDrive.disk.indexPos - i) * 200) /
              this.currentDrive.disk.bytesPerTrack
            : 200;
          if (i > 0) {
            this.registerEvent(i, this.fdcEventHandler, this);
            return;
          }
        }

        this.readId = false;
        if (!this.idMark) {
          // --- Not found/crc error
          this.sr0 |= SR0_AT;
          abortReadData();
          return;
        }

        if (this.readDataAddressMark()) {
          // --- not found
          this.sr0 |= SR0_AT;
          abortReadData();
          return;
        }

        if (this.ddam !== this.delData) {
          this.sr2 |= SR2_CM;
          if (this.sk) {
            this.dataRegister[3]++;
            // --- Not deleted but we want to read deleted
            continue; // Goto skip_deleted_sector;
          }
        }
      } else {
        if (this.mt) {
          // --- Next track
          this.dataRegister[1]++;
          // --- First sector
          this.dataRegister[3] = 1;
          continue; // Goto multi_track_next;
        }

        // LABEL: abort_read_data:
        abortReadData();
        return;
      }

      this.msr |= MSR_RQM;
      if (this.cmd.id !== Command.Scan) this.msr |= MSR_DIO;
      this.dataOffset = 0;
      this.removeEvent(this.timeoutEventHandler);
      // --- 2 revolutions
      this.registerEvent(400, this.timeoutEventHandler, this);
      return;
    }

    function abortReadData (): void {
      // --- End of execution phase
      fdc.phase = OperationPhase.Result;
      fdc.cycle = fdc.cmd.reslength;

      // --- End of cylinder is set if:
      // --- 1: sector data is read completely (i.e. no other errors occur like no data.)
      // --- 2: sector being read is same specified by EOT
      // --- 3: terminal count is not received
      // --- Note: in +3 uPD765 never got TC
      if (!fdc.sr0 && !fdc.sr1) {
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
      fdc.cmdResult();
    }
  }

  // --- Starts writing data
  private startWriteData (): void {
    let i = 0;
    const d = this.currentDrive;
    const fdc = this;

    while (true) {
      if (
        this.firstRw ||
        this.readId ||
        this.dataRegister[5] > this.dataRegister[3]
      ) {
        if (!this.readId) {
          if (!this.firstRw) {
            this.dataRegister[3]++;
          }
          this.firstRw = false;

          this.revCounter = 2;
          this.readId = true;
        }
        while (this.revCounter) {
          // --- Start position
          i =
            this.currentDrive.disk.indexPos >=
            this.currentDrive.disk.bytesPerTrack
              ? 0
              : this.currentDrive.disk.indexPos;
          if (this.seekId() === 0) {
            this.revCounter = 0;
          } else {
            this.idMark = false;
          }
          i = this.currentDrive.disk.bytesPerTrack
            ? ((this.currentDrive.disk.indexPos - i) * 200) /
              this.currentDrive.disk.bytesPerTrack
            : 200;
          if (i > 0) {
            this.registerEvent(i, this.fdcEventHandler, this);
            return;
          }
        }

        this.readId = false;
        if (!this.idMark) {
          // --- not found/crc error
          this.sr0 |= SR0_AT;
          abortWriteData();
          return;
        }

        // --- "delay" 11 GAP bytes
        for (i = 11; i > 0; i--) {
          d.readData();
        }
        if (this.mf) {
          // --- MFM, "delay" another 11 GAP byte
          for (i = 11; i > 0; i--) {
            d.readData();
          }
        }

        d.data = 0x00;
        // -- Write 6/12 zero
        for (i = this.mf ? 12 : 6; i > 0; i--) {
          d.writeData();
        }
        this.crcPreset();
        if (this.mf) {
          // --- MFM
          d.data = 0xffa1;
          // --- Write 3 0xa1 with clock mark */
          for (i = 3; i > 0; i--) {
            d.writeData();
            this.crcAdd();
          }
        }
        d.data = (this.delData ? 0x00f8 : 0x00fb) | (this.mf ? 0x0000 : 0xff00);
        // --- Write data mark */
        d.writeData();
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
    }

    function abortWriteData (): void {
      // LABEL: abort_write_data:
      fdc.phase = OperationPhase.Result;
      fdc.cycle = this.cmd.reslength;
      // --- End of cylinder is set if:
      // --- 1: sector data is read completely (i.e. no other errors occur like no data).
      // --- 2: sector being read is same specified by EOT
      // --- 3: terminal count is not received
      // --- Note: in +3 uPD765 never got TC
      fdc.sr0 |= SR0_AT;
      fdc.sr1 |= SR1_EN;
      fdc.msr &= ~MSR_RQM;
      fdc.intReq = IntRequest.Result;
      fdc.cmdResult();
    }
  }

  // --- Loads the head
  private loadHead (): void {
    this.removeEvent(this.headEventHandler);
    if (this.headLoad) {
      // --- Head already loaded
      if (this.cmd.id === Command.ReadData || this.cmd.id === Command.Scan) {
        this.startReadData();
      } else if (this.cmd.id === Command.ReadId) {
        this.startReadId();
      } else if (this.cmd.id == Command.WriteData) {
        this.startWriteData();
      }
    } else {
      this.currentDrive.loadHead(true);
      this.headLoad = true;
      this.registerEvent(this.hld, this.fdcEventHandler, this);
    }
  }

  // --- Handles the timeout event
  private timeoutEventHandler (data: any): void {
    const fdc = data as FloppyControllerDevice;
    fdc.sr0 |= SR0_AT;
    fdc.sr1 |= SR1_OR;
    fdc.cmdResult();
  }

  // --- Handles the head event
  private headEventHandler (data: any): void {
    const fdc = data as FloppyControllerDevice;
    fdc.currentDrive.loadHead(false);
    fdc.headLoad = false;
  }

  private fdcEventHandler (data: any): void {
    const fdc = data as FloppyControllerDevice;

    if (fdc.readId) {
      if (fdc.cmd.id === Command.ReadData) {
        fdc.startReadData();
      } else if (fdc.cmd.id === Command.ReadId) {
        fdc.startReadId();
      } else if (fdc.cmd.id === Command.WriteData) {
        fdc.startWriteData();
      }
    } else if (fdc.msr & 0x03) {
      /* seek/recalibrate active */
      fdc.seekStep(false);
    } else if (fdc.cmd.id === Command.ReadData || fdc.cmd.id === Command.Scan) {
      fdc.startReadData();
    } else if (fdc.cmd.id === Command.ReadId) {
      fdc.startReadId();
    } else if (fdc.cmd.id === Command.WriteData) {
      fdc.startWriteData();
    }
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

// --- US 0: Indicates the status of the Unit Select 0 signal
const SR3_US0 = 0x01;

// --- Two Side
// --- This bit is used to indicate the status of the two side signal from the FDD.
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
enum Command {
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
  // --- Display name
  name: string;
  // --- Mask to use
  mask: number;
  // --- Value to test with mask
  value: number;
  // --- Command paremeter length
  cmdLength: number;
  // --- Result length
  reslength: number;
  // --- Parameter names
  pars: string[];
  // --- Result names
  reslbls: string[]; 
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

const readDataPars = ["HD/US", "C", "H", "N", "R", "EOT", "GPL", "DTL"];
const readDataResults = ["ST0", "ST1", "ST2", "C", "H", "R", "N"];

// --- Description of available commmands
const commandTable: CommandDescriptor[] = [
  {
    id: Command.ReadData,
    name: "Read Data",
    mask: 0x1f,
    value: 0x06,
    cmdLength: 0x08,
    reslength: 0x07,
    pars: readDataPars,
    reslbls: readDataResults
  },
  // --- Deleted data
  {
    id: Command.ReadData,
    name: "Read Deleted Data",
    mask: 0x1f,
    value: 0x0c,
    cmdLength: 0x08,
    reslength: 0x07,
    pars: readDataPars,
    reslbls: readDataResults
  },
  {
    id: Command.Recalibrate,
    name: "Recalibrate",
    mask: 0xff,
    value: 0x07,
    cmdLength: 0x01,
    reslength: 0x00,
    pars: ["US"],
    reslbls: []
  },
  {
    id: Command.Seek,
    name: "Seek",
    mask: 0xff,
    value: 0x0f,
    cmdLength: 0x02,
    reslength: 0x00,
    pars: ["HD/US", "NCN"],
    reslbls: []
  },
  {
    id: Command.WriteData,
    name: "Write Data",
    mask: 0x3f,
    value: 0x05,
    cmdLength: 0x08,
    reslength: 0x07,
    pars: readDataPars,
    reslbls: readDataResults
  },
  // --- Deleted data
  {
    id: Command.WriteData,
    name: "Write Deleted Data",
    mask: 0x3f,
    value: 0x09,
    cmdLength: 0x08,
    reslength: 0x07,
    pars: readDataPars,
    reslbls: readDataResults
  },
  // --- Equal
  {
    id: Command.Scan,
    name: "Scan Equal",
    mask: 0x1f,
    value: 0x11,
    cmdLength: 0x08,
    reslength: 0x07,
    pars: readDataPars,
    reslbls: readDataResults
  },
  // --- Low or Equal
  {
    id: Command.Scan,
    name: "Scan Low or Equal",
    mask: 0x1f,
    value: 0x19,
    cmdLength: 0x08,
    reslength: 0x07,
    pars: readDataPars,
    reslbls: readDataResults
  },
  // --- High or Equal
  {
    id: Command.Scan,
    name: "Scan High or Equal",
    mask: 0x1f,
    value: 0x1d,
    cmdLength: 0x08,
    reslength: 0x07,
    pars: readDataPars,
    reslbls: readDataResults
  },
  {
    id: Command.ReadId,
    name: "Read Id",
    mask: 0xbf,
    value: 0x0a,
    cmdLength: 0x01,
    reslength: 0x07,
    pars: ["HD/US"],
    reslbls: readDataResults
  },
  {
    id: Command.SenseInt,
    name: "Sense Interrupt",
    mask: 0xff,
    value: 0x08,
    cmdLength: 0x00,
    reslength: 0x02,
    pars: [],
    reslbls: ["ST0", "PCN"]
  },
  {
    id: Command.Specify,
    name: "Specify",
    mask: 0xff,
    value: 0x03,
    cmdLength: 0x02,
    reslength: 0x00,
    pars: ["SRT/HUT", "HLT/ND"],
    reslbls: []
  },
  {
    id: Command.SenseDrive,
    name: "Sense Drive",
    mask: 0xff,
    value: 0x04,
    cmdLength: 0x01,
    reslength: 0x01,
    pars: ["HD/US"],
    reslbls: ["ST3"]
  },
  {
    id: Command.Invalid,
    name: "Invalid",
    mask: 0x00,
    value: 0x00,
    cmdLength: 0x00,
    reslength: 0x01,
    pars: [],
    reslbls: ["ST0"]
  }
];
