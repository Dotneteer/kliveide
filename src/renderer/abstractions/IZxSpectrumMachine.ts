import { IBeeperDevice } from "../../emu/abstractions/IBeeperDevice";
import { IFloatingBusDevice } from "../../emu/abstractions/IFloatingBusDevice";
import { IKeyboardDevice } from "../../emu/abstractions/IKeyboardDevice";
import { IScreenDevice } from "../../emu/abstractions/IScreenDevice";
import { ITapeDevice } from "../../emu/abstractions/ITapeDevice";
import { IZ80Machine } from "@/renderer/abstractions/IZ80Machine";
import { SysVar } from "@abstractions/SysVar";

/**
 * This interface defines the behavior of a ZX Spectrum 48K virtual machine that integrates the emulator built from
 * the standard components of a ZX Spectrum.
 */
export interface IZxSpectrumMachine extends IZ80Machine {
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
  keyboardDevice: IKeyboardDevice;

  /**
   * Represents the screen device of ZX Spectrum 48K
   */
  screenDevice: IScreenDevice;

  /**
   * Represents the beeper device of ZX Spectrum 48K
   */
  beeperDevice: IBeeperDevice;

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
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory(): Uint8Array;

  /**
   * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
   * @param index Partition index
   * @returns Bytes of the partition
   *
   * Less than zero: ROM pages
   * 0..7: RAM bank with the specified index
   */
  get16KPartition(index: number): Uint8Array;

  /**
   * Gets the audio sample rate
   */
  getAudioSampleRate(): number;

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples(): number[];

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized(): boolean;

  /**
   * Gets the current cursor mode
   */
  getCursorMode(): number;

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[];
}
