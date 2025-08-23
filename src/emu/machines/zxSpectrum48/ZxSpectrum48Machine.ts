import type { SysVar } from "@abstractions/SysVar";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { MachineModel } from "@common/machines/info-types";

import { SysVarType } from "@abstractions/SysVar";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { AUDIO_SAMPLE_RATE, REWIND_REQUESTED, TAPE_MODE, TAPE_SAVER } from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import { SP48_MAIN_ENTRY, ZxSpectrumBase } from "../ZxSpectrumBase";
import { ZxSpectrum48FloatingBusDevice } from "./ZxSpectrum48FloatingBusDevice";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { MC_MEM_SIZE, MC_SCREEN_FREQ } from "@common/machines/constants";
import { zxSpectrum48SysVars } from "./ZxSpectrum48SysVars";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrum48Machine extends ZxSpectrumBase {
  // --- This byte array represents the 64K memory, including the 16K ROM and 48K RAM.
  private readonly _memory = new Uint8Array(0x1_0000);
  private readonly _is16KModel: boolean;

  /**
   * The unique identifier of the machine type
   */
  public readonly machineId = "sp48";

  /**
   * Initialize the machine
   */
  constructor(public readonly modelInfo?: MachineModel) {
    super();

    // --- Set up machine attributes
    this._is16KModel = modelInfo?.config?.[MC_MEM_SIZE] === 16;
    const isNtsc = modelInfo?.config?.[MC_SCREEN_FREQ] === "ntsc";
    this.baseClockFrequency = isNtsc ? 3_527_500 : 3_500_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;

    // --- Create and initialize devices
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(
      this,
      isNtsc
        ? CommonScreenDevice.ZxSpectrum48NtscScreenConfiguration
        : CommonScreenDevice.ZxSpectrum48PalScreenConfiguration
    );
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.floatingBusDevice = new ZxSpectrum48FloatingBusDevice(this);
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  /**
   * Sets up the machine (async)
   */
  async setup(): Promise<void> {
    // --- Get the ROM file
    const romContents = await this.loadRomFromResource(this.romId);

    // --- Initialize the machine's ROM (roms/sp48.rom)
    this.uploadRomBytes(romContents);
  }

  /**
   * Dispose the resources held by the machine
   */
  dispose(): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
    this.floatingBusDevice?.dispose();
    this.tapeDevice?.dispose();
  }

  /**
   * Gets the ULA issue number of the ZX Spectrum model (2 or 3)
   */
  ulaIssue = 3;

  /**
   * Emulates turning on a machine (after it has been turned off).
   */
  hardReset(): void {
    super.hardReset();
    for (let i = 0x4000; i < this._memory.length; i++) this._memory[i] = 0;
    if (this._is16KModel) {
      for (let i = 0x8000; i < this._memory.length; i++) this._memory[i] = 0xff;
    }
    this.reset();
  }

  /**
   * This method emulates resetting a machine with a hardware reset button.
   */
  reset(): void {
    // --- Reset the CPU
    super.reset();

    // --- Reset and setup devices
    this.keyboardDevice.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);
    }
    this.floatingBusDevice.reset();
    this.tapeDevice.reset();

    // --- Set default property values
    this.setMachineProperty(TAPE_MODE, TapeMode.Passive);
    this.setMachineProperty(TAPE_SAVER, new TapeSaver(this.tapeDevice as TapeDevice));
    this.setMachineProperty(REWIND_REQUESTED);

    // --- Prepare for running a new machine loop
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;
    this.lastRenderedFrameTact = 0;

    // --- Empty the queue of emulated keystrokes
    this.emulatedKeyStrokes.length = 0;
  }

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number {
    return this._memory[0x4000 + (offset & 0x3fff)];
  }

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory(): Uint8Array {
    return this._memory;
  }

  /**
   * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
   * @param _index Partition index
   */
  getMemoryPartition(_index: number): Uint8Array {
    return new Uint8Array(0x4000);
  }

  /**
   * Gets the current partition values for all 16K/8K partitions
   */
  getCurrentPartitions(): number[] {
    return [];
  }

  /**
   * Gets the current partition labels for all 16K/8K partitions
   */
  getCurrentPartitionLabels(): string[] {
    return [];
  }

  /**
   * Parses a partition label to get the partition number
   * @param _label Label to parse
   */
  parsePartitionLabel(_label: string): number | undefined {
    return undefined;
  }

  /**
   * Gets the label of the specified partition
   * @param partition Partition index
   */
  getPartitionLabels(): Record<number, string> {
    return {};
  }

  /**
   * Gets a flag for each 8K page that indicates if the page is a ROM
   */
  getRomFlags(): boolean[] {
    return [true, true, false, false, false, false, false, false];
  }

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples(): number[] {
    return this.beeperDevice.getAudioSamples();
  }

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine(): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * Read the byte at the specified memory address.
   * @param address 16-bit memory address
   * @returns The byte read from the memory
   */
  doReadMemory(address: number): number {
    return this._memory[address];
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory(address: number, value: number): void {
    const slot = address >>> 14;
    if ((this._is16KModel && slot === 1) || (!this._is16KModel && slot !== 0)) {
      this._memory[address] = value;
    }
  }

  /**
   * This function reads a byte (8-bit) from an I/O port using the provided 16-bit address.
   * @param address
   * @returns Byte read from the specified port
   *
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port read operation.
   */
  doReadPort(address: number): number {
    return (address & 0x0001) == 0
      ? this.readPort0Xfe(address)
      : this.floatingBusDevice.readFloatingBus();
  }

  /**
   * This function implements the I/O port read delay of the CPU.
   * @param address Port address
   *
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortRead(address: number): void {
    this.delayContendedIo(address);
  }

  /**
   * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
   * @param address Port address
   * @param value Value to send to the port
   *
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port write operation.
   */
  doWritePort(address: number, value: number): void {
    if ((address & 0x0001) === 0) {
      this.writePort0xFE(value);
    }
  }

  /**
   * This function implements the I/O port write delay of the CPU.
   * @param address Port address
   */
  delayPortWrite(address: number): void {
    this.delayContendedIo(address);
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels(): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels(): number {
    return this.screenDevice.screenLines;
  }

  /**
   * Gets the buffer that stores the rendered pixels
   */
  getPixelBuffer(): Uint32Array {
    return this.screenDevice.getPixelBuffer();
  }

  /**
   * Uploades the specified ROM information to the ZX Spectrum 48 ROM memory
   * @param data ROM contents
   */
  uploadRomBytes(data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this._memory[i] = data[i];
    }
  }

  /**
   * Gets the main execution point information of the machine
   * @param model Machine model to use for code execution
   */
  getCodeInjectionFlow(model: string): CodeInjectionFlow {
    if (model === "sp48") {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SP48_MAIN_ENTRY,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SP48_MAIN_ENTRY)})`
        },
        {
          type: "Inject"
        },
        {
          type: "SetReturn",
          returnPoint: SP48_MAIN_ENTRY
        }
      ];
    }
    throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[] {
    return zxSpectrum48SysVars;
  }
}
