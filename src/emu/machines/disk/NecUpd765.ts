import {
  CommandCode,
  CommandConfiguration,
  CommandData,
  CommandFlags,
  CommandFlow,
  CommandOperation,
  CommandParameter,
  CommandResultParameter,
  ControllerCommandPhase,
  MainStatusRegister,
  StatusRegister0,
  StatusRegister1,
  StatusRegister2,
  StatusRegister3
} from "./NecUpd765-defs";
import { FloppyDiskDriveCluster } from "./FloppyDiskDriveCluster";
import { FloppyDiskDriveDevice } from "./floppy-disk-drive";
import { Sector } from "./FloppyDisk";

const MAX_PARAMETER_BYTES = 9;

// --- This class implements the behavior of the NEC UPD 765 chip (floppy disk controller)
export class NecUpd765 {
  private _msr: MainStatusRegister;
  private _sr0: StatusRegister0;
  private _sr1: StatusRegister1;
  private _sr2: StatusRegister2;
  private _sr3: StatusRegister3;
  private readonly _commands: CommandConfiguration[] = [];
  private _activeCommandConfiguration: CommandConfiguration;
  private _cmdIndex = 0;
  private readonly _commandParameters = new Uint8Array[MAX_PARAMETER_BYTES]();
  private _commandParameterIndex = 0;
  private _commandFlags: CommandFlags;
  private _executionLength = 0;
  private _executionBufferCounter = 0;
  private _lastByteReceived = 0;
  private _lastSectorDataReadByte = 0;
  private _overrunCounter = 0;

  private _activePhase = ControllerCommandPhase.Command;
  private readonly _activeCommandData: CommandData = {
    unitSelect: 0,
    side: 0,
    cylinder: 0,
    head: 0,
    sector: 0,
    sectorSize: 0,
    eot: 0,
    gap3Length: 0,
    dtl: 0
  };
  private readonly _executionBuffer = new Uint8Array[0x8000]();
  private readonly _resultBuffer = new Uint8Array(7);
  private _resultBufferCounter = 0;

  constructor (private readonly floppyDiskDriveCluster: FloppyDiskDriveCluster) {
    this._commands.push(...this.createCommands());
    this.reset();
  }

  // --- Resets the FDC
  private reset (): void {
    this._msr = 0 as MainStatusRegister.None;
    this.clearStatusRegisters();

    // --- The controller is idle
    this._activePhase = ControllerCommandPhase.Idle;
    this._commandParameterIndex = 0;
    this._resultBufferCounter = 0;

    // --- Reset the active command
    this._activeCommandConfiguration = this._commands[this._cmdIndex];
  }

  /**
   * Gets the value of the data register (8-bit)
   */
  readDataRegister (): number {
    throw new Error("Not implemented yet");
  }

  /**
   * Gets the value of the Main Status Register
   */
  readMainStatusRegister (): number {
    throw new Error("Not implemented yet");
  }

  /**
   * Writes the value of the data register (8-bit)
   */
  writeDataRegister (value: number): void {
    throw new Error("Not implemented yet");
  }

  /**
   * Gets the value of the Main Status Register
   */
  writeMainStatusRegister (value: number): void {
    throw new Error("Not implemented yet");
  }

  // --- Signs whether the motor is on/off
  isMotorOn: boolean;

  // --- Signs whether the drive is active
  driveLightIsOn: boolean;

  // --- Initialize the command handlers
  private createCommands (): CommandConfiguration[] {
    const emptyCommandFlags: CommandFlags = { mf: false, mt: false, sk: false };
    return [
      {
        commandHandler: this.invalidCommandHandler,
        commandCode: CommandCode.Invalid,
        commandFlow: CommandFlow.Out,
        parameterBytesCount: 0,
        resultBytesCount: 1,
        commandOperation: CommandOperation.Read,
        commandFlags: emptyCommandFlags
      },
      {
        commandHandler: this.readDataCommandHandler,
        commandCode: CommandCode.ReadData,
        commandFlags: { mt: true, mf: true, sk: true },
        commandOperation: CommandOperation.Read,
        commandFlow: CommandFlow.Out,
        parameterBytesCount: 8,
        resultBytesCount: 7
      },
      {
        commandHandler: this.readDeletedDataCommandHandler,
        commandCode: CommandCode.ReadDeletedData,
        commandFlags: { mt: true, mf: true, sk: true },
        commandOperation: CommandOperation.Read,
        commandFlow: CommandFlow.Out,
        parameterBytesCount: 8,
        resultBytesCount: 7
      },
      {
        commandHandler: this.readDiagnosticCommandHandler,
        commandCode: CommandCode.ReadDiagnostic,
        commandFlags: { mt: false, mf: true, sk: true },
        commandOperation: CommandOperation.Read,
        commandFlow: CommandFlow.Out,
        parameterBytesCount: 8,
        resultBytesCount: 7
      }
    ];
  }

  // --- Query the active drive
  private get activeDrive (): FloppyDiskDriveDevice {
    return this.floppyDiskDriveCluster.activeDrive;
  }

  // --- Parse the specified command parameter byte
  private parseParameterByte (index: CommandParameter): void {
    const currByte = this._commandParameters[index];

    switch (index) {
      // HD & US
      case CommandParameter.HEAD:
        this._activeCommandData.side = currByte & 0x02;
        this._activeCommandData.unitSelect = currByte & 0x03;
        this.floppyDiskDriveCluster.floppyDiskDriveSlot =
          this._activeCommandData.unitSelect;
        break;

      // C
      case CommandParameter.C:
        this._activeCommandData.cylinder = currByte;
        break;

      // H
      case CommandParameter.H:
        this._activeCommandData.head = currByte;
        break;

      // R
      case CommandParameter.R:
        this._activeCommandData.sector = currByte;
        break;

      // N
      case CommandParameter.N:
        this._activeCommandData.sectorSize = currByte;
        break;

      // EOT
      case CommandParameter.EOT:
        this._activeCommandData.eot = currByte;
        break;

      // GPL
      case CommandParameter.GPL:
        this._activeCommandData.gap3Length = currByte;
        break;

      // DTL
      case CommandParameter.DTL:
        this._activeCommandData.dtl = currByte;
        break;

      default:
        break;
    }
  }

  // --- Push the last byte received into the current command
  private pushCommandByteInBuffer (): void {
    this._commandParameters[this._commandParameterIndex] =
      this._lastByteReceived;
    this.parseParameterByte(this._commandParameterIndex);
    this._commandParameterIndex++;
  }

  // --- Clear the result buffer
  private clearExecBuffer (): void {
    for (let i = 0; i < this._executionBuffer.length; i++) {
      this._executionBuffer[i] = 0;
    }
  }

  // --- Reset status registers
  private clearStatusRegisters (): void {
    this._sr0 = StatusRegister0.None;
    this._sr1 = StatusRegister1.None;
    this._sr2 = StatusRegister2.None;
    this._sr3 = StatusRegister3.None;
  }

  // --- Populates the result status registers
  private commitResultStatus (): void {
    // --- Check for read diagnostic
    if (
      this._activeCommandConfiguration.commandCode == CommandCode.ReadDiagnostic
    ) {
      // --- Commit to result buffer
      this._resultBuffer[CommandResultParameter.ST0] = this._sr0;
      this._resultBuffer[CommandResultParameter.ST1] = this._sr1;
      return;
    }

    // --- Check for error bits
    if (
      this.sr1Has(StatusRegister1.DE) ||
      this.sr1Has(StatusRegister1.MA) ||
      this.sr1Has(StatusRegister1.ND) ||
      this.sr1Has(StatusRegister1.NW) ||
      this.sr1Has(StatusRegister1.OR) ||
      this.sr1Has(StatusRegister2.BC) ||
      this.sr1Has(StatusRegister2.CM) ||
      this.sr1Has(StatusRegister2.DD) ||
      this.sr1Has(StatusRegister2.MD) ||
      this.sr1Has(StatusRegister2.SN) ||
      this.sr1Has(StatusRegister2.WC)
    ) {
      // --- Error bits set - unset end of track
      this.sr1Clear(StatusRegister1.EN);
    }

    // --- Check for data errors
    if (this.sr1Has(StatusRegister1.DE) || this.sr1Has(StatusRegister2.DD)) {
      // --- Clear control mark
      this.sr2Clear(StatusRegister2.CM);
    } else if (this.sr2Has(StatusRegister2.CM)) {
      // --- DAM found - clear IC and US0
      this.sr0Clear(StatusRegister0.IC_D6 | StatusRegister0.US0);
    }

    // --- Commit to result buffer
    this._resultBuffer[CommandResultParameter.ST0] = this._sr0;
    this._resultBuffer[CommandResultParameter.ST1] = this._sr1;
    this._resultBuffer[CommandResultParameter.ST2] = this._sr2;
  }

  // --- Populates the result's CHRN values
  private commitResultCHRN (): void {
    this._resultBuffer[CommandResultParameter.C] =
      this._activeCommandData.cylinder;
    this._resultBuffer[CommandResultParameter.H] = this._activeCommandData.head;
    this._resultBuffer[CommandResultParameter.R] =
      this._activeCommandData.sector;
    this._resultBuffer[CommandResultParameter.N] =
      this._activeCommandData.sectorSize;
  }

  // --- Invalid
  // COMMAND:    NO parameter bytes
  // EXECUTION:  NO execution phase
  // RESULT:     1 result byte
  private invalidCommandHandler (): void {
    switch (this._activePhase) {
      case ControllerCommandPhase.Idle:
        break;

      case ControllerCommandPhase.Command:
        break;

      case ControllerCommandPhase.Execution:
        // --- No execution phase
        this._activePhase = ControllerCommandPhase.Result;
        this.invalidCommandHandler();
        break;

      case ControllerCommandPhase.Result:
        // --- ST0 = 0x80
        this._resultBuffer[0] = 0x80;
        break;
    }
  }

  /// --- Read Data
  /// COMMAND:    8 parameter bytes
  /// EXECUTION:  Data transfer between FDD and FDC
  /// RESULT:     7 result bytes
  private readDataCommandHandler () {
    if (this.activeDrive == null) {
      return;
    }

    switch (this._activePhase) {
      case ControllerCommandPhase.Idle:
        break;

      case ControllerCommandPhase.Command:
        this.pushCommandByteInBuffer();

        // --- All parameter bytes received - setup for execution phase
        if (
          this._commandParameterIndex ==
          this._activeCommandConfiguration.parameterBytesCount
        ) {
          // --- Clear exec buffer and status registers
          this.clearExecBuffer();
          this.clearStatusRegisters();

          // --- Temporary sector index
          const secIdx = this._activeCommandData.sector;

          // --- Do we have a valid disk inserted?
          if (!this.activeDrive.isReady) {
            // --- No disk, no tracks, or motor is not on
            this.sr0Set(StatusRegister0.IC_D6 | StatusRegister0.NR);

            this.commitResultCHRN();
            this.commitResultStatus();

            // move to result phase
            this._activePhase = ControllerCommandPhase.Result;
            break;
          }

          let buffPos = 0;
          let sectorSize = 0;

          // calculate requested size of data required
          if (this._activeCommandData.sectorSize == 0) {
            // When N=0, then DTL defines the data length which the FDC must treat as a sector. If DTL is smaller than the actual
            // data length in a sector, the data beyond DTL in the sector is not sent to the Data Bus. The FDC reads (internally)
            // the complete sector performing the CRC check and, depending upon the manner of command termination, may perform
            // a Multi-Sector Read Operation.
            sectorSize = this._activeCommandData.dtl;
          } else {
            // When N is non - zero, then DTL has no meaning and should be set to ffh
            this._activeCommandData.dtl = 0xff;
            sectorSize = 0x80 << this._activeCommandData.sectorSize;
          }

          // get the current track
          var track = this.activeDrive.disk?.tracks?.find(
            a => a.trackNo === this.activeDrive.currentTrackId
          );

          if (track == null || track.numSectors <= 0) {
            // track could not be found
            this.sr0Set(StatusRegister0.IC_D6 | StatusRegister0.NR);

            this.commitResultCHRN();
            this.commitResultStatus();

            // move to result phase
            this._activePhase = ControllerCommandPhase.Result;
            break;
          }

          let sector: Sector;

          // sector read loop
          for (;;) {
            let terminate = false;

            // lookup the sector
            sector = this.getSector();

            if (sector == null) {
              // --- Sector was not found after two passes of the disk index hole
              this.setAbnormalTerminationCommand();
              this.sr1Set(StatusRegister1.ND);

              // result requires the actual track id, rather than the sector track id
              this._activeCommandData.cylinder = track.trackNo;

              this.commitResultCHRN();
              this.commitResultStatus();
              this._activePhase = ControllerCommandPhase.Result;
              break;
            }

            // --- Sector ID was found on this track

            // --- Get status regs from sector
            this._sr1 = sector.fdcStatus1;
            this._sr2 = sector.fdcStatus2;

            // -- We don't need EN
            this.sr1Clear(StatusRegister1.EN);

            // --- If SK=1, the FDC skips the sector with the Deleted Data Address Mark and reads the next sector.
            // --- The CRC bits in the deleted data field are not checked when SK=1
            if (this._commandFlags.sk && this.sr2Has(StatusRegister2.CM)) {
              if (
                this._activeCommandData.sector !== this._activeCommandData.eot
              ) {
                // --- Increment the sector ID and search again
                this._activeCommandData.sector++;
                continue;
              } else {
                // --- Eo execution phase
                this.setAbnormalTerminationCommand();

                // --- Result requires the actual track id, rather than the sector track id
                this._activeCommandData.cylinder = track.trackNo;

                this.commitResultCHRN();
                this.commitResultStatus();
                this._activePhase = ControllerCommandPhase.Result;
                break;
              }
            }

            // --- Read the sector
            for (let i = 0; i < sector.dataLen; i++) {
              this._executionBuffer[buffPos++] = sector.actualData[i];
            }

            // --- Mark the sector read
            sector.sectorReadCompleted();

            // --- Any CRC errors?
            if (
              this.sr1Has(StatusRegister1.DE) ||
              this.sr2Has(StatusRegister2.DD)
            ) {
              this.setAbnormalTerminationCommand();
              terminate = true;
            }

            if (!this._commandFlags.sk && this.sr2Has(StatusRegister2.CM)) {
              // --- Deleted address mark was detected with NO skip flag set
              this._activeCommandData.eot = this._activeCommandData.sector;
              this.sr2Set(StatusRegister2.CM);
              this.setAbnormalTerminationCommand();
              terminate = true;
            }

            if (sector.sectorId == this._activeCommandData.eot || terminate) {
              // --- This was the last sector to read or termination requested
              this.sr1Set(StatusRegister1.EN);

              let keyIndex = 0;
              for (let i = 0; i < track.sectors.length; i++) {
                if (track.sectors[i].sectorId == sector.sectorId) {
                  keyIndex = i;
                  break;
                }
              }

              if (keyIndex === track.sectors.length - 1) {
                // --- Last sector on the cylinder, set EN
                this.sr1Set(StatusRegister1.EN);

                // --- Increment cylinder
                this._activeCommandData.cylinder++;

                // --- Reset sector
                this._activeCommandData.sector = sector.sectorId; // 1;
                this.activeDrive.sectorIndex = 0;
              } else {
                this.activeDrive.sectorIndex++;
              }

              this.setAbnormalTerminationCommand();

              // result requires the actual track id, rather than the sector track id
              this._activeCommandData.cylinder = track.trackNo;

              this.commitResultCHRN();
              this.commitResultStatus();
              this._activePhase = ControllerCommandPhase.Execution;
              break;
            } else {
              // --- Continue with multi-sector read operation
              this._activeCommandData.sector++;
            }
          }

          if (this._activePhase == ControllerCommandPhase.Execution) {
            this._executionLength = buffPos;
            this._executionBufferCounter = buffPos;
            this.driveLightIsOn = true;
          }
        }

        break;

      case ControllerCommandPhase.Execution:
        const index = this._executionLength - this._executionBufferCounter;
        this._lastSectorDataReadByte = this._executionBuffer[index];

        this._overrunCounter--;
        this._executionBufferCounter--;
        break;

      case ControllerCommandPhase.Result:
        break;
    }
  }

  /// --- Read Deleted Data
  /// COMMAND:    8 parameter bytes
  /// EXECUTION:  Data transfer between the FDD and FDC
  /// RESULT:     7 result bytes
  private readDeletedDataCommandHandler (): void {
    if (!this.activeDrive) {
      return;
    }

    switch (this._activePhase) {
      case ControllerCommandPhase.Idle:
        break;

      case ControllerCommandPhase.Command:
        this.pushCommandByteInBuffer();

        // --- Was that the last parameter byte?
        if (
          this._commandParameterIndex ===
          this._activeCommandConfiguration.parameterBytesCount
        ) {
          // --- All parameter bytes received - setup for execution phase

          // --- Clear exec buffer and status registers
          this.clearExecBuffer();
          this.clearStatusRegisters();

          // --- Do we have a valid disk inserted?
          if (!this.activeDrive.isReady) {
            // --- No disk, no tracks, or motor is not on
            this.sr0Set(StatusRegister0.IC_D6 | StatusRegister0.NR);

            this.commitResultCHRN();
            this.commitResultStatus();

            // move to result phase
            this._activePhase = ControllerCommandPhase.Result;
            break;
          }

          let buffPos = 0;
          let sectorSize = 0;

          // --- Calculate requested size of data required
          if (this._activeCommandData.sectorSize === 0) {
            // --- When N=0, then DTL defines the data length which the FDC must treat as a sector. If DTL is smaller than the actual
            // --- data length in a sector, the data beyond DTL in the sector is not sent to the Data Bus. The FDC reads (internally)
            // --- the complete sector performing the CRC check and, depending upon the manner of command termination, may perform
            // --- a Multi-Sector Read Operation.
            sectorSize = this._activeCommandData.dtl;
          } else {
            // --- When N is non - zero, then DTL has no meaning and should be set to ffh
            this._activeCommandData.dtl = 0xff;
            sectorSize = 0x80 << this._activeCommandData.sectorSize;
          }

          // --- Get the current track
          const track = this.activeDrive.disk.tracks.find(
            a => a.trackNo === this.activeDrive.currentTrackId
          );

          if (!track || track.numSectors <= 0) {
            // --- Track could not be found
            this.sr0Set(StatusRegister0.IC_D6 | StatusRegister0.NR);

            this.commitResultCHRN();
            this.commitResultStatus();

            // --- Move to result phase
            this._activePhase = ControllerCommandPhase.Result;
            break;
          }

          let sector: Sector;

          // --- Sector read loop
          for (;;) {
            // --- Lookup the sector
            sector = this.getSector();

            if (!sector) {
              // --- Sector was not found after two passes of the disk index hole
              this.setAbnormalTerminationCommand();
              this.sr1Set(StatusRegister1.ND);

              // --- Result requires the actual track id, rather than the sector track id
              this._activeCommandData.cylinder = track.trackNo;

              this.commitResultCHRN();
              this.commitResultStatus();
              this._activePhase = ControllerCommandPhase.Result;
              break;
            }

            // --- Sector ID was found on this track
            // --- Get status regs from sector
            this._sr1 = sector.fdcStatus1;
            this._sr2 = sector.fdcStatus2;

            // --- We don't need EN
            this.sr1Clear(StatusRegister1.EN);

            // --- Invert CM for read deleted data command
            if (this.sr2Has(StatusRegister2.CM)) {
              this.sr2Clear(StatusRegister2.CM);
            } else {
              this.sr2Set(StatusRegister2.CM);
            }

            // --- Skip flag is set and no DAM found
            if (this._commandFlags.sk && this.sr2Has(StatusRegister2.CM)) {
              if (
                this._activeCommandData.sector !== this._activeCommandData.eot
              ) {
                // --- Increment the sector ID and search again
                this._activeCommandData.sector++;
                continue;
              } else {
                // --- No execution phase
                this.setAbnormalTerminationCommand();

                // result requires the actual track id, rather than the sector track id
                this._activeCommandData.cylinder = track.trackNo;

                this.commitResultCHRN();
                this.commitResultStatus();
                this._activePhase = ControllerCommandPhase.Result;
                break;
              }
            }

            // --- If DAM is not set this will be the last sector to read
            if (this.sr2Has(StatusRegister2.CM)) {
              this._activeCommandData.eot = this._activeCommandData.sector;
            }

            // read the sector
            for (let i = 0; i < sectorSize; i++) {
              this._executionBuffer[buffPos++] = sector.actualData[i];
            }

            // mark the sector read
            sector.sectorReadCompleted();

            if (sector.sectorId == this._activeCommandData.eot) {
              // this was the last sector to read
              this.sr1Set(StatusRegister1.EN);

              let keyIndex = 0;
              for (let i = 0; i < track.sectors.length; i++) {
                if (track.sectors[i].sectorId == sector.sectorId) {
                  keyIndex = i;
                  break;
                }
              }

              if (keyIndex === track.sectors.length - 1) {
                // --- Last sector on the cylinder, set EN
                this.sr1Set(StatusRegister1.EN);

                // --- Increment cylinder
                this._activeCommandData.cylinder++;

                // --- Reset sector
                this._activeCommandData.sector = 1;
                this.activeDrive.sectorIndex = 0;
              } else {
                this.activeDrive.sectorIndex++;
              }

              this.setAbnormalTerminationCommand();

              // result requires the actual track id, rather than the sector track id
              this._activeCommandData.cylinder = track.trackNo;

              // remove CM (appears to be required to defeat Alkatraz copy protection)
              this.sr2Clear(StatusRegister2.CM);

              this.commitResultCHRN();
              this.commitResultStatus();
              this._activePhase = ControllerCommandPhase.Execution;
              break;
            } else {
              // --- Continue with multi-sector read operation
              this._activeCommandData.sector++;
            }
          }

          if (this._activePhase === ControllerCommandPhase.Execution) {
            this._executionLength = buffPos;
            this._executionBufferCounter = buffPos;
            this.driveLightIsOn = true;
          }
        }
        break;

      case ControllerCommandPhase.Execution:
        const index = this._executionLength - this._executionBufferCounter;

        this._lastSectorDataReadByte = this._executionBuffer[index];

        this._overrunCounter--;
        this._executionBufferCounter--;

        break;

      case ControllerCommandPhase.Result:
        break;
    }
  }

  /// <summary>
  /// Read Diagnostic (read track)
  /// COMMAND:    8 parameter bytes
  /// EXECUTION:  Data transfer between FDD and FDC. FDC reads all data fields from index hole to EDT
  /// RESULT:     7 result bytes
  /// </summary>
  private readDiagnosticCommandHandler (): void {
    if (!this.activeDrive) {
      return;
    }

    switch (this._activePhase) {
      case ControllerCommandPhase.Idle:
        break;

      case ControllerCommandPhase.Command:
        this.pushCommandByteInBuffer();

        // was that the last parameter byte?
        if (
          this._commandParameterIndex ===
          this._activeCommandConfiguration.parameterBytesCount
        ) {
          // --- All parameter bytes received - setup for execution phase

          // --- Clear exec buffer and status registers
          this.clearExecBuffer();
          this.clearStatusRegisters();

          // --- Temp sector index
          let secIdx = this._activeCommandData.sector;

          // -- Do we have a valid disk inserted?
          if (!this.activeDrive.isReady) {
            // --- No disk, no tracks or motor is not on
            this.sr0Set(StatusRegister0.IC_D6 | StatusRegister0.NR);

            this.commitResultCHRN();
            this.commitResultStatus();

            // --- Move to result phase
            this._activePhase = ControllerCommandPhase.Result;
            break;
          }

          let buffPos = 0;
          let sectorSize = 0;

          // calculate requested size of data required
          if (this._activeCommandData.sectorSize === 0) {
            // --- When N=0, then DTL defines the data length which the FDC must treat as a sector. If DTL is smaller than the actual
            // --- data length in a sector, the data beyond DTL in the sector is not sent to the Data Bus. The FDC reads (internally)
            // --- the complete sector performing the CRC check and, depending upon the manner of command termination, may perform
            // --- a Multi-Sector Read Operation.
            sectorSize = this._activeCommandData.dtl;
          } else {
            // --- When N is non - zero, then DTL has no meaning and should be set to ffh
            this._activeCommandData.dtl = 0xff;
            sectorSize = 0x80 << this._activeCommandData.sectorSize;
          }

          // --- Get the current track
          const track = this.activeDrive.disk.tracks.find(
            a => a.trackNo === this.activeDrive.currentTrackId
          );

          if (!track || track.numSectors <= 0) {
            // --- Track could not be found
            this.sr0Set(StatusRegister0.IC_D6 | StatusRegister0.NR);

            this.commitResultCHRN();
            this.commitResultStatus();

            // move to result phase
            this._activePhase = ControllerCommandPhase.Result;
            break;
          }

          this.activeDrive.sectorIndex = 0;

          let secCount = 0;

          // --- Read the whole track
          for (let i = 0; i < track.sectors.length; i++) {
            if (secCount >= this._activeCommandData.eot) {
              break;
            }

            var sec = track.sectors[i];
            for (let b = 0; b < sec.actualData.length; b++) {
              this._executionBuffer[buffPos++] = sec.actualData[b];
            }

            // --- Mark the sector read
            sec.sectorReadCompleted();

            // --- End of sector - compare IDs
            if (
              sec.trackNo != this._activeCommandData.cylinder ||
              sec.sideNo != this._activeCommandData.head ||
              sec.sectorId != this._activeCommandData.sector ||
              sec.sectorSize != this._activeCommandData.sectorSize
            ) {
              this.sr1Set(StatusRegister1.ND);
            }

            secCount++;
            this.activeDrive.sectorIndex = i;
          }

          if (secCount === this._activeCommandData.eot) {
            // --- This was the last sector to read
            // --- or termination requested

            let keyIndex = 0;
            for (let i = 0; i < track.sectors.length; i++) {
              if (
                track.sectors[i].sectorId ==
                track.sectors[this.activeDrive.sectorIndex].sectorId
              ) {
                keyIndex = i;
                break;
              }
            }

            if (keyIndex === track.sectors.length - 1) {
              // --- Last sector on the cylinder, set EN
              this.sr1Set(StatusRegister1.EN);

              // --- Increment cylinder
              this._activeCommandData.cylinder++;

              // reset sector
              this._activeCommandData.sector = 1;
              this.activeDrive.sectorIndex = 0;
            } else {
              this.activeDrive.sectorIndex++;
            }

            this.sr0Clear(StatusRegister0.IC_D6 | StatusRegister0.IC_D7);

            this.commitResultCHRN();
            this.commitResultStatus();
            this._activePhase = ControllerCommandPhase.Execution;
          }

          if (this._activePhase == ControllerCommandPhase.Execution) {
            this._executionLength = buffPos;
            this._executionBufferCounter = buffPos;

            this.driveLightIsOn = true;
          }
        }

        break;

      case ControllerCommandPhase.Execution:
        var index = this._executionLength - this._executionBufferCounter;

        this._lastSectorDataReadByte = this._executionBuffer[index];

        this._overrunCounter--;
        this._executionBufferCounter--;

        break;

      case ControllerCommandPhase.Result:
        break;
    }
  }

  // --- Searches for the requested sector
  private getSector (): Sector | undefined {
    if (!this.activeDrive?.disk?.tracks) {
      return;
    }

    let result: Sector;

    // --- Get the current track
    const trk = this.activeDrive.disk.tracks[this.activeDrive.trackIndex];

    // --- Get the current sector index
    let sectorIndex = this.activeDrive.sectorIndex;

    // make sure this index exists
    if (sectorIndex > trk.sectors.length) {
      sectorIndex = 0;
    }

    // --- Index hole count
    let indexHole = 0;

    // --- Loop through the sectors in a track, the loop ends with either the sector being found or the index hole being passed twice
    while (indexHole <= 2) {
      // --- Does the requested sector match the current sector?
      if (
        trk.sectors[sectorIndex].sectorIdInfo.c ==
          this._activeCommandData.cylinder &&
        trk.sectors[sectorIndex].sectorIdInfo.h ==
          this._activeCommandData.head &&
        trk.sectors[sectorIndex].sectorIdInfo.r ==
          this._activeCommandData.sector &&
        trk.sectors[sectorIndex].sectorIdInfo.n ==
          this._activeCommandData.sectorSize
      ) {
        // --- Sector has been found
        result = trk.sectors[sectorIndex];
        this.sr2Clear(StatusRegister2.BC | StatusRegister2.WC);
        break;
      }

      // --- Check for a bad cylinder
      if (trk.sectors[sectorIndex].sectorIdInfo.c == 255) {
        this.sr2Set(StatusRegister2.BC);
      }
      // --- Check for no cylinder
      else if (
        trk.sectors[sectorIndex].sectorIdInfo.c !=
        this._activeCommandData.cylinder
      ) {
        this.sr2Set(StatusRegister2.WC);
      }

      // --- Incrememnt sector index
      sectorIndex++;

      // --- Do we have reached the index hole?
      if (trk.sectors.length <= sectorIndex) {
        // --- Wrap around
        sectorIndex = 0;
        indexHole++;
      }
    }
    // --- Search loop has completed and the sector may or may not have been found

    // --- Bad cylinder detected?
    if (this.sr2Has(StatusRegister2.BC)) {
      // --- Remove the WC flag
      this.sr2Clear(StatusRegister2.WC);
    }

    // --- Update the current sector index
    this.activeDrive.sectorIndex = sectorIndex;

    // --- Done.
    return result;
  }

  // --- Signs the abnormal termination of a particular command
  setAbnormalTerminationCommand () {
    this.sr0Set(StatusRegister0.IC_D6);
    this.sr0Clear(StatusRegister0.IC_D7);
  }

  // --- Test for SR0 flag existence
  sr0Has (flag: number): boolean {
    return (this._sr0 & flag) !== 0;
  }

  // --- Set SR0 flag
  sr0Set (mask: number): void {
    this._sr0 = (this._sr0 | mask) & 0xff;
  }

  // --- Clear SR0 flag
  sr0Clear (mask: number): void {
    this._sr0 = this._sr0 & ~mask & 0xff;
  }

  // --- Test for SR1 flag existence
  sr1Has (flag: number): boolean {
    return (this._sr1 & flag) !== 0;
  }

  // --- Set SR1 flag
  sr1Set (mask: number): void {
    this._sr1 = (this._sr1 | mask) & 0xff;
  }

  // --- Clear SR1 flag
  sr1Clear (mask: number): void {
    this._sr1 = this._sr1 & ~mask & 0xff;
  }

  // --- Test for SR2 flag existence
  sr2Has (flag: number): boolean {
    return (this._sr2 & flag) !== 0;
  }

  // --- Set SR2 flag
  sr2Set (mask: number): void {
    this._sr2 = (this._sr2 | mask) & 0xff;
  }

  // --- Clear SR2 flag
  sr2Clear (mask: number): void {
    this._sr2 = this._sr2 & ~mask & 0xff;
  }
}
