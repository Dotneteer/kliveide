import type { IZ80Machine } from "./IZ80Machine";
import { AudioSample } from "@emu/abstractions/IAudioDevice";

/**
 * This interface defines the behavior of a Cambridge Z88 virtual machine that integrates the
 * emulator, whichever core emulates it. It deliberately exposes no TypeScript device or memory
 * object: a WASM machine has none. The TypeScript devices reach those through `IZ88DeviceHost`, and
 * the IDE reads the Blink state through `IZ88IdeMachine`.
 */
export interface IZ88Machine extends IZ80Machine {
  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples(): AudioSample[];

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
