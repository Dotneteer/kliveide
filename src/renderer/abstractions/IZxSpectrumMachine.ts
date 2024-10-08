import type { SysVar } from "@abstractions/SysVar";

import type { ISpectrumBeeperDevice } from "@emu/machines/zxSpectrum/ISpectrumBeeperDevice";
import type { IFloatingBusDevice } from "@emu/abstractions/IFloatingBusDevice";
import type { ISpectrumKeyboardDevice } from "@emu/machines/zxSpectrum/ISpectrumKeyboardDevice";
import type { IScreenDevice } from "@emu/abstractions/IScreenDevice";
import type { ITapeDevice } from "@emu/abstractions/ITapeDevice";
import type { IZ80Machine } from "@renderer/abstractions/IZ80Machine";

/**
 * This interface defines the behavior of a ZX Spectrum 48K virtual machine that integrates the emulator built from
 * the standard components of a ZX Spectrum.
 */
export interface IZxSpectrumMachine extends IZ80Machine {
  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId(): string;

  /**
   * Gets the ULA issue number of the ZX Spectrum model (2 or 3)
   */
  ulaIssue: number;

  /**
   * This method sets the contention value associated with the specified machine frame tact.
   * @param tact Machine frame tact
   * @param value Contention value
   */
  setContentionValue(tact: number, value: number): void;

  /**
   * This method gets the contention value for the specified machine frame tact.
   * @param tact Machine frame tact
   * @returns The contention value associated with the specified tact.
   */
  getContentionValue(tact: number): number;

  /**
   * Represents the keyboard device of ZX Spectrum 48K
   */
  keyboardDevice: ISpectrumKeyboardDevice;

  /**
   * Represents the screen device of ZX Spectrum 48K
   */
  screenDevice: IScreenDevice;

  /**
   * Represents the beeper device of ZX Spectrum 48K
   */
  beeperDevice: ISpectrumBeeperDevice;

  /**
   * Represents the floating port device of ZX Spectrum 48K
   */
  floatingBusDevice: IFloatingBusDevice;

  /**
   * Represents the tape device of ZX Spectrum 48K
   */
  tapeDevice: ITapeDevice;

  /**
   * Indicates if the currently selected ROM is the ZX Spectrum 48 ROM
   */
  isSpectrum48RomSelected: boolean;

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number;

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples(): number[];

  /**
   * Gets the current cursor mode
   */
  getCursorMode(): number;

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[];
}
