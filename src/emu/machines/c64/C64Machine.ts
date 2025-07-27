import { CodeToInject } from "@abstractions/CodeToInject";
import { KeyMapping } from "@abstractions/KeyMapping";
import { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { CallStackInfo } from "@emu/abstractions/CallStack";
import { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { ExecutionContext } from "@emu/abstractions/ExecutionContext";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import { MachineEventFn } from "@renderer/abstractions/IMachineEventHandler";
import { C64Cia1Device } from "./C64Cia1Device";
import { C64Cia2Device } from "./C64Cia2Device";
import { C64IoExpansionDevice } from "./C64IoExpansionDevice";
import { C64KeyboardDevice } from "./C64KeyboardDevice";
import { C64MemoryDevice } from "./C64MemoryDevice";
import { C64SidDevice } from "./C64SidDevice";
import { C64VicDevice } from "./C64VicDevice";
import { IC64Machine } from "./IC64Machine";
import { LiteEvent } from "@emu/utils/lite-event";
import { M6510Cpu } from "@emu/m6510/M6510Cpu";
import { C64KeyCode } from "./C64KeyCode";
import { c64KeyMappings } from "./C64KeyMappings";
import { EmulatedKeyStroke } from "@emu/structs/EmulatedKeyStroke";
import { MC_SCREEN_FREQ } from "@common/machines/constants";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FILE_PROVIDER } from "../machine-props";
import { IFileProvider } from "@renderer/core/IFileProvider";
import { M6510CpuState } from "@common/messaging/EmuApi";

export class C64Machine extends M6510Cpu implements IC64Machine {
  private _emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  readonly memory: C64MemoryDevice;
  readonly vicDevice: C64VicDevice;
  readonly sidDevice: C64SidDevice;
  readonly keyboardDevice: C64KeyboardDevice;
  readonly cia1Device: C64Cia1Device;
  readonly cia2Device: C64Cia2Device;
  readonly ioExpansionDevice: C64IoExpansionDevice;

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
  uiFrameFrequency: number;
  frameJustCompleted: boolean;
  lastRenderedFrameTact: number;

  get isNtsc(): boolean {
    return this.modelInfo?.config?.[MC_SCREEN_FREQ] === "ntsc";
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

  constructor(public readonly modelInfo?: MachineModel) {
    super();
    this.baseClockFrequency = this.isNtsc ? 1022727 : 985248;
    this.clockMultiplier = 1;
    this.targetClockMultiplier = 1;

    this.memory = new C64MemoryDevice(this);
    this.vicDevice = new C64VicDevice(
      this,
      this.isNtsc ? C64VicDevice.C64NtscScreenConfiguration : C64VicDevice.C64PalScreenConfiguration
    );
    this.sidDevice = new C64SidDevice(this);
    this.keyboardDevice = new C64KeyboardDevice(this);
    this.cia1Device = new C64Cia1Device(this);
    this.cia2Device = new C64Cia2Device(this);
    this.ioExpansionDevice = new C64IoExpansionDevice(this);
    this.config = {};
  }

  async setup(): Promise<void> {
    this.memory.reset();

    const basicRomContents = await this.loadRomFromResource("c64-basic");
    this.memory.uploadBasicRom(basicRomContents);
    const kernalRomContents = await this.loadRomFromResource(
      `c64-kernal-${this.isNtsc ? "ntsc" : "pal"}`
    );
    this.memory.uploadKernalRom(kernalRomContents);
    const chargenRomContents = await this.loadRomFromResource("c64-chargen");
    this.memory.uploadChargenRom(chargenRomContents);

    this.vicDevice.reset();
    this.sidDevice.reset();
    this.keyboardDevice.reset();
    this.cia1Device.reset();
    this.cia2Device.reset();
    this.ioExpansionDevice.reset();
    this.reset();
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

  getMachineProperty(key: string) {
    return (this as any)[key];
  }

  setMachineProperty(key: string, value?: any): void {
    (this as any)[key] = value;
    this.machinePropertyChanged?.fire({ propertyName: key, newValue: value });
  }

  executeMachineFrame(): FrameTerminationMode {
    // Emulate a single frame
    this.frameJustCompleted = false;
    for (let t = 0; t < this.tactsInFrame; t++) {
      this.executeCpuCycle();
      this.currentFrameTact++;
    }
    this.frames++;
    this.frameJustCompleted = true;
    this.lastRenderedFrameTact = this.currentFrameTact;
    return FrameTerminationMode.Normal;
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

  get64KFlatMemory(): Uint8Array {
    // TODO: Implement 64K flat memory retrieval
    return new Uint8Array(65536);
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
    await this.setup();
  }

  reset(): void {
    this.memory.reset();
    super.reset();
    this.vicDevice.reset();
    this.sidDevice.reset();
    this.keyboardDevice.reset();
    this.cia1Device.reset();
    this.cia2Device.reset();
    this.ioExpansionDevice.reset();
    this.tacts = 0;
    this.frames = 0;
    this.currentFrameTact = 0;
  }

  beforeOpcodeFetch(): void {
    // Hook before opcode fetch
  }

  afterOpcodeFetch(): void {
    // Hook after opcode fetch
  }

  doReadMemory(address: number): number {
    return this.memory.readMemory(address);
  }

  doWriteMemory(address: number, value: number): void {
    this.memory.writeMemory(address, value);
  }

  delayMemoryWrite(_address: number): void {}

  delayAddressBusAccess(_address: number): void {}

  doReadPort(_address: number): number {
    return 0xff;
  }

  delayPortRead(_address: number): void {}

  doWritePort(_address: number, _value: number): void {}

  delayPortWrite(_address: number): void {}

  /**
   * Allow the VIC to render the next screen tact (and stall or release the CPU if needed).
   */
  onTactIncremented(): void {
    this.vicDevice.renderNextTact();
  }

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

  queueEvent(_eventTact: number, _eventFn: MachineEventFn, _data: any): void {
    // Queue an event for a future tact
  }

  removeEvent(_eventFn: MachineEventFn): void {
    // Remove a queued event
  }

  consumeEvents(): void {
    // Consume all queued events for the current tact
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
}
