import type { SysVar } from "@abstr/SysVar";
import type { ISpectrumPsgDevice } from "../../machines/zxSpectrum/ISpectrumPsgDevice";
import type { CodeInjectionFlow } from "@emuabstr/CodeInjectionFlow";
import type { MachineModel } from "@common/machines/info-types";
import type { IFloppyControllerDevice } from "@emuabstr/IFloppyControllerDevice";

import { TapeMode } from "@emuabstr/TapeMode";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import {
  SP48_MAIN_ENTRY,
  SPP3_MAIN_WAITING_LOOP,
  SPP3_RETURN_TO_EDITOR,
  SP_KEY_WAIT,
  ZxSpectrumBase
} from "../ZxSpectrumBase";
import { FloppyControllerDevice } from "../disk/FloppyControllerDevice";
import { AUDIO_SAMPLE_RATE, TAPE_MODE, TAPE_SAVER, REWIND_REQUESTED } from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import { ZxSpectrum128PsgDevice } from "../zxSpectrum128/ZxSpectrum128PsgDevice";
import {
  ZxSpectrumP3eFloatingBusDevice,
  zxSpectrumP32FloatingBusPorts
} from "./ZxSpectrumP3eFloatingBusDevice";
import { PagedMemory } from "../memory/PagedMemory";
import { SpectrumKeyCode } from "../../machines/zxSpectrum/SpectrumKeyCode";
import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { MEDIA_DISK_A, MEDIA_DISK_B } from "@common/structs/project-const";
import { zxSpectrum128SysVars } from "../zxSpectrum128/ZxSpectrum128SysVars";
import { zxSpectrum48SysVars } from "../zxSpectrum48/ZxSpectrum48SysVars";
import { toHexa4 } from "@common/utils/conversions";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrumP3EMachine extends ZxSpectrumBase {
  readonly machineId = "spp3e";

  // --- Override to sign if this model handles floppy disks.
  private hasFloppy: boolean;

  // --- Override to sign that the second floppy drive is present.
  private hasDriveB: boolean;

  // --- Memory-related fields
  private memory: PagedMemory;
  private previousRom = 0;
  private previousBank = 0;
  private screenStartOffset = 0;
  selectedRom = 0;
  selectedBank = 0;

  // --- We need this value for the floating bus device
  lastContendedValue = 0xff;
  lastUlaReadValue = 0xff;

  // --- Paging-related fields
  pagingEnabled = true;
  useShadowScreen = false;
  inSpecialPagingMode = false;
  specialConfigMode = 0;
  diskMotorOn = false;

  /**
   * Represents the PSG device of ZX Spectrum +3E
   */
  psgDevice: ISpectrumPsgDevice;

  /**
   * Represents the floppy controller device
   */
  floppyDevice: IFloppyControllerDevice;

  /**
   * Initialize the machine
   */
  constructor(model: MachineModel) {
    super();
    try {
      switch (model?.config?.[MC_DISK_SUPPORT]) {
        case 1:
          this.hasFloppy = true;
          this.hasDriveB = false;
          break;
        case 2:
          this.hasFloppy = true;
          this.hasDriveB = true;
          break;
        default:
          this.hasFloppy = false;
          this.hasDriveB = false;
          break;
      }

      // --- Set up machine attributes
      this.baseClockFrequency = 3_546_900;
      this.clockMultiplier = 1;
      this.delayedAddressBus = true;

      // --- Initialize the memory contents
      this.memory = new PagedMemory(4, 8);

      // --- Create and initialize devices
      this.keyboardDevice = new KeyboardDevice(this);
      this.screenDevice = new CommonScreenDevice(
        this,
        CommonScreenDevice.ZxSpectrumP3EScreenConfiguration
      );
      this.beeperDevice = new SpectrumBeeperDevice(this);
      this.psgDevice = new ZxSpectrum128PsgDevice(this);
      if (this.hasFloppy) {
        this.floppyDevice = new FloppyControllerDevice(this, this.hasDriveB);
      }
      this.floatingBusDevice = new ZxSpectrumP3eFloatingBusDevice(this);
      this.tapeDevice = new TapeDevice(this);
      this.reset();
    } catch (err) {
      console.log(err);
    }
  }

  /**
   * Sets up the machine (async)
   */
  async setup(): Promise<void> {
    // --- Initialize the machine's ROM (roms/sp48.rom)
    this.uploadRomBytes(-1, await this.loadRomFromResource(this.romId, 0));
    this.uploadRomBytes(-2, await this.loadRomFromResource(this.romId, 1));
    this.uploadRomBytes(-3, await this.loadRomFromResource(this.romId, 2));
    this.uploadRomBytes(-4, await this.loadRomFromResource(this.romId, 3));
  }

  /**
   * Dispose the resources held by the machine
   */
  dispose(): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
    this.psgDevice?.dispose();
    this.floppyDevice?.dispose();
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

    // --- Special mode is off
    this.inSpecialPagingMode = false;
    this.specialConfigMode = 0;

    // --- Turn off disk motor
    this.diskMotorOn = false;

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
    this.floppyDevice?.reset();
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

    // --- Reset media
    this.setMachineProperty(MEDIA_DISK_A);
    this.setMachineProperty(MEDIA_DISK_B);
  }

  /**
   * Indicates if the currently selected ROM is the ZX Spectrum 48 ROM
   */
  get isSpectrum48RomSelected(): boolean {
    return this.selectedRom === 3;
  }

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number {
    const value = this.memory.memory[this.screenStartOffset + (offset & 0x3fff)];
    this.lastUlaReadValue = value;
    return value;
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
    return partition >= -4 && partition < 8 ? partition : undefined;
  }

  /**
   * Gets the label of the specified partition
   * @param partition Partition index
   */
  getPartitionLabels(): Record<number, string> {
    return {
      [-1]: "R0",
      [-2]: "R1",
      [-3]: "R2",
      [-4]: "R3",
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
    return [
      this.memory.bankData[0].isReadOnly,
      this.memory.bankData[1].isReadOnly,
      false,
      false,
      false,
      false,
      false,
      false
    ];
  }

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples(): number[] {
    const beeperSamples = this.beeperDevice.getAudioSamples();
    const psgSamples = this.psgDevice.getAudioSamples();
    const samplesCount = Math.min(beeperSamples.length, psgSamples.length);
    var sumSamples: number[] = [];
    for (let i = 0; i < samplesCount; i++) {
      sumSamples[i] = beeperSamples[i] + psgSamples[i];
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
    const valueRead = this.memory.readMemory(address);
    if (this.isContendedMemoryAddress(address)) {
      this.lastContendedValue = valueRead;
    }
    return valueRead;
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory(address: number, value: number): void {
    this.memory.writeMemory(address, value);
    if (this.isContendedMemoryAddress(address)) {
      this.lastContendedValue = value;
    }
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
    if (!this.isContendedMemoryAddress(address)) {
      return;
    }

    // --- We read from contended memory
    const delay = this.contentionValues[this.currentFrameTact];
    this.tactPlusN(delay);
    this.totalContentionDelaySinceStart += delay;
    this.contentionDelaySincePause += delay;
  }

  /**
   * Test if the memory address is in contended memory
   * @param address Memory address to test
   * @returns True, if the memory address is in contended memory
   */
  isContendedMemoryAddress(address: number): boolean {
    const page = address & 0xc000;
    if (this.inSpecialPagingMode) {
      if (page === 0xc000) {
        if (this.specialConfigMode !== 1) return false;
      } else if (!this.specialConfigMode) return false;
    } else {
      if (page !== 0x4000 && (page !== 0xc000 || this.selectedBank < 4)) return false;
    }
    return true;
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
      return this.readPort0XfeUpdated(address);
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

    // --- Handle reading the FDC main status register port
    if ((address & 0xf002) === 0x2000) {
      return this.hasFloppy ? this.floppyDevice.readMainStatusRegister() : 0xff;
    }

    // --- Handle reading the FDC data port
    if ((address & 0xf002) === 0x3000) {
      return this.hasFloppy ? this.floppyDevice.readDataRegister() : 0xff;
    }

    return address in zxSpectrumP32FloatingBusPorts && this.pagingEnabled
      ? this.floatingBusDevice.readFloatingBus()
      : 0xff;
  }

  /**
   * Reads a byte from the ZX Spectrum generic input port.
   * @param address Port address
   * @returns Byte value read from the generic port
   */
  private readPort0XfeUpdated(address: number): number {
    let portValue = this.keyboardDevice.getKeyLineStatus(address);

    // --- Check for LOAD mode
    if (this.tapeDevice.tapeMode === TapeMode.Load) {
      const earBit = this.tapeDevice.getTapeEarBit();
      this.beeperDevice.setEarBit(earBit);
      portValue = ((portValue & 0xbf) | (earBit ? 0x40 : 0)) & 0xff;
    } else {
      portValue = portValue & 0xbf;
    }
    return portValue;
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
        if (this.inSpecialPagingMode) {
          this.setupSpecialMemoryConfig();
        } else {
          pm.setPageInfo(6, pm.getPartitionOffset(this.selectedBank), this.selectedBank, false);
          pm.setPageInfo(
            7,
            0x2000 + pm.getPartitionOffset(this.selectedBank),
            this.selectedBank,
            false
          );
        }
      }

      // --- Choose screen (Bank 5 or 7)
      this.useShadowScreen = ((value >> 3) & 0x01) === 0x01;
      this.screenStartOffset = this.memory.getPartitionOffset(this.useShadowScreen ? 7 : 5);

      // --- Choose ROM bank for Slot 0 (0x0000-0x3fff)
      this.selectedRom = ((value >> 4) & 0x01) | (this.specialConfigMode & 0x02);
      this.setupSelectedRom();

      // --- Enable/disable paging
      this.pagingEnabled = (value & 0x20) === 0x00;
      return;
    }

    // --- Special memory paging port
    if ((address & 0xf002) == 0x1000) {
      // --- Special paging mode
      this.inSpecialPagingMode = (value & 0x01) !== 0;
      this.specialConfigMode = (value >> 1) & 0x03;
      this.selectedRom = (this.selectedRom & 0x01) | (this.specialConfigMode & 0x02);
      this.setupSelectedRom();

      // --- Disk motor
      this.diskMotorOn = (value & 0x08) != 0;
      if (this.diskMotorOn) {
        this.floppyDevice?.turnOnMotor();
      } else {
        this.floppyDevice?.turnOffMotor();
      }
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

    // --- Test for the floppy controller port
    if ((address & 0xf002) == 0x3000) {
      this.floppyDevice?.writeDataRegister(value);
    }
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
          execPoint: SPP3_MAIN_WAITING_LOOP,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SPP3_MAIN_WAITING_LOOP)})`
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
          rom: 3,
          execPoint: SP48_MAIN_ENTRY,
          message: `Main execution cycle point reached (ROM3/$${toHexa4(SP48_MAIN_ENTRY)})`
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
    if (model === "spp3e") {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SPP3_MAIN_WAITING_LOOP,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SPP3_MAIN_WAITING_LOOP)})`
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
          execPoint: SPP3_RETURN_TO_EDITOR,
          message: `Main execution cycle point reached (ROM1/$${toHexa4(SPP3_RETURN_TO_EDITOR)})`
        },
        {
          type: "Inject"
        },
        {
          type: "SetReturn",
          returnPoint: SPP3_RETURN_TO_EDITOR
        }
      ];
    }
    throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * @param _clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the
   * previous frame.
   */
  onInitNewFrame(_clockMultiplierChanged: boolean): void {
    // --- No screen tact rendered in this frame
    this.lastRenderedFrameTact = 0;

    // --- Prepare the screen device for the new machine frame
    this.screenDevice.onNewFrame();

    // --- Prepare the beeper device for the new frame
    this.beeperDevice.onNewFrame();
    this.psgDevice.onNewFrame();

    // --- Handle floppy events
    this.floppyDevice?.onFrameCompleted();
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

  /**
   * Sets up the special memory configuration mode
   */
  private setupSpecialMemoryConfig(): void {
    const pm = this.memory;
    const part0 = this.specialConfigMode ? 4 : 0;
    pm.setPageInfo(0, pm.getPartitionOffset(part0), part0, false);
    pm.setPageInfo(1, 0x2000 + pm.getPartitionOffset(part0), part0, false);
    const part1 = this.specialConfigMode ? (this.specialConfigMode === 3 ? 7 : 5) : 1;
    pm.setPageInfo(2, pm.getPartitionOffset(part1), part1, false);
    pm.setPageInfo(3, 0x2000 + pm.getPartitionOffset(part1), part1, false);
    const part2 = this.specialConfigMode ? 6 : 2;
    pm.setPageInfo(4, pm.getPartitionOffset(part2), part2, false);
    pm.setPageInfo(5, 0x2000 + pm.getPartitionOffset(part2), part2, false);
    const part3 = this.specialConfigMode === 1 ? 7 : 3;
    pm.setPageInfo(6, pm.getPartitionOffset(part3), part3, false);
    pm.setPageInfo(7, 0x2000 + pm.getPartitionOffset(part3), part3, false);
  }

  /**
   * Sets the memory configuration when the selected ROM index changes
   */
  private setupSelectedRom() {
    if (this.selectedRom !== this.previousRom) {
      this.previousRom = this.selectedRom;
      const pm = this.memory;
      if (this.inSpecialPagingMode) {
        this.setupSpecialMemoryConfig();
      } else {
        const romPartition = -this.selectedRom - 1;
        pm.setPageInfo(0, pm.getPartitionOffset(romPartition), romPartition, true);
        pm.setPageInfo(1, 0x2000 + pm.getPartitionOffset(romPartition), romPartition, true);
      }
    }
  }
}
