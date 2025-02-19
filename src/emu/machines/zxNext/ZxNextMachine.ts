import type { KeyMapping } from "@abstractions/KeyMapping";
import type { SysVar } from "@abstractions/SysVar";
import type { ISpectrumBeeperDevice } from "@emu/machines/zxSpectrum/ISpectrumBeeperDevice";
import type { IFloatingBusDevice } from "@emu/abstractions/IFloatingBusDevice";
import type { ITapeDevice } from "@emu/abstractions/ITapeDevice";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import type { MachineModel } from "@common/machines/info-types";

import { EmulatedKeyStroke } from "@emu/structs/EmulatedKeyStroke";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";
import { Z80NMachineBase } from "./Z80NMachineBase";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { NextRegDevice } from "./NextRegDevice";
import { Layer2Device } from "./Layer2Device";
import { PaletteDevice } from "./PaletteDevice";
import { TilemapDevice } from "./TilemapDevice";
import { SpriteDevice } from "./SpriteDevice";
import { DmaDevice } from "./DmaDevice";
import { CopperDevice } from "./CopperDevice";
import { OFFS_NEXT_ROM, MemoryDevice, OFFS_ALT_ROM_0, OFFS_DIVMMC_ROM } from "./MemoryDevice";
import { NextIoPortManager } from "./io-ports/NextIoPortManager";
import { DivMmcDevice } from "./DivMmcDevice";
import { NextScreenDevice } from "./NextScreenDevice";
import { MouseDevice } from "./MouseDevice";
import { InterruptDevice } from "./InterruptDevice";
import { JoystickDevice } from "./JoystickDevice";
import { NextSoundDevice } from "./NextSoundDevice";
import { UlaDevice } from "./UlaDevice";
import { LoResDevice } from "./LoResDevice";
import { NextKeyboardDevice } from "./NextKeyboardDevice";
import { CallStackInfo } from "@emu/abstractions/CallStack";
import { SdCardDevice } from "./SdCardDevice";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { createMainApi } from "@common/messaging/MainApi";
import { MessengerBase } from "@common/messaging/MessengerBase";

/**
 * The common core functionality of the ZX Spectrum Next virtual machine.
 */
export class ZxNextMachine extends Z80NMachineBase implements IZxNextMachine {
  /**
   * The unique identifier of the machine type
   */
  public readonly machineId = "zxnext";

  portManager: NextIoPortManager;

  memoryDevice: MemoryDevice;

  interruptDevice: InterruptDevice;

  nextRegDevice: NextRegDevice;

  divMmcDevice: DivMmcDevice;

  sdCardDevice: SdCardDevice;

  layer2Device: Layer2Device;

  paletteDevice: PaletteDevice;

  tilemapDevice: TilemapDevice;

  spriteDevice: SpriteDevice;

  dmaDevice: DmaDevice;

  copperDevice: CopperDevice;

  /**
   * Represents the keyboard device of ZX Spectrum 48K
   */
  keyboardDevice: NextKeyboardDevice;

  /**
   * Represents the screen device of ZX Spectrum 48K
   */
  screenDevice: NextScreenDevice;

  mouseDevice: MouseDevice;

  joystickDevice: JoystickDevice;

  soundDevice: NextSoundDevice;

  ulaDevice: UlaDevice;

  loResDevice: LoResDevice;

  /**
   * Represents the beeper device of ZX Spectrum 48K
   */
  beeperDevice: ISpectrumBeeperDevice;

  /**
   * Represents the floating port device of ZX Spectrum 48K
   */
  floatingBusDevice: IFloatingBusDevice;

  /**
   * Represents the tape device of ZX Spectrum 48K
   */
  tapeDevice: ITapeDevice;

  /**
   * Initialize the machine
   */
  constructor(public readonly modelInfo?: MachineModel) {
    super();

    // --- Set up machine attributes
    this.baseClockFrequency = 3_500_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;

    // --- Create and initialize the I/O port manager
    this.portManager = new NextIoPortManager(this);

    // --- Create and initialize the memory
    this.memoryDevice = new MemoryDevice(this);
    this.nextRegDevice = new NextRegDevice(this);
    this.interruptDevice = new InterruptDevice(this);

    // --- Create and initialize devices
    this.divMmcDevice = new DivMmcDevice(this);
    this.sdCardDevice = new SdCardDevice(this);
    this.layer2Device = new Layer2Device(this);
    this.paletteDevice = new PaletteDevice(this);
    this.tilemapDevice = new TilemapDevice(this);
    this.spriteDevice = new SpriteDevice(this);
    this.dmaDevice = new DmaDevice(this);
    this.copperDevice = new CopperDevice(this);
    this.keyboardDevice = new NextKeyboardDevice(this);
    this.screenDevice = new NextScreenDevice(this, NextScreenDevice.NextScreenConfiguration);
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.mouseDevice = new MouseDevice(this);
    this.joystickDevice = new JoystickDevice(this);
    this.soundDevice = new NextSoundDevice(this);
    this.ulaDevice = new UlaDevice(this);
    this.loResDevice = new LoResDevice(this);
    this.hardReset();
  }

  reset(): void {
    super.reset();
    this.memoryDevice.reset();
    this.interruptDevice.reset();
    this.divMmcDevice.reset();
    this.sdCardDevice.reset();
    this.layer2Device.reset();
    this.paletteDevice.reset();
    this.tilemapDevice.reset();
    this.spriteDevice.reset();
    this.dmaDevice.reset();
    this.copperDevice.reset();
    this.keyboardDevice.reset();
    this.screenDevice.reset();
    this.mouseDevice.reset();
    this.joystickDevice.reset();
    this.soundDevice.reset();
    this.ulaDevice.reset();
    this.loResDevice.reset();
    this.beeperDevice.reset();

    // --- This device is the last to reset, as it may override the reset of other devices
    this.nextRegDevice.reset();

    // --- Set default machine type
    this.nextRegDevice.configMode = false;
    this.screenDevice.machineType = 0x03; // ZX Spectrum Next
  }

  async setup(): Promise<void> {
    // --- Get the ZX Spectrum Next ROM file
    let romContents = await this.loadRomFromFile("roms/enNextZX.rom");
    this.memoryDevice.upload(romContents, OFFS_NEXT_ROM);

    // --- Get the ZX Spectrum Next ROM file
    romContents = await this.loadRomFromFile("roms/enNxtmmc.rom");
    this.memoryDevice.upload(romContents, OFFS_DIVMMC_ROM);

    // --- Get the alternate ROM file
    romContents = await this.loadRomFromFile("roms/enAltZX.rom");
    this.memoryDevice.upload(romContents, OFFS_ALT_ROM_0);
  }

  /**
   * Emulates turning on a machine (after it has been turned off).
   */
  hardReset(): void {
    super.hardReset();
    this.reset();
    this.nextRegDevice.hardReset();
    this.memoryDevice.hardReset();
  }

  get64KFlatMemory(): Uint8Array {
    return this.memoryDevice.get64KFlatMemory();
  }

  get16KPartition(index: number): Uint8Array {
    return this.memoryDevice.get16KPartition(index);
  }

  getCurrentPartitions(): number[] {
    return this.memoryDevice.getPartitions();
  }

  getCurrentPartitionLabels(): string[] {
    return this.memoryDevice.getPartitionLabels();
  }

  /**
   * Gets the partition in which the specified address is paged in
   * @param address Address to get the partition for
   */
  getPartition(address: number): number | undefined {
    const pageIndex = address >> 13;
    const page = this.memoryDevice.getPageInfo(pageIndex);
    if (page.bank16k === 0xff) {
      const romLabel = this.memoryDevice.getPartitionLabelForPage(pageIndex);
      switch (romLabel) {
        case "UN":
          return undefined;
        case "R0":
          return -1;
        case "R1":
          return -2;
        case "R2":
          return -3;
        case "R3":
          return -4;
        case "A0":
          return -5;
        case "A1":
          return -6;
        case "DM":
          return -7;
        default:
          return -8 - parseInt(romLabel.substring(1));
      }
    } else {
      return page.bank16k;
    }
  }

  /**
   * Parses a partition label to get the partition number
   * @param label Label to parse
   */
  parsePartitionLabel(label: string): number | undefined {
    switch (label.toUpperCase()) {
      case "UN":
        return undefined;
      case "R0":
        return -1;
      case "R1":
        return -2;
      case "R2":
        return -3;
      case "R3":
        return -4;
      case "Q0":
        return -5;
      case "Q1":
        return -6;
      case "DM":
        return -7;
      default:
        if (label.startsWith("M")) {
          const part = label.substring(1);
          if (part.match(/^[0-9a-fA-F]$/)) {
            let partition = parseInt(part, 16);
            return partition >= 0 && partition <= 15 ? -8 - partition : undefined;
          }
          return -8 - parseInt(label.substring(1));
        }
        if (label.match(/^[0-9a-fA-F]{1,2}$/)) {
          const partValue = parseInt(label, 16);
          return partValue >= 0 && partValue < 224 ? partValue : undefined;
        }
        return undefined;
    }
  }

  /**
   * Gets the label of the specified partition
   * @param partition Partition index
   */
  getPartitionLabels(): Record<number, string> {
    const result: Record<number, string> = {
      [-1]: "R0",
      [-2]: "R1",
      [-3]: "R2",
      [-4]: "R3",
      [-5]: "Q0",
      [-6]: "Q1",
      [-7]: "DM"
    };
    for (let i = 0; i < 16; i++) {
      result[-8 - i] = `M${i.toString(16).toUpperCase()}`;
    }
    for (let i = 0; i < 224; i++) {
      result[i] = toHexa2(i).toUpperCase();
    }
    return result;
  }

  /**
   * Gets the current call stack information
   */
  getCallStack(frames = 16): CallStackInfo {
    const stack: number[] = [];
    let addr = this.sp;
    for (let i = 0; i < frames; i++) {
      const low = this.doReadMemory(addr++);
      const high = this.doReadMemory(addr++);
      stack.push(((high << 8) | low) & 0xffff);
    }
    return {
      sp: this.sp,
      frames: stack
    };
  }

  /**
   * Stores the key strokes to emulate
   */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId(): string {
    return this.machineId;
  }

  /**
   * Indicates if the currently selected ROM is the ZX Spectrum 48 ROM
   */
  get isSpectrum48RomSelected(): boolean {
    return true;
  }

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized(): boolean {
    return this.iy === 0x5c3a;
  }

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number {
    // TODO: Implement this
    return this.memoryDevice.readMemory(0x4000 + offset);
  }

  /**
   * Gets the audio samples rendered in the current frame
   */
  getAudioSamples(): number[] {
    // TODO: Implement this
    return [];
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[] {
    // TODO: Implement this
    return [];
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
   * @return The byte read from the memory
   */
  doReadMemory(address: number): number {
    return this.memoryDevice.readMemory(address);
  }

  /**
   * This function implements the memory read delay of the CPU.
   * @param address Memory address to read
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   *  action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryRead(address: number): void {
    this.delayAddressBusAccess(address);
    this.tactPlus3();
    this.totalContentionDelaySinceStart += 3;
    this.contentionDelaySincePause += 3;
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory(address: number, value: number): void {
    this.memoryDevice.writeMemory(address, value);
  }

  /**
   * This function implements the memory write delay of the CPU.
   * @param address Memory address to write
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryWrite(address: number): void {
    this.delayMemoryRead(address);
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
    return this.portManager.readPort(address);
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
    this.portManager.writePort(address, value);
  }

  /**
   * Sets a TBBlue register value
   * @param address Register address
   * @param value Register value;
   */
  tbblueOut(address: number, value: number): void {
    this.nextRegDevice.setNextRegisterIndex(address);
    this.nextRegDevice.setNextRegisterValue(value);
  }

  /**
   * Gets the ULA issue number of the ZX Spectrum model (2 or 3)
   */
  ulaIssue = 3;

  /**
   * This method sets the contention value associated with the specified machine frame tact.
   * @param tact Machine frame tact
   * @param value Contention value
   */
  setContentionValue(_tact: number, _value: number): void {
    // TODO: Implement this
  }

  /**
   * This method gets the contention value for the specified machine frame tact.
   * @param tact Machine frame tact
   * @returns The contention value associated with the specified tact.
   */
  getContentionValue(_tact: number): number {
    // TODO: Implement this
    return 0;
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
   * This function implements the I/O port write delay of the CPU.
   * @param address  Port address
   *
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortWrite(address: number): void {
    this.delayContendedIo(address);
  }

  /**
   * Execute this method before fetching the opcode of the next instruction
   */
  beforeOpcodeFetch(): void {
    this.divMmcDevice.beforeOpcodeFetch();
  }

  /**
   * Execute this method after fetching the opcode of the next instruction
   */
  afterOpcodeFetch(): void {
    this.divMmcDevice.afterOpcodeFetch();
  }

  /**
   * Delays the I/O access according to address bus contention
   * @param address Port address
   */
  protected delayContendedIo(_address: number): void {
    // TODO: Implement this
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels() {
    return this.screenDevice.screenWidth;
  }

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels() {
    return this.screenDevice.screenLines;
  }

  /**
   * Use canvas size multipliers
   * @returns The aspect ratio of the screen
   */
  getAspectRatio(): [number, number] {
    return this.screenDevice.getAspectRatio();
  }

  /**
   * Gets the buffer that stores the rendered pixels
   * @returns
   */
  getPixelBuffer(): Uint32Array {
    return this.screenDevice.getPixelBuffer();
  }

  /**
   * This method renders the entire screen frame as the shadow screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  renderShadowScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.screenDevice.renderShadowScreen(savedPixelBuffer);
  }

  /*
   * Gets the offset of the pixel buffer in the memory
   */
  getBufferStartOffset(): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * Gets the key code set used for the machine
   */
  getKeyCodeSet(): KeyCodeSet {
    return SpectrumKeyCode;
  }

  /**
   * Gets the default key mapping for the machine
   */
  getDefaultKeyMapping(): KeyMapping {
    return spectrumKeyMappings;
  }

  /**
   * Set the status of the specified ZX Spectrum key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setKeyStatus(key: number, isDown: boolean): void {
    this.keyboardDevice.setStatus(key, isDown);
  }

  /**
   * Emulates queued key strokes as if those were pressed by the user
   */
  emulateKeystroke(): void {
    if (this.emulatedKeyStrokes.length === 0) return;

    // --- Check the next keystroke
    const keyStroke = this.emulatedKeyStrokes[0];

    // --- Time has not come
    if (keyStroke.startTact > this.tacts) return;

    if (keyStroke.endTact < this.tacts) {
      // --- End emulation of this very keystroke
      this.keyboardDevice.setStatus(keyStroke.primaryCode, false);
      if (keyStroke.secondaryCode !== undefined) {
        this.keyboardDevice.setStatus(keyStroke.secondaryCode, false);
      }

      // --- Remove the keystroke from the queue
      this.emulatedKeyStrokes.shift();
      return;
    }

    // --- Emulate this very keystroke, and leave it in the queue
    this.keyboardDevice.setStatus(keyStroke.primaryCode, true);
    if (keyStroke.secondaryCode !== undefined) {
      this.keyboardDevice.setStatus(keyStroke.secondaryCode, true);
    }
  }

  /**
   * Adds an emulated keypress to the queue of the provider.
   * @param frameOffset Number of frames to start the keypress emulation
   * @param frames Number of frames to hold the emulation
   * @param primary Primary key code
   * @param secondary Optional secondary key code
   *
   * The keyboard provider can play back emulated key strokes
   */
  queueKeystroke(frameOffset: number, frames: number, primary: number, secondary?: number): void {
    const startTact = this.tacts + frameOffset * this.tactsInFrame;
    const endTact = startTact + frames * this.tactsInFrame;
    const keypress = new EmulatedKeyStroke(startTact, endTact, primary, secondary);
    this.emulatedKeyStrokes.push(keypress);
  }

  /**
   * Gets the length of the key emulation queue
   */
  getKeyQueueLength(): number {
    return this.emulatedKeyStrokes.length;
  }

  /**
   * Gets the current cursor mode
   */
  getCursorMode(): number {
    return this.doReadMemory(0x5c41);
  }

  /**
   * Gets the main execution point information of the machine
   * @param _model Machine model to use for code execution
   */
  getCodeInjectionFlow(_model: string): CodeInjectionFlow {
    // TODO: Implement this
    return [];
  }

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   * @returns The start address of the injected code
   */
  injectCodeToRun(codeToInject: CodeToInject): number {
    // --- Clear the screen unless otherwise requested
    if (!codeToInject.options.noCls) {
      for (let addr = 0x4000; addr < 0x5800; addr++) {
        this.writeMemory(addr, 0);
      }
      for (let addr = 0x5800; addr < 0x5b00; addr++) {
        this.writeMemory(addr, 0x38);
      }
    }
    for (const segment of codeToInject.segments) {
      if (segment.bank !== undefined) {
        // TODO: Implement this
      } else {
        const addr = segment.startAddress;
        for (let i = 0; i < segment.emittedCode.length; i++) {
          this.writeMemory(addr + i, segment.emittedCode[i]);
        }
      }
    }

    // --- Prepare the run mode
    if (codeToInject.options.cursork) {
      // --- Set the keyboard in "L" mode
      this.writeMemory(0x5c3b, this.readMemory(0x5c3b) | 0x08);
    }

    // --- Use this start point
    return codeToInject.entryAddress ?? codeToInject.segments[0].startAddress;
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
  }

  /**
   * Tests if the machine should raise a Z80 maskable interrupt
   * @returns True, if the INT signal should be active; otherwise, false.
   */
  shouldRaiseInterrupt(): boolean {
    return this.currentFrameTact < 32;
  }

  /**
   * Every time the CPU clock is incremented, this function is executed.
   * @param increment The tact increment value
   */
  onTactIncremented(): void {
    const machineTact = this.currentFrameTact;
    while (this.lastRenderedFrameTact <= machineTact) {
      this.screenDevice.renderTact(this.lastRenderedFrameTact++);
    }
    this.beeperDevice.setNextAudioSample();
  }

  /**
   * The number of consequtive frames after which the UI should be refreshed
   */
  readonly uiFrameFrequency = 1;

  /**
   * Processes the frame command
   */
  async processFrameCommand(messenger: MessengerBase): Promise<void> {
    const frameCommand = this.getFrameCommand();
    switch (frameCommand.command) {
      case "sd-write":
        await createMainApi(messenger).writeSdCardSector(frameCommand.sector, frameCommand.data);
        this.sdCardDevice.setWriteResponse();
        //this.sdCardDevice.writeSector(frameCommand.sector, frameCommand.data);
        break;
      case "sd-read":
        const sectorData = await createMainApi(messenger).readSdCardSector(frameCommand.sector);
        this.sdCardDevice.setReadResponse(sectorData);
        //this.sdCardDevice.readSector(frameCommand.sector);
        break;
      default:
        console.log("Unknown frame command", frameCommand);
        break;
    }
  }
}
