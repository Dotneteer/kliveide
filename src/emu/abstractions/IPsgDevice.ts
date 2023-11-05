import { PsgChipState } from "@emu/machines/zxSpectrum128/PsgChip";
import { IAudioDevice } from "./IAudioDevice";

/**
 * Represents the AY-3-8910 PSG chip as a device
 */
export interface IPsgDevice extends IAudioDevice {
  /**
   * Sets the PSG register index to read or write
   * @param index PSG register index
   */
  setPsgRegisterIndex(index: number): void;

  /**
   * Reads the value of the PSG register addressed with the las SetPsgRegisterIndex operation
   */
  readPsgRegisterValue(): number;

  /**
   * Writes the value of the PSG register addressed with the las SetPsgRegisterIndex operation
   * @param value Value to set for the PSG register
   */
  writePsgRegisterValue(value: number): void;

  /**
   * Queries the current state of the PSG chip
   */
  getPsgState(): PsgChipState;
}
