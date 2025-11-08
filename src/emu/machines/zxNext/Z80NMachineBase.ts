import type { KeyMapping } from "@abstr/KeyMapping";
import type { IFileProvider } from "@abstr/IFileProvider";
import type { ExecutionContext } from "@emuabstr/ExecutionContext";
import type { IZ80Machine } from "@emuabstr/IZ80Machine";
import type { KeyCodeSet } from "@emuabstr/IGenericKeyboardDevice";
import type { MachineConfigSet } from "@common/machines/info-types";

import { DebugStepMode } from "@emuabstr/DebugStepMode";
import { FrameTerminationMode } from "@emuabstr/FrameTerminationMode";
import { OpCodePrefix } from "@emuabstr/OpCodePrefix";
import { TapeMode } from "@emuabstr/TapeMode";
import { LiteEvent } from "@emu/utils/lite-event";
import { FILE_PROVIDER, TAPE_MODE, REWIND_REQUESTED } from "../machine-props";
import { Z80NCpu } from "@emu/z80/Z80NCpu";
import { CallStackInfo } from "@emuabstr/CallStack";
import { MessengerBase } from "@messaging/MessengerBase";
import { SysVar } from "@abstr/SysVar";
import { CpuState } from "@messaging/EmuApi";
import { QueuedEvent } from "@emuabstr/QueuedEvent";
import { CodeToInject } from "@emuabstr/CodeToInject";
import { CodeInjectionFlow } from "@emuabstr/CodeInjectionFlow";
import { IMachineFrameRunner, MachineFrameRunner } from "../MachineFrameRunner";

/**
 * This class is intended to be a reusable base class for emulators using the Z80 CPU.
 */
export abstract class Z80NMachineBase extends Z80NCpu implements IZ80Machine {
  // --- This instance runs the machine frame
  private _machineFrameRunner: IMachineFrameRunner;

  // --- Store machine-specific properties here
  private readonly _machineProps = new Map<string, any>();

  // --- Optional frame command
  private _frameCommand: any;

  // --- Events queued for execution
  protected _queuedEvents?: QueuedEvent[];

  /**
   * Initialize the machine using the specified configuration
   * @param config Machine configuration
   */
  constructor(readonly config: MachineConfigSet = {}) {
    super();
    this._machineFrameRunner = this.createMachineFrameRunner();
  }

  softResetOnFirstStart?: boolean;

  /**
   * The dynamic machine configuration (can be set after the machine is created)
   */
  dynamicConfig?: MachineConfigSet;

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

  /**
   * The unique identifier of the machine type
   */
  abstract readonly machineId: string;

  /**
   * This property stores the execution context where the emulated machine runs its execution loop.
   */
  executionContext: ExecutionContext = {
    frameTerminationMode: FrameTerminationMode.Normal,
    debugStepMode: DebugStepMode.NoDebug,
    canceled: false
  };

  /**
   * Sets up the machine (async)
   */
  abstract setup(): Promise<void>;

  /**
   * Configures the machine after setting it up
   */
  async configure(): Promise<void> {
    // --- Override in derived classes
  }

  /**
   * Dispose the resources held by the machine
   */
  dispose(): void {
    this.machinePropertyChanged?.release();
  }

  /**
   * Gets the current CPU state
   */
  getCpuState(): CpuState {
    return {
      af: this.af,
      bc: this.bc,
      de: this.de,
      hl: this.hl,
      af_: this.af_,
      bc_: this.bc_,
      de_: this.de_,
      hl_: this.hl_,
      pc: this.pc,
      sp: this.sp,
      ix: this.ix,
      iy: this.iy,
      ir: this.ir,
      wz: this.wz,
      tacts: this.tacts,
      tactsAtLastStart: this.tactsAtLastStart,
      interruptMode: this.interruptMode,
      iff1: this.iff1,
      iff2: this.iff2,
      sigINT: this.sigINT,
      halted: this.halted,
      snoozed: this.isCpuSnoozed(),
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
   * Gets the value of the machine property with the specified key
   * @param key Machine property key
   * @returns Value of the property, if found; otherwise, undefined
   */
  getMachineProperty(key: string): any {
    return this._machineProps.get(key);
  }

  /**
   * This event fires when the state of a machine property changes.
   */
  machinePropertyChanged? = new LiteEvent<{
    propertyName: string;
    newValue?: any;
  }>();

  /**
   * Sets the value of the specified machine property
   * @param key Machine property key
   * @param value Machine property value
   */
  setMachineProperty(key: string, value?: any): void {
    if (value === undefined) {
      if (!this._machineProps.get(key)) return;
      this._machineProps.delete(key);
      this.machinePropertyChanged?.fire({ propertyName: key });
    } else {
      const oldValue = this._machineProps.get(key);
      if (oldValue) {
        if (oldValue === value) return;
      }
      this._machineProps.set(key, value);
      this.machinePropertyChanged?.fire({ propertyName: key, newValue: value });
    }
  }

  /**
   * This property gets or sets the value of the target clock multiplier to set when the next machine frame starts.
   *
   * By default, the CPU works with its regular (base) clock frequency; however, you can use an integer clock
   * frequency multiplier to emulate a faster CPU.
   */
  targetClockMultiplier = 1;

  /**
   * This method emulates resetting a machine with a hardware reset button.
   */
  reset(): void {
    super.reset();
    this._machineFrameRunner.reset();
    this._queuedEvents = null;
  }

  /**
   * Stores the last rendered machine frame tact.
   */
  lastRenderedFrameTact: number;

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
   * Load the specified ROM from a file
   * @returns The byte array that represents the ROM contents
   */
  protected async loadRomFromFile(filename: string): Promise<Uint8Array> {
    // --- Obtain the IFileProvider instance
    const fileProvider = this.getMachineProperty(FILE_PROVIDER) as IFileProvider;
    if (!fileProvider) {
      throw new Error("Could not obtain file provider instance");
    }
    return await fileProvider.readBinaryFile(filename);
  }

  /**
   * Sets the number of tacts within a single machine frame
   * @param tacts Tacts to set
   */
  setTactsInFrame(tacts: number): void {
    super.setTactsInFrame(tacts);
    this.tactsInFrame28 = tacts * 8;
  }

  /**
   * Gets the current frame command
   */
  getFrameCommand(): any {
    return this._frameCommand;
  }

  /**
   * Sets a frame command that terminates the current frame for execution.
   * @param command
   */
  setFrameCommand(command: any): void {
    this._frameCommand = command;
  }

  /**
   * Processes the frame command
   */
  abstract processFrameCommand(_messenger: MessengerBase): Promise<void>;

  /**
   * Indicates that the frame has just completed
   */
  get frameJustCompleted(): boolean {
    return this._machineFrameRunner.frameCompleted;
  }

  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop
   */
  executeMachineFrame(): FrameTerminationMode {
    return this._machineFrameRunner.executeMachineFrame();
  }

  /**
   * The number of consequtive frames after which the UI should be refreshed
   */
  readonly uiFrameFrequency: number = 1;

  /**
   * Clean up machine resources on stop
   */
  onStop(): void {
    this.setMachineProperty(TAPE_MODE, TapeMode.Passive);
    this.setMachineProperty(REWIND_REQUESTED);
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  abstract get screenWidthInPixels(): number;

  /**
   * Height of the screen in native machine screen pixels
   */
  abstract get screenHeightInPixels(): number;

  /**
   * Gets the buffer that stores the rendered pixels
   */
  abstract getPixelBuffer(): Uint32Array;

  /**
   * This method renders the entire screen frame as the shadow screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  abstract renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array;

  /*
   * Gets the offset of the pixel buffer in the memory
   */
  getBufferStartOffset(): number {
    return 0;
  }

  /**
   * Gets the key code set used for the machine
   */
  abstract getKeyCodeSet(): KeyCodeSet;

  /**
   * Gets the default key mapping for the machine
   */
  abstract getDefaultKeyMapping(): KeyMapping;

  /**
   * Set the status of the specified ZX Spectrum key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down
   */
  abstract setKeyStatus(key: number, isDown: boolean): void;

  /**
   * Emulates queued key strokes as if those were pressed by the user
   */
  abstract emulateKeystroke(): void;

  /**
   * Adds an emulated keypress to the queue of the provider.
   * @param frameOffset Number of frames to start the keypress emulation
   * @param frames Number of frames to hold the emulation
   * @param primary Primary key code
   * @param secondary Optional secondary key code
   *
   * The keyboard provider can play back emulated key strokes
   */
  abstract queueKeystroke(
    frameOffset: number,
    frames: number,
    primary: number,
    secondary?: number,
    ternary?: number
  ): void;

  /**
   * Gets the main execution point information of the machine
   * @param model Machine model to use for code execution
   */
  abstract getCodeInjectionFlow(model: string): CodeInjectionFlow;

  /**
   * Gets the length of the key emulation queue
   */
  abstract getKeyQueueLength(): number;

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   */
  abstract injectCodeToRun(codeToInject: CodeToInject): number;

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  abstract get64KFlatMemory(): Uint8Array;

  /**
   * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
   * @param index Partition index
   *
   * Less than zero: ROM pages
   * 0..7: RAM bank with the specified index
   */
  abstract getMemoryPartition(index: number): Uint8Array;

  /**
   * Gets the current partition values for all 16K/8K partitions
   */
  abstract getCurrentPartitions(): number[];

  /**
   * Gets the current partition labels for all 16K/8K partitions
   */
  abstract getCurrentPartitionLabels(): string[];

  /**
   * Gets the selected ROM page number
   */
  abstract getSelectedRomPage(): number;

  /**
   * Gets the selected RAM bank number
   */
  abstract getSelectedRamBank(): number;

  /**
   * Gets a flag for each 8K page that indicates if the page is a ROM
   */
  abstract getRomFlags(): boolean[];

  /**
   * Indicates if the machine's operating system is initialized
   */
  abstract get isOsInitialized(): boolean;

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
    const idx = this._queuedEvents.findIndex(item => item.eventFn === eventFn);
    if (idx < 0) return;

    // --- Event found, remove it
    this._queuedEvents.splice(idx, 1);
  }

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
   * Gets the partition in which the specified address is paged in
   * @param _address Address to get the partition for
   */
  abstract getPartition(_address: number): number | undefined;

  /**
   * Parses a partition label to get the partition number
   * @param label Label to parse
   */
  abstract parsePartitionLabel(label: string): number | undefined;

  /**
   * Gets the label of the specified partition
   * @param partition Partition index
   */
  abstract getPartitionLabels(): Record<number, string>;

  /**
   * Gets the current call stack information
   */
  abstract getCallStack(frames): CallStackInfo;

  /**
   * Returns disassembly sections for the machine (required by IAnyMachine)
   */
  abstract getDisassemblySections(_options: Record<string, any>): any[];

  /**
   * Executes the specified custom command
   * @param _command Command to execute
   */
  async executeCustomCommand(_command: string): Promise<void> {
    // --- Override in derived classes
  }

  /**
   * This method tests if the CPU reached the specified termination point.
   * @returns True, if the execution has reached the termination point; otherwise, false.
   *
   * By default, this method checks if the PC equals the execution context's TerminationPoint value.
   */
  testTerminationPoint(): boolean {
    return (
      this.executionContext.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint &&
      this.pc === this.executionContext.terminationPoint
    );
  }

  /**
   * The machine's execution loop calls this method to check if it can change the clock multiplier.
   * @returns True, if the clock multiplier can be changed; otherwise, false.
   */
  allowCpuClockChange(): boolean {
    return false;
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * @param _clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the
   * previous frame.
   */
  onInitNewFrame(_clockMultiplierChanged?: boolean): void {
    // --- Override this method in derived classes.
  }

  /**
   * Tests if the machine should raise a Z80 maskable interrupt
   */
  protected abstract shouldRaiseInterrupt(): boolean;

  /**
   * Checks if the CPU is currently executing an instruction.
   * @return True if an instruction is being executed; otherwise false.
   */
  instructionExecutionInProgress(): boolean {
    return this.prefix !== OpCodePrefix.None;
  }

  /**
   * The machine frame loop invokes this method before executing a CPU instruction.
   */
  beforeInstructionExecuted(): void {
    // --- Set the interrupt signal, if required so
    this.sigINT = this.shouldRaiseInterrupt();
  }

  /**
   * The machine frame loop invokes this method after executing a CPU instruction.
   */
  afterInstructionExecuted(): void {
    // --- Override this method in derived classes.
  }

  /**
   * Checks if the next instruction to be executed is a call instruction or not
   * @return 0, if the next instruction is not a call; otherwise the length of the call instruction
   */
  getCallInstructionLength(): number {
    // --- We intentionally avoid using ReadMemory() directly
    // --- So that we can prevent false memory touching.
    var opCode = this.doReadMemory(this.pc);

    // --- CALL instruction
    if (opCode == 0xcd) return 3;

    // --- Call instruction with condition
    if ((opCode & 0xc7) == 0xc4) return 3;

    // --- Check for RST instructions
    if ((opCode & 0xc7) == 0xc7) {
      return opCode === 0xdf || opCode === 0xef ? 3 : 1;
    }

    // --- Check for HALT instruction
    if (opCode == 0x76) return 1;

    // --- Check for extended instruction prefix
    if (opCode != 0xed) return 0;

    // --- Check for I/O and block transfer instructions
    opCode = this.doReadMemory(this.pc + 1);
    if ((opCode & 0xb4) === 0xb0) {
      return 2;
    }
    if (extendedInstructionLenghts[opCode] !== undefined) {
      return extendedInstructionLenghts[opCode];
    }
    return 0;
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[] {
    return [];
  }
}

const extendedInstructionLenghts: Record<number, number> = {
  0xa4: 2,
  0xa5: 2,
  0xb4: 2,
  0xac: 2,
  0xbc: 2,
  0xb7: 2,
  0x90: 2,
  0x30: 2,
  0x31: 2,
  0x32: 2,
  0x33: 2,
  0x34: 4,
  0x35: 4,
  0x36: 4,
  0x23: 2,
  0x24: 2,
  0x8a: 4,
  0x91: 4,
  0x92: 4,
  0x93: 2,
  0x94: 2,
  0x95: 2,
  0x27: 3,
  0x28: 2,
  0x29: 2,
  0x2a: 2,
  0x2b: 2,
  0x2c: 2,
  0x98: 2
};
