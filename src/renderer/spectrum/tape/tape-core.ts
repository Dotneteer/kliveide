import { BinaryReader } from "../../../shared/utils/BinaryReader";
import { BinaryWriter } from "../../../shared/utils/BinaryWriter";

/**
 * Pilot pulse length
 */
export const PILOT_PL = 2168;

/**
 * Pilot pulses in the ROM header block
 */
export const HEADER_PILOT_COUNT = 8063;

/**
 * Pilot pulses in the ROM data block
 */
export const DATA_PILOT_COUNT = 3223;

/**
 * Sync 1 pulse length
 */
export const SYNC_1_PL = 667;

/**
 * Sync 2 pulse lenth
 */
export const SYNC_2_PL = 735;

/**
 * Bit 0 pulse length
 */
export const BIT_0_PL = 855;

/**
 * Bit 1 pulse length
 */
export const BIT_1_PL = 1710;

/**
 * End sync pulse length
 */
export const TERM_SYNC = 947;

/**
 * 1 millisecond pause
 */
const PAUSE_MS = 3500;

/**
 * Plays a tape data block into the virtual machine
 */
export class TapeDataBlockPlayer implements ITapeData {
  private _pilotEnds = 0;
  private _sync1Ends = 0;
  private _sync2Ends = 0;
  private _bitStarts = 0;
  private _bitPulseLength = 0;
  private _currentBit = false;
  private _termSyncEnds = 0;
  private _pauseEnds = 0;

  /**
   * Pause after this block (default: 1000ms)
   */
  pauseAfter: number;

  /**
   * Block Data
   */
  data: Uint8Array;

  /// <summary>
  /// Initializes a new instance of the <see cref="T:System.Object" /> class.
  /// </summary>
  constructor(data: Uint8Array, pauseAfter: number) {
    this.pilotPulseLength = PILOT_PL;
    this.sync1PulseLength = SYNC_1_PL;
    this.sync2PulseLength = SYNC_2_PL;
    this.zeroBitPulseLength = BIT_0_PL;
    this.oneBitPulseLength = BIT_1_PL;
    this.headerPilotToneLength = HEADER_PILOT_COUNT;
    this.dataPilotToneLength = DATA_PILOT_COUNT;

    this.pauseAfter = pauseAfter;
    this.data = data;
  }

  /**
   * Length of pilot pulse
   */
  pilotPulseLength: number;

  /**
   * Length of the first sync pulse
   */
  sync1PulseLength: number;

  /**
   * Length of the second sync pulse
   */
  sync2PulseLength: number;

  /**
   * Length of the zero bit
   */
  zeroBitPulseLength: number;

  /**
   * Length of the one bit
   */
  oneBitPulseLength: number;

  /**
   * Length of the header pilot tone
   */
  headerPilotToneLength: number;

  /**
   * Length of the data pilot tone
   */
  dataPilotToneLength: number;

  /**
   * The index of the currently playing byte.
   */
  byteIndex = 0;

  /**
   * The mask of the currently playing bit in the current byte
   */
  bitMask = 0;

  /**
   * The current playing phase
   */
  playPhase = PlayPhase.None;

  /**
   * The tact count of the CPU when playing starts
   */
  startTact = 0;

  /**
   * Last tact queried
   */
  lastTact = 0;

  /**
   * Initializes the player
   * @param startTact Start CPU tact
   */
  initPlay(startTact: number): void {
    this.playPhase = PlayPhase.Pilot;
    this.startTact = this.lastTact = startTact;
    this._pilotEnds =
      ((this.data[0] & 0x80) === 0
        ? this.headerPilotToneLength
        : this.dataPilotToneLength) * this.pilotPulseLength;
    this._sync1Ends = this._pilotEnds + this.sync1PulseLength;
    this._sync2Ends = this._sync1Ends + this.sync2PulseLength;
    this.byteIndex = 0;
    this.bitMask = 0x80;
  }

  /**
   * Gets the EAR bit value for the specified tact
   * @param long Tacts to retrieve the EAR bit
   * @param currentTact The EAR bit value to play back
   */
  getEarBit(currentTact: number): boolean {
    let pos = currentTact - this.startTact;
    this.lastTact = currentTact;

    if (
      this.playPhase === PlayPhase.Pilot ||
      this.playPhase === PlayPhase.Sync
    ) {
      // --- Generate the appropriate pilot or sync EAR bit
      if (pos <= this._pilotEnds) {
        // --- Alternating pilot pulses
        return Math.floor(pos / this.pilotPulseLength) % 2 === 0;
      }
      if (pos <= this._sync1Ends) {
        // --- 1st sync pulse
        this.playPhase = PlayPhase.Sync;
        return false;
      }
      if (pos <= this._sync2Ends) {
        // --- 2nd sync pulse
        this.playPhase = PlayPhase.Sync;
        return true;
      }
      this.playPhase = PlayPhase.Data;
      this._bitStarts = this._sync2Ends;
      this._currentBit = (this.data[this.byteIndex] & this.bitMask) !== 0;
      this._bitPulseLength = this._currentBit
        ? this.oneBitPulseLength
        : this.zeroBitPulseLength;
    }
    if (this.playPhase === PlayPhase.Data) {
      // --- Data block playback
      // --- Generate current bit pulse
      const bitPos = pos - this._bitStarts;
      if (bitPos < this._bitPulseLength) {
        // --- First pulse of the bit
        return false;
      }
      if (bitPos < 2 * this._bitPulseLength) {
        // --- Second pulse of the bit
        return true;
      }

      // --- Move to the next bit, or byte
      if ((this.bitMask >>= 1) === 0) {
        this.bitMask = 0x80;
        this.byteIndex++;
      }

      // --- Prepare the next bit
      if (this.byteIndex < this.data.length) {
        this._bitStarts += 2 * this._bitPulseLength;
        this._currentBit = (this.data[this.byteIndex] & this.bitMask) !== 0;
        this._bitPulseLength = this._currentBit
          ? this.oneBitPulseLength
          : this.zeroBitPulseLength;
        // --- We're in the first pulse of the next bit
        return false;
      }

      // --- We've played back all data bytes, send terminating pulse
      this.playPhase = PlayPhase.TermSync;
      this._termSyncEnds = currentTact + TERM_SYNC;
      return false;
    }

    if (this.playPhase === PlayPhase.TermSync) {
      if (currentTact < this._termSyncEnds) {
        return false;
      }

      // --- We've played back all data, not, it's pause time
      this.playPhase = PlayPhase.Pause;
      this._pauseEnds = currentTact + PAUSE_MS * this.pauseAfter;
      return true;
    }

    // --- We need to produce pause signs
    if (currentTact > this._pauseEnds) {
      this.playPhase = PlayPhase.Completed;
    }
    return true;
  }
}

/**
 * This class is the base class of all data block types (TAP, TZX, and others)
 */
export interface IPlayableDataBlockBase {
  /**
   * Signs if the data block support playback
   */
  supportsPlayback(): boolean;

  /**
   * The current playing phase
   */
  getPlayPhase(): PlayPhase;

  /**
   * The tact count of the CPU when playing starts
   */
  getStartTact(): number;

  /**
   * Initializes the player
   * @param startTact CPU tacts when playing starts
   */
  initPlay(startTact: number): void;

  /**
   * The data of the playable block
   */
  data: Uint8Array;

  /**
   * Gets the EAR bit value for the specified tact
   * @param currentTact Tact value to retrieve the EAR bit for
   * @returns The EAR bit value to play back
   */
  getEarBit(currentTact: number): boolean;
}

/**
 * Represents the data in the tape
 */
export interface ITapeData {
  /**
   * Block Data
   */
  data: Uint8Array;

  /**
   * Pause after this block (given in milliseconds)
   */
  pauseAfter: number;
}

/**
 * Defines the serialization operations of a TZX record
 */
export interface ITapeDataSerialization {
  /**
   * Reads the content of the block from the specified binary stream.
   * @param reader Stream to read the block from
   */
  readFrom(reader: BinaryReader): void;

  /**
   * Writes the content of the block to the specified binary stream.
   * @param writer Stream to write the block to
   */
  writeTo(writer: BinaryWriter): void;
}

/**
 * Represents the playing phase of the current tape block
 */
export enum PlayPhase {
  /**
   * The player is passive
   */
  None = 0,

  /**
   * Pilot signals
   */
  Pilot,

  /**
   * Sync signals at the end of the pilot
   */
  Sync,

  /**
   * Bits in the data block
   */
  Data,

  /**
   * Short terminating sync signal before pause
   */
  TermSync,

  /**
   * Pause after the data block
   */
  Pause,

  /**
   * The entire block has been played back
   */
  Completed,
}
