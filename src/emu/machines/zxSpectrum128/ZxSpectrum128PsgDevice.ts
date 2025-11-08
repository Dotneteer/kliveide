import type { ISpectrumPsgDevice } from "../../machines/zxSpectrum/ISpectrumPsgDevice";
import type { IZxSpectrumMachine } from "@emuabstr/IZxSpectrumMachine";
import type { PsgChipState } from "@emuabstr/PsgChipState";

import { AudioDeviceBase } from "../AudioDeviceBase";
import { PsgChip } from "./PsgChip";

// ---The number of ULA tacts that represent a single PSG clock tick
const PSG_CLOCK_STEP = 16;

export class ZxSpectrum128PsgDevice
  extends AudioDeviceBase<IZxSpectrumMachine>
  implements ISpectrumPsgDevice
{
  // --- The value of the next ULA tact when a PSG output value should be generated
  private _psgNextClockTact: number;

  // --- The PsgChip instance that provides the sound sample calculation
  private readonly _psg: PsgChip;

  /**
   * Initialize the PSG device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZxSpectrumMachine) {
    super(machine);
    this._psg = new PsgChip();

    // --- Set the first tact to create a sample for
    this._psgNextClockTact = PSG_CLOCK_STEP;
  }

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    super.reset();
    this._psg.reset();
  }

  /**
   * Reads the value of the PSG register addressed with the las SetPsgRegisterIndex operation
   */
  public readPsgRegisterValue (): number {
    return this._psg.readPsgRegisterValue();
  }

  /**
   * Writes the value of the PSG register addressed with the las SetPsgRegisterIndex operation
   * @param value Value to set for the PSG register
   * @returns
   */
  writePsgRegisterValue (value: number): void {
    return this._psg.writePsgRegisterValue(value);
  }

  /**
   * Queries the current state of the PSG chip
   */
  getPsgState (): PsgChipState {
    return this._psg.getPsgData();
  }

  /**
   * Sets the PSG register index to read or write
   * @param index PSG register index
   * @returns
   */
  setPsgRegisterIndex (index: number): void {
    return this._psg.setPsgRegisterIndex(index);
  }

  /**
   * Calculates the current audio value according to the CPU's clock
   */
  calculateCurrentAudioValue (): void {
    while (this.machine.currentFrameTact >= this._psgNextClockTact) {
      this._psg.generateOutputValue();
      this._psgNextClockTact += PSG_CLOCK_STEP;
    }
  }

  /**
   * Gets the current sound sample (according to the current CPU tact)
   */
  getCurrentSampleValue (): number {
    let value =
      this._psg.orphanSamples > 0
        ? this._psg.orphanSum / this._psg.orphanSamples / 65535 / 3
        : 0.0;
    this._psg.orphanSum = 0;
    this._psg.orphanSamples = 0;
    return value;
  }

  /**
   * This method signs that a new machine frame has been started
   */
  onNewFrame (): void {
    super.onNewFrame();
    if (this._psgNextClockTact >= this.machine.tactsInFrame) {
      this._psgNextClockTact -= this.machine.tactsInFrame;
    }
  }
}
