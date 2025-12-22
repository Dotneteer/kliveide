/**
 * This interface represents the behavior and state of a generic CPU that is available
 * from outside by other components.
 */
export interface IAnyCpu {
  /**
   * The Program Counter register
   */
  pc: number;

  /**
   * The Stack Pointer register
   */
  sp: number;

  /**
   * Get the base clock frequency of the CPU. We use this value to calculate the machine frame rate.
   */
  baseClockFrequency: number;

  /**
   * This property gets or sets the value of the current clock multiplier.
   *
   * By default, the CPU works with its regular (base) clock frequency; however, you can use an integer clock
   * frequency multiplier to emulate a faster CPU.
   */
  clockMultiplier: number;

  /**
   * Indicates if the current frame has been completed
   */
  frameCompleted: boolean;

  /**
   * The number of T-states (clock cycles) elapsed since the last reset
   */
  readonly tacts: number;

  /**
   * Sets the value of tacts explicitly
   * @param value The value to set
   */
  setTacts(value: number): void;

  /**
   * Show the number of machine frames completed since the CPU started.
   */
  readonly frames: number;

  /**
   * The number of T-states within the current frame
   */
  readonly frameTacts: number;

  /**
   * Get the current frame tact within the machine frame being executed.
   */
  readonly currentFrameTact: number;

  /**
   * Get the number of T-states in a machine frame with clock multiplier of 1
   */
  readonly tactsInFrame: number;

  /**
   * Get the number of T-states in the current machine frame, which have a higher
   * clock multiplier than 1.
   */
  tactsInCurrentFrame: number;

  /**
   * Sets the number of tacts within a single machine frame
   * @param tacts Tacts to set
   */
  setTactsInFrame(tacts: number): void;

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine(): number;

  /**
   * The last fetched opcode. If an instruction is prefixed, it contains the prefix or the opcode following the
   * prefix, depending on which was fetched last.
   */
  opCode: number;

  /**
   * We keep subroutine return addresses in this stack to implement the step-over debugger function
   */
  stepOutStack: number[];

  /**
   * We store the step out address in this variable to implement the step-out debugger function
   */
  stepOutAddress: number;

  /**
   * Invoke this method to mark the current depth of the call stack when the step-out operation starts.
   */
  markStepOutAddress(): void;

  /**
   * Accumulates the total contention value since the last start
   */
  totalContentionDelaySinceStart: number;

  /**
   * Accumulates the contention since the last pause
   */
  contentionDelaySincePause: number;

  /**
   * Number of clock cycles at the last machine frame cycle start
   */
  tactsAtLastStart: number;

  /**
   * The start address of the operation being executed;
   */
  opStartAddress: number;

  /**
   * The memory addresses of the last memory read operations
   */
  lastMemoryReads: number[];

  /**
   * The last value read from memory
   */
  lastMemoryReadValue: number;

  /**
   * The memory addresses of the last memory write operations
   */
  lastMemoryWrites: number[];

  /**
   * The last value written to memory
   */
  lastMemoryWriteValue: number;

  /**
   * The port address of the last I/O read operation
   */
  lastIoReadPort: number;

  /**
   * The last value read from the I/O port
   */
  lastIoReadValue: number;

  /**
   * The port address of the last I/O write operation
   */
  lastIoWritePort: number;

  /**
   * The last value written to the I/O port
   */
  lastIoWriteValue: number;

  /**
   * Executes a hard reset as if the machine and the CPU had just been turned on.
   */
  hardReset(): void | Promise<void>;

  /**
   * Handles the active RESET signal of the CPU.
   */
  reset(): void;

  /**
   * Call this method to execute a CPU instruction cycle.
   */
  executeCpuCycle(): void;

  /**
   * Execute this method before fetching the opcode of the next instruction
   */
  beforeOpcodeFetch(): void;

  /**
   * Execute this method after fetching the opcode of the next instruction
   */
  afterOpcodeFetch(): void;

  /**
   * Read the byte at the specified memory address.
   * @param address 16-bit memory address
   * @return The byte read from the memory
   */
  doReadMemory(address: number): number;

  /**
   * This function implements the memory read delay of the CPU.
   * @param address Memory address to read
   */
  delayMemoryRead(address: number): void;

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory(address: number, value: number): void;

  /**
   * This function implements the memory write delay of the CPU.
   * @param address Memory address to write
   */
  delayMemoryWrite(address: number): void;

  /**
   * This function handles address-based memory read contention.
   * @param address Address to use for contention delay calculation
   */
  delayAddressBusAccess(address: number): void;

  /**
   * This function reads a byte (8-bit) from an I/O port using the provided 16-bit address.
   * @param address 16-bit port address to read
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port read operation.
   */
  doReadPort(address: number): number;

  /**
   * This function implements the I/O port read delay of the CPU.
   * @param address 16-bit port address
   */
  delayPortRead(address: number): void;

  /**
   * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
   * @param address 16-bit port address to write
   * @param value The value to write to the specified port
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port write operation.
   */
  doWritePort(address: number, value: number): void;

  /**
   * This function implements the I/O port write delay of the CPU.
   * @param address 16-bit port address
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortWrite(address: number): void;

  /**
   * Optional method that can be invoked before the tact counter is implemented.
   * @returns
   */
  beforeTactIncremented?: () => void;

  /**
   * Every time the CPU clock is incremented with a single T-state, this function is executed.
   * @param increment The tact increment value
   * With this function, you can emulate hardware activities running simultaneously with the CPU. For example,
   * rendering the screen or sound,  handling peripheral devices, and so on.
   */
  onTactIncremented?: (increment?: number) => void;

  /**
   * Indicates if the CPU is currently snoozed
   */
  isCpuSnoozed(): boolean;

  /**
   * Awakes the CPU from the snoozed state
   */
  awakeCpu(): void;

  /**
   * Puts the CPU into snoozed state
   */
  snoozeCpu(): void;

  /**
   * Define what to do when CPU is snoozed. You should increment the tacts emulating the snoozing.
   */
  onSnooze(): void;

  /**
   * We need this flag to implement the step-over debugger function that continues the execution and stops when the
   * current subroutine returns to its caller. The debugger will observe the change of this flag and manage its
   * internal tracking of the call stack accordingly.
   */
  retExecuted: boolean;

  /**
   * Checks if the next instruction to be executed is a call instruction or not
   * @return 0, if the next instruction is not a call; otherwise the length of the call instruction
   */
  getCallInstructionLength(): number

  /**
   * Checks if the CPU is currently executing an instruction.
   * @return True if an instruction is being executed; otherwise false.
   */
  instructionExecutionInProgress(): boolean;
}
