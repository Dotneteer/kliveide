import type { IGenericDevice } from "./IGenericDevice";
import type { IZxSpectrumMachine } from "./IZxSpectrumMachine";
import type { TapeMode } from "./TapeMode";

/**
 * This interface defines the properties and operations of the ZX Spectrum's tape device.
 */
export interface ITapeDevice extends IGenericDevice<IZxSpectrumMachine> {
  /**
   * Get the current operation mode of the tape device.
   */
  tapeMode: TapeMode;

  /**
   * This method updates the current tape mode according to the current ROM index and PC value
   */
  updateTapeMode(): void;

  /**
   * This method returns the value of the EAR bit read from the tape.
   */
  getTapeEarBit(): boolean;

  /**
   * The current value of the MIC bit
   */
  micBit: boolean;

  /**
   * Process the specified MIC bit value.
   * @param micBit MIC bit to process
   */
  processMicBit(micBit: boolean): void;
}

export type SavedFileInfo = {
  name: string;
  contents: Uint8Array;
}
