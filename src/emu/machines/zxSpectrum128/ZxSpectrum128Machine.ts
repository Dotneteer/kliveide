import type { SysVar } from "@abstractions/SysVar";
import type { ISpectrumPsgDevice } from "@emu/machines/zxSpectrum/ISpectrumPsgDevice";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

import { TapeMode } from "@emu/abstractions/TapeMode";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { AUDIO_SAMPLE_RATE, REWIND_REQUESTED, TAPE_MODE, TAPE_SAVER } from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import {
  SP128_MAIN_WAITING_LOOP,
  SP128_RETURN_TO_EDITOR,
  SP48_MAIN_ENTRY,
  SP_KEY_WAIT,
  ZxSpectrumBase
} from "../ZxSpectrumBase";
import { ZxSpectrum128FloatingBusDevice } from "./ZxSpectrum128FloatingBusDevice";
import { ZxSpectrum128PsgDevice } from "./ZxSpectrum128PsgDevice";
import { PagedMemory } from "../memory/PagedMemory";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { zxSpectrum48SysVars } from "../zxSpectrum48/ZxSpectrum48SysVars";
import { zxSpectrum128SysVars } from "./ZxSpectrum128SysVars";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrum128Machine extends ZxSpectrumBase {
  // --- Memory-related fields
  private memory: PagedMemory;
  private previousRom = 0;
  private previousBank = 0;
  private screenStartOffset = 0;
  selectedRom = 0;
  selectedBank = 0;
  pagingEnabled = true;
  useShadowScreen = false;

  /**
   * The unique identifier of the machine type
   */
  readonly machineId = "sp128";

  /**
   * Represents the PSG device of ZX Spectrum 128
   */
  psgDevice: ISpectrumPsgDevice;

  /**
   * Initialize the machine
   */
  constructor() {
    super();
    // --- Set up machine attributes
    this.baseClockFrequency = 3_546_900;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;

    // --- Initialize the memory contents
    this.memory = new PagedMemory(2, 8);

    // --- Create and initialize devices
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(
      this,
      CommonScreenDevice.ZxSpectrum128ScreenConfiguration
    );
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.psgDevice = new ZxSpectrum128PsgDevice(this);
    this.floatingBusDevice = new ZxSpectrum128FloatingBusDevice(this);
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  /**
   * Sets up the machine (async)
   */
  async setup(): Promise<void> {
    // --- Initialize the machine's ROM (roms/sp48.rom)
    this.uploadRomBytes(-1, await this.loadRomFromResource(this.romId, 0));
    this.uploadRomBytes(-2, await this.loadRomFromResource(this.romId, 1));
  }

  /**
   * Dispose the resources held by the machine
   */
  dispose(): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
    this.psgDevice?.dispose();
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
    for (let i = 0; i < 8; i++) {
      this.memory.resetPartition(i);
    }
    this.reset();
  }

  /**
   * This method emulates resetting a machine with a hardware reset button.
   */
  reset(): void {
    // --- Reset the CPU
    super.reset();

    // --- Reset the ROM pages and the RAM banks
    const pm = this.memory;
    pm.setPageInfo(0, pm.getPartitionOffset(-1), -1, true);
    pm.setPageInfo(1, 0x2000 + pm.getPartitionOffset(-1), -1, true);
    pm.setPageInfo(2, pm.getPartitionOffset(5), 5, false);
    pm.setPageInfo(3, 0x2000 + pm.getPartitionOffset(5), 5, false);
    pm.setPageInfo(4, pm.getPartitionOffset(2), 2, false);
    pm.setPageInfo(5, 0x2000 + pm.getPartitionOffset(2), 2, false);
    pm.setPageInfo(6, pm.getPartitionOffset(0), 0, false);
    pm.setPageInfo(7, 0x2000 + pm.getPartitionOffset(0), 0, false);

    this.previousRom = 0;
    this.selectedRom = 0;
    this.previousBank = 0;
    this.selectedBank = 0;

    // --- Enable memory paging
    this.pagingEnabled = true;

    // --- Shadow screen is disabled
    this.useShadowScreen = false;
    this.screenStartOffset = pm.getPartitionOffset(5);

    // --- Reset and setup devices
    this.keyboardDevice.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    this.psgDevice.reset();
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);
      this.psgDevice.setAudioSampleRate(audioRate);
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
   * Indicates if the currently selected ROM is the ZX Spectrum 48 ROM
   */
  get isSpectrum48RomSelected(): boolean {
    return this.selectedRom === 1;
  }

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number {
    return this.memory.memory[this.screenStartOffset + (offset & 0x3fff)];
  }

  /**
   * Gets the partition in which the specified address is paged in
   * @param address Address to get the partition for
   */
  getPartition(address: number): number | undefined {
    return this.memory.getAddressPartition(address);
  }

  /**
   * Parses a partition label to get the partition number
   * @param label Label to parse
   */
  parsePartitionLabel(label: string): number | undefined {
    if (!label) return undefined;
    let isRom = false;
    label = label.trim().toUpperCase();
    if (label.startsWith("R")) {
      isRom = true;
    } else if (!label.startsWith("B")) {
      return undefined;
    }
    const index = label.substring(1);
    if (!index.match(/^\d+$/)) {
      return undefined;
    }
    let partition = parseInt(index, 10);
    partition = isRom ? -partition - 1 : partition;
    return partition >= -2 && partition < 8 ? partition : undefined;
  }

  /**
   * Gets the label of the specified partition
   * @param partition Partition index
   */
  getPartitionLabels(): Record<number, string> {
    return {
      [-2]: "R1",
      [-1]: "R0",
      0: "B0",
      1: "B1",
      2: "B2",
      3: "B3",
      4: "B4",
      5: "B5",
      6: "B6",
      7: "B7"
    };
  }

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory(): Uint8Array {
    return this.memory.get64KFlatMemory();
  }

  /**
   * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
   * @param index Partition index
   */
  getMemoryPartition(index: number): Uint8Array {
    return this.memory.getMemoryPartition(index);
  }

  /**
   * Gets the current partition values for all 16K/8K partitions
   */
  getCurrentPartitions(): number[] {
    return this.memory.getPartitions();
  }

  /**
   * Gets the selected ROM page number
   */
  getSelectedRomPage(): number {
    return this.selectedRom;
  }

  /**
   * Gets the selected RAM bank number
   */
  getSelectedRamBank(): number {
    return this.selectedBank;
  }

  /**
   * Gets the current partition labels for all 16K/8K partitions
   */
  getCurrentPartitionLabels(): string[] {
    return this.memory.getPartitionLabels();
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
  getAudioSamples(): AudioSample[] {
    const beeperSamples = this.beeperDevice.getAudioSamples();
    const psgSamples = this.psgDevice.getAudioSamples();
    const samplesCount = Math.min(beeperSamples.length, psgSamples.length);
    const sumSamples: AudioSample[] = [];
    for (let i = 0; i < samplesCount; i++) {
      sumSamples[i] = {
        left: beeperSamples[i].left + psgSamples[i].left,
        right: beeperSamples[i].right + psgSamples[i].right
      };
    }
    return sumSamples;
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
    return this.memory.readMemory(address);
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory(address: number, value: number): void {
    this.memory.writeMemory(address, value);
  }

  /**
   * This method implements memory operation delays.
   * @param address Memory address
   *
   * Whenever the CPU accesses the 0x4000-0x7fff memory range, it contends with the ULA. We keep the contention
   * delay values for a particular machine frame tact in _contentionValues.Independently of the memory address,
   * the Z80 CPU takes 3 T-states to read or write the memory contents.
   */
  delayAddressBusAccess(address: number): void {
    const page = address & 0xc000;
    if (page != 0x4000 && (page != 0xc000 || (this.selectedBank & 0x01) !== 1)) return;

    // --- We read from contended memory
    const delay = this.contentionValues[this.currentFrameTact];
    this.tactPlusN(delay);
    this.totalContentionDelaySinceStart += delay;
    this.contentionDelaySincePause += delay;
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
    if ((address & 0x0001) === 0) {
      // --- Standard ZX Spectrum 48 I/O read
      return this.readPort0Xfe(address);
    }

    // --- Handle the Kempston port
    if ((address & 0x00e0) === 0) {
      // TODO: Implement Kempston port handling
      return 0xff;
    }

    // --- Handle the PSG register index port
    if ((address & 0xc002) === 0xc000) {
      return this.psgDevice.readPsgRegisterValue();
    }

    return this.floatingBusDevice.readFloatingBus();
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
    // --- Standard ZX Spectrum 48 port
    if ((address & 0x0001) === 0) {
      this.writePort0xFE(value);
      return;
    }

    // --- Memory paging port
    if ((address & 0xc002) === 0x4000) {
      // --- Abort if paging is not enabled
      if (!this.pagingEnabled) return;

      // --- Choose the RAM bank for Slot 3 (0xc000-0xffff)
      this.selectedBank = value & 0x07;
      if (this.selectedBank !== this.previousBank) {
        // --- Update the bank page
        this.previousBank = this.selectedBank;
        const pm = this.memory;
        pm.setPageInfo(6, pm.getPartitionOffset(this.selectedBank), this.selectedBank, false);
        pm.setPageInfo(
          7,
          0x2000 + pm.getPartitionOffset(this.selectedBank),
          this.selectedBank,
          false
        );
      }

      // --- Choose screen (Bank 5 or 7)
      this.useShadowScreen = ((value >> 3) & 0x01) == 0x01;
      this.screenStartOffset = this.memory.getPartitionOffset(this.useShadowScreen ? 7 : 5);

      // --- Choose ROM bank for Slot 0 (0x0000-0x3fff)
      this.selectedRom = (value >> 4) & 0x01;
      if (this.previousRom !== this.selectedRom) {
        // --- Update rom page indices
        this.previousRom = this.selectedRom;
        const romPartition = -this.selectedRom - 1;
        const pm = this.memory;
        pm.setPageInfo(0, pm.getPartitionOffset(romPartition), romPartition, true);
        pm.setPageInfo(1, 0x2000 + pm.getPartitionOffset(romPartition), romPartition, true);
      }

      // --- Enable/disable paging
      this.pagingEnabled = (value & 0x20) == 0x00;
      return;
    }

    // --- Test for PSG register index port
    if ((address & 0xc002) === 0xc000) {
      this.psgDevice.setPsgRegisterIndex(value & 0x0f);
      return;
    }

    // --- Test for PSG register value port
    if ((address & 0xc002) === 0x8000) {
      this.psgDevice.writePsgRegisterValue(value);
      return;
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
   * @returns
   */
  getPixelBuffer(): Uint32Array {
    return this.screenDevice.getPixelBuffer();
  }

  /**
   * Uploades the specified ROM information to the ZX Spectrum ROM memory
   * @param partition Partition to upload the ROM contents to
   * @param data ROM contents
   */
  uploadRomBytes(partition: number, data: Uint8Array): void {
    this.memory.rawCopy(this.memory.getPartitionOffset(partition), data);
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
          execPoint: SP128_MAIN_WAITING_LOOP,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SP128_MAIN_WAITING_LOOP)})`
        },
        {
          type: "Start"
        },
        {
          type: "QueueKey",
          primary: SpectrumKeyCode.N6,
          secondary: SpectrumKeyCode.CShift,
          wait: SP_KEY_WAIT,
          message: "Arrow down"
        },
        {
          type: "QueueKey",
          primary: SpectrumKeyCode.N6,
          secondary: SpectrumKeyCode.CShift,
          wait: SP_KEY_WAIT,
          message: "Arrow down"
        },
        {
          type: "QueueKey",
          primary: SpectrumKeyCode.N6,
          secondary: SpectrumKeyCode.CShift,
          wait: SP_KEY_WAIT,
          message: "Arrow down"
        },
        {
          type: "QueueKey",
          primary: SpectrumKeyCode.Enter,
          wait: 0,
          message: "Enter"
        },
        {
          type: "ReachExecPoint",
          rom: 1,
          execPoint: SP48_MAIN_ENTRY,
          message: `Main execution cycle point reached (ROM1/$${toHexa4(SP48_MAIN_ENTRY)})`
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
    if (model === "sp128") {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SP128_MAIN_WAITING_LOOP,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SP128_MAIN_WAITING_LOOP)})`
        },
        {
          type: "Start"
        },
        {
          type: "QueueKey",
          primary: SpectrumKeyCode.N6,
          secondary: SpectrumKeyCode.CShift,
          wait: SP_KEY_WAIT,
          message: "Arrow down"
        },
        {
          type: "QueueKey",
          primary: SpectrumKeyCode.Enter,
          wait: 0,
          message: "Enter"
        },
        {
          type: "ReachExecPoint",
          rom: 1,
          execPoint: SP128_RETURN_TO_EDITOR,
          message: `Main execution cycle point reached (ROM1/$${toHexa4(SP128_RETURN_TO_EDITOR)})`
        },
        {
          type: "Inject"
        },
        {
          type: "SetReturn",
          returnPoint: SP128_RETURN_TO_EDITOR
        }
      ];
    }
    throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * @param clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the
   * previous frame.
   */
  onInitNewFrame(): void {
    // --- No screen tact rendered in this frame
    this.lastRenderedFrameTact = 0;

    // --- Prepare the screen device for the new machine frame
    this.screenDevice.onNewFrame();

    // --- Prepare the beeper device for the new frame
    this.beeperDevice.onNewFrame();
    this.psgDevice.onNewFrame();
  }

  /**
   * Check for current tape mode after each executed instruction
   */
  afterInstructionExecuted(): void {
    super.afterInstructionExecuted();
    this.psgDevice.calculateCurrentAudioValue();
  }

  /**
   * Every time the CPU clock is incremented, this function is executed.
   * @param increment The tact increment value
   */
  onTactIncremented(): void {
    super.onTactIncremented();
    this.psgDevice.setNextAudioSample();
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[] {
    return [...zxSpectrum128SysVars, ...zxSpectrum48SysVars];
  }
}
