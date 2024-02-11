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
   * The physical memory of the machine
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

  /**
   * The Blink only fires an IM 1 interrupt when the flap is opened and when
   * INT.FLAP is enabled. Both STA.FLAPOPEN and STA.FLAP is set at the time of
   * the interrupt. As long as the flap is open, no STA.TIME interrupts gets
   * out of the Blink (even though INT.TIME may be enabled and signals it to
   * fire those RTC interrupts). The Flap interrupt is only fired once; when
   * the flap is closed, and then opened. STA.FLAPOPEN remains enabled as long
   * as the flap is open; when the flap is closed, NO interrupt is fired -
   * only STA.FLAPOPEN is set to 0.
   */
  signalFlapOpened(): void;

  /**
   * Signal that the flap was closed.<p> The Blink will start to fire STA.TIME
   * interrupts again if the INT.TIME is enabled and TMK has been setup to
   * fire Minute, Second or TICK's.
   *
   * This is not an interrupt (but Z80 goes out of snooze), only the STA.FLAPOPEN bit set to 0
   */
  signalFlapClosed(): void;
}
