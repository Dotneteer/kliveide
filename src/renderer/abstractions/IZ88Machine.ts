import { IZ80Machine } from "./IZ80Machine";
import { IZ88KeyboardDevice } from "@emu/machines/z88/IZ88KeyboardDevice";
import { IZ88ScreenDevice } from "@emu/machines/z88/IZ88ScreenDevice";
import { IZ88BeeperDevice } from "@emu/machines/z88/IZ88BeeperDevice";
import { IZ88BlinkDevice } from "@emu/machines/z88/IZ88BlinkDevice";
import { PagedMemory } from "@emu/machines/memory/PagedMemory";
import { Z88BankedMemory } from "@emu/machines/z88/memory/Z88BankedMemory";

/**
 * This interface defines the behavior of a Cambridge Z88 virtual machine that integrates the emulator
 */
export interface IZ88Machine extends IZ80Machine {
  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId(): string;

  /**
   * (Z88) The physical memory of the machine
   */
  readonly memory: Z88BankedMemory;

  /**
   * Represents the Blink device of Z88
   */
  blinkDevice: IZ88BlinkDevice;

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
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples(): number[];

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized(): boolean;

  /**
   * Indicates if Z88 is in sleep mode
   */
  isInSleepMode: boolean;

  /**
   * Reads the memory directly from the physical memory
   * @param absAddress Absolute memory address
   */
  directReadMemory(absAddress: number): number;
}