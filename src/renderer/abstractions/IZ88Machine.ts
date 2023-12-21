import { IZ80Machine } from "./IZ80Machine";
import { IZ88KeyboardDevice } from "@emu/machines/z88/IZ88KeyboardDevice";
import { IZ88ScreenDevice } from "@emu/machines/z88/IZ88ScreenDevice";
import { IZ88BeeperDevice } from "@emu/machines/z88/IZ88BeeperDevice";

/**
 * This interface defines the behavior of a Cambridge Z88 virtual machine that integrates the emulator
 */
export interface IZ88Machine extends IZ80Machine {
  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId(): string;

  /**
   * Represents the keyboard device of Z88
   */
  keyboardDevice: IZ88KeyboardDevice;

  /**
   * Represents the screen device of Z88
   */
  screenDevice: IZ88ScreenDevice;

  /**
   * Represents the beeper device of Z88
   */
  beeperDevice: IZ88BeeperDevice;

  /**
   * Get the 64K of addressable memory of the Z88 computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory(): Uint8Array;

  /**
   * Get the specified 16K partition (page or bank) of the Z88 computer
   * @param index Partition index
   * @returns Bytes of the partition
   */
  get16KPartition(index: number): Uint8Array;

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples(): number[];

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized(): boolean;
}
