import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";

/**
 * This interface defines the behavior of a ZX Spectrum 48K virtual machine that integrates the emulator built from
 * the standard components of a ZX Spectrum.
 */
export interface IZxNextMachine extends IZ80Machine {
  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId(): string;
}
