import { CodeToInject } from "@abstractions/CodeToInject";
import { KeyMapping } from "@abstractions/KeyMapping";
import { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { CallStackInfo } from "@emu/abstractions/CallStack";
import { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { ExecutionContext } from "@emu/abstractions/ExecutionContext";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import { C64Cia1Device } from "./C64Cia1Device";
import { C64Cia2Device } from "./C64Cia2Device";
import { C64IoExpansionDevice } from "./C64IoExpansionDevice";
import { C64KeyboardDevice } from "./C64KeyboardDevice";
import { C64MemoryDevice } from "./C64MemoryDevice";
import { C64SidDevice } from "./C64SidDevice";
import { C64VicDevice } from "./vic/C64VicDevice";
import { IC64Machine } from "./IC64Machine";
import { LiteEvent } from "@emu/utils/lite-event";
import { C64KeyCode } from "./C64KeyCode";
import { c64KeyMappings } from "./C64KeyMappings";
import { EmulatedKeyStroke } from "@emu/structs/EmulatedKeyStroke";
import { MC_SCREEN_FREQ } from "@common/machines/constants";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FILE_PROVIDER } from "../machine-props";
import { IFileProvider } from "@renderer/core/IFileProvider";
import { M6510CpuState, VicState } from "@common/messaging/EmuApi";
import { SysVar } from "@common/abstractions/SysVar";
import { C64CpuPortDevice } from "./C64CpuPortDevice";
import { C64TapeDevice } from "./C64TapeDevice";
import { vicMos6569r3, vicMos8562 } from "./vic/vic-models";
import { QueuedEvent } from "@emu/abstractions/QueuedEvent";
import { IMachineFrameRunner, MachineFrameRunner } from "../MachineFrameRunner";
import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { c64SysVars } from "./C64SysVars";
import { M6510VaCpu } from "@emu/m6510Va/M6510VaCpu";

export class C64Machine extends M6510VaCpu implements IC64Machine {
  // --- This instance runs the machine frame
  private _machineFrameRunner: IMachineFrameRunner;

  private _emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  // --- This flag indicates that the last machine frame has been completed.
  protected _frameCompleted: boolean;

  // --- Shows the number of frame tacts that overflow to the subsequent machine frame.
  protected _frameOverflow = 0;

  // --- Store the start tact of the next machine frame
  protected _nextFrameStartTact = 0;

  // --- Events queued for execution
  private _queuedEvents?: QueuedEvent[];

  readonly memoryDevice: C64MemoryDevice;
  readonly cpuPortDevice: C64CpuPortDevice;
  readonly vicDevice: C64VicDevice;
  readonly sidDevice: C64SidDevice;
  readonly keyboardDevice: C64KeyboardDevice;
  readonly cia1Device: C64Cia1Device;
  readonly cia2Device: C64Cia2Device;
  readonly ioExpansionDevice: C64IoExpansionDevice;
  readonly tapeDevice: C64TapeDevice;

  machineId: string = "c64";

  softResetOnFirstStart?: boolean = false;

  config: MachineConfigSet;

  dynamicConfig?: MachineConfigSet;

  /**
   * This property stores the execution context where the emulated machine runs its execution loop.
   */
  executionContext: ExecutionContext = {
    frameTerminationMode: FrameTerminationMode.Normal,
    debugStepMode: DebugStepMode.NoDebug,
    canceled: false
  };

  /**
   * This event fires when the state of a machine property changes.
   */
  machinePropertyChanged? = new LiteEvent<{
    propertyName: string;
    newValue?: any;
  }>();

  targetClockMultiplier: number;
  lastRenderedFrameTact: number;

  get isNtsc(): boolean {
    return this.modelInfo?.config?.[MC_SCREEN_FREQ] === "ntsc";
  }

  constructor(public readonly modelInfo?: MachineModel) {
    super();
    this._machineFrameRunner = this.createMachineFrameRunner();
    this.baseClockFrequency = this.isNtsc ? 1022727 : 985248;
    this.clockMultiplier = 1;
    this.targetClockMultiplier = 1;

    this.vicDevice = new C64VicDevice(this, this.isNtsc ? vicMos8562 : vicMos6569r3);
    this.sidDevice = new C64SidDevice(this);
    this.keyboardDevice = new C64KeyboardDevice(this);
    this.cia1Device = new C64Cia1Device(this);
    this.cia2Device = new C64Cia2Device(this);
    this.tapeDevice = new C64TapeDevice(this);
    this.ioExpansionDevice = new C64IoExpansionDevice(this);
    this.cpuPortDevice = new C64CpuPortDevice(this);
    this.memoryDevice = new C64MemoryDevice(this);
    this.config = {};
  }

  /**
   * Creates the machine frame runner for the emulated machine.
   * @returns The machine frame runner instance
   */
  protected createMachineFrameRunner(): IMachineFrameRunner {
    return new MachineFrameRunner(this);
  }

  /**
   * Gets the machine frame runner associated with the machine.
   */
  get machineFrameRunner(): IMachineFrameRunner {
    return this._machineFrameRunner;
  }

  get frameJustCompleted(): boolean {
    return this.machineFrameRunner.frameCompleted;
  }

  /**
   * The number of consequtive frames after which the UI should be refreshed
   */
  readonly uiFrameFrequency: number = 1;

  async setup(): Promise<void> {
    this.memoryDevice.reset();

    const basicRomContents = await this.loadRomFromResource("c64-basic");
    this.memoryDevice.uploadBasicRom(basicRomContents);
    const kernalRomContents = await this.loadRomFromResource(
      `c64-kernal-${this.isNtsc ? "ntsc" : "pal"}`
    );
    this.memoryDevice.uploadKernalRom(kernalRomContents);
    const chargenRomContents = await this.loadRomFromResource("c64-chargen");
    this.memoryDevice.uploadChargenRom(chargenRomContents);
  }

  async configure(): Promise<void> {
    // Apply configuration if needed
    if (this.dynamicConfig) {
      // Apply dynamic config to devices if necessary
    }
  }

  dispose(): void {
    // Clean up resources if needed
  }

  /**
   * Checks if there is an active IRQ request
   * @returns True if there is an active IRQ request, false otherwise
   */
  isIrqActive(): boolean {
    return (
      this.cia1Device.requestsIrq() ||
      this.cia2Device.requestsIrq() ||
      this.vicDevice.requestsIrq() ||
      this.ioExpansionDevice.requestsIrq()
    );
  }

  /**
   * Checks if there is an active NMI request
   * @returns True if there is an active NMI request, false otherwise
   */
  isNmiActive(): boolean {
    return this.cia2Device.requestsNmi() || this.ioExpansionDevice.requestsNmi();
  }

  getMachineProperty(key: string) {
    return (this as any)[key];
  }

  setMachineProperty(key: string, value?: any): void {
    (this as any)[key] = value;
    this.machinePropertyChanged?.fire({ propertyName: key, newValue: value });
  }

  /**
   * This method tests if the CPU reached the specified termination point.
   * @returns True, if the execution has reached the termination point; otherwise, false.
   *
   * By default, this method checks if the PC equals the execution context's TerminationPoint value.
   */
  testTerminationPoint(): boolean {
    // TODO: Implement this method
    return false;
  }

  /**
   * The machine's execution loop calls this method to check if it can change the clock multiplier.
   * @returns True, if the clock multiplier can be changed; otherwise, false.
   */
  allowCpuClockChange(): boolean {
    return true;
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * previous frame.
   */
  onInitNewFrame(): void {
    // --- Override this method in derived classes.
  }

  /**
   * The machine frame loop invokes this method before executing a CPU instruction.
   */
  beforeInstructionExecuted(): void {
    // --- Override this method in derived classes.
  }

  /**
   * The machine frame loop invokes this method after executing a CPU instruction.
   */
  afterInstructionExecuted(): void {
    // --- Override this method in derived classes.
  }

  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop
   */
  executeMachineFrame(): FrameTerminationMode {
    return this._machineFrameRunner.executeMachineFrame();
  }

  onStop(): void {
    // Called when emulation stops
  }

  get screenWidthInPixels(): number {
    return this.vicDevice.screenWidth;
  }

  get screenHeightInPixels(): number {
    return this.vicDevice.screenLines;
  }

  getPixelBuffer(): Uint32Array {
    return this.vicDevice.getPixelBuffer();
  }

  renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.vicDevice.renderInstantScreen(savedPixelBuffer);
  }

  getBufferStartOffset(): number {
    return 0;
  }

  getKeyCodeSet(): KeyCodeSet {
    return C64KeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return c64KeyMappings;
  }

  setKeyStatus(key: number, isDown: boolean): void {
    this.keyboardDevice.setKeyStatus(key, isDown);
  }

  /**
   * Emulates queued key strokes as if those were pressed by the user
   */
  emulateKeystroke(): void {
    if (this._emulatedKeyStrokes.length === 0) return;

    // --- Check the next keystroke
    const keyStroke = this._emulatedKeyStrokes[0];

    // --- Time has not come
    if (keyStroke.startTact > this.tacts) return;

    if (keyStroke.endTact < this.tacts) {
      // --- End emulation of this very keystroke
      this.keyboardDevice.setKeyStatus(keyStroke.primaryCode, false);
      if (keyStroke.secondaryCode !== undefined) {
        this.keyboardDevice.setKeyStatus(keyStroke.secondaryCode, false);
      }
      if (keyStroke.ternaryCode !== undefined) {
        this.keyboardDevice.setKeyStatus(keyStroke.ternaryCode, false);
      }

      // --- Remove the keystroke from the queue
      this._emulatedKeyStrokes.shift();
      return;
    }

    // --- Emulate this very keystroke, and leave it in the queue
    this.keyboardDevice.setKeyStatus(keyStroke.primaryCode, true);
    if (keyStroke.secondaryCode !== undefined) {
      this.keyboardDevice.setKeyStatus(keyStroke.secondaryCode, true);
    }
    if (keyStroke.ternaryCode !== undefined) {
      this.keyboardDevice.setKeyStatus(keyStroke.ternaryCode, true);
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
    const startTact = this.tacts + frameOffset * this.tactsInFrame * this.clockMultiplier;
    const endTact = startTact + frames * this.tactsInFrame * this.clockMultiplier;
    const keypress = new EmulatedKeyStroke(startTact, endTact, primary, secondary);
    this._emulatedKeyStrokes.push(keypress);
  }

  /**
   * Gets the length of the key emulation queue
   */
  getKeyQueueLength(): number {
    return this._emulatedKeyStrokes.length;
  }

  getCodeInjectionFlow(_model: string): CodeInjectionFlow {
    return [];
  }

  injectCodeToRun(_codeToInject: CodeToInject): number {
    // TODO: Implement code injection logic
    return 0;
  }

  getPartition(_address: number): number | undefined {
    // TODO: Implement partition retrieval logic
    return undefined;
  }

  parsePartitionLabel(_label: string): number | undefined {
    // TODO: Implement partition label parsing logic
    return undefined;
  }

  getPartitionLabels(): Record<number, string> {
    // TODO: Implement partition label retrieval logic
    return {};
  }

  getCallStack(_frames?: number): CallStackInfo {
    return {
      sp: 0,
      frames: []
    };
  }

  async executeCustomCommand(_command: string): Promise<void> {
    // Handle custom commands if needed
  }

  /**
   * Gets the 64KB flat memory representation.
   * @returns A Uint8Array representing the 64KB flat memory
   */
  get64KFlatMemory(): Uint8Array {
    return this.memoryDevice.get64KFlatMemory();
  }

  getMemoryPartition(_index: number): Uint8Array {
    // TODO: Implement memory partition retrieval
    return new Uint8Array(65536);
  }

  getCurrentPartitions(): number[] {
    // TODO: Implement current partition retrieval
    return [];
  }

  getCurrentPartitionLabels(): string[] {
    // TODO: Implement current partition label retrieval
    return [];
  }

  getRomFlags(): boolean[] {
    // TODO: Implement ROM flags retrieval
    return [];
  }

  get isOsInitialized(): boolean {
    // TODO: Implement OS initialization status retrieval
    return false;
  }

  getFrameCommand() {
    return undefined;
  }

  setFrameCommand(_command: any): void {
    // TODO: Implement frame command setting
  }

  async processFrameCommand(_messenger: MessengerBase): Promise<void> {
    // TODO: Implement frame command processing
  }

  setTactsInFrame(tacts: number): void {
    this.tactsInFrame = tacts;
  }

  get tactsInDisplayLine(): number {
    return this.vicDevice.tactsInDisplayLine;
  }

  markStepOutAddress(): void {
    this.stepOutAddress = this.pc;
    this.stepOutStack.push(this.pc);
  }

  async hardReset(): Promise<void> {
    this.reset();
    await this.setup();
  }

  reset(): void {
    // Reset the CPU base class
    super.reset();

    console.log("here");

    // Reset the CPU port first to ensure memory config is correct
    this.cpuPortDevice.reset();

    // Reset memory to establish correct config and memory map
    this.memoryDevice.reset();

    this._machineFrameRunner.reset();

    // Reset all other peripherals
    this.vicDevice.reset();
    this.sidDevice.reset();
    this.keyboardDevice.reset();
    this.cia1Device.reset();
    this.cia2Device.reset();
    this.ioExpansionDevice.reset();
    this.tapeDevice.reset();

    // Reset timing counters
    this.tacts = 0;
    this.frames = 0;
    this.currentFrameTact = 0;
    this._queuedEvents = null;
  }

  beforeOpcodeFetch(): void {
    // Hook before opcode fetch
  }

  afterOpcodeFetch(): void {
    // Hook after opcode fetch
  }

  doReadMemory(address: number): number {
    return this.memoryDevice.readMemory(address);
  }

  doWriteMemory(address: number, value: number): void {
    this.memoryDevice.writeMemory(address, value);
  }

  delayMemoryWrite(_address: number): void {}

  delayAddressBusAccess(_address: number): void {}

  doReadPort(_address: number): number {
    return 0xff;
  }

  delayPortRead(_address: number): void {}

  doWritePort(_address: number, _value: number): void {}

  delayPortWrite(_address: number): void {}

  isCpuSnoozed(): boolean {
    // Return CPU snooze state
    return false;
  }

  awakeCpu(): void {
    // Wake up CPU if snoozed
  }

  snoozeCpu(): void {
    // Snooze CPU
  }

  onSnooze(): void {
    // Called when CPU snoozes
  }

  /**
   * Gets the current CPU state
   */
  getCpuState(): M6510CpuState {
    return {
      a: this.a,
      x: this.x,
      y: this.y,
      p: this.p,
      pc: this.pc,
      sp: this.sp,
      tacts: this.tacts,
      tactsAtLastStart: this.tactsAtLastStart,
      stalled: !!this.stalled,
      jammed: this.jammed,
      nmiRequested: this.nmiRequested,
      irqRequested: this.irqRequested,
      opStartAddress: this.opStartAddress,
      lastMemoryReads: this.lastMemoryReads,
      lastMemoryReadValue: this.lastMemoryReadValue,
      lastMemoryWrites: this.lastMemoryWrites,
      lastMemoryWriteValue: this.lastMemoryWriteValue,
      lastIoReadPort: this.lastIoReadPort,
      lastIoReadValue: this.lastIoReadValue,
      lastIoWritePort: this.lastIoWritePort,
      lastIoWriteValue: this.lastIoWriteValue
    };
  }

  /**
   * Registers and event to execute at the specified tact
   * @param eventTact Tact when the event should be executed
   * @param eventFn Event function with event data passed
   * @param data Data to pass to the event function
   */
  queueEvent(eventTact: number, eventFn: (data: any) => void, data: any): void {
    const newEvent = {
      eventTact,
      eventFn,
      data
    };
    if (!this._queuedEvents) {
      this._queuedEvents = [newEvent];
    } else {
      let idx = 0;
      while (idx < this._queuedEvents.length && this._queuedEvents[idx].eventTact <= eventTact) {
        idx++;
      }
      if (idx >= this._queuedEvents.length) {
        this._queuedEvents.push(newEvent);
      } else {
        this._queuedEvents.splice(idx, 0, newEvent);
      }
    }
  }

  /**
   * Removes the specified event handler from the event queue
   * @param eventFn Event function to remove
   */
  removeEvent(eventFn: (data: any) => void): void {
    if (!this._queuedEvents) return;
    const idx = this._queuedEvents.findIndex((item) => item.eventFn === eventFn);
    if (idx < 0) return;

    // --- Event found, remove it
    this._queuedEvents.splice(idx, 1);
  }

  /**
   * Consumes all events in the queue for the current tact
   */
  consumeEvents(): void {
    if (!this._queuedEvents) return;
    const currentTact = this.tacts;
    while (
      this._queuedEvents &&
      this._queuedEvents.length > 0 &&
      this._queuedEvents[0].eventTact <= currentTact
    ) {
      const currentEvent = this._queuedEvents[0];
      currentEvent.eventFn(currentEvent.data);
      this._queuedEvents.shift();
    }
    if (this._queuedEvents.length === 0) {
      this._queuedEvents = null;
    }
  }

  /**
   * Load the specified ROM
   * @param romName Name of the ROM file to load
   * @param page Optional ROM page for multi-rom machines
   * @returns The byte array that represents the ROM contents
   */
  protected async loadRomFromResource(romName: string, page = -1): Promise<Uint8Array> {
    // --- Obtain the IFileProvider instance
    const fileProvider = this.getMachineProperty(FILE_PROVIDER) as IFileProvider;
    if (!fileProvider) {
      throw new Error("Could not obtain file provider instance");
    }
    const filename = romName.startsWith("/")
      ? romName
      : `roms/${romName}${page === -1 ? "" : "-" + page}.rom`;
    return await fileProvider.readBinaryFile(filename);
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[] {
    return c64SysVars;
  }

  /**
   * Gets a disassembly section of the machine with the specified options.
   * @param _options The options for the disassembly section.
   * @returns The disassembly section.
   */
  getDisassemblySections(options: Record<string, any>): IMemorySection[] {
    const ram = !!options.ram;
    const screen = !!options.screen;
    const sections: IMemorySection[] = [];
    // 0x0000-0x9fff
    if (ram) {
      if (screen) {
        sections.push({
          startAddress: 0x0000,
          endAddress: 0x9fff,
          sectionType: MemorySectionType.Disassemble
        });
      } else {
        // TODO: Use the VIC $d018 to determine where the screen memory is
        sections.push({
          startAddress: 0x0000,
          endAddress: 0x03ff,
          sectionType: MemorySectionType.Disassemble
        });
        sections.push({
          startAddress: 0x0800,
          endAddress: 0x9fff,
          sectionType: MemorySectionType.Disassemble
        });
      }
    }

    // 0xa000-0xbfff
    if (this.memoryDevice.loram || ram) {
      sections.push({
        startAddress: 0xa000,
        endAddress: 0xbfff,
        sectionType: MemorySectionType.Disassemble
      });
    }

    // 0xc000-0xcfff
    if (ram) {
      sections.push({
        startAddress: 0xc000,
        endAddress: 0xcfff,
        sectionType: MemorySectionType.Disassemble
      });
    }

    // 0xd000-0xdfff
    if (!this.memoryDevice.chargen || ram) {
      sections.push({
        startAddress: 0xd000,
        endAddress: 0xdfff,
        sectionType: MemorySectionType.ByteArray
      });
    }

    // 0xe000-0xfff9
    if (this.memoryDevice.hiram || ram) {
      sections.push({
        startAddress: 0xe000,
        endAddress: 0xfff9,
        sectionType: MemorySectionType.Disassemble
      });
    }

    // --- NMI, START, and IRQ vectors
    sections.push({
      startAddress: 0xfffa,
      endAddress: 0xfffb,
      sectionType: MemorySectionType.WordArray
    });
    sections.push({
      startAddress: 0xfffc,
      endAddress: 0xfffd,
      sectionType: MemorySectionType.WordArray
    });
    sections.push({
      startAddress: 0xfffe,
      endAddress: 0xffff,
      sectionType: MemorySectionType.WordArray
    });

    return sections;
  }

  /**
   * Retrieves the current VIC state.
   */
  getVicState(): VicState {
    return this.vicDevice.getVicState();
  }
}
