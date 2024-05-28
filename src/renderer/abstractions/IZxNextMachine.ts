import { CopperDevice } from "@emu/machines/zxNext/CopperDevice";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { Layer2Device } from "@emu/machines/zxNext/Layer2Device";
import { NextRegDevice } from "@emu/machines/zxNext/NextRegDevice";
import { PaletteDevice } from "@emu/machines/zxNext/PaletteDevice";
import { SpriteDevice } from "@emu/machines/zxNext/sprites/SpriteDevice";
import { TilemapDevice } from "@emu/machines/zxNext/TilemapDevice";
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

  nextRegDevice: NextRegDevice;

  layer2Device: Layer2Device;

  paletteDevice: PaletteDevice;

  tilemapDevice: TilemapDevice;

  spriteDevice: SpriteDevice;

  dmaDevice: DmaDevice;

  copperDevice: CopperDevice;
}
