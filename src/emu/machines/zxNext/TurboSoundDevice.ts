import type { PsgChipState } from "@emu/abstractions/PsgChipState";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { PsgChip } from "@emu/machines/zxSpectrum128/PsgChip";

export type TurboSoundFrameAudioDiagnostics = {
  sampleCount: number;
  nonZeroSamples: number;
  peakLeft: number;
  peakRight: number;
};

/**
 * Turbo Sound Next - Manages 3 AY-3-8912 PSG Chips with Stereo Panning and Mixing
 *
 * ## Purpose
 * Extends single PSG with three independent chips for enhanced sound capabilities:
 * - 9 total tone channels (3 per chip × 3 chips)
 * - 3 independent noise generators
 * - 3 independent envelope generators
 * - Per-chip stereo panning (muted, left, right, stereo)
 * - Global stereo mode selection (ABC vs ACB)
 * - Per-chip mono mode option
 *
 * ## Chip Selection (Port 0xFFFD)
 * Format: OUT 0xFFFD, A
 * - If bits 7:5 = 0, selects register in active chip
 * - If bit 7=1 AND bits 4:2=111, controls chip selection and panning
 *   - Bits 1:0 = active chip (11=0, 10=1, 01=2, 00=reserved)
 *   - Bits 6:5 = panning (00=muted, 01=right, 10=left, 11=stereo)
 *
 * ## Stereo Modes (Global Setting)
 * - ABC mode (ayStereoMode=false, default):
 *   - Left output = Channel A + Channel B (from all chips)
 *   - Right output = Channel B + Channel C (from all chips)
 * - ACB mode (ayStereoMode=true):
 *   - Left output = Channel A + Channel C (from all chips)
 *   - Right output = Channel B + Channel C (from all chips)
 * 
 * Note: Channel B is always mixed into the right output in both modes.
 * Channel C is also always mixed into the right output in both modes.
 *
 * ## Mono Mode (Per-Chip)
 * When enabled for a chip:
 *   - All channels (A, B, C) are combined
 *   - Output is duplicated to both left and right channels
 *   - Panning still applies to the combined output
 *
 * ## Output Mixing
 * Each chip produces stereo output based on:
 * 1. Individual channel levels (from PSG registers 8-10)
 * 2. Global stereo mode (ABC vs ACB)
 * 3. Per-chip mono mode (if enabled)
 * 4. Per-chip panning (muted, left, right, stereo)
 *
 * Total left output = Sum of all left contributions with panning applied
 * Total right output = Sum of all right contributions with panning applied
 *
 * ## Performance
 * - ~100ms per 500 iterations (Step 18 benchmarked)
 * - Real-time capable at 50Hz with margin
 *
 * ## References
 * - See AUDIO_ARCHITECTURE.md for complete system design
 * - See PORT_MAPPINGS.md for I/O port details (0xFFFD, 0xBFFD)
 * - See PsgChip class for individual chip register details
 */
export class TurboSoundDevice {
  // --- The three PSG chips
  private readonly _chips: PsgChip[] = [
    new PsgChip(0, 'YM'), // ZX Next uses YM2149
    new PsgChip(1, 'YM'),
    new PsgChip(2, 'YM'),
  ];

  // --- Currently selected chip (0, 1, or 2)
  private _selectedChip = 0;

  // --- Turbosound enable (FPGA turbosound_en_i): gates chip selection and per-chip audio output
  enableTurbosound = false;

  // --- Panning for each chip: bits [1:0] = left, [3:2] = right
  // --- Bit layout: [unused, right_enable, unused, left_enable]
  // --- 00 = muted, 01 = right only, 10 = left only, 11 = stereo
  private readonly _chipPanning = [0x3, 0x3, 0x3]; // All stereo by default (11)

  // --- AY stereo mode: false = ABC, true = ACB
  private _ayStereoMode = false;

  // --- Mono mode per chip
  private readonly _chipMonoMode = [false, false, false];

  // --- Audio sampling controls
  // Sample length and comparison are in the 28 MHz frameTacts domain
  private _audioSampleRate = 0;
  private _audioSampleLength = 0;
  private _audioNextSampleTact = 0;
  private readonly _audioSamples: AudioSample[] = [];
  
  // --- PSG clock tracking (PSG runs at baseClockFrequency / 2 = 1.75 MHz)
  // --- But generateOutputValue() should be called at 1.75 MHz / 8 due to internal ÷8 prescaler.
  // --- Timing is tracked in the fixed 28 MHz frame-tact domain so CPU speed changes do not shift pitch.
  private _psgClockDivisor = 128; // 28 MHz / 128 = 1.75 MHz / 8 PSG output steps
  private _psgNextClockFrameTact = this._psgClockDivisor;
  private _psgLastAccumulationFrameTact = 0;
  private _psgCurrentLeft = 0;
  private _psgCurrentRight = 0;
  private _psgAccumulatedLeft = 0;
  private _psgAccumulatedRight = 0;
  private _psgAccumulatedTacts = 0;

  /**
   * Initialize the Turbo Sound device
   * @param audioSampleRate Audio sample rate (default 48,000 Hz)
   */
  constructor(audioSampleRate: number = 48_000) {
    this.setAudioSampleRate(audioSampleRate);
    this.reset();
  }

  /**
   * Set the mixer device reference for diagnostic capture
   */
  /**
   * Sets up the sample rate to use with this device.
   * Sample length is in 28 MHz ticks (frameTacts domain).
   * @param sampleRate Audio sample rate
   */
  setAudioSampleRate(sampleRate: number): void {
    this._audioSampleRate = sampleRate;
    this._audioSampleLength = 28_000_000 / sampleRate;
    this._audioNextSampleTact = this._audioSampleLength;
  }

  /**
   * Gets the audio sample rate
   */
  getAudioSampleRate(): number {
    return this._audioSampleRate;
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
    this._audioNextSampleTact = this._audioSampleLength;
    this._audioSamples.length = 0;
    this.resetPsgAudioWindow();
    this.refreshCurrentStereoOutput();
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
    this.refreshCurrentStereoOutput();
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
    this.refreshCurrentStereoOutput();
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
      // FPGA turbosound.vhd: chip select gated by turbosound_en_i='1'
      if (this.enableTurbosound) {
        const chipSelect = value & 0x03;

        // Map chip selection to chip ID (FPGA): "10"→1, "01"→2, others→0
        if (chipSelect === 0x2) {
          this._selectedChip = 1;
        } else if (chipSelect === 0x1) {
          this._selectedChip = 2;
        } else {
          this._selectedChip = 0; // "11" or "00" → chip 0
        }

        // Panning control in bits 6:5 (extract and shift to bits 1:0)
        const panning = (value >> 5) & 0x03;
        this._chipPanning[this._selectedChip] = panning;
        this.refreshCurrentStereoOutput();
      }
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
    this.refreshCurrentStereoOutput();
  }

  /**
   * Generates the next output value for all chips
   */
  generateAllOutputValues(): void {
    this._chips.forEach((chip) => chip.generateOutputValue());
    this.refreshCurrentStereoOutput();
  }

  private resetPsgAudioWindow(): void {
    this._psgNextClockFrameTact = this._psgClockDivisor;
    this._psgLastAccumulationFrameTact = 0;
    this._psgAccumulatedLeft = 0;
    this._psgAccumulatedRight = 0;
    this._psgAccumulatedTacts = 0;
  }

  private refreshCurrentStereoOutput(): void {
    let totalLeft = 0;
    let totalRight = 0;

    for (let i = 0; i < 3; i++) {
      if (this.enableTurbosound || i === this._selectedChip) {
        const output = this.getChipStereoOutput(i, false);
        totalLeft += output.left;
        totalRight += output.right;
      }
    }

    this._psgCurrentLeft = totalLeft;
    this._psgCurrentRight = totalRight;
  }

  private accumulateCurrentOutputUntil(frameTact28: number): void {
    if (frameTact28 <= this._psgLastAccumulationFrameTact) {
      return;
    }

    const duration = frameTact28 - this._psgLastAccumulationFrameTact;
    this._psgAccumulatedLeft += this._psgCurrentLeft * duration;
    this._psgAccumulatedRight += this._psgCurrentRight * duration;
    this._psgAccumulatedTacts += duration;
    this._psgLastAccumulationFrameTact = frameTact28;
  }

  private advancePsgToFrameTact(frameTact28: number): void {
    if (frameTact28 < this._psgLastAccumulationFrameTact) {
      this.resetPsgAudioWindow();
    }

    while (this._psgNextClockFrameTact <= frameTact28) {
      this.accumulateCurrentOutputUntil(this._psgNextClockFrameTact);
      this.generateAllOutputValues();
      this._psgNextClockFrameTact += this._psgClockDivisor;
    }

    this.accumulateCurrentOutputUntil(frameTact28);
  }

  /**
   * Gets the stereo output for a specific chip
   * Applies stereo mode (ABC/ACB), mono mode, and panning settings
   * @param chipId The chip ID (0-2)
   * @returns Object with left and right channel samples (UNSIGNED 0-196605), with panning applied
   */
  getChipStereoOutput(chipId: number, resetOrphans = true): { left: number; right: number } {
    const id = chipId & 0x03;
    const chip = this._chips[id];
    const panning = this._chipPanning[id];

    // Use INSTANTANEOUS UNSIGNED values (matching VHDL hardware)
    // Hardware: tone bit HIGH = amplitude, LOW = 0 (DC-biased square wave)
    let volA = chip.currentOutputA;  // 0-65535
    let volB = chip.currentOutputB;  // 0-65535
    let volC = chip.currentOutputC;  // 0-65535

    if (resetOrphans) {
      chip.orphanSum = 0;
      chip.orphanSumA = 0;
      chip.orphanSumB = 0;
      chip.orphanSumC = 0;
      chip.orphanSamples = 0;
    }

    let left = 0;
    let right = 0;

    if (this._chipMonoMode[id]) {
      // Mono mode: all channels to both left and right
      // FPGA: L = R = A + B + C
      const mono = volA + volB + volC;
      left = mono;
      right = mono;
    } else {
      // Stereo mode matching FPGA turbosound.vhd mixing formulas.
      // FPGA uses full-addition (no halving of center channel).
      if (this._ayStereoMode) {
        // ACB mode (stereo_mode_i='1'): L = A + C, R = B + C
        left  = volA + volC;
        right = volB + volC;
      } else {
        // ABC mode (stereo_mode_i='0'): L = A + B, R = B + C
        left  = volA + volB;
        right = volB + volC;
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
    this.refreshCurrentStereoOutput();
  }

  /**
   * Selects a register on the currently selected chip (for port handler use)
   * @param registerIndex The register index (0-15 for AY)
   */
  selectRegister(registerIndex: number): void {
    this._chips[this._selectedChip].setPsgRegisterIndex(registerIndex & 0x1f); // 5-bit (FPGA)
  }

  /**
   * Sets the panning for the currently selected chip (for port handler use)
   * @param chipId The chip ID (0-2)
   * @param panControl Panning control value (0-3: muted, right, left, stereo)
   */
  setChipPanning(chipId: number, panControl: number): void {
    const id = chipId & 0x03;
    this._chipPanning[id] = panControl & 0x03;
    this.refreshCurrentStereoOutput();
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
      audioNextSampleTact: this._audioNextSampleTact,
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
    this._audioNextSampleTact = state.audioNextSampleTact ?? this._audioSampleLength;
    
    if (state.chipStates) {
      for (let i = 0; i < 3; i++) {
        if (state.chipStates[i]) {
          this._chips[i].setState(state.chipStates[i]);
        }
      }
    }
    this.resetPsgAudioWindow();
    this.refreshCurrentStereoOutput();
  }

  /**
   * Gets debug information about the TurboSound device
   */
  getDebugInfo(): any {
    return {
      selectedChip: this._selectedChip,
      ayStereoMode: this._ayStereoMode ? "ACB" : "ABC",
      chips: [
        {
          chipId: 0,
          panning: this._chipPanning[0],
          monoMode: this._chipMonoMode[0],
          debug: this._chips[0].getDebugInfo()
        },
        {
          chipId: 1,
          panning: this._chipPanning[1],
          monoMode: this._chipMonoMode[1],
          debug: this._chips[1].getDebugInfo()
        },
        {
          chipId: 2,
          panning: this._chipPanning[2],
          monoMode: this._chipMonoMode[2],
          debug: this._chips[2].getDebugInfo()
        }
      ]
    };
  }

  /**
   * Gets debug information about a specific chip
   * @param chipId The chip ID (0-2)
   */
  getChipDebugInfo(chipId: number): any {
    const id = chipId & 0x03;
    return {
      chipId: id,
      panning: this._chipPanning[id],
      monoMode: this._chipMonoMode[id],
      debug: this._chips[id].getDebugInfo()
    };
  }

  // --- AudioSample stub methods for integration with ZxNextMachine ---

  /**
   * Called at the start of each frame to clear samples
   */
  onNewFrame(): void {
    // Clear frame samples for new frame
    this._audioSamples.length = 0;
    this._audioNextSampleTact = this._audioSampleLength;
    this.resetPsgAudioWindow();
    this.refreshCurrentStereoOutput();
  }

  /**
   * Calculate current audio value (called after instruction executed)
   * Advances PSG chips by the correct number of tacts since last call
   * PSG generateOutputValue() called at CPU clock / 16 (accounts for ÷2 for 1.75MHz + ÷8 internal prescaler)
   */
  calculateCurrentAudioValue(currentFrameTact28: number): void {
    this.advancePsgToFrameTact(currentFrameTact28);
  }

  /**
   * Generate next audio sample (called on tact incremented)
   * Follows BeeperDevice pattern: generates samples at fixed intervals
   * accounting for clock multiplier changes
   * Emits all samples whose 28 MHz frame-clock boundaries have been crossed.
   */
  setNextAudioSample(frameTacts28: number): void {
    while (frameTacts28 >= this._audioNextSampleTact) {
      this.advancePsgToFrameTact(this._audioNextSampleTact);

      const sample = this._psgAccumulatedTacts > 0
        ? {
          left: this._psgAccumulatedLeft / this._psgAccumulatedTacts,
          right: this._psgAccumulatedRight / this._psgAccumulatedTacts
        }
        : { left: this._psgCurrentLeft, right: this._psgCurrentRight };
      this._audioSamples.push(sample);

      this._psgAccumulatedLeft = 0;
      this._psgAccumulatedRight = 0;
      this._psgAccumulatedTacts = 0;
      this._audioNextSampleTact += this._audioSampleLength;
    }
  }

  /**
   * Get audio samples for current frame (for integration)
   */
  getAudioSamples(): AudioSample[] {
    return this._audioSamples;
  }

  /**
   * Gets per-frame raw AY/TurboSound sample diagnostics before the audio mixer.
   */
  getFrameAudioDiagnostics(): TurboSoundFrameAudioDiagnostics {
    let nonZeroSamples = 0;
    let peakLeft = 0;
    let peakRight = 0;

    for (const sample of this._audioSamples) {
      if (sample.left !== 0 || sample.right !== 0) {
        nonZeroSamples++;
      }
      peakLeft = Math.max(peakLeft, Math.abs(sample.left));
      peakRight = Math.max(peakRight, Math.abs(sample.right));
    }

    return {
      sampleCount: this._audioSamples.length,
      nonZeroSamples,
      peakLeft,
      peakRight
    };
  }
}
