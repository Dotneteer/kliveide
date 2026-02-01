import type { PsgChipState } from "@emu/abstractions/PsgChipState";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

/**
 * Turbo Sound Next - manages 3 AY-3-8912 PSG chips
 *
 * Chip Selection via port 0xFFFD:
 * - If bits 7:5 = 0, selects register in active chip
 * - If bits 7:5 = 111 (0xE0), controls chip selection and panning
 *   - Bits 1:0 = active chip (11=0, 10=1, 01=2, 00=reserved)
 *   - Bits 6:5 = panning (00=muted, 01=right, 10=left, 11=stereo)
 */
export class TurboSoundDevice {
  // --- The three PSG chips
  private readonly _chips: PsgChip[] = [
    new PsgChip(0),
    new PsgChip(1),
    new PsgChip(2),
  ];

  // --- Currently selected chip (0, 1, or 2)
  private _selectedChip = 0;

  // --- Panning for each chip: bits [1:0] = left, [3:2] = right
  // --- Bit layout: [unused, right_enable, unused, left_enable]
  // --- 00 = muted, 01 = right only, 10 = left only, 11 = stereo
  private readonly _chipPanning = [0x3, 0x3, 0x3]; // All stereo by default (11)

  /**
   * Initialize the Turbo Sound device
   */
  constructor() {
    this.reset();
  }

  /**
   * Reset the device to its initial state
   */
  reset(): void {
    this._chips.forEach((chip) => chip.reset());
    this._selectedChip = 0;
    this._chipPanning[0] = 0x3; // Stereo
    this._chipPanning[1] = 0x3; // Stereo
    this._chipPanning[2] = 0x3; // Stereo
  }

  /**
   * Gets the ID of the currently selected chip
   */
  getSelectedChipId(): number {
    return this._selectedChip;
  }

  /**
   * Gets the panning configuration for a specific chip
   * @param chipId The chip ID (0-2)
   * @returns Panning value (0-3: muted, right, left, stereo)
   */
  getChipPanning(chipId: number): number {
    const id = chipId & 0x03;
    return this._chipPanning[id];
  }

  /**
   * Gets a reference to a specific chip
   * @param chipId The chip ID (0-2)
   * @returns The PSG chip instance
   */
  getChip(chipId: number): PsgChip {
    const id = chipId & 0x03;
    return this._chips[id];
  }

  /**
   * Gets the currently selected chip
   */
  getSelectedChip(): PsgChip {
    return this._chips[this._selectedChip];
  }

  /**
   * Reads the value of the currently selected register from the active chip
   */
  readPsgRegisterValue(): number {
    return this._chips[this._selectedChip].readPsgRegisterValue();
  }

  /**
   * Sets the PSG register index on the active chip
   * Also handles chip selection and panning control
   * 
   * Chip selection format (bit 7=1, bits 4:2=111):
   * - Bits 6:5 = panning (00=muted, 01=right, 10=left, 11=stereo)
   * - Bits 1:0 = chip select (11=0, 10=1, 01=2, 00=reserved)
   * 
   * @param value The value written to port 0xFFFD
   */
  setPsgRegisterIndex(value: number): void {
    // Check if this is a chip selection command (bit 7 = 1 AND bits 4:2 = 111)
    if ((value & 0x80) !== 0 && (value & 0x1c) === 0x1c) {
      // Chip selection and panning control
      const chipSelect = value & 0x03;

      // Map chip selection to chip ID: 11=0, 10=1, 01=2
      if (chipSelect === 0x3) {
        this._selectedChip = 0;
      } else if (chipSelect === 0x2) {
        this._selectedChip = 1;
      } else if (chipSelect === 0x1) {
        this._selectedChip = 2;
      }
      // chipSelect === 0 is reserved, ignore

      // Panning control in bits 6:5 (extract and shift to bits 1:0)
      const panning = (value >> 5) & 0x03;
      this._chipPanning[this._selectedChip] = panning;
    } else if ((value & 0xe0) === 0) {
      // Register selection (bits 7:5 = 000)
      this._chips[this._selectedChip].setPsgRegisterIndex(value & 0x0f);
    }
    // Ignore other bit patterns
  }

  /**
   * Writes a value to the currently selected register on the active chip
   * @param value The value to write
   */
  writePsgRegisterValue(value: number): void {
    this._chips[this._selectedChip].writePsgRegisterValue(value);
  }

  /**
   * Gets the state of a specific chip
   * @param chipId The chip ID (0-2)
   */
  getChipState(chipId: number): PsgChipState {
    return this._chips[chipId & 0x03].getPsgData();
  }

  /**
   * Gets the state of the currently selected chip
   */
  getSelectedChipState(): PsgChipState {
    return this._chips[this._selectedChip].getPsgData();
  }

  /**
   * Generates the next output value for a specific chip
   * @param chipId The chip ID (0-2)
   */
  generateChipOutputValue(chipId: number): void {
    this._chips[chipId & 0x03].generateOutputValue();
  }

  /**
   * Generates the next output value for all chips
   */
  generateAllOutputValues(): void {
    this._chips.forEach((chip) => chip.generateOutputValue());
  }

  /**
   * Gets the orphan samples for a specific chip
   * @param chipId The chip ID (0-2)
   */
  getChipOrphanSamples(chipId: number): {
    sum: number;
    count: number;
  } {
    const chip = this._chips[chipId & 0x03];
    return {
      sum: chip.orphanSum,
      count: chip.orphanSamples,
    };
  }

  /**
   * Clears the orphan samples for a specific chip
   * @param chipId The chip ID (0-2)
   */
  clearChipOrphanSamples(chipId: number): void {
    const chip = this._chips[chipId & 0x03];
    chip.orphanSum = 0;
    chip.orphanSamples = 0;
  }

  /**
   * Clears orphan samples for all chips
   */
  clearAllOrphanSamples(): void {
    this._chips.forEach((chip) => {
      chip.orphanSum = 0;
      chip.orphanSamples = 0;
    });
  }
}
