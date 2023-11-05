import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";
import { ITapeDevice } from "@emu/abstractions/ITapeDevice";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { MicPulseType } from "@emu/abstractions/MicPulseTypes";
import { PlayPhase } from "@emu/abstractions/PlayPhase";
import { SavePhase } from "@emu/abstractions/SavePhase";
import { TapeMode } from "@emu/abstractions/TapeMode";
import {
  BIT_0_PL,
  BIT_1_PL,
  PILOT_PL,
  SYNC_1_PL,
  SYNC_2_PL,
  TERM_SYNC
} from "@common/structs/tape-const";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import {
  TAPE_MODE,
  FAST_LOAD,
  TAPE_SAVER,
  TAPE_DATA,
  REWIND_REQUESTED,
  TAPE_SAVED
} from "../machine-props";
import { ITapeSaver } from "./ITapeSaver";
import { TzxStandardSpeedBlock } from "./TzxStandardSpeedBlock";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TzxHeader } from "./TzxHeader";

// --- Pilot pulses in the header blcok
const HEADER_PILOT_COUNT = 8063;

// --- Pilot pulses in the data block
const DATA_PILOT_COUNT = 3223;

// --- Minimum number of pilot pulses before SYNC1 (while saving)
const MIN_PILOT_PULSE_COUNT = 3000;

// --- This value is the LD_START address of the ZX Spectrum ROM. This routine checks the tape input for a pilot
// --- pulse. When we reach this address, a LOAD operation has just been started.
const TAPE_LOAD_BYTES_ROUTINE = 0x056c;

// --- This value is the address in the ZX Spectrum ROM at which the LOAD routine tests if the tape header is
// --- correct. The address points to a RET NZ instruction that returns in case of an incorrect header. We use this
// --- address to emulate an error in fast tape mode.
const TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE = 0x05b6;

// --- This value is the address in the ZX Spectrum ROM at which the LOAD routine returns after successfully loading
// --- a tape block.
const TAPE_LOAD_BYTES_RESUME = 0x05e2;

// --- This value is the address of the SA-BYTES routine in the ZX Spectrum ROM, which indicates that a SAVE
// --- operation has just been started.
const TAPE_SAVE_BYTES_ROUTINE = 0x04c2;

// --- Represents the minimum length of a too long pause in CPU tacts
const TOO_LONG_PAUSE = 3_500_000;

// --- The width tolerance of save pulses
const SAVE_PULSE_TOLERANCE = 24;

/**
 * This class implements the ZX Spectrum tape device.
 */
export class TapeDevice implements ITapeDevice {
  // --- The current tape mode
  private _tapeMode: TapeMode;

  // --- The tape blocks to play
  private _blocks: TapeDataBlock[];

  // --- Signs that we reached the end of the tape
  private _tapeEof: boolean;

  // --- The index of the block to read
  private _currentBlockIndex: number;

  // --- The current phase of playing a tape block
  private _playPhase: PlayPhase;

  // --- The CPU tact when the tape load started
  private _tapeStartTact: number;

  // --- End tact of the current pilot
  private _tapePilotEndPos: number;

  // --- End tact of the SYNC1 pulse
  private _tapeSync1EndPos: number;

  // --- End tact of the SYNC2 pulse
  private _tapeSync2EndPos: number;

  // --- Start tact of the current bit
  private _tapeBitStartPos: number;

  // --- Length of the current bit pulse
  private _tapeBitPulseLen: number;

  // --- Index of byte to load within the current data block
  private _dataIndex: number;

  // --- Bit mask of the current bit beign read
  private _tapeBitMask: number;

  // --- Tape termination tact
  private _tapeTermEndPos: number;

  // --- Tape pause position
  private _tapePauseEndPos: number;

  // --- Object that knows how to save the tape information
  private _tapeSaver?: ITapeSaver;

  // --- The tact when detecting the last MIC bit
  private _tapeLastMicBitTact: number;

  // --- Current save phase
  private _savePhase: SavePhase;

  // --- Pilot pulse counter used during a SAVE operation
  private _pilotPulseCount: number;

  // --- Value of the last data pulse detected
  private _prevDataPulse: MicPulseType;

  // --- Offset of the last bit being saved
  private _bitOffset: number;

  // --- Data byte being saved
  private _dataByte: number;

  // --- Length of data being saved
  private _dataLength: number;

  // --- Buffer collecting the date saved
  private _dataBuffer: number[] = [];

  // --- Number of data blocks beign saved
  private _dataBlockCount: number;

  /// <summary>
  /// Initialize the tape device and assign it to its host machine.
  /// </summary>
  /// <param name="machine">The machine hosting this device</param>
  constructor (public readonly machine: IZxSpectrumMachine) {
    const device = this;
    machine.machinePropertyChanged.on(args =>
      this.onMachinePropertiesChanged(device, args)
    );
    this.reset();
  }

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // --- Nothing to dispose
  }

  /**
   * Get or set the current operation mode of the tape device.
   */
  get tapeMode (): TapeMode {
    return this._tapeMode;
  }
  set tapeMode (value: TapeMode) {
    if (this._tapeMode === value) return;
    this._tapeMode = value;
    this.machine.setMachineProperty(TAPE_MODE, value);
  }

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    this._tapeMode = TapeMode.Passive;
    this._currentBlockIndex = -1;
    this._tapeEof = false;
    this._playPhase = PlayPhase.None;
  }

  /**
   * This method updates the current tape mode according to the current ROM index and PC value
   */
  updateTapeMode (): void {
    // --- Handle passive mode
    if (this.tapeMode === TapeMode.Passive) {
      if (!this.machine.isSpectrum48RomSelected) {
        // --- Not in ZX Spectrum 48 ROM, nothing to do
        return;
      }
      switch (this.machine.pc) {
        case TAPE_LOAD_BYTES_ROUTINE: {
          // --- We just entered into the LOAD routine
          this.tapeMode = TapeMode.Load;
          this.nextTapeBlock();

          // --- Do we allow fast loading mode?
          const allowFastLoad = this.machine.getMachineProperty(FAST_LOAD);
          if (!(allowFastLoad ?? true)) return;

          // --- Emulate loading the current block in fast mode.
          this.fastLoad();
          this.tapeMode = TapeMode.Passive;
          return;
        }

        case TAPE_SAVE_BYTES_ROUTINE:
          // --- Turn on SAVE mode
          this.tapeMode = TapeMode.Save;
          this._tapeLastMicBitTact = this.machine.tacts;
          this.micBit = true;
          this._savePhase = SavePhase.None;
          this._pilotPulseCount = 0;
          this._dataBlockCount = 0;
          this._prevDataPulse = MicPulseType.None;
          this._dataLength = 0;
          break;
      }

      return;
    }

    // --- Handle LOAD mode
    if (this.tapeMode === TapeMode.Load) {
      // --- Move to passive mode when tape ends or a tape error occurs
      if (
        this._tapeEof ||
        (this.machine.isSpectrum48RomSelected && this.machine.pc === 0x0008)
      ) {
        this.tapeMode = TapeMode.Passive;
      }
      return;
    }

    // --- Handle SAVE Mode. Error or too long pause?
    if (
      (this.machine.isSpectrum48RomSelected && this.machine.pc === 0x0008) ||
      this.machine.tacts - this._tapeLastMicBitTact > TOO_LONG_PAUSE
    ) {
      // --- Leave the SAVE mode
      this.tapeMode = TapeMode.Passive;
    }
  }

  /**
   * This method returns the value of the EAR bit read from the tape.
   * @returns
   */
  getTapeEarBit (): boolean {
    // --- Calculate the current position
    const pos = this.machine.tacts - this._tapeStartTact;
    const block = this._blocks[this._currentBlockIndex];

    // --- PILOT or SYNC phase?
    if (
      this._playPhase === PlayPhase.Pilot ||
      this._playPhase === PlayPhase.Sync
    ) {
      // --- Generate appropriate pilot or sync EAR bit
      if (pos <= this._tapePilotEndPos) {
        // --- Alternating pilot pulses
        return Math.floor(pos / block.pilotPulseLength) % 2 == 0;
      }

      // --- Test SYNC1 position
      if (pos <= this._tapeSync1EndPos) {
        // --- Turn to SYNC phase
        this._playPhase = PlayPhase.Sync;
        return false; // => Low EAR bit
      }

      // --- Test SYNC_2 position
      if (pos <= this._tapeSync2EndPos) {
        this._playPhase = PlayPhase.Sync;
        return true; // => High EAR bit
      }

      // --- Now, we're ready to change to Data phase
      this._playPhase = PlayPhase.Data;
      this._tapeBitStartPos = this._tapeSync2EndPos;

      // --- Select the bit pulse length of the first bit of the data byte
      this._tapeBitPulseLen =
        (block.data[this._dataIndex] & this._tapeBitMask) != 0
          ? block.oneBitPulseLength
          : block.zeroBitPulseLength;
    }

    // --- Data phase?
    if (this._playPhase === PlayPhase.Data) {
      // --- Generate current bit pulse
      var bitPos = pos - this._tapeBitStartPos;

      // --- First pulse?
      if (bitPos < this._tapeBitPulseLen) {
        return false; // => Low EAR bit
      }
      if (bitPos < this._tapeBitPulseLen * 2) {
        return true; // => High EAR bit
      }

      // --- Move to the next bit
      this._tapeBitMask = this._tapeBitMask >>> 1;
      if (this._tapeBitMask === 0) {
        // --- Move to the next byte
        this._tapeBitMask = 0x80;
        this._dataIndex++;
      }

      // --- Do we have more bits to play?
      if (this._dataIndex < block.data.length) {
        // --- Prepare to the next bit
        this._tapeBitStartPos += 2 * this._tapeBitPulseLen;

        // --- Select the bit pulse length of the next bit
        this._tapeBitPulseLen =
          (block.data[this._dataIndex] & this._tapeBitMask) != 0
            ? block.oneBitPulseLength
            : block.zeroBitPulseLength;

        // --- We're in the first pulse of the next bit
        return false; // => Low EAR bit
      }

      // --- We've played all data bytes, let's send the terminating pulse
      this._playPhase = PlayPhase.TermSync;

      // --- Prepare to the terminating sync
      this._tapeTermEndPos =
        this._tapeBitStartPos +
        2 * this._tapeBitPulseLen +
        block.endSyncPulseLenght;
      return false;
    }

    // --- Termination sync?
    if (this._playPhase == PlayPhase.TermSync) {
      if (pos < this._tapeTermEndPos) {
        return false; // => Low EAR bit
      }

      // --- We terminated the data, it's pause time (1 second)
      this._playPhase = PlayPhase.Pause;
      this._tapePauseEndPos =
        this._tapeTermEndPos + this.machine.baseClockFrequency;
      return true; // => High EAR bit
    }

    // --- Completion? Move to the next block
    if (pos > this._tapePauseEndPos) {
      this.nextTapeBlock();
    }

    // --- Return with a high bit
    return true;
  }

  /**
   * The current value of the MIC bit
   */
  micBit = false;

  /// <summary>
  /// Process the specified MIC bit value.
  /// </summary>
  /// <param name="micBit">MIC bit to process</param>
  processMicBit (micBit: boolean): void {
    if (this._tapeMode !== TapeMode.Save || this.micBit === micBit) {
      return;
    }

    const length = this.machine.tacts - this._tapeLastMicBitTact;

    // --- Classify the pulse by its width
    let pulse = MicPulseType.None;
    if (
      length >= BIT_0_PL - SAVE_PULSE_TOLERANCE &&
      length <= BIT_0_PL + SAVE_PULSE_TOLERANCE
    ) {
      pulse = MicPulseType.Bit0;
    } else if (
      length >= BIT_1_PL - SAVE_PULSE_TOLERANCE &&
      length <= BIT_1_PL + SAVE_PULSE_TOLERANCE
    ) {
      pulse = MicPulseType.Bit1;
    } else if (
      length >= PILOT_PL - SAVE_PULSE_TOLERANCE &&
      length <= PILOT_PL + SAVE_PULSE_TOLERANCE
    ) {
      pulse = MicPulseType.Pilot;
    } else if (
      length >= SYNC_1_PL - SAVE_PULSE_TOLERANCE &&
      length <= SYNC_1_PL + SAVE_PULSE_TOLERANCE
    ) {
      pulse = MicPulseType.Sync1;
    } else if (
      length >= SYNC_2_PL - SAVE_PULSE_TOLERANCE &&
      length <= SYNC_2_PL + SAVE_PULSE_TOLERANCE
    ) {
      pulse = MicPulseType.Sync2;
    } else if (
      length >= TERM_SYNC - SAVE_PULSE_TOLERANCE &&
      length <= TERM_SYNC + SAVE_PULSE_TOLERANCE
    ) {
      pulse = MicPulseType.TermSync;
    } else if (length < SYNC_1_PL - SAVE_PULSE_TOLERANCE) {
      pulse = MicPulseType.TooShort;
    } else if (length > PILOT_PL + 2 * SAVE_PULSE_TOLERANCE) {
      pulse = MicPulseType.TooLong;
    }

    this.micBit = micBit;
    this._tapeLastMicBitTact = this.machine.tacts;

    // --- Lets process the pulse according to the current SAVE phase and pulse width
    let nextPhase = SavePhase.Error;
    switch (this._savePhase) {
      case SavePhase.None:
        if (pulse === MicPulseType.TooShort || pulse === MicPulseType.TooLong) {
          nextPhase = SavePhase.None;
        } else if (pulse === MicPulseType.Pilot) {
          this._pilotPulseCount = 1;
          nextPhase = SavePhase.Pilot;
        }
        break;
      case SavePhase.Pilot:
        if (pulse === MicPulseType.Pilot) {
          this._pilotPulseCount++;
          nextPhase = SavePhase.Pilot;
        } else if (
          pulse === MicPulseType.Sync1 &&
          this._pilotPulseCount >= MIN_PILOT_PULSE_COUNT
        ) {
          nextPhase = SavePhase.Sync1;
        }
        break;
      case SavePhase.Sync1:
        if (pulse === MicPulseType.Sync2) {
          nextPhase = SavePhase.Sync2;
        }
        break;
      case SavePhase.Sync2:
        if (pulse === MicPulseType.Bit0 || pulse === MicPulseType.Bit1) {
          // --- Next pulse starts data, prepare for receiving it
          this._prevDataPulse = pulse;
          nextPhase = SavePhase.Data;
          this._bitOffset = 0;
          this._dataByte = 0;
          this._dataLength = 0;
          this._dataBuffer = [];
        }
        break;
      case SavePhase.Data:
        if (pulse === MicPulseType.Bit0 || pulse === MicPulseType.Bit1) {
          if (this._prevDataPulse === MicPulseType.None) {
            // --- We are waiting for the second half of the bit pulse
            this._prevDataPulse = pulse;
            nextPhase = SavePhase.Data;
          } else if (this._prevDataPulse == pulse) {
            // --- We received a full valid bit pulse
            nextPhase = SavePhase.Data;
            this._prevDataPulse = MicPulseType.None;

            // --- Add this bit to the received data
            this._bitOffset++;
            this._dataByte =
              (this._dataByte * 2 + (pulse == MicPulseType.Bit0 ? 0 : 1)) &
              0xff;
            if (this._bitOffset === 8) {
              // --- We received a full byte
              this._dataBuffer[this._dataLength++] = this._dataByte;
              this._dataByte = 0;
              this._bitOffset = 0;
            }
          }
        } else if (pulse === MicPulseType.TermSync) {
          // --- We received the terminating pulse, the datablock has been completed
          nextPhase = SavePhase.None;
          this._dataBlockCount++;

          // --- Create and save the data block
          const dataBlock: TzxStandardSpeedBlock = new TzxStandardSpeedBlock();
          dataBlock.data = new Uint8Array(this._dataBuffer);
          dataBlock.dataLength = this._dataLength;

          // --- If this is the first data block, extract the name from the header
          if (this._dataBlockCount === 1 && this._dataLength == 0x13) {
            // --- It's a header!
            let sb = "";
            for (let i = 2; i <= 11; i++) {
              sb += String.fromCharCode(this._dataBuffer[i]);
            }
            const name = sb.trimEnd();
            this._tapeSaver?.setName(name);
          }
          this._tapeSaver?.saveTapeBlock(dataBlock);
        }
        break;
    }
    this._savePhase = nextPhase;
  }

  /**
   * Moves to the next tape block to play
   */
  nextTapeBlock (): void {
    // --- No next block situations
    if (this._tapeEof) return;
    if (!this._blocks) {
      this._tapeEof = true;
      return;
    }
    if (this._currentBlockIndex >= this._blocks.length - 1) {
      this._tapeEof = true;
      return;
    }

    // --- Current block completed?
    if (this._playPhase === PlayPhase.Completed) {
      return;
    }

    // --- Ok, we have a current block to play
    const block = this._blocks[++this._currentBlockIndex];
    this._playPhase = PlayPhase.Pilot;
    this._tapeStartTact = this.machine.tacts;
    this._tapePilotEndPos =
      block.pilotPulseLength *
      (block.data[0] & 0x80 ? DATA_PILOT_COUNT : HEADER_PILOT_COUNT);
    this._tapeSync1EndPos = this._tapePilotEndPos + block.sync1PulseLength;
    this._tapeSync2EndPos = this._tapeSync1EndPos + block.sync2PulseLength;
    this._dataIndex = 0;
    this._tapeBitMask = 0x80;
  }

  /**
   * Emulates loading the current block in fast mode.
   * @returns
   */
  fastLoad (): void {
    // --- Stop playing if no more blocks
    if (this._tapeEof) {
      return;
    }

    // --- No it's time to fast load
    const block = this._blocks[this._currentBlockIndex];
    let dataIndex = 0;
    let machine = this.machine;

    // -- Move AF' to AF
    machine.af = machine.af_;

    // -- Check if it is a VERIFY
    const isVerify = (machine.af & 0xff01) === 0xff00;

    // --- At this point IX contains the address to load the data,
    // --- DE shows the #of bytes to load. A contains 0x00 for header,
    // --- 0xFF for data block
    if (block.data[dataIndex] !== machine.a) {
      // --- This block has a different type we're expecting
      machine.a ^= machine.l;
      // --- Reset Z and C
      machine.f &= 0xbe;
      machine.pc = TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE;
      this.nextTapeBlock();
      return;
    }

    // --- It is time to load the block
    machine.h = machine.a;

    // --- Skip the header byte
    dataIndex++;
    while (machine.de > 0) {
      machine.l = block.data[dataIndex];
      if (isVerify) {
        // -- VERIFY operation
        if (machine.doReadMemory(machine.ix) !== machine.l) {
          // --- We read a different byte, it's an error
          // --- Reset Z and C
          machine.f &= 0xbe;
          machine.pc = TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE;
          return;
        }
      }

      // --- Store the loaded byte
      machine.doWriteMemory(machine.ix, machine.l);

      // --- Calculate the checksum
      machine.h ^= machine.l;

      // --- Increment the data pointers
      dataIndex++;
      machine.ix++;

      // --- Decrement byte count
      machine.de--;
    }

    // --- Check the end of the data stream
    if (dataIndex > block.data.length - 1) {
      // --- Read over the expected length
      // --- Reset Carry to sign error
      machine.f &= 0xfe;
    } else {
      // --- Verify checksum
      if (block.data[dataIndex] !== machine.h) {
        // --- Wrong checksum
        // --- Reset Carry to sign error
        machine.f &= 0xfe;
      } else {
        // --- Block read successfully, set Carry
        machine.f |= FlagsSetMask.C;
      }
    }

    machine.pc = TAPE_LOAD_BYTES_RESUME;

    // --- Sign completion of this block
    this._playPhase = PlayPhase.Pause;

    // --- Imitate, we're over the pause period
    this._tapePauseEndPos = 0;
  }

  /**
   * Respond to the tape data changes and rewind requests
   */
  onMachinePropertiesChanged (
    device: TapeDevice,
    handler: { propertyName: string; newValue?: any }
  ): void {
    switch (handler.propertyName) {
      case TAPE_MODE:
        if ((handler.newValue as TapeMode) === TapeMode.Passive) {
          device.machine.beeperDevice.setEarBit(false);
        }
        break;
      case TAPE_SAVER:
        if (handler.newValue.setName) {
          device._tapeSaver = handler.newValue as ITapeSaver;
        }
        break;

      case TAPE_DATA:
        if (Array.isArray(handler.newValue)) {
          device._blocks = handler.newValue as TapeDataBlock[];
          device._currentBlockIndex = -1;
          device._tapeEof = false;
        }
        break;

      case REWIND_REQUESTED:
        if (handler.newValue === true) {
          device._currentBlockIndex = -1;
          device._tapeEof = false;
          device._playPhase = PlayPhase.None;
          device.machine.setMachineProperty(REWIND_REQUESTED);
        }
        break;
    }
  }
}

export class TapeSaver implements ITapeSaver {
  private _name: string;
  private _headerBlock: TzxStandardSpeedBlock;

  constructor (private readonly tapeDevice: TapeDevice) {}

  /**
   * This method sets the name of the file according to the Spectrum SAVE HEADER information
   * @param name Name to set
   */
  setName (name: string): void {
    this._name = name;
  }

  /**
   * Appends the TZX block to the tape file
   * @param block Tape block to save
   */
  saveTapeBlock (block: TzxStandardSpeedBlock): void {
    if (block.dataLength === 0x13 && block?.data[0] === 0x00) {
      this._headerBlock = block;
    } else if (block.data?.[0] === 0xff) {
      const writer = new BinaryWriter();
      // --- Save data blocks
      const header = new TzxHeader();
      header.writeTo(writer);
      this._headerBlock.writeTo(writer);
      block.writeTo(writer);

      // --- Store the last saved file
      this.tapeDevice.machine.setMachineProperty(TAPE_SAVED, {
        name: `${this._name}.tzx`,
        contents: writer.buffer
      });
    }
  }
}
