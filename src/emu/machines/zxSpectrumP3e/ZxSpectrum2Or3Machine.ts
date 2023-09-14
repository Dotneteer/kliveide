import { SysVar } from "@abstractions/SysVar";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import { IPsgDevice } from "@emu/abstractions/IPsgDevice";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { MainExecPointInfo } from "@renderer/abstractions/IZ80Machine";
import { BeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../KeyboardDevice";
import { ZxSpectrumBase } from "../ZxSpectrumBase";
import { FloppyControllerDevice } from "../disk/FloppyControllerDevice";
import {
  AUDIO_SAMPLE_RATE,
  TAPE_MODE,
  TAPE_SAVER,
  REWIND_REQUESTED,
  KBTYPE_48
} from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import { zxSpectrum128SysVars } from "../zxSpectrum128/ZxSpectrum128Machine";
import { ZxSpectrum128PsgDevice } from "../zxSpectrum128/ZxSpectrum128PsgDevice";
import { zxSpectrum48SysVars } from "../zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrumP3eFloatingBusDevice } from "./ZxSpectrumP3eFloatingBusDevice";
import { Store } from "@common/state/redux-light";
import { AppState } from "@common/state/AppState";
import { setDiskFileAction } from "@common/state/actions";

/**
 * ZX Spectrum 48 main execution cycle entry point
 */
export const SP48_MAIN_ENTRY = 0x12ac;

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export abstract class ZxSpectrum2Or3Machine extends ZxSpectrumBase {
  // --- This array represents the storage for ROM pages
  private readonly romPages: Uint8Array[] = [];
  private readonly ramBanks: Uint8Array[] = [];

  // --- Override to sign if this model handles floppy disks.
  protected abstract hasFloppy(): boolean;

  // --- Override to sign that the second floppy drive is present.
  protected abstract hasDriveB(): boolean;

  selectedRom = 0;
  selectedBank = 0;
  pagingEnabled = true;
  useShadowScreen = false;
  inSpecialPagingMode = false;
  specialConfigMode = 0;
  diskMotorOn = false;

  /**
   * Represents the PSG device of ZX Spectrum +3E
   */
  psgDevice: IPsgDevice;

  /**
   * Represents the floppy controller device
   */
  floppyDevice: IFloppyControllerDevice;

  /**
   * Initialize the machine
   */
  constructor (store: Store<AppState>) {
    super();
    store.dispatch(setDiskFileAction(0, null), "emu");
    store.dispatch(setDiskFileAction(1, null), "emu");

    // --- Set up machine attributes
    this.baseClockFrequency = 3_546_900;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;

    // --- Initialize the memory contents
    this.romPages = [
      new Uint8Array(0x4000), // ROM 0
      new Uint8Array(0x4000), // ROM 1
      new Uint8Array(0x4000), // ROM 2
      new Uint8Array(0x4000) // ROM 3
    ];
    this.ramBanks = [
      new Uint8Array(0x4000), // Bank 0
      new Uint8Array(0x4000), // Bank 1
      new Uint8Array(0x4000), // Bank 2
      new Uint8Array(0x4000), // Bank 3
      new Uint8Array(0x4000), // Bank 4
      new Uint8Array(0x4000), // Bank 5
      new Uint8Array(0x4000), // Bank 7
      new Uint8Array(0x4000) // Bank 8
    ];

    // --- Create and initialize devices
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(
      this,
      CommonScreenDevice.ZxSpectrumP3EScreenConfiguration
    );
    this.beeperDevice = new BeeperDevice(this);
    this.psgDevice = new ZxSpectrum128PsgDevice(this);
    if (this.hasFloppy()) {
      this.floppyDevice = new FloppyControllerDevice(this);
      this.floppyDevice.isDriveAPresent = true;
      this.floppyDevice.isDriveBPresent = this.hasDriveB();
    }
    this.floatingBusDevice = new ZxSpectrumP3eFloatingBusDevice(this);
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  /**
   * Sets up the machine (async)
   */
  async setup (): Promise<void> {
    // --- Initialize the machine's ROM (roms/sp48.rom)
    this.uploadRomBytes(0, await this.loadRomFromResource(this.romId, 0));
    this.uploadRomBytes(1, await this.loadRomFromResource(this.romId, 1));
    this.uploadRomBytes(2, await this.loadRomFromResource(this.romId, 2));
    this.uploadRomBytes(3, await this.loadRomFromResource(this.romId, 3));
  }

  /**
   * Dispose the resources held by the machine
   */
  dispose (): void {
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
  hardReset (): void {
    super.hardReset();
    for (let b = 0; b < this.ramBanks.length; b++) {
      const bank = this.ramBanks[b];
      for (let i = 0; i < bank.length; i++) bank[i] = 0;
    }
    this.reset();
  }

  /**
   * This method emulates resetting a machine with a hardware reset button.
   */
  reset (): void {
    // --- Reset the CPU
    super.reset();

    // --- Reset the ROM page and the RAM bank
    this.selectedRom = 0;
    this.selectedBank = 0;

    // --- Enable memory paging
    this.pagingEnabled = true;

    // --- Shadow screen is disabled
    this.useShadowScreen = false;

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
    this.setMachineProperty(
      TAPE_SAVER,
      new TapeSaver(this.tapeDevice as TapeDevice)
    );
    this.setMachineProperty(REWIND_REQUESTED);
    this.setMachineProperty(KBTYPE_48, true);

    // --- Unknown clock multiplier in the previous frame
    this.oldClockMultiplier = -1;

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
  get isSpectrum48RomSelected (): boolean {
    return this.selectedRom === 3;
  }

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory (offset: number): number {
    return this.ramBanks[this.useShadowScreen ? 7 : 5][offset & 0x3fff];
  }

  // --- Page 0 with the current configuration
  private getPage0 (): Uint8Array {
    return this.inSpecialPagingMode
      ? this.ramBanks[this.specialConfigMode ? 4 : 0]
      : this.romPages[this.selectedRom];
  }

  // --- Page 1 with the current configuration
  private getPage1 (): Uint8Array {
    return this.ramBanks[
      this.inSpecialPagingMode
        ? this.specialConfigMode === 0
          ? 1
          : this.specialConfigMode === 3
          ? 7
          : 5
        : 5
    ];
  }

  // --- Page 2 with the current configuration
  private getPage2 (): Uint8Array {
    return this.ramBanks[
      this.inSpecialPagingMode ? (this.specialConfigMode ? 6 : 2) : 2
    ];
  }

  // --- Page 2 with the current configuration
  private getPage3 (): Uint8Array {
    return this.ramBanks[
      this.inSpecialPagingMode
        ? this.specialConfigMode === 1
          ? 7
          : 3
        : this.selectedBank
    ];
  }

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory (): Uint8Array {
    const memory = new Uint8Array(0x01_0000);
    let page0 = this.getPage0();
    let page1 = this.getPage1();
    let page2 = this.getPage2();
    let page3 = this.getPage3();

    for (let i = 0; i < 0x4000; i++) {
      memory[i] = page0[i];
      memory[i + 0x4000] = page1[i];
      memory[i + 0x8000] = page2[i];
      memory[i + 0xc000] = page3[i];
    }
    return memory;
  }

  /**
   * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
   * @param index Partition index
   */
  get16KPartition (index: number): Uint8Array {
    switch (index) {
      case -1:
        return this.romPages[0];
      case -2:
        return this.romPages[1];
      case -3:
        return this.romPages[2];
      case -4:
        return this.romPages[3];
      default:
        return this.ramBanks[index & 0x07];
    }
  }

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples (): number[] {
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
  get tactsInDisplayLine (): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * Read the byte at the specified memory address.
   * @param address 16-bit memory address
   * @returns The byte read from the memory
   */
  doReadMemory (address: number): number {
    const memIndex = address & 0x3fff;
    switch (address & 0xc000) {
      case 0x0000:
        return this.getPage0()[memIndex];
      case 0x4000:
        return this.getPage1()[memIndex];
      case 0x8000:
        return this.getPage2()[memIndex];
      default:
        return this.getPage3()[memIndex];
    }
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory (address: number, value: number): void {
    const memIndex = address & 0x3fff;
    switch (address & 0xc000) {
      case 0x0000:
        if (this.inSpecialPagingMode) {
          this.ramBanks[this.specialConfigMode ? 4 : 0][memIndex] = value;
        }
        return;
      case 0x4000:
        this.getPage1()[memIndex] = value;
        return;
      case 0x8000:
        this.getPage2()[memIndex] = value;
        return;
      default:
        this.getPage3()[memIndex] = value;
        return;
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
  delayAddressBusAccess (address: number): void {
    const page = address & 0xc000;

    if (this.inSpecialPagingMode) {
      if (page === 0xc000) {
        if (this.specialConfigMode !== 1) return;
      } else if (!this.specialConfigMode) return;
    } else {
      if (page !== 0x4000 && (page !== 0xc000 || this.selectedBank < 4)) return;
    }

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
  doReadPort (address: number): number {
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
      return this.hasFloppy()
        ? this.floppyDevice.readMainStatusRegister()
        : 0xff;
    }

    // --- Handle reading the FDC data port
    if ((address & 0xf002) === 0x3000) {
      return this.hasFloppy() ? this.floppyDevice.readDataRegister() : 0xff;
    }

    return this.floatingBusDevice.readFloatingBus();
  }

  /**
   * Reads a byte from the ZX Spectrum generic input port.
   * @param address Port address
   * @returns Byte value read from the generic port
   */
  private readPort0XfeUpdated (address: number): number {
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
  doWritePort (address: number, value: number): void {
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

      // --- Choose screen (Bank 5 or 7)
      this.useShadowScreen = ((value >> 3) & 0x01) === 0x01;

      // --- Choose ROM bank for Slot 0 (0x0000-0x3fff)
      this.selectedRom =
        ((value >> 4) & 0x01) | (this.specialConfigMode & 0x02);

      // --- Enable/disable paging
      this.pagingEnabled = (value & 0x20) === 0x00;
      return;
    }

    // --- Special memory paging port
    if ((address & 0xf002) == 0x1000) {
      // --- Special paging mode
      this.inSpecialPagingMode = (value & 0x01) !== 0;
      this.specialConfigMode = (value >> 1) & 0x03;
      this.selectedRom =
        (this.selectedRom & 0x01) | (this.specialConfigMode & 0x02);

      // --- Disk motor
      this.diskMotorOn = (value & 0x08) != 0;
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
      this.floppyDevice.writeDataRegister(value);
      console.log(this.floppyDevice.getLogEntries());
    }
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels (): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels (): number {
    return this.screenDevice.screenLines;
  }

  /// <summary>
  /// Gets the buffer that stores the rendered pixels
  /// </summary>
  getPixelBuffer (): Uint32Array {
    return this.screenDevice.getPixelBuffer();
  }

  /**
   * Uploades the specified ROM information to the ZX Spectrum 48 ROM memory
   * @param data ROM contents
   */
  uploadRomBytes (pageIndex: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.romPages[pageIndex][i] = data[i];
    }
  }

  /**
   * Gets the main execution point information of the machine
   * @param model Machine model to use for code execution
   */
  getMainExecPoint (model: string): MainExecPointInfo {
    return {
      romIndex: 0,
      entryPoint: SP48_MAIN_ENTRY
    };
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * @param clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the
   * previous frame.
   */
  onInitNewFrame (clockMultiplierChanged: boolean): void {
    // --- No screen tact rendered in this frame
    this.lastRenderedFrameTact = 0;

    // --- Prepare the screen device for the new machine frame
    this.screenDevice.onNewFrame();

    // --- Handle audio sample recalculations when the actual clock frequency changes
    if (this.oldClockMultiplier !== this.clockMultiplier) {
      const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
      if (typeof audioRate === "number") {
        this.beeperDevice.setAudioSampleRate(audioRate);
        this.psgDevice.setAudioSampleRate(audioRate);
      }
      this.oldClockMultiplier = this.clockMultiplier;
    }

    // --- Prepare the beeper device for the new frame
    this.beeperDevice.onNewFrame();
    this.psgDevice.onNewFrame();

    // --- Handle floppy events
    this.floppyDevice?.onFrameCompleted();
  }

  /**
   * Check for current tape mode after each executed instruction
   */
  afterInstructionExecuted (): void {
    super.afterInstructionExecuted();
    this.psgDevice.calculateCurrentAudioValue();
  }

  /**
   * Every time the CPU clock is incremented, this function is executed.
   * @param increment The tact increment value
   */
  onTactIncremented (increment: number): void {
    super.onTactIncremented(increment);
    this.psgDevice.setNextAudioSample();
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars (): SysVar[] {
    return [...zxSpectrum128SysVars, ...zxSpectrum48SysVars];
  }
}
