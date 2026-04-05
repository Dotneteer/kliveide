import { CopperDevice } from "@emu/machines/zxNext/CopperDevice";
import { CtcDevice } from "@emu/machines/zxNext/CtcDevice";
import { I2cDevice } from "@emu/machines/zxNext/I2cDevice";
import { UartDevice } from "@emu/machines/zxNext/UartDevice";
import { DivMmcDevice } from "@emu/machines/zxNext/DivMmcDevice";
import { MultifaceDevice } from "@emu/machines/zxNext/MultifaceDevice";
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
import type { ISpectrumBeeperDevice } from "@emu/machines/zxSpectrum/ISpectrumBeeperDevice";
import type { AudioControlDevice } from "@emu/machines/zxNext/AudioControlDevice";
import type { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";

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

  multifaceDevice: MultifaceDevice;

  sdCardDevice: SdCardDevice;

  paletteDevice: PaletteDevice;

  tilemapDevice: TilemapDevice;

  spriteDevice: SpriteDevice;

  dmaDevice: DmaDevice;

  copperDevice: CopperDevice;

  ctcDevice: CtcDevice;

  i2cDevice: I2cDevice;

  uartDevice: UartDevice;

  composedScreenDevice: NextComposedScreenDevice;

  keyboardDevice: NextKeyboardDevice

  mouseDevice: MouseDevice;

  joystickDevice: JoystickDevice;

  soundDevice: NextSoundDevice;

  ulaDevice: UlaDevice;

  beeperDevice: ISpectrumBeeperDevice;

  audioControlDevice: AudioControlDevice;

  expansionBusDevice: ExpansionBusDevice;

  floppyDevice: IFloppyControllerDevice;

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number;

  /**
   * Requests a Multiface NMI from the software path (nextreg 0x02 bit 3).
   * Accepted only when nmiAcceptCause is true.
   */
  requestMfNmiFromSoftware(): void;

  /**
   * Requests a DivMMC NMI from the software path (nextreg 0x02 bit 2).
   * Accepted only when nmiAcceptCause is true.
   */
  requestDivMmcNmiFromSoftware(): void;

  /**
   * Called when config mode is entered (nextreg 0x03 = 0x07). Clears all
   * pending NMI state to prevent stale NMIs from firing during config mode.
   */
  onConfigModeEntered(): void;
}
