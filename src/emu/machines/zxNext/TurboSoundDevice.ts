import type { PsgChipState } from "@emu/abstractions/PsgChipState";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

/**
 * Turbo Sound Next - manages 3 AY-3-8912 PSG chips
 *
 * Chip Selection via port 0xFFFD:
 * - If bits 7:5 = 0, selects register in active chip
 * - If bit 7=1 AND bits 4:2=111, controls chip selection and panning
 *   - Bits 1:0 = active chip (11=0, 10=1, 01=2, 00=reserved)
 *   - Bits 6:5 = panning (00=muted, 01=right, 10=left, 11=stereo)
 *
 * Stereo modes (global):
 * - ABC: A+B=Left, C=Right (default)
 * - ACB: A+C=Left, B=Right (when ayStereoMode=true)
 *
 * Mono mode (per chip):
 * - Disabled: stereo output per mode
 * - Enabled: all channels mixed to both left and right (mono output)
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

  // --- AY stereo mode: false = ABC, true = ACB
  private _ayStereoMode = false;

  // --- Mono mode per chip
  private readonly _chipMonoMode = [false, false, false];

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
    this._ayStereoMode = false; // ABC mode
    this._chipMonoMode[0] = false;
    this._chipMonoMode[1] = false;
    this._chipMonoMode[2] = false;
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
   * Gets the AY stereo mode
   * @returns false = ABC mode, true = ACB mode
   */
  getAyStereoMode(): boolean {
    return this._ayStereoMode;
  }

  /**
   * Sets the AY stereo mode
   * @param mode false = ABC mode, true = ACB mode
   */
  setAyStereoMode(mode: boolean): void {
    this._ayStereoMode = mode;
  }

  /**
   * Gets the mono mode for a specific chip
   * @param chipId The chip ID (0-2)
   * @returns true if mono mode, false if stereo mode
   */
  getChipMonoMode(chipId: number): boolean {
    const id = chipId & 0x03;
    return this._chipMonoMode[id];
  }

  /**
   * Sets the mono mode for a specific chip
   * @param chipId The chip ID (0-2)
   * @param mode true for mono, false for stereo
   */
  setChipMonoMode(chipId: number, mode: boolean): void {
    const id = chipId & 0x03;
    this._chipMonoMode[id] = mode;
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
   * Gets the stereo output for a specific chip
   * Applies stereo mode (ABC/ACB), mono mode, and panning settings
   * @param chipId The chip ID (0-2)
   * @returns Object with left and right channel samples (0-65535), with panning applied
   */
  getChipStereoOutput(chipId: number): { left: number; right: number } {
    const id = chipId & 0x03;
    const chip = this._chips[id];
    const panning = this._chipPanning[id];

    // Get the current volume for each channel
    const volA = chip.getChannelAVolume();
    const volB = chip.getChannelBVolume();
    const volC = chip.getChannelCVolume();

    let left = 0;
    let right = 0;

    if (this._chipMonoMode[id]) {
      // Mono mode: all channels to both left and right
      // Total = A + B + C for both channels
      const mono = Math.min(65535, volA + volB + volC);
      left = mono;
      right = mono;
    } else {
      // Stereo mode
      if (this._ayStereoMode) {
        // ACB mode: Left = A + C, Right = B
        left = Math.min(65535, volA + volC);
        right = volB;
      } else {
        // ABC mode: Left = A + B, Right = C
        left = Math.min(65535, volA + volB);
        right = volC;
      }
    }

    // Apply panning control
    // Panning bits: 00=muted, 01=right only, 10=left only, 11=stereo
    switch (panning) {
      case 0x00: // Muted
        left = 0;
        right = 0;
        break;
      case 0x01: // Right only
        left = 0;
        // right stays as is
        break;
      case 0x02: // Left only
        // left stays as is
        right = 0;
        break;
      case 0x03: // Stereo (default)
        // Both channels pass through
        break;
    }

    return { left, right };
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

  /**
   * Selects a chip by ID (for port handler use)
   * @param chipId The chip ID (0-2)
   */
  selectChip(chipId: number): void {
    this._selectedChip = chipId & 0x03;
  }

  /**
   * Selects a register on the currently selected chip (for port handler use)
   * @param registerIndex The register index (0-15 for AY)
   */
  selectRegister(registerIndex: number): void {
    this._chips[this._selectedChip].setPsgRegisterIndex(registerIndex & 0x0f);
  }

  /**
   * Sets the panning for the currently selected chip (for port handler use)
   * @param chipId The chip ID (0-2)
   * @param panControl Panning control value (0-3: muted, right, left, stereo)
   */
  setChipPanning(chipId: number, panControl: number): void {
    const id = chipId & 0x03;
    this._chipPanning[id] = panControl & 0x03;
  }

  /**
   * Gets the currently selected register index (for port handler use)
   */
  getSelectedRegister(): number {
    return this._chips[this._selectedChip].psgRegisterIndex;
  }

  /**
   * Reads the currently selected register (for port handler use)
   */
  readSelectedRegister(): number {
    return this._chips[this._selectedChip].readPsgRegisterValue();
  }

  /**
   * Writes to the currently selected register (for port handler use)
   */
  writeSelectedRegister(value: number): void {
    this._chips[this._selectedChip].writePsgRegisterValue(value);
  }

  /**
   * Get the device state for persistence
   */
  getState(): any {
    return {
      selectedChip: this._selectedChip,
      chipPanning: [...this._chipPanning],
      ayStereoMode: this._ayStereoMode,
      chipMonoMode: [...this._chipMonoMode],
      chipStates: this._chips.map(chip => chip.getState())
    };
  }

  /**
   * Restore the device state from persisted data
   */
  setState(state: any): void {
    if (!state) return;
    
    this._selectedChip = state.selectedChip ?? 0;
    if (state.chipPanning) {
      this._chipPanning[0] = state.chipPanning[0] ?? 0x3;
      this._chipPanning[1] = state.chipPanning[1] ?? 0x3;
      this._chipPanning[2] = state.chipPanning[2] ?? 0x3;
    }
    this._ayStereoMode = state.ayStereoMode ?? false;
    if (state.chipMonoMode) {
      this._chipMonoMode[0] = state.chipMonoMode[0] ?? false;
      this._chipMonoMode[1] = state.chipMonoMode[1] ?? false;
      this._chipMonoMode[2] = state.chipMonoMode[2] ?? false;
    }
    
    if (state.chipStates) {
      for (let i = 0; i < 3; i++) {
        if (state.chipStates[i]) {
          this._chips[i].setState(state.chipStates[i]);
        }
      }
    }
  }
}

