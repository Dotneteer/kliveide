import { CodeToInject } from "@abstractions/CodeToInject";
import { KeyMapping } from "@abstractions/KeyMapping";
import { MachineConfigSet } from "@common/machines/info-types";
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

export class C64Machine extends M6510Cpu implements IC64Machine {
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
  executionContext: ExecutionContext;

  /**
   * This event fires when the state of a machine property changes.
   */
  machinePropertyChanged? = new LiteEvent<{
    propertyName: string;
    newValue?: any;
  }>();

  targetClockMultiplier: number = 1;
  uiFrameFrequency: number = 50;
  frameJustCompleted: boolean = false;
  lastRenderedFrameTact: number = 0;
  baseClockFrequency: number = 985248; // PAL C64
  clockMultiplier: number = 1;
  tacts: number = 0;
  frames: number = 0;
  frameTacts: number = 0;
  currentFrameTact: number = 0;
  tactsInCurrentFrame: number = 0;
  opCode: number = 0;
  stepOutStack: number[] = [];
  stepOutAddress: number = 0;
  totalContentionDelaySinceStart: number = 0;
  contentionDelaySincePause: number = 0;
  tactsAtLastStart: number = 0;
  opStartAddress: number = 0;
  lastMemoryReads: number[] = [];
  lastMemoryReadValue: number = 0;
  lastMemoryWrites: number[] = [];
  lastMemoryWriteValue: number = 0;
  lastIoReadPort: number = 0;
  lastIoReadValue: number = 0;
  lastIoWritePort: number = 0;
  lastIoWriteValue: number = 0;

  constructor() {
    super();
    this.memory = new C64MemoryDevice(this);
    this.vicDevice = new C64VicDevice(this);
    this.sidDevice = new C64SidDevice(this);
    this.keyboardDevice = new C64KeyboardDevice(this);
    this.cia1Device = new C64Cia1Device(this);
    this.cia2Device = new C64Cia2Device(this);
    this.ioExpansionDevice = new C64IoExpansionDevice(this);
    this.config = {};
  }

  async setup(): Promise<void> {
    this.memory.reset();
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
    return this.vicDevice.screenHeight;
  }

  getAspectRatio?: () => [number, number] = () => [4, 3];

  getPixelBuffer(): Uint32Array {
    return this.vicDevice.getPixelBuffer();
  }

  renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.vicDevice.renderInstantScreen(savedPixelBuffer);
  }

  getBufferStartOffset(): number {
    return this.vicDevice.getBufferStartOffset();
  }

  getKeyCodeSet(): KeyCodeSet {
    return this.keyboardDevice.getKeyCodeSet();
  }

  getDefaultKeyMapping(): KeyMapping {
    return this.keyboardDevice.getDefaultKeyMapping();
  }

  setKeyStatus(key: number, isDown: boolean): void {
    this.keyboardDevice.setKeyStatus(key, isDown);
  }

  emulateKeystroke(): void {
    this.keyboardDevice.emulateKeystroke();
  }

  queueKeystroke(
    frameOffset: number,
    frames: number,
    primary: number,
    secondary?: number,
    ternary?: number
  ): void {
    this.keyboardDevice.queueKeystroke(frameOffset, frames, primary, secondary, ternary);
  }

  getKeyQueueLength(): number {
    return this.keyboardDevice.getKeyQueueLength();
  }

  getCodeInjectionFlow(_model: string): CodeInjectionFlow {
    return [];
  }

  injectCodeToRun(codeToInject: CodeToInject): number {
    // Inject code into memory and return the start address
    return this.memory.injectCode(codeToInject);
  }

  getPartition(address: number): number | undefined {
    return this.memory.getPartition(address);
  }

  parsePartitionLabel(label: string): number | undefined {
    return this.memory.parsePartitionLabel(label);
  }

  getPartitionLabels(): Record<number, string> {
    return this.memory.getPartitionLabels();
  }

  getCallStack(frames?: number): CallStackInfo {
    return this.memory.getCallStack(frames);
  }

  async executeCustomCommand(command: string): Promise<void> {
    // Handle custom commands if needed
  }

  get64KFlatMemory(): Uint8Array {
    return this.memory.get64KFlatMemory();
  }

  getMemoryPartition(index: number): Uint8Array {
    return this.memory.getMemoryPartition(index);
  }

  getCurrentPartitions(): number[] {
    return this.memory.getCurrentPartitions();
  }

  getCurrentPartitionLabels(): string[] {
    return this.memory.getCurrentPartitionLabels();
  }

  getRomFlags(): boolean[] {
    // TODO: Implement ROM flags retrieval
    return [];
  }

  get isOsInitialized(): boolean {
    return this.memory.isOsInitialized();
  }

  getFrameCommand() {
    return this.memory.getFrameCommand();
  }

  setFrameCommand(command: any): void {
    this.memory.setFrameCommand(command);
  }

  async processFrameCommand(messenger: MessengerBase): Promise<void> {
    await this.memory.processFrameCommand(messenger);
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
    this.pc = this.memory.getResetVector();
    this.sp = 0xff;
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.sp = 0xff;
    this.p = 0x34;
    this.memory.reset();
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

  executeCpuCycle(): void {
    // Emulate a single CPU cycle
    // This is a stub; real implementation would fetch, decode, execute
    this.tacts++;
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

  delayMemoryWrite(_address: number): void {
  }

  delayAddressBusAccess(_address: number): void {
  }

  doReadPort(_address: number): number {
    return 0xff;
  }

  delayPortRead(_address: number): void {
  }

  doWritePort(_address: number, value: number): void {
  }

  delayPortWrite(_address: number): void {
  }

  onTactIncremented(increment: number): void {
    // TODO: Implement logic for handling tact increments
    this.currentFrameTact += increment;
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
}
