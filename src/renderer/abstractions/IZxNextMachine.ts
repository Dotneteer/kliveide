import { CopperDevice } from "@emu/machines/zxNext/CopperDevice";
import { DivMmcDevice } from "@emu/machines/zxNext/DivMmcDevice";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { InterruptDevice } from "@emu/machines/zxNext/InterruptDevice";
import { NextIoPortManager } from "@emu/machines/zxNext/io-ports/NextIoPortManager";
import { JoystickDevice } from "@emu/machines/zxNext/JoystickDevice";
import { MemoryDevice } from "@emu/machines/zxNext/MemoryDevice";
import { SdCardDevice } from "@emu/machines/zxNext/SdCardDevice";
import { MouseDevice } from "@emu/machines/zxNext/MouseDevice";
import { NextKeyboardDevice } from "@emu/machines/zxNext/NextKeyboardDevice";
import { NextRegDevice } from "@emu/machines/zxNext/NextRegDevice";
import { NextSoundDevice } from "@emu/machines/zxNext/NextSoundDevice";
import { PaletteDevice } from "@emu/machines/zxNext/PaletteDevice";
import { SpriteDevice } from "@emu/machines/zxNext/SpriteDevice";
import { TilemapDevice } from "@emu/machines/zxNext/TilemapDevice";
import { UlaDevice } from "@emu/machines/zxNext/UlaDevice";
import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";
import { CpuSpeedDevice } from "@emu/machines/zxNext/CpuSpeedDevice";
import { ExpansionBusDevice } from "@emu/machines/zxNext/ExpansionBusDevice";
import { NextComposedScreenDevice } from "@emu/machines/zxNext/screen/NextComposedScreenDevice";

/**
 * This interface defines the behavior of a ZX Spectrum 48K virtual machine that integrates the emulator built from
 * the standard components of a ZX Spectrum.
 */
export interface IZxNextMachine extends IZ80Machine {
  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId(): string;

  cpuSpeedDevice: CpuSpeedDevice;

  portManager: NextIoPortManager;

  memoryDevice: MemoryDevice;

  interruptDevice: InterruptDevice;

  nextRegDevice: NextRegDevice;

  divMmcDevice: DivMmcDevice;

  sdCardDevice: SdCardDevice;

  paletteDevice: PaletteDevice;

  tilemapDevice: TilemapDevice;

  spriteDevice: SpriteDevice;

  dmaDevice: DmaDevice;

  copperDevice: CopperDevice;

  composedScreenDevice: NextComposedScreenDevice;

  keyboardDevice: NextKeyboardDevice

  mouseDevice: MouseDevice;

  joystickDevice: JoystickDevice;

  soundDevice: NextSoundDevice;

  ulaDevice: UlaDevice;

  expansionBusDevice: ExpansionBusDevice;

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number;
}
